import type { PageServerLoad, Actions } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sentences } from '$lib/server/db/schema';
import { like, desc, eq } from 'drizzle-orm';
import { transformSentencesWithPrompt, parseSentences } from '$lib/server/gemini';
import { generateTTS } from '$lib/server/tts';

export const load: PageServerLoad = async ({ locals, url }) => {
    if (locals.user?.role !== 'admin') {
        throw redirect(303, '/');
    }

    const searchQuery = url.searchParams.get('search') || '';
    const ttsBaseUrl = env.TTS_BASE_URL || process.env.TTS_BASE_URL || 'http://localhost:5173';

    let rows;
    if (searchQuery) {
        rows = await db.select()
            .from(sentences)
            .where(like(sentences.sent, `%${searchQuery}%`))
            .orderBy(desc(sentences.createdAt))
            .limit(100);
    } else {
        rows = await db.select()
            .from(sentences)
            .orderBy(desc(sentences.createdAt))
            .limit(100);
    }

    return { sentences: rows, searchQuery, ttsBaseUrl };
};

export const actions: Actions = {
    generate: async ({ request, locals }) => {
        if (locals.user?.role !== 'admin') {
            throw error(403, 'Unauthorized');
        }

        const data = await request.formData();
        const sentence = String(data.get('sentence') || '');
        const prompt = String(data.get('prompt') || '');
        const languageCode = String(data.get('languageCode') || 'ko-KR');
        const voiceName = String(data.get('voiceName') || 'ko-KR-Neural2-A');

        if (!sentence.trim()) {
            throw error(400, '문장을 입력해주세요.');
        }
        if (!prompt.trim()) {
            throw error(400, '프롬프트를 입력해주세요.');
        }

        console.log('[gen_1] Starting LLM generation...');
        console.log('[gen_1] Input sentence:', sentence);
        console.log('[gen_1] Prompt:', prompt);

        const llmResult = await transformSentencesWithPrompt([sentence], prompt);

        console.log('[gen_1] LLM result:', JSON.stringify(llmResult, null, 2));

        const inserted: { lang: string; sent: string; voice: string; file_tts: string }[] = [];

        for (const row of llmResult) {
            console.log('[gen_1] Generating TTS for:', row.statement);

            const ttsResult = await generateTTS({ text: row.statement, languageCode, voiceName });

            console.log('[gen_1] TTS generated, filename:', ttsResult.filename);

            await db.insert(sentences).values({
                lang: languageCode,
                sent: row.statement,
                voice: voiceName,
                file_tts: ttsResult.filename
            });

            console.log('[gen_1] Inserted into DB:', row.statement);

            inserted.push({
                lang: languageCode,
                sent: row.statement,
                voice: voiceName,
                file_tts: ttsResult.filename
            });
        }

        console.log('[gen_1] All done, inserted count:', inserted.length);

        return { success: true, inserted };
    },

    search: async ({ request, locals }) => {
        if (locals.user?.role !== 'admin') {
            throw error(403, 'Unauthorized');
        }

        const data = await request.formData();
        const query = String(data.get('query') || '');

        console.log('[gen_1] Search query:', query);

        let rows;
        if (query.trim()) {
            rows = await db.select()
                .from(sentences)
                .where(like(sentences.sent, `%${query}%`))
                .orderBy(desc(sentences.createdAt))
                .limit(100);
        } else {
            rows = await db.select()
                .from(sentences)
                .orderBy(desc(sentences.createdAt))
                .limit(100);
        }

        console.log('[gen_1] Search results count:', rows.length);

        return { sentences: rows };
    },

    delete: async ({ request, locals }) => {
        if (locals.user?.role !== 'admin') {
            throw error(403, 'Unauthorized');
        }

        const data = await request.formData();
        const id = Number(data.get('id'));

        if (!id) {
            throw error(400, 'ID is required');
        }

        await db.delete(sentences).where(eq(sentences.id, id));
        return { success: true };
    }
};
