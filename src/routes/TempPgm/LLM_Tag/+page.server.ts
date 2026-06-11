import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { transformSentencesWithPrompt } from '$lib/server/gemini';
import { db } from '$lib/server/db';
import { config, sentences } from '$lib/server/db/schema';
import { eq, like, desc, and, ne, inArray } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals, url, depends }) => {
	depends('app:sentences');

	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	// config에서 저장된 프롬프트 조회 (key: LLM_Tag)
	const savedConfigPrompt = await db
		.select()
		.from(config)
		.where(eq(config.key, 'LLM_Tag'))
		.limit(1);

	// URL 검색 파라미터 처리
	const searchQuery = url.searchParams.get('search') || '';
	const tagFilter = url.searchParams.get('tagFilter') || 'not-generated';

	// sentences 테이블 조회 (tag 필드 포함, ID 역순, 최대 100개)
	let sentenceRows;

	if (tagFilter === 'generated') {
		// 태그가 있는 문장만 (tag !== '')
		const baseWhere = and(
			ne(sentences.tag, ''),
			searchQuery ? like(sentences.sent, `%${searchQuery}%`) : undefined
		);
		sentenceRows = await db
			.select({
				id: sentences.id,
				lang: sentences.lang,
				voice: sentences.voice,
				speed: sentences.speed,
				sent: sentences.sent,
				tag: sentences.tag,
				createdAt: sentences.createdAt,
				file_tts: sentences.file_tts
			})
			.from(sentences)
			.where(baseWhere)
			.orderBy(desc(sentences.id))
			.limit(100);
	} else if (tagFilter === 'not-generated') {
		// 태그가 없는 문장만 (tag === '')
		const baseWhere = and(
			eq(sentences.tag, ''),
			searchQuery ? like(sentences.sent, `%${searchQuery}%`) : undefined
		);
		sentenceRows = await db
			.select({
				id: sentences.id,
				lang: sentences.lang,
				voice: sentences.voice,
				speed: sentences.speed,
				sent: sentences.sent,
				tag: sentences.tag,
				createdAt: sentences.createdAt,
				file_tts: sentences.file_tts
			})
			.from(sentences)
			.where(baseWhere)
			.orderBy(desc(sentences.id))
			.limit(100);
	} else {
		// all (default)
		if (searchQuery) {
			sentenceRows = await db
				.select({
					id: sentences.id,
					lang: sentences.lang,
					voice: sentences.voice,
					speed: sentences.speed,
					sent: sentences.sent,
					tag: sentences.tag,
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
					tag: sentences.tag,
					createdAt: sentences.createdAt,
					file_tts: sentences.file_tts
				})
				.from(sentences)
				.orderBy(desc(sentences.id))
				.limit(100);
		}
	}

	return {
		geminiConfigured: Boolean(env.GEMINI_API_KEY),
		savedPrompt: savedConfigPrompt[0]?.value || '',
		sentences: sentenceRows,
		searchQuery,
		tagFilter
	};
}) satisfies PageServerLoad;

export const actions = {
	process: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const prompt = String(formData.get('prompt') ?? '').trim();
		const selectedSentenceId = Number(formData.get('selectedSentenceId'));

		if (!prompt) {
			return fail(400, { error: '프롬프트를 입력해 주세요.' });
		}
		if (!selectedSentenceId) {
			return fail(400, { error: '문장을 선택해 주세요.' });
		}
		if (!env.GEMINI_API_KEY) {
			return fail(500, { error: 'GEMINI_API_KEY 환경 변수를 설정해 주세요.' });
		}

		try {
			// 1. config 테이블에 프롬프트 저장 (key: LLM_Tag, upsert)
			await db
				.insert(config)
				.values({ key: 'LLM_Tag', value: prompt })
				.onConflictDoUpdate({
					target: config.key,
					set: { value: prompt }
				});

			// 2. 선택된 문장의 sent 값 조회
			const [record] = await db
				.select({ sent: sentences.sent })
				.from(sentences)
				.where(eq(sentences.id, selectedSentenceId))
				.limit(1);

			if (!record) {
				return fail(404, { error: '문장을 찾을 수 없습니다.' });
			}

			// 3. Gemini API 호출
			const generatedRows = await transformSentencesWithPrompt([record.sent], prompt);

			if (generatedRows.length === 0) {
				return fail(500, { error: '생성된 태그가 없습니다.' });
			}

			const tag = generatedRows.map(row => row.statement.trim()).filter(Boolean).join(', ');

			// 4. sentences.tag UPDATE (INSERT 아님)
			await db
				.update(sentences)
				.set({ tag })
				.where(eq(sentences.id, selectedSentenceId));

			return {
				success: true,
				updatedId: selectedSentenceId,
				tag
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'LLM 처리 중 오류가 발생했습니다.';
			return fail(500, { error: message });
		}
	},

	batchGenerateTags: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const idsStr = String(formData.get('ids') || '');
		const ids = idsStr.split(',').map(Number).filter(Boolean);

		if (ids.length === 0) {
			return fail(400, { error: '태그를 생성할 문장이 없습니다.' });
		}

		if (!env.GEMINI_API_KEY) {
			return fail(500, { error: 'GEMINI_API_KEY 환경 변수를 설정해 주세요.' });
		}

		// config에서 저장된 프롬프트 조회
		const savedConfig = await db
			.select()
			.from(config)
			.where(eq(config.key, 'LLM_Tag'))
			.limit(1);

		const prompt = savedConfig[0]?.value || '';
		if (!prompt) {
			return fail(400, { error: '저장된 프롬프트가 없습니다. 먼저 단일 태그 생성을 실행해 주세요.' });
		}

		// 이미 태그가 있는 문장 제외
		const taggedSentences = await db
			.select({ id: sentences.id })
			.from(sentences)
			.where(ne(sentences.tag, ''));

		const taggedIdSet = new Set(taggedSentences.map(s => s.id));
		const untaggedIds = ids.filter(id => !taggedIdSet.has(id));

		if (untaggedIds.length === 0) {
			return fail(400, { error: '모든 문장에 이미 태그가 있습니다.' });
		}

		// 태그가 없는 문장들 조회
		const records = await db
			.select({ id: sentences.id, sent: sentences.sent })
			.from(sentences)
			.where(inArray(sentences.id, untaggedIds));

		let successCount = 0;
		let errorCount = 0;

		for (const record of records) {
			try {
				const generatedRows = await transformSentencesWithPrompt([record.sent], prompt);
				if (generatedRows.length === 0) {
					errorCount++;
					continue;
				}

				const tag = generatedRows.map(row => row.statement.trim()).filter(Boolean).join(', ');

				await db
					.update(sentences)
					.set({ tag })
					.where(eq(sentences.id, record.id));

				successCount++;
			} catch {
				errorCount++;
			}
		}

		return { success: true, successCount, errorCount };
	},

	clearTag: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const sentenceId = Number(formData.get('sentenceId'));

		if (!sentenceId) {
			return fail(400, { error: '문장을 선택해 주세요.' });
		}

		await db
			.update(sentences)
			.set({ tag: '' })
			.where(eq(sentences.id, sentenceId));

		return { success: true };
	}
} satisfies Actions;
