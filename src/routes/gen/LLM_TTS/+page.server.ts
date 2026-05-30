import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sentences } from '$lib/server/db/schema';
import { eq, like, desc, or, and, isNotNull, ne, isNull } from 'drizzle-orm';
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
	const ttsBaseUrl = env.TTS_BASE_URL || process.env.TTS_BASE_URL || 'http://localhost:5173/TTS';

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
		ttsBaseUrl
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

			return { success: true };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'TTS 생성 중 오류가 발생했습니다.';
			return fail(500, { error: message });
		}
	}
} satisfies Actions;
