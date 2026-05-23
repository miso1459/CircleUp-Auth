import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { transformSentencesWithPrompt } from '$lib/server/gemini';
import { generateTTS } from '$lib/server/tts';
import { db } from '$lib/server/db';
import { sentences } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (locals.user?.role !== 'admin') {
        throw error(403, 'Unauthorized: Admin access required');
    }

    let body: { sentence?: string; prompt?: string; languageCode?: string; voiceName?: string };
    try {
        body = await request.json();
    } catch {
        throw error(400, 'Invalid JSON body');
    }

    const { sentence = '', prompt = '', languageCode = 'ko-KR', voiceName = 'ko-KR-Neural2-A' } = body;

    if (!sentence.trim()) {
        throw error(400, '문장을 입력해주세요.');
    }
    if (!prompt.trim()) {
        throw error(400, '프롬프트를 입력해주세요.');
    }

    console.log('[gen_1] Starting LLM generation via +server.ts...');
    console.log('[gen_1] Input sentence:', sentence);
    console.log('[gen_1] Prompt:', prompt);

    const llmResult = await transformSentencesWithPrompt([sentence], prompt);
    console.log('[gen_1] LLM result:', JSON.stringify(llmResult, null, 2));

    const inserted: { lang: string; sent: string; voice: string; file_tts: string; url: string }[] = [];

    for (const row of llmResult) {
        console.log('[gen_1] Generating TTS for:', row.statement);

        const ttsResult = await generateTTS({ text: row.statement, languageCode, voiceName });

        console.log('[gen_1] TTS generated, filename:', ttsResult.filename, 'url:', ttsResult.url);

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
            file_tts: ttsResult.filename,
            url: ttsResult.url
        });
    }

    console.log('[gen_1] All done, inserted count:', inserted.length);

    return json({
        success: true,
        inserted
    });
};
