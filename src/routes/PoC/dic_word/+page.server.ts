import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sentences, dicWord } from '$lib/server/db/schema';
import { like, desc, inArray } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals, url, depends }) => {
	depends('app:sentences');

	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

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
		sentences: sentenceRows,
		searchQuery
	};
}) satisfies PageServerLoad;

export const actions = {
	process: async ({ request }) => {
		const formData = await request.formData();
		const sentence = String(formData.get('sentence') ?? '').trim();

		if (!sentence) {
			return fail(400, { error: '단어를 입력해 주세요.' });
		}

		try {
			// 1. 입력 단어 리스트 추출
			const wordList = sentence
				.split('\n')
				.map(s => s.trim())
				.filter(Boolean);

			if (wordList.length === 0) {
				return fail(400, { error: '유효한 단어가 없습니다.' });
			}

			// 2. 기존 단어 조회 (중복 제외)
			const existingWords = await db
				.select({ word: dicWord.word })
				.from(dicWord)
				.where(inArray(dicWord.word, wordList));

			const existingSet = new Set(existingWords.map(r => r.word));
			const newWords = wordList.filter(w => !existingSet.has(w));
			const dicSkipped = wordList.length - newWords.length;

			// 3. 신규 단어마다 dictionaryapi에서 mp3_url 추출 후 INSERT
			let dicInserted = 0;

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

				await db.insert(dicWord).values(insertData);
				dicInserted = insertData.length;
			}

			return {
				success: true,
				dicInserted,
				dicSkipped
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'dicWord 처리 중 오류가 발생했습니다.';
			return fail(500, { error: message });
		}
	}
} satisfies Actions;
