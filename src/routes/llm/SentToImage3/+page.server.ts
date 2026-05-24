import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { GoogleGenAI } from '@google/genai';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { sentences } from '$lib/server/db/schema';
import { and, or, isNull, eq, like, desc } from 'drizzle-orm';

export const load = (async ({ locals, url }) => {
	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	const searchQuery = url.searchParams.get('search') || '';
	const ttsBaseUrl = env.TTS_BASE_URL || process.env.TTS_BASE_URL || 'http://localhost:5173/TTS';

	const conditions = [
		or(isNull(sentences.file_image), eq(sentences.file_image, ''))
	];

	if (searchQuery) {
		conditions.push(like(sentences.sent, `%${searchQuery}%`));
	}

	const rows = await db.select()
		.from(sentences)
		.where(and(...conditions))
		.orderBy(desc(sentences.createdAt))
		.limit(100);

	return {
		sentences: rows,
		searchQuery,
		ttsBaseUrl,
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
	},
	applyImage: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			throw redirect(303, '/');
		}
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		if (!id) return fail(400, { error: 'ID가 필요합니다.' });

		try {
			const [row] = await db.select().from(sentences).where(eq(sentences.id, id)).limit(1);
			if (!row) return fail(404, { error: '해당 ID의 레코드를 찾을 수 없습니다.' });
			if (!row.file_tts) return fail(400, { error: 'file_tts가 존재하지 않습니다.' });

			const fileImage = row.file_tts.replace(/\.mp3$/i, '.jpg');
			await db.update(sentences).set({ file_image: fileImage }).where(eq(sentences.id, id));

			return { success: true, file_image: fileImage };
		} catch (err) {
			const message = err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.';
			return fail(500, { error: message });
		}
	}
} satisfies Actions;
