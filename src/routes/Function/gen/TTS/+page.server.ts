import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sentences } from '$lib/server/db/schema';
import { eq, like, desc, or, and, isNotNull, ne, isNull, inArray } from 'drizzle-orm';
import { generateTTS } from '$lib/server/tts';
import { config } from '$lib/server/db/schema';
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

	let sentenceRows;

	if (ttsFilter === 'all') {
		if (searchQuery) {
			sentenceRows = await db
				.select({
					id: sentences.id,
					lang: sentences.lang,
					voice: sentences.voice,
					speed: sentences.speed,
					sent: sentences.sent,
					createdAt: sentences.createdAt,
					file_tts: sentences.file_tts
				})
				.from(sentences)
				.where(like(sentences.sent, `%${searchQuery}%`))
				.orderBy(desc(sentences.id))
				.limit(100);
		} else {
			sentenceRows = await db
				.select({
					id: sentences.id,
					lang: sentences.lang,
					voice: sentences.voice,
					speed: sentences.speed,
					sent: sentences.sent,
					createdAt: sentences.createdAt,
					file_tts: sentences.file_tts
				})
				.from(sentences)
				.orderBy(desc(sentences.id))
				.limit(100);
		}
	} else if (ttsFilter === 'generated') {
		sentenceRows = await db
			.select({
				id: sentences.id,
				lang: sentences.lang,
				voice: sentences.voice,
				speed: sentences.speed,
				sent: sentences.sent,
				createdAt: sentences.createdAt,
				file_tts: sentences.file_tts
			})
			.from(sentences)
			.where(and(
				like(sentences.sent, `%${searchQuery}%`),
				isNotNull(sentences.file_tts),
				ne(sentences.file_tts, '')
			))
			.orderBy(desc(sentences.id))
			.limit(100);
	} else {
		// not_generated (default)
		sentenceRows = await db
			.select({
				id: sentences.id,
				lang: sentences.lang,
				voice: sentences.voice,
				speed: sentences.speed,
				sent: sentences.sent,
				createdAt: sentences.createdAt,
				file_tts: sentences.file_tts
			})
			.from(sentences)
			.where(and(
				like(sentences.sent, `%${searchQuery}%`),
				or(
					isNull(sentences.file_tts),
					eq(sentences.file_tts, '')
				)
			))
			.orderBy(desc(sentences.id))
			.limit(100);
	}

	return {
		geminiConfigured: Boolean(env.GEMINI_API_KEY),
		sentences: sentenceRows,
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
				.select({ sent: sentences.sent, file_tts: sentences.file_tts, lang: sentences.lang })
				.from(sentences)
				.where(eq(sentences.id, sentenceId))
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

			const ttsResult = await generateTTS({
				text: record.sent,
				languageCode: lang || record.lang,
				voiceName: voice,
				speakingRate: speed
			});

			await db
				.update(sentences)
				.set({ file_tts: ttsResult.filename, voice, speed: String(speed), lang: lang || record.lang })
				.where(eq(sentences.id, sentenceId));

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

			return { success: true, file_tts: ttsResult.filename };
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
			.select({ id: sentences.id, file_tts: sentences.file_tts })
			.from(sentences)
			.where(inArray(sentences.id, ids));

		const existingTtsIds = new Set(
			existingRecords.filter(r => r.file_tts && r.file_tts.trim()).map(r => r.id)
		);
		const ungeneratedIds = ids.filter(id => !existingTtsIds.has(id));

		if (ungeneratedIds.length === 0) {
			return fail(400, { error: '모든 문장의 TTS가 이미 생성되었습니다.' });
		}

		const records = await db
			.select({
				id: sentences.id,
				sent: sentences.sent,
				file_tts: sentences.file_tts,
				lang: sentences.lang
			})
			.from(sentences)
			.where(inArray(sentences.id, ungeneratedIds));

		const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
		const ttsDirFull = path.resolve(process.cwd(), ttsDir);
		let successCount = 0;
		let errorCount = 0;
		const errors: string[] = [];

		for (const record of records) {
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

				const ttsResult = await generateTTS({
					text: record.sent,
					languageCode: lang || record.lang,
					voiceName: voice,
					speakingRate: speed
				});

				await db
					.update(sentences)
					.set({ file_tts: ttsResult.filename, voice, speed: String(speed), lang: lang || record.lang })
					.where(eq(sentences.id, record.id));

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
