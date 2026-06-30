import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { tursoDb } from '$lib/server/db/turso';
import { turso_passages, turso_sentences, turso_works } from '$lib/server/db/tursoSchema';
import { db } from '$lib/server/db';
import { tp_sentences, tp_passages, config } from '$lib/server/db/schema';
import { eq, like, desc, or, and, inArray, gt } from 'drizzle-orm';
import { generateTTS } from '$lib/server/tts';
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

	const baseWhere = and(
		eq(turso_passages.content_type, 'body'),
		or(
			gt(turso_sentences.word_count, 1),
			gt(turso_sentences.char_count, 2)
		),
		selectedWorkId ? eq(turso_sentences.work_id, selectedWorkId) : undefined
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

	if (searchQuery) {
		sentenceRows = await baseQuery
			.where(and(
				baseWhere,
				like(turso_sentences.text, `%${searchQuery}%`)
			))
			.orderBy(desc(turso_sentences.id))
			.limit(1000);
	} else {
		sentenceRows = await baseQuery
			.where(baseWhere)
			.orderBy(desc(turso_sentences.id))
			.limit(1000);
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
		works,
		selectedWorkId,
		searchQuery,
		ttsFilter,
		ttsBaseUrl,
		savedLang: savedConfigLang[0]?.value || 'en-US',
		savedVoice: savedConfigVoice[0]?.value || 'en-US-Neural2-F'
	};
}) satisfies PageServerLoad;

/** 배치 크기 (SQLite 변수 제한 999 미만) */
const BATCH_SIZE = 500;

async function importBatch<T extends { id: number }>(
	items: T[],
	table: any,
	enrichFn?: (item: T) => Record<string, unknown>
): Promise<number> {
	let imported = 0;
	for (let i = 0; i < items.length; i += BATCH_SIZE) {
		const batch = items.slice(i, i + BATCH_SIZE);
		const batchIds = batch.map(item => item.id);

		// 배치 단위로 이미 존재하는 ID 조회
		const existing = await db
			.select({ id: table.id })
			.from(table)
			.where(inArray(table.id, batchIds));

		const existingIds = new Set(existing.map((r: { id: number }) => r.id));
		const newItems = batch.filter(item => !existingIds.has(item.id));

		if (newItems.length > 0) {
			const values = enrichFn ? newItems.map(enrichFn) : newItems;
			await db.insert(table).values(values as any);
			imported += newItems.length;
		}
	}
	return imported;
}

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
			const [record] = await db
				.select({ text: tp_sentences.text, file_tts: tp_sentences.file_tts, lang: tp_sentences.lang })
				.from(tp_sentences)
				.where(eq(tp_sentences.id, sentenceId))
				.limit(1);

			if (!record) {
				return fail(404, { error: '문장을 찾을 수 없습니다.' });
			}

			// 기존 MP3 파일 삭제
			if (record.file_tts && record.file_tts.trim()) {
				const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
				const ttsDirFull = path.resolve(process.cwd(), ttsDir);
				const filePath = path.join(ttsDirFull, record.file_tts);
				try {
					if (fs.existsSync(filePath)) {
						fs.unlinkSync(filePath);
					}
				} catch (e) {
					console.error('Failed to delete MP3 file:', filePath, e);
				}
			}

			const filename = `${sentenceId}.mp3`;
			const ttsResult = await generateTTS({
				text: record.text,
				languageCode: lang || record.lang,
				voiceName: voice,
				speakingRate: speed,
				filename
			});

			await db
				.update(tp_sentences)
				.set({ file_tts: filename, voice, speed: String(speed), lang: lang || record.lang })
				.where(eq(tp_sentences.id, sentenceId));

			// TTS 설정 저장 (TTS_Lang, TTS_Voice)
			await db
				.insert(config)
				.values({ key: 'TTS_Lang', value: lang || record.lang })
				.onConflictDoUpdate({
					target: config.key,
					set: { value: lang || record.lang }
				});

			await db
				.insert(config)
				.values({ key: 'TTS_Voice', value: voice })
				.onConflictDoUpdate({
					target: config.key,
					set: { value: voice }
				});

			return { success: true, file_tts: filename };
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
		const idsStr = String(formData.get('ids') || '');
		const voice = String(formData.get('voice') ?? '').trim();
		const speed = Number(formData.get('speed') ?? 1.0);
		const lang = String(formData.get('lang') ?? '').trim();

		const ids = idsStr.split(',').map(Number).filter(Boolean);

		if (ids.length === 0) {
			return fail(400, { error: '생성할 문장이 없습니다.' });
		}

		// 이미 생성된 문장 필터링
		const existingRecords = await db
			.select({ id: tp_sentences.id, file_tts: tp_sentences.file_tts })
			.from(tp_sentences)
			.where(inArray(tp_sentences.id, ids));

		const existingTtsIds = new Set(
			existingRecords.filter(r => r.file_tts && r.file_tts.trim()).map(r => r.id)
		);
		const ungeneratedIds = ids.filter(id => !existingTtsIds.has(id));

		if (ungeneratedIds.length === 0) {
			return fail(400, { error: '모든 문장의 TTS가 이미 생성되었습니다.' });
		}

		const records = await db
			.select({
				id: tp_sentences.id,
				text: tp_sentences.text,
				file_tts: tp_sentences.file_tts,
				lang: tp_sentences.lang
			})
			.from(tp_sentences)
			.where(inArray(tp_sentences.id, ungeneratedIds));

		const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
		const ttsDirFull = path.resolve(process.cwd(), ttsDir);
		let successCount = 0;
		let errorCount = 0;
		const errors: string[] = [];

		for (const [index, record] of records.entries()) {
			// 3초 간격 (첫 번째는 대기 없음)
			if (index > 0) {
				await new Promise(resolve => setTimeout(resolve, 3000));
			}

			try {
				// 기존 MP3 파일 삭제
				if (record.file_tts && record.file_tts.trim()) {
					const filePath = path.join(ttsDirFull, record.file_tts);
					try {
						if (fs.existsSync(filePath)) {
							fs.unlinkSync(filePath);
						}
					} catch (e) {
						console.error('Failed to delete MP3 file:', filePath, e);
					}
				}

				const recFilename = `${record.id}.mp3`;
				const ttsResult = await generateTTS({
					text: record.text,
					languageCode: lang || record.lang,
					voiceName: voice,
					speakingRate: speed,
					filename: recFilename
				});

				await db
					.update(tp_sentences)
					.set({ file_tts: recFilename, voice, speed: String(speed), lang: lang || record.lang })
					.where(eq(tp_sentences.id, record.id));

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

		return { success: true, successCount, errorCount };
	},
	importFromTurso: async ({ locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized: Admin access required' });
		}

		try {
			// 1. Turso passages → local tp_passages
			const allPassages = await tursoDb.select().from(turso_passages);
			const passageImported = allPassages.length > 0
				? await importBatch(allPassages, tp_passages)
				: 0;

			// 2. Turso sentences → local tp_sentences
			const allSentences = await tursoDb.select().from(turso_sentences);
			const sentenceImported = allSentences.length > 0
				? await importBatch(allSentences, tp_sentences, (s: any) => ({
					...s,
					lang: 'en-US',
					voice: '',
					speed: '1.0',
					file_tts: ''
				}))
				: 0;

			return {
				success: true,
				passageImported,
				sentenceImported,
				passageSkipped: allPassages.length - passageImported,
				sentenceSkipped: allSentences.length - sentenceImported
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Turso 가져오기 중 오류가 발생했습니다.';
			console.error('importFromTurso error:', err);
			return fail(500, { error: message });
		}
	}
} satisfies Actions;
