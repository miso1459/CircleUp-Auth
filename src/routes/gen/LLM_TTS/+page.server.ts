import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sentences } from '$lib/server/db/schema';
import { eq, like, desc, or, and, isNotNull, ne, isNull } from 'drizzle-orm';
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
	process: async () => {
		return fail(500, { error: 'Not implemented' });
	}
} satisfies Actions;
