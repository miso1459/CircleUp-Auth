import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { GoogleGenAI } from '@google/genai';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	return {
		geminiConfigured: Boolean(env.GEMINI_API_KEY)
	};
}) satisfies PageServerLoad;

export const actions = {
	generatePrompt: async ({ request }) => {
		const formData = await request.formData();
		const promptTemplate = String(formData.get('sentenceForPrompt') ?? '').trim();
		const mainSentence = String(formData.get('mainSentence') ?? '').trim();

		if (!promptTemplate) {
			return fail(400, { error: '프롬프트 생성 규칙을 입력해 주세요.' });
		}
		if (!env.GEMINI_API_KEY) {
			return fail(500, { error: 'GEMINI_API_KEY 환경 변수를 설정해 주세요.' });
		}

		try {
			const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

			const userMessage = promptTemplate.includes('{sentence}')
				? promptTemplate.replaceAll('{sentence}', mainSentence)
				: `${promptTemplate}\n\n문장: ${mainSentence}`;

			const response = await genAI.models.generateContent({
				model: env.GEMINI_MODEL ?? 'gemini-2.0-flash',
				contents: userMessage
			});

			const generatedPrompt = (response.text ?? '').trim();

			if (!generatedPrompt) {
				return fail(500, { error: '프롬프트 생성에 실패했습니다.' });
			}

			return { prompt: generatedPrompt };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'LLM 처리 중 오류가 발생했습니다.';
			return fail(500, { error: message });
		}
	}
} satisfies Actions;
