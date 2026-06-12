import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { generateWordInfo } from '$lib/server/gemini';
import { db } from '$lib/server/db';
import { config, dicWord } from '$lib/server/db/schema';
import { eq, like, desc } from 'drizzle-orm';
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
		.where(eq(config.key, 'dic_word'))
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
				senses: dicWord.senses,
				phrasal_verbs: dicWord.phrasal_verbs,
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
				senses: dicWord.senses,
				phrasal_verbs: dicWord.phrasal_verbs,
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
			// 1. config 테이블에 프롬프트 저장
			await db
				.insert(config)
				.values({ key: 'dic_word', value: prompt })
				.onConflictDoUpdate({
					target: config.key,
					set: { value: prompt }
				});

			// 2. 입력 단어 리스트 추출 (빈값 제외)
			const wordList = sentence
				.split('\n')
				.map((s) => s.trim())
				.filter(Boolean);

			if (wordList.length === 0) {
				return fail(400, { error: '처리할 단어가 없습니다.' });
			}

			// 3. 기존 단어 조회
			const existingRows = await db
				.select({ word: dicWord.word })
				.from(dicWord);

			const existingSet = new Set(existingRows.map((r) => r.word));

			let dicInserted = 0;
			let dicUpdated = 0;
			const dicResults: { word: string; core_meaning: string; isNew: boolean }[] = [];

			const now = new Date();

			for (const w of wordList) {
				const isNew = !existingSet.has(w);

				// mp3_url 추출 (dictionary API)
				let mp3_url = '';
				try {
					const res = await fetch(
						`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`
					);
					if (res.ok) {
						const json = await res.json();
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

				// LLM으로 단어 정보 생성
				let wordInfo;
				try {
					wordInfo = await generateWordInfo(w, prompt);
				} catch {
					// LLM 실패 시 기본값
					wordInfo = {
						word: w,
						core_meaning: '',
						pronunciation: { ipa: '' },
						pos: [],
						level: '',
						frequency: '',
						senses: [],
						phrasal_verbs: []
					};
				}

				const core_meaning = wordInfo.core_meaning || '';
				const ipa = wordInfo.pronunciation?.ipa || '';
				const pos = wordInfo.pos?.length ? JSON.stringify(wordInfo.pos) : '';
				const level = wordInfo.level || '';
				const frequency = wordInfo.frequency || '';
				const senses = wordInfo.senses?.length ? JSON.stringify(wordInfo.senses) : '[]';
				const phrasal_verbs = wordInfo.phrasal_verbs?.length
					? JSON.stringify(wordInfo.phrasal_verbs)
					: '[]';

				if (isNew) {
					await db.insert(dicWord).values({
						word: w,
						mp3_url,
						core_meaning,
						ipa,
						pos,
						level,
						frequency,
						senses,
						phrasal_verbs,
						check_core: 0,
						createdAt: now
					});
					dicInserted++;
				} else {
					await db
						.update(dicWord)
						.set({
							mp3_url,
							core_meaning,
							ipa,
							pos,
							level,
							frequency,
							senses,
							phrasal_verbs,
							createdAt: now
						})
						.where(eq(dicWord.word, w));
					dicUpdated++;
				}

				dicResults.push({ word: w, core_meaning, isNew });
			}

			return {
				success: true,
				savedPrompt: prompt,
				dicInserted,
				dicUpdated,
				dicResults
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'LLM 처리 중 오류가 발생했습니다.';
			return fail(500, { error: message });
		}
	}
} satisfies Actions;
