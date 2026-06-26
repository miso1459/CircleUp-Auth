import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { tp_sentences, tp_passages, config } from '$lib/server/db/schema';
import { eq, like, desc, or, and, isNotNull, ne, isNull, inArray, gt } from 'drizzle-orm';
import { generateTTS } from '$lib/server/tts';
import fs from 'fs';
import path from 'path';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals, url, depends }) => {
	const baseWhere = and(
		eq(tp_passages.content_type, 'body'),
		or(
			gt(tp_sentences.word_count, 1),
			gt(tp_sentences.char_count, 2)
		)
	);
	depends('app:sentences');

	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	const searchQuery = url.searchParams.get('search') || '';
	const ttsFilter = url.searchParams.get('ttsFilter') || 'not_generated';
	const ttsBaseUrl = env.TTS_BASE_URL || process.env.TTS_BASE_URL || 'http://localhost:5173/TTS';

	// config에서 저장된 TTS 언어 및 음성 모델 조회
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

	const selectCols = {
		id: tp_sentences.id,
		lang: tp_sentences.lang,
		voice: tp_sentences.voice,
		speed: tp_sentences.speed,
		sent: tp_sentences.text,
		createdAt: tp_sentences.created_at,
		file_tts: tp_sentences.file_tts
	} as const;

	let sentenceRows;

	const baseQuery = db
		.select(selectCols)
		.from(tp_sentences)
		.innerJoin(tp_passages, eq(tp_sentences.passage_id, tp_passages.id));

	if (ttsFilter === 'all') {
		if (searchQuery) {
			sentenceRows = await baseQuery
				.where(and(
					baseWhere,
					like(tp_sentences.text, `%${searchQuery}%`)
				))
				.orderBy(desc(tp_sentences.id))
				.limit(1000);
		} else {
			sentenceRows = await baseQuery
				.where(baseWhere)
				.orderBy(desc(tp_sentences.id))
				.limit(1000);
		}
	} else if (ttsFilter === 'generated') {
		sentenceRows = await baseQuery
			.where(and(
				baseWhere,
				like(tp_sentences.text, `%${searchQuery}%`),
				isNotNull(tp_sentences.file_tts),
				ne(tp_sentences.file_tts, '')
			))
			.orderBy(desc(tp_sentences.id))
			.limit(1000);
	} else {
		// not_generated (default)
		sentenceRows = await baseQuery
			.where(and(
				baseWhere,
				like(tp_sentences.text, `%${searchQuery}%`),
				or(
					isNull(tp_sentences.file_tts),
					eq(tp_sentences.file_tts, '')
				)
			))
			.orderBy(desc(tp_sentences.id))
			.limit(1000);
	}

	const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
	const ttsDirFull = path.resolve(process.cwd(), ttsDir);

	return {
		geminiConfigured: Boolean(env.GEMINI_API_KEY),
		sentences: sentenceRows.map(s => ({
			...s,
			hasMp3: s.file_tts ? fs.existsSync(path.join(ttsDirFull, s.file_tts)) : false
		})),
		searchQuery,
		ttsFilter,
		ttsBaseUrl,
		savedLang: savedConfigLang[0]?.value || 'en-US',
		savedVoice: savedConfigVoice[0]?.value || 'en-US-Neural2-F'
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
	}
} satisfies Actions;
