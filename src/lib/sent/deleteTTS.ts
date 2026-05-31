import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sentences } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';

export async function deleteTTSFile(event: RequestEvent) {
    const { request, locals } = event;

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

    // file_tts 조회
    const [record] = await db.select({ file_tts: sentences.file_tts })
        .from(sentences)
        .where(eq(sentences.id, id))
        .limit(1);

    if (!record) {
        throw error(404, 'Sentence not found');
    }

    // MP3 파일 삭제
    if (record.file_tts && record.file_tts.trim()) {
        const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
        const ttsDirFull = path.resolve(process.cwd(), ttsDir);
        const filePath = path.join(ttsDirFull, record.file_tts);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (e) {
            console.error('Failed to delete MP3 file:', filePath, e);
        }
    }

    // file_tts를 빈값으로 업데이트
    await db.update(sentences)
        .set({ file_tts: null })
        .where(eq(sentences.id, id));

    return json({ success: true });
}