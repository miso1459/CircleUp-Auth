import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { transformSentencesWithPrompt, generateSentencesFromPrompt } from '$lib/server/gemini';
import { db } from '$lib/server/db';
import { config, sentences, dicWord } from '$lib/server/db/schema';
import { eq, inArray, like, desc } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals, url, depends }) => {
	depends('app:dicword');

	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	// config에서 저장된 프롬프트 조회
	const savedConfigPrompt = await db
		.select()
		.from(config)
		.where(eq(config.key, 'LLM_SentToSent'))
		.limit(1);

	// URL 검색 파라미터 처리
	const searchQuery = url.searchParams.get('search') || '';

	// dic_word 테이블 조회 (생성일 역순, 최대 100개)
	let wordRows;
	if (searchQuery) {
		wordRows = await db
			.select({
				word: dicWord.word,
				mp3_url: dicWord.mp3_url,
				core_meaning: dicWord.core_meaning,
				ipa: dicWord.ipa,
				pos: dicWord.pos,
				level: dicWord.level,
				frequency: dicWord.frequency,
				check_core: dicWord.check_core,
				createdAt: dicWord.createdAt
			})
			.from(dicWord)
			.where(like(dicWord.word, `%${searchQuery}%`))
			.orderBy(desc(dicWord.createdAt))
			.limit(100);
	} else {
		wordRows = await db
			.select({
				word: dicWord.word,
				mp3_url: dicWord.mp3_url,
				core_meaning: dicWord.core_meaning,
				ipa: dicWord.ipa,
				pos: dicWord.pos,
				level: dicWord.level,
				frequency: dicWord.frequency,
				check_core: dicWord.check_core,
				createdAt: dicWord.createdAt
			})
			.from(dicWord)
			.orderBy(desc(dicWord.createdAt))
			.limit(100);
	}

	return {
		geminiConfigured: Boolean(env.GEMINI_API_KEY),
		savedPrompt: savedConfigPrompt[0]?.value || '',
		dicWords: wordRows,
		searchQuery
	};
}) satisfies PageServerLoad;

export const actions = {
	process: async ({ request }) => {
		const formData = await request.formData();
		const prompt = String(formData.get('prompt') ?? '').trim();
		const sentence = String(formData.get('sentence') ?? '').trim();

		if (!prompt) {
			return fail(400, { error: '프롬프트를 입력해 주세요.' });
		}
		if (!env.GEMINI_API_KEY) {
			return fail(500, { error: 'GEMINI_API_KEY 환경 변수를 설정해 주세요.' });
		}

		try {
			// 1. config 테이블에 프롬프트 저장 (없으면 추가, 있으면 업데이트)
			await db
				.insert(config)
				.values({ key: 'LLM_SentToSent', value: prompt })
				.onConflictDoUpdate({
					target: config.key,
					set: { value: prompt }
				});

			await db
				.insert(config)
				.values({ key: 'dic_word', value: prompt })
				.onConflictDoUpdate({
					target: config.key,
					set: { value: prompt }
				});

			// 2. 입력 단어 리스트 추출
			const sentencesList = sentence
				.split('\n')
				.map(s => s.trim())
				.filter(Boolean);

			// 3. dicWord 테이블에 단어 저장 (mp3_url은 dictionaryapi에서 추출)
			let dicInserted = 0;
			let dicSkipped = 0;

			if (sentencesList.length > 0) {
				// 기존 단어 조회 (중복 제외)
				const existingWords = await db
					.select({ word: dicWord.word })
					.from(dicWord)
					.where(inArray(dicWord.word, sentencesList));

				const existingSet = new Set(existingWords.map(r => r.word));
				const newWords = sentencesList.filter(w => !existingSet.has(w));

				dicSkipped = sentencesList.length - newWords.length;

				if (newWords.length > 0) {
					const insertData: typeof dicWord.$inferInsert[] = [];

					for (const w of newWords) {
						let mp3_url = '';
						try {
							const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
							if (res.ok) {
								const json = await res.json();
								// phonetics 배열에서 첫 번째 유효한 audio 추출
								const phonetics = json[0]?.phonetics ?? [];
								for (const p of phonetics) {
									if (p.audio?.trim()) {
										mp3_url = p.audio.trim();
										break;
									}
								}
							}
						} catch {
							// dictionary API 실패 시 mp3_url 빈 값
						}

						insertData.push({
							word: w,
							mp3_url,
							core_meaning: '',
							ipa: '',
							pos: '',
							level: '',
							frequency: '',
							senses: '[]',
							phrasal_verbs: '[]',
							check_core: 0
						});
					}

					if (insertData.length > 0) {
						await db.insert(dicWord).values(insertData);
						dicInserted = insertData.length;
					}
				}
			}

			// 4. Gemini API 호출하여 입력 단어들을 프롬프트에 따라 변환
			const generatedRows = sentencesList.length > 0
				? await transformSentencesWithPrompt(sentencesList, prompt)
				: await generateSentencesFromPrompt(prompt);

			if (generatedRows.length === 0) {
				return fail(500, { error: '생성된 단어가 없습니다.' });
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

				// 4. 중복 제외된 새 단어들만 DB sentences 테이블에 저장
				if (newStatements.length > 0) {
					const insertData = newStatements.map((sent) => ({
						lang: 'en-US',
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
				duplicateCount,
				savedPrompt: prompt,
				dicInserted,
				dicSkipped
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'LLM 처리 중 오류가 발생했습니다.';
			return fail(500, { error: message });
		}
	}
} satisfies Actions;
