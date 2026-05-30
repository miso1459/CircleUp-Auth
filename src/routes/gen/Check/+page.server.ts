import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sentences, sentences_tran, config } from '$lib/server/db/schema';
import { eq, like, desc, and, inArray } from 'drizzle-orm';
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

	// 각 문장에 대한 번역 데이터 조회
	const sentenceIds = sentenceRows.map(s => s.id);
	const translations = sentenceIds.length > 0
		? await db
			.select()
			.from(sentences_tran)
			.where(inArray(sentences_tran.id, sentenceIds))
		: [];

	// config에서 저장된 번역 언어 조회
	const savedConfigTransLang = await db
		.select()
		.from(config)
		.where(eq(config.key, 'Trans_lang'))
		.limit(1);

	// 문장별 번역 데이터 매핑
	const translationMap = new Map(translations.map(t => [t.id, t]));
	const sentencesWithTrans = sentenceRows.map(s => ({
		...s,
		tran: translationMap.get(s.id)?.sent || null,
		tranLang: translationMap.get(s.id)?.lang || null
	}));

	return {
		sentences: sentencesWithTrans,
		searchQuery,
		imgFilter,
		imgBaseUrl,
		savedTransLang: savedConfigTransLang[0]?.value || 'EN'
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
	},
	translate: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const sentenceId = Number(formData.get('sentenceId'));
		const targetLang = String(formData.get('targetLang') ?? 'EN').trim();

		if (!sentenceId) {
			return fail(400, { error: '문장을 선택해 주세요.' });
		}

		// 문장 조회
		const [record] = await db
			.select({ sent: sentences.sent, lang: sentences.lang })
			.from(sentences)
			.where(eq(sentences.id, sentenceId))
			.limit(1);

		if (!record) {
			return fail(404, { error: '문장을 찾을 수 없습니다.' });
		}

		// DeepL API 호출
		const apiKey = env.DEEPL_API_KEY;
		if (!apiKey) {
			return fail(500, { error: 'DEEPL_API_KEY 미설정' });
		}

		const isFreeKey = apiKey.endsWith(':fx');
		const url = isFreeKey
			? 'https://api-free.deepl.com/v2/translate'
			: 'https://api.deepl.com/v2/translate';

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Authorization': `DeepL-Auth-Key ${apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					text: [record.sent],
					target_lang: targetLang
				})
			});

			if (!response.ok) {
				const errText = await response.text();
				return fail(500, { error: `DeepL API 오류: ${response.status}` });
			}

			const data = await response.json();
			const translatedText = data.translations[0].text;

			// sentences_tran에 저장 (upsert)
			await db
				.insert(sentences_tran)
				.values({
					id: sentenceId,
					lang: targetLang,
					sent: translatedText
				})
				.onConflictDoUpdate({
					target: [sentences_tran.id],
					set: { lang: targetLang, sent: translatedText }
				});

			// config에 Trans_lang 저장
			await db
				.insert(config)
				.values({ key: 'Trans_lang', value: targetLang })
				.onConflictDoUpdate({
					target: [config.key],
					set: { value: targetLang }
				});

			return { success: true };
		} catch (err) {
			const message = err instanceof Error ? err.message : '번역 중 오류 발생';
			return fail(500, { error: message });
		}
	}
} satisfies Actions;
