import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sentences, sentences_tran, config } from '$lib/server/db/schema';
import { eq, like, desc, or, and, isNotNull, ne, isNull, inArray, notInArray } from 'drizzle-orm';
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

	// config에서 저장된 번역 언어 조회
	const savedConfigTransLang = await db
		.select()
		.from(config)
		.where(eq(config.key, 'Trans_lang'))
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

	// 각 문장에 대한 번역 데이터 조회
	const sentenceIds = sentenceRows.map(s => s.id);
	const translations = sentenceIds.length > 0
		? await db
			.select()
			.from(sentences_tran)
			.where(inArray(sentences_tran.id, sentenceIds))
		: [];

	// 문장별 번역 데이터 매핑
	const translationMap = new Map(translations.map(t => [t.id, t]));
	const sentencesWithTrans = sentenceRows.map(s => ({
		...s,
		tran: translationMap.get(s.id)?.sent || null,
		tranLang: translationMap.get(s.id)?.lang || null
	}));

	return {
		geminiConfigured: Boolean(env.GEMINI_API_KEY),
		sentences: sentencesWithTrans,
		searchQuery,
		ttsFilter,
		ttsBaseUrl,
		savedLang: savedConfigLang[0]?.value || 'en-US',
		savedVoice: savedConfigVoice[0]?.value || 'en-US-Neural2-F',
		savedTransLang: savedConfigTransLang[0]?.value || 'EN'
	};
}) satisfies PageServerLoad;

export const actions = {
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
	},
	translateAll: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const targetLang = String(formData.get('targetLang') ?? 'EN').trim();

		// 미번역 문장 조회
		const notTranslatedIds = await db
			.select({ id: sentences.id, sent: sentences.sent, lang: sentences.lang })
			.from(sentences)
			.where(
				notInArray(sentences.id,
					db.select({ id: sentences_tran.id }).from(sentences_tran)
				)
			)
			.orderBy(desc(sentences.id))
			.limit(100);

		if (notTranslatedIds.length === 0) {
			return fail(400, { error: '미번역 문장이 없습니다.' });
		}

		const apiKey = env.DEEPL_API_KEY;
		if (!apiKey) {
			return fail(500, { error: 'DEEPL_API_KEY 미설정' });
		}

		const isFreeKey = apiKey.endsWith(':fx');
		const url = isFreeKey
			? 'https://api-free.deepl.com/v2/translate'
			: 'https://api.deepl.com/v2/translate';

		let successCount = 0;
		let failCount = 0;
		const errors: string[] = [];

		for (const record of notTranslatedIds) {
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
					throw new Error(`DeepL API 오류: ${response.status}`);
				}

				const data = await response.json();
				const translatedText = data.translations[0].text;

				await db
					.insert(sentences_tran)
					.values({
						id: record.id,
						lang: targetLang,
						sent: translatedText
					})
					.onConflictDoUpdate({
						target: [sentences_tran.id],
						set: { lang: targetLang, sent: translatedText }
					});

				successCount++;
			} catch (err) {
				failCount++;
				const message = err instanceof Error ? err.message : '알 수 없는 오류';
				errors.push(`ID ${record.id}: ${message}`);
			}
		}

		// config에 Trans_lang 저장
		await db
			.insert(config)
			.values({ key: 'Trans_lang', value: targetLang })
			.onConflictDoUpdate({
				target: [config.key],
				set: { value: targetLang }
			});

		return {
			success: true,
			successCount,
			failCount,
			errors: errors.length > 0 ? errors.join('\n') : null
		};
	}
} satisfies Actions;
