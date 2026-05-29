import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { transformSentencesWithPrompt } from '$lib/server/gemini';
import { db } from '$lib/server/db';
import { config, sentences } from '$lib/server/db/schema';
import { eq, inArray, like, desc } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const LANG_INSTRUCTION: Record<string, string> = {
	'en-US': '\n\n[Important] All generated sentences must be written in English (en-US) only.',
	'ko-KR': '\n\n[중요] 생성되는 모든 문장은 반드시 한국어(ko-KR)로 작성해주세요.'
};

export const load = (async ({ locals, url, depends }) => {
	depends('app:sentences');

	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	// config에서 저장된 프롬프트와 언어 조회
	const savedConfigPrompt = await db
		.select()
		.from(config)
		.where(eq(config.key, 'LLM_SentToSent'))
		.limit(1);

	const savedConfigLang = await db
		.select()
		.from(config)
		.where(eq(config.key, 'LLM_Sent_Lang'))
		.limit(1);

	// URL 검색 파라미터 처리
	const searchQuery = url.searchParams.get('search') || '';

	// sentences 테이블 조회 (ID 역순, 최대 100개)
	let sentenceRows;
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

	return {
		geminiConfigured: Boolean(env.GEMINI_API_KEY),
		savedPrompt: savedConfigPrompt[0]?.value || '',
		savedLang: savedConfigLang[0]?.value || 'en',
		sentences: sentenceRows,
		searchQuery
	};
}) satisfies PageServerLoad;

export const actions = {
	process: async ({ request }) => {
		const formData = await request.formData();
		const prompt = String(formData.get('prompt') ?? '').trim();
		const lang = String(formData.get('lang') ?? 'en').trim();
		const sentence = String(formData.get('sentence') ?? '').trim();

		if (!prompt) {
			return fail(400, { error: '프롬프트를 입력해 주세요.' });
		}
		if (!lang) {
			return fail(400, { error: '언어 코드를 입력해 주세요.' });
		}
		if (!sentence) {
			return fail(400, { error: '변환할 문장을 입력해 주세요.' });
		}
		if (!env.GEMINI_API_KEY) {
			return fail(500, { error: 'GEMINI_API_KEY 환경 변수를 설정해 주세요.' });
		}

		try {
			// 1. config 테이블에 프롬프트 및 언어 저장 (없으면 추가, 있으면 업데이트)
			await db
				.insert(config)
				.values({ key: 'LLM_SentToSent', value: prompt })
				.onConflictDoUpdate({
					target: config.key,
					set: { value: prompt }
				});

			await db
				.insert(config)
				.values({ key: 'LLM_Sent_Lang', value: lang })
				.onConflictDoUpdate({
					target: config.key,
					set: { value: lang }
				});

			// 2. Gemini API 호출하여 입력 문장을 프롬프트에 따라 변환
			// 언어 지시문을 프롬프트에 추가하여 대상 언어로 결과가 생성되도록 함
			const langInstruction = LANG_INSTRUCTION[lang] || '';
			const generatedRows = await transformSentencesWithPrompt([sentence], prompt + langInstruction);

			if (generatedRows.length === 0) {
				return fail(500, { error: '생성된 문장이 없습니다.' });
			}

			const statements = generatedRows.map(row => row.statement.trim()).filter(Boolean);

			let newStatements: string[] = [];
			let duplicateCount = 0;

			if (statements.length > 0) {
				// 3. 중복 제외 로직
				const existing = await db
					.select({ sent: sentences.sent })
					.from(sentences)
					.where(inArray(sentences.sent, statements));

				const existingSet = new Set(existing.map(r => r.sent.trim()));
				newStatements = statements.filter(s => !existingSet.has(s));
				duplicateCount = statements.length - newStatements.length;

				// 4. 중복 제외된 새 문장들만 DB sentences 테이블에 저장
				if (newStatements.length > 0) {
					const insertData = newStatements.map((sent) => ({
						lang,
						sent,
						voice: '',
						speed: '1.0',
						tag: '',
						file_tts: '',
						file_image: '',
						createdAt: new Date()
					}));

					await db.insert(sentences).values(insertData);
				}
			}

			return {
				success: true,
				rows: generatedRows,
				insertedCount: newStatements.length,
				duplicateCount
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'LLM 처리 중 오류가 발생했습니다.';
			return fail(500, { error: message });
		}
	}
} satisfies Actions;
