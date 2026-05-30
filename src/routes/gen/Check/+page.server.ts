import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sentences } from '$lib/server/db/schema';
import { eq, like, desc, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals, url, depends }) => {
	depends('app:sentences');

	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	const searchQuery = url.searchParams.get('search') || '';
	const imgFilter = url.searchParams.get('imgFilter') || 'unchecked';
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
	},
	deleteImage: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const id = Number(formData.get('id'));

		if (!id) {
			return fail(400, { error: 'ID가 필요합니다.' });
		}

		// 이미지 파일 삭제를 위해 file_image 조회
		const [record] = await db
			.select({ file_image: sentences.file_image })
			.from(sentences)
			.where(eq(sentences.id, id))
			.limit(1);

		if (record?.file_image && record.file_image.trim()) {
			const imgDir = env.IMG_DIR || process.env.IMG_DIR || 'static/IMG';
			const imgDirFull = path.resolve(process.cwd(), imgDir);
			const imgFilePath = path.join(imgDirFull, record.file_image);
			try {
				if (fs.existsSync(imgFilePath)) {
					fs.unlinkSync(imgFilePath);
				}
			} catch (e) {
				console.error('Failed to delete image file:', imgFilePath, e);
			}
		}

		// sentences 테이블의 file_image를 빈값으로 변경
		await db
			.update(sentences)
			.set({ file_image: '' })
			.where(eq(sentences.id, id));

		return { success: true };
	}
} satisfies Actions;
