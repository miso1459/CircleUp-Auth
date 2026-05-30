import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sentences } from '$lib/server/db/schema';
import { eq, like, desc, and } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals, url, depends }) => {
	depends('app:sentences');

	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	const searchQuery = url.searchParams.get('search') || '';
	const imgFilter = url.searchParams.get('imgFilter') || 'all';
	const imgBaseUrl = (env.IMG_BASE_URL || process.env.IMG_BASE_URL || 'http://localhost:5173/IMG_files').replace(/\/+$/, '');

	let sentenceRows;

	if (imgFilter === 'checked') {
		sentenceRows = await db
			.select({
				id: sentences.id,
				lang: sentences.lang,
				voice: sentences.voice,
				speed: sentences.speed,
				sent: sentences.sent,
				createdAt: sentences.createdAt,
				file_tts: sentences.file_tts,
				file_image: sentences.file_image,
				check_img: sentences.check_img
			})
			.from(sentences)
			.where(and(
				like(sentences.sent, `%${searchQuery}%`),
				eq(sentences.check_img, 1)
			))
			.orderBy(desc(sentences.id))
			.limit(100);
	} else if (imgFilter === 'unchecked') {
		sentenceRows = await db
			.select({
				id: sentences.id,
				lang: sentences.lang,
				voice: sentences.voice,
				speed: sentences.speed,
				sent: sentences.sent,
				createdAt: sentences.createdAt,
				file_tts: sentences.file_tts,
				file_image: sentences.file_image,
				check_img: sentences.check_img
			})
			.from(sentences)
			.where(and(
				like(sentences.sent, `%${searchQuery}%`),
				eq(sentences.check_img, 0)
			))
			.orderBy(desc(sentences.id))
			.limit(100);
	} else {
		// all
		sentenceRows = await db
			.select({
				id: sentences.id,
				lang: sentences.lang,
				voice: sentences.voice,
				speed: sentences.speed,
				sent: sentences.sent,
				createdAt: sentences.createdAt,
				file_tts: sentences.file_tts,
				file_image: sentences.file_image,
				check_img: sentences.check_img
			})
			.from(sentences)
			.where(like(sentences.sent, `%${searchQuery}%`))
			.orderBy(desc(sentences.id))
			.limit(100);
	}

	return {
		sentences: sentenceRows,
		searchQuery,
		imgFilter,
		imgBaseUrl
	};
}) satisfies PageServerLoad;

export const actions = {
	toggleCheckImg: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const checkImg = Number(formData.get('check_img'));

		if (!id) {
			return fail(400, { error: 'ID가 필요합니다.' });
		}

		await db
			.update(sentences)
			.set({ check_img: checkImg })
			.where(eq(sentences.id, id));

		return { success: true };
	}
} satisfies Actions;
