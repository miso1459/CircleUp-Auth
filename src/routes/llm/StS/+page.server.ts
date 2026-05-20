import { fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
	parseSentences,
	rowsToJson,
	transformSentencesWithPrompt,
	type SentenceRow
} from '$lib/server/gemini';
import type { Actions, PageServerLoad } from './$types';

export const load = (async () => {
	return {
		geminiConfigured: Boolean(env.GEMINI_API_KEY)
	};
}) satisfies PageServerLoad;

function getFormStrings(formData: FormData) {
	return {
		sentences: String(formData.get('sentences') ?? ''),
		prompt: String(formData.get('prompt') ?? '')
	};
}

export const actions = {
	/** 문장만 파싱해 미리보기 */
	parseSentences: async ({ request }) => {
		const { sentences } = getFormStrings(await request.formData());
		const parsed = parseSentences(sentences);

		if (parsed.length === 0) {
			return fail(400, { error: '문장을 한 줄에 하나씩 입력해 주세요.', parsed: [] as string[] });
		}

		return { parsed };
	},

	/** 프롬프트 전달 확인 */
	previewPrompt: async ({ request }) => {
		const { sentences, prompt } = getFormStrings(await request.formData());
		const parsed = parseSentences(sentences);

		if (!prompt.trim()) {
			return fail(400, { error: '프롬프트를 입력해 주세요.' });
		}

		return {
			prompt: prompt.trim(),
			preview: parsed.map((s, i) => ({
				index: i + 1,
				applied: prompt.includes('{sentence}')
					? prompt.replaceAll('{sentence}', s)
					: `${prompt.trim()}\n\n문장: ${s}`
			}))
		};
	},

	/** 프롬프트 적용 후 Gemini 호출 */
	process: async ({ request }) => {
		const { sentences, prompt } = getFormStrings(await request.formData());
		const parsed = parseSentences(sentences);

		if (parsed.length === 0) {
			return fail(400, { error: '문장을 한 줄에 하나씩 입력해 주세요.' });
		}
		if (!prompt.trim()) {
			return fail(400, { error: '프롬프트를 입력해 주세요.' });
		}
		if (!env.GEMINI_API_KEY) {
			return fail(500, { error: 'GEMINI_API_KEY 환경 변수를 설정해 주세요.' });
		}

		try {
			const rows: SentenceRow[] = await transformSentencesWithPrompt(parsed, prompt);
			return {
				rows,
				json: rowsToJson(rows)
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'LLM 처리 중 오류가 발생했습니다.';
			return fail(500, { error: message });
		}
	}
} satisfies Actions;
