import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { transformSentencesWithPrompt } from '$lib/server/gemini';
import { generateTTS } from '$lib/server/tts';
import { db } from '$lib/server/db';
import { sentences } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';

const ts = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
};
const log = (...args: any[]) => console.log(`[${ts()}]`, ...args);
const warn = (...args: any[]) => console.warn(`[${ts()}]`, ...args);
const err = (...args: any[]) => console.error(`[${ts()}]`, ...args);

export const POST: RequestHandler = async ({ request, locals }) => {
    if (locals.user?.role !== 'admin') {
        throw error(403, 'Unauthorized: Admin access required');
    }

    let body: { sentence?: string; prompt?: string; languageCode?: string; voiceName?: string; speakingRate?: number };
    try {
        body = await request.json();
    } catch {
        throw error(400, 'Invalid JSON body');
    }

    const { sentence = '', prompt = '', languageCode = 'ko-KR', voiceName = 'ko-KR-Neural2-A', speakingRate = 1.0 } = body;

    if (!sentence.trim()) {
        throw error(400, '문장을 입력해주세요.');
    }
    if (!prompt.trim()) {
        throw error(400, '프롬프트를 입력해주세요.');
    }

    log('[gen_1] Starting LLM generation via +server.ts...');
    log('[gen_1] Input sentence:', sentence);
    log('[gen_1] Prompt:', prompt);

    const llmResult = await transformSentencesWithPrompt([sentence], prompt);
    log('[gen_1] LLM result:', JSON.stringify(llmResult, null, 2));

    const inserted: { lang: string; sent: string; voice: string; file_tts: string; url: string; speed: string }[] = [];

    for (const row of llmResult) {
        log('[gen_1] Generating TTS for:', row.statement);

        const ttsResult = await generateTTS({ text: row.statement, languageCode, voiceName, speakingRate });

        log('[gen_1] TTS generated, filename:', ttsResult.filename, 'url:', ttsResult.url);

        await db.insert(sentences).values({
            lang: languageCode,
            sent: row.statement,
            voice: voiceName,
            file_tts: ttsResult.filename,
            speed: String(speakingRate)
        });

        log('[gen_1] Inserted into DB:', row.statement);

        inserted.push({
            lang: languageCode,
            sent: row.statement,
            voice: voiceName,
            file_tts: ttsResult.filename,
            url: ttsResult.url,
            speed: String(speakingRate)
        });
    }

    log('[gen_1] All done, inserted count:', inserted.length);

    return json({
        success: true,
        inserted
    });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
    if (locals.user?.role !== 'admin') {
        throw error(403, 'Unauthorized: Admin access required');
    }

    let body: { id?: number };
    try {
        body = await request.json();
    } catch {
        throw error(400, 'Invalid JSON body');
    }

    const id = Number(body.id);
    if (!id) {
        throw error(400, 'ID is required');
    }

    // MP3 파일 삭제를 위해 file_tts 조회
    const [record] = await db.select({ file_tts: sentences.file_tts })
        .from(sentences)
        .where(eq(sentences.id, id))
        .limit(1);

    log('[gen_1] DELETE: id=', id, 'file_tts=', record?.file_tts);

    if (record?.file_tts && record.file_tts.trim()) {
        const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
        const ttsDirFull = path.resolve(process.cwd(), ttsDir);
        const filePath = path.join(ttsDirFull, record.file_tts);
        log('[gen_1] DELETE: ttsDir=', ttsDir, 'ttsDirFull=', ttsDirFull, 'filePath=', filePath);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                log('[gen_1] Deleted MP3 file:', filePath);
            } else {
                warn('[gen_1] MP3 file not found:', filePath);
            }
        } catch (e) {
            err('[gen_1] Failed to delete MP3 file:', filePath, e);
        }
    } else {
        warn('[gen_1] No file_tts to delete for id:', id);
    }

    await db.delete(sentences).where(eq(sentences.id, id));
    return json({ success: true });
};
