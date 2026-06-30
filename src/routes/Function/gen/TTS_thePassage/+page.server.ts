import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { tursoDb } from '$lib/server/db/turso';
import { turso_passages, turso_sentences, turso_works } from '$lib/server/db/tursoSchema';
import { db } from '$lib/server/db';
import { config } from '$lib/server/db/schema';
import { eq, ne, like, desc, or, and, inArray, gt, isNull, count } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { generateTTS } from '$lib/server/tts';
import { uploadAllFilesToR2 } from '$lib/server/r2';
import fs from 'fs';
import path from 'path';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals, url, depends }) => {
	depends('app:sentences');

	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	const searchQuery = url.searchParams.get('search') || '';
	const ttsFilter = url.searchParams.get('ttsFilter') || 'not_generated';
	const workIdParam = url.searchParams.get('workId');
	const selectedWorkId = workIdParam ? Number(workIdParam) : null;
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const pageSize = Math.min(200, Math.max(10, Number(url.searchParams.get('pageSize')) || 50));
	const ttsBaseUrl = env.TTS_BASE_URL || process.env.TTS_BASE_URL || 'http://localhost:5173/TTS';

	// config에서 저장된 TTS 언어 및 음성 모델 조회 (로컬 DB)
	const savedConfigLang = await db
		.select()
		.from(config)
		.where(eq(config.key, 'TTS_Lang'))
		.limit(1);

	const savedConfigVoice = await db
		.select()
		.from(config)
		.where(eq(config.key, 'TTS_Voice'))
		.limit(1);

	// Turso에서 works 목록 조회
	const works = await tursoDb
		.select({ id: turso_works.id, title: turso_works.title })
		.from(turso_works)
		.orderBy(turso_works.id);

	// work_id별 전체 문장 수 및 MP3 생성된 문장 수 조회 (리스트와 동일 조건 적용)
	const sentenceCounts = await tursoDb
		.select({
			work_id: turso_sentences.work_id,
			total: count(turso_sentences.id),
			mp3Count: sql<number>`COALESCE(SUM(CASE WHEN ${turso_sentences.audio_file} = 1 THEN 1 ELSE 0 END), 0)`
		})
		.from(turso_sentences)
		.innerJoin(turso_passages, eq(turso_sentences.passage_id, turso_passages.id))
		.where(
			and(
				eq(turso_passages.content_type, 'body'),
				or(
					gt(turso_sentences.word_count, 1),
					gt(turso_sentences.char_count, 2)
				)
			)
		)
		.groupBy(turso_sentences.work_id);

	const countMap = new Map(sentenceCounts.map(c => [c.work_id, { total: c.total, mp3Count: c.mp3Count }]));

	const worksWithCounts = works.map(w => ({
		id: w.id,
		title: w.title,
		totalCount: countMap.get(w.id)?.total ?? 0,
		mp3Count: countMap.get(w.id)?.mp3Count ?? 0
	}));

	// ttsFilter에 따라 audio_file 조건 추가
	let audioFileCondition;
	if (ttsFilter === 'generated') {
		audioFileCondition = eq(turso_sentences.audio_file, 1);
	} else if (ttsFilter === 'not_generated') {
		audioFileCondition = or(
			ne(turso_sentences.audio_file, 1),
			isNull(turso_sentences.audio_file)
		);
	} // 'all' → 조건 없음

	const baseWhere = and(
		eq(turso_passages.content_type, 'body'),
		or(
			gt(turso_sentences.word_count, 1),
			gt(turso_sentences.char_count, 2)
		),
		selectedWorkId ? eq(turso_sentences.work_id, selectedWorkId) : undefined,
		audioFileCondition
	);

	const selectCols = {
		id: turso_sentences.id,
		sent: turso_sentences.text,
		createdAt: turso_sentences.created_at
	} as const;

	let sentenceRows;

	const baseQuery = tursoDb
		.select(selectCols)
		.from(turso_sentences)
		.innerJoin(turso_passages, eq(turso_sentences.passage_id, turso_passages.id));

	// 전체 건수 조회 (동일 조건)
	const countQuery = tursoDb
		.select({ total: count() })
		.from(turso_sentences)
		.innerJoin(turso_passages, eq(turso_sentences.passage_id, turso_passages.id));

	let totalCount: number;
	if (searchQuery) {
		const [result] = await countQuery
			.where(and(baseWhere, like(turso_sentences.text, `%${searchQuery}%`)));
		totalCount = Number(result?.total ?? 0);
	} else {
		const [result] = await countQuery.where(baseWhere);
		totalCount = Number(result?.total ?? 0);
	}
	const totalPages = Math.ceil(totalCount / pageSize);

	if (searchQuery) {
		sentenceRows = await baseQuery
			.where(and(baseWhere, like(turso_sentences.text, `%${searchQuery}%`)))
			.orderBy(desc(turso_sentences.id))
			.limit(pageSize)
			.offset((page - 1) * pageSize);
	} else {
		sentenceRows = await baseQuery
			.where(baseWhere)
			.orderBy(desc(turso_sentences.id))
			.limit(pageSize)
			.offset((page - 1) * pageSize);
	}

	return {
		geminiConfigured: Boolean(env.GEMINI_API_KEY),
		sentences: sentenceRows.map(s => ({
			id: s.id,
			lang: 'en-US',
			voice: '',
			speed: '1.0',
			sent: s.sent,
			createdAt: s.createdAt,
			file_tts: '',
			hasMp3: false
		})),
		works: worksWithCounts,
		selectedWorkId,
		searchQuery,
		ttsFilter,
		ttsBaseUrl,
		savedLang: savedConfigLang[0]?.value || 'en-US',
		savedVoice: savedConfigVoice[0]?.value || 'en-US-Neural2-F',
		totalCount,
		totalPages,
		page,
		pageSize
	};
}) satisfies PageServerLoad;
export const actions = {
	process: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized: Admin access required' });
		}

		const formData = await request.formData();
		const sentenceId = Number(formData.get('sentenceId'));
		const voice = String(formData.get('voice') ?? '').trim();
		const speed = Number(formData.get('speed') ?? 1.0);
		const lang = String(formData.get('lang') ?? '').trim();

		if (!sentenceId) {
			return fail(400, { error: '문장을 선택해 주세요.' });
		}

		try {
			const [record] = await tursoDb
				.select({ text: turso_sentences.text, work_id: turso_sentences.work_id, audio_file_path: turso_sentences.audio_file_path })
				.from(turso_sentences)
				.where(eq(turso_sentences.id, sentenceId))
				.limit(1);

			if (!record) {
				return fail(404, { error: '문장을 찾을 수 없습니다.' });
			}

			const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
			const ttsDirFull = path.resolve(process.cwd(), ttsDir);

			// 기존 MP3 파일 삭제
			if (record.audio_file_path) {
				const filePath = path.join(ttsDirFull, record.audio_file_path);
				try {
					if (fs.existsSync(filePath)) {
						fs.unlinkSync(filePath);
					}
				} catch (e) {
					console.error('Failed to delete MP3 file:', filePath, e);
				}
			}

			const workId = record.work_id ?? 0;
			const workDir = path.join(ttsDirFull, String(workId));
			if (!fs.existsSync(workDir)) {
				fs.mkdirSync(workDir, { recursive: true });
			}

			const audioPath = `${workId}/${sentenceId}.mp3`;
			const ttsResult = await generateTTS({
				text: record.text,
				languageCode: lang,
				voiceName: voice,
				speakingRate: speed,
				filename: audioPath
			});

			await tursoDb
				.update(turso_sentences)
				.set({ audio_file: 1, audio_file_path: audioPath })
				.where(eq(turso_sentences.id, sentenceId));

			// TTS 설정 저장 (TTS_Lang, TTS_Voice)
			await db
				.insert(config)
				.values({ key: 'TTS_Lang', value: lang })
				.onConflictDoUpdate({
					target: config.key,
					set: { value: lang }
				});

			await db
				.insert(config)
				.values({ key: 'TTS_Voice', value: voice })
				.onConflictDoUpdate({
					target: config.key,
					set: { value: voice }
				});

			return { success: true, file_tts: audioPath };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'TTS 생성 중 오류가 발생했습니다.';
			return fail(500, { error: message });
		}
	},
	processAll: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized: Admin access required' });
		}

		const formData = await request.formData();
		const voice = String(formData.get('voice') ?? '').trim();
		const speed = Number(formData.get('speed') ?? 1.0);
		const lang = String(formData.get('lang') ?? '').trim();

		// 필터 파라미터로 전체 대상 조회
		const ttsFilter = String(formData.get('ttsFilter') || 'all');
		const workIdParam = String(formData.get('workId') || '');
		const selectedWorkId = workIdParam ? Number(workIdParam) : null;
		const searchQuery = String(formData.get('searchQuery') || '');

		let audioFileCondition;
		if (ttsFilter === 'generated') {
			audioFileCondition = eq(turso_sentences.audio_file, 1);
		} else if (ttsFilter === 'not_generated') {
			audioFileCondition = or(ne(turso_sentences.audio_file, 1), isNull(turso_sentences.audio_file));
		}

		const where = and(
			eq(turso_passages.content_type, 'body'),
			or(gt(turso_sentences.word_count, 1), gt(turso_sentences.char_count, 2)),
			selectedWorkId ? eq(turso_sentences.work_id, selectedWorkId) : undefined,
			audioFileCondition,
			searchQuery ? like(turso_sentences.text, `%${searchQuery}%`) : undefined
		);

		const matchingRecords = await tursoDb
			.select({ id: turso_sentences.id })
			.from(turso_sentences)
			.innerJoin(turso_passages, eq(turso_sentences.passage_id, turso_passages.id))
			.where(where);

		const allIds = matchingRecords.map(r => r.id);

		if (allIds.length === 0) {
			return fail(400, { error: '처리할 문장이 없습니다.' });
		}

		// 이미 생성된 문장 제외 (audio_file=1인 경우)
		const existingRecords = await tursoDb
			.select({ id: turso_sentences.id, audio_file: turso_sentences.audio_file })
			.from(turso_sentences)
			.where(inArray(turso_sentences.id, allIds));

		const existingTtsIds = new Set(
			existingRecords.filter(r => r.audio_file === 1).map(r => r.id)
		);
		const ungeneratedIds = allIds.filter(id => !existingTtsIds.has(id));

		if (ungeneratedIds.length === 0) {
			return fail(400, { error: '모든 문장의 TTS가 이미 생성되었습니다.' });
		}

		const records = await tursoDb
			.select({
				id: turso_sentences.id,
				text: turso_sentences.text,
				work_id: turso_sentences.work_id
			})
			.from(turso_sentences)
			.where(inArray(turso_sentences.id, ungeneratedIds));

		const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
		const ttsDirFull = path.resolve(process.cwd(), ttsDir);

		// 1회 스캔: TTS_files 디렉토리의 모든 MP3 파일 절대경로를 Set에 수집
		const existingMp3 = new Set<string>();
		(function scan(dir: string) {
			try {
				const entries = fs.readdirSync(dir, { withFileTypes: true });
				for (const entry of entries) {
					const fp = path.join(dir, entry.name);
					if (entry.isDirectory()) {
						scan(fp);
					} else if (entry.isFile() && entry.name.endsWith('.mp3')) {
						existingMp3.add(fp);
					}
				}
			} catch { /* 디렉토리 없으면 무시 */ }
		})(ttsDirFull);

		// records 분류: 이미 파일 있음 → skip, 루트에만 있음 → 이동 + skip, 새로 생성
		const toSkip: { id: number; audioPath: string }[] = [];
		const toGenerate: typeof records = [];

		for (const record of records) {
			const workId = record.work_id ?? 0;
			const workDir = path.join(ttsDirFull, String(workId));
			const targetFile = path.join(workDir, `${record.id}.mp3`);
			const audioPath = `${workId}/${record.id}.mp3`;

			// Set.has()는 O(1) → fs.existsSync 대체
			if (existingMp3.has(targetFile)) {
				toSkip.push({ id: record.id, audioPath });
				continue;
			}

			// 루트에 파일이 있으면 이동
			const rootFile = path.join(ttsDirFull, `${record.id}.mp3`);
			if (existingMp3.has(rootFile)) {
				if (!fs.existsSync(workDir)) {
					fs.mkdirSync(workDir, { recursive: true });
				}
				fs.renameSync(rootFile, targetFile);
				existingMp3.add(targetFile); // Set 갱신
				toSkip.push({ id: record.id, audioPath });
				continue;
			}

			toGenerate.push(record);
		}

		// Skip 대상 DB 업데이트 (병렬 한 번에)
		let skippedCount = 0;
		if (toSkip.length > 0) {
			await Promise.all(
				toSkip.map(s =>
					tursoDb.update(turso_sentences)
						.set({ audio_file: 1, audio_file_path: s.audioPath })
						.where(eq(turso_sentences.id, s.id))
				)
			);
			skippedCount = toSkip.length;
		}

		// 실제 TTS 생성 (순차 + 3초 간격)
		let successCount = 0;
		let errorCount = 0;
		const errors: string[] = [];

		for (let i = 0; i < toGenerate.length; i++) {
			const record = toGenerate[i];
			const workId = record.work_id ?? 0;
			const workDir = path.join(ttsDirFull, String(workId));
			const audioPath = `${workId}/${record.id}.mp3`;

			// 3초 간격 (첫 번째는 대기 없음)
			if (i > 0) {
				await new Promise(resolve => setTimeout(resolve, 3000));
			}

			try {
				if (!fs.existsSync(workDir)) {
					fs.mkdirSync(workDir, { recursive: true });
				}

				await tursoDb
					.update(turso_sentences)
					.set({ audio_file: 1, audio_file_path: audioPath })
					.where(eq(turso_sentences.id, record.id));

				successCount++;
			} catch (err) {
				const message = err instanceof Error ? err.message : 'TTS 생성 중 오류가 발생했습니다.';
				errors.push(`ID ${record.id}: ${message}`);
				errorCount++;
			}
		}

		// TTS 설정 저장
		await db
			.insert(config)
			.values({ key: 'TTS_Lang', value: lang })
			.onConflictDoUpdate({
				target: config.key,
				set: { value: lang }
			});

		await db
			.insert(config)
			.values({ key: 'TTS_Voice', value: voice })
			.onConflictDoUpdate({
				target: config.key,
				set: { value: voice }
			});

		return { success: true, successCount, skippedCount, errorCount };
	},
	organizeMp3: async ({ locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized: Admin access required' });
		}

		try {
			const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
			const ttsDirFull = path.resolve(process.cwd(), ttsDir);

			// 루트 디렉토리의 MP3 파일만 수집 (하위 디렉토리는 제외)
			const rootFiles = fs.readdirSync(ttsDirFull).filter(f => f.endsWith('.mp3'));

			if (rootFiles.length === 0) {
				return fail(400, { error: '정리할 MP3 파일이 루트에 없습니다.' });
			}

			// 파일명에서 ID 추출
			const ids: number[] = [];
			for (const f of rootFiles) {
				const id = parseInt(f.replace('.mp3', ''), 10);
				if (!isNaN(id)) ids.push(id);
			}

			if (ids.length === 0) {
				return fail(400, { error: 'ID를 추출할 수 있는 MP3 파일이 없습니다.' });
			}

			// turso_sentences에서 work_id 조회
			const sentenceRecords = await tursoDb
				.select({ id: turso_sentences.id, work_id: turso_sentences.work_id })
				.from(turso_sentences)
				.where(inArray(turso_sentences.id, ids));

			const recordMap = new Map(sentenceRecords.map(r => [r.id, r.work_id]));

			// 처리할 작업 목록 작성
			const tasks: { id: number; targetDir: string; audioPath: string }[] = [];
			let skippedCount = 0;

			for (const id of ids) {
				const workId = recordMap.get(id);
				if (!workId) {
					skippedCount++;
					continue;
				}
				const workDir = path.join(ttsDirFull, String(workId));
				const targetFile = path.join(workDir, `${id}.mp3`);
				// 이미 work_id 폴더에 파일이 있으면 건너뛰기
				if (fs.existsSync(targetFile)) {
					skippedCount++;
					continue;
				}
				tasks.push({
					id,
					audioPath: `${workId}/${id}.mp3`,
					targetDir: workDir
				});
			}

			if (tasks.length === 0) {
				return { success: true, copiedCount: 0, skippedCount, errorCount: 0, total: ids.length };
			}

			// 1. 모든 필요한 디렉토리 한 번에 생성
			const uniqueDirs = [...new Set(tasks.map(t => t.targetDir))];
			for (const dir of uniqueDirs) {
				if (!fs.existsSync(dir)) {
					fs.mkdirSync(dir, { recursive: true });
				}
			}

			// 2. 파일 이동 병렬 실행
			const fsp = fs.promises;
			const moveResults = await Promise.allSettled(
				tasks.map(t => fsp.rename(
					path.join(ttsDirFull, `${t.id}.mp3`),
					path.join(t.targetDir, `${t.id}.mp3`)
				))
			);

			const succeeded: { id: number; audioPath: string }[] = [];
			let moveErrorCount = 0;
			for (let i = 0; i < moveResults.length; i++) {
				if (moveResults[i].status === 'fulfilled') {
					succeeded.push({ id: tasks[i].id, audioPath: tasks[i].audioPath });
				} else {
					moveErrorCount++;
				}
			}

			// 3. Turso DB 업데이트 (모든 성공한 파일)
			await Promise.all(
				succeeded.map(s =>
					tursoDb.update(turso_sentences)
						.set({ audio_file: 1, audio_file_path: s.audioPath })
						.where(eq(turso_sentences.id, s.id))
				)
			);

			const totalError = moveErrorCount;

			return {
				success: true,
				copiedCount: succeeded.length,
				skippedCount,
				errorCount: totalError,
				total: ids.length
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'MP3 정리 중 오류가 발생했습니다.';
			console.error('organizeMp3 error:', err);
			return fail(500, { error: message });
		}
	},
	uploadToR2: async ({ locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized: Admin access required' });
		}

		try {
			const result = await uploadAllFilesToR2();

			return {
				success: true,
				uploadedCount: result.uploaded.length,
				skippedCount: result.skipped.length,
				errorCount: result.errors.length,
				total: result.uploaded.length + result.skipped.length + result.errors.length
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'R2 업로드 중 오류가 발생했습니다.';
			console.error('uploadToR2 error:', err);
			return fail(500, { error: message });
		}
	},
} satisfies Actions;
