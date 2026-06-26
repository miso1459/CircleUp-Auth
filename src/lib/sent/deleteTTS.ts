import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { tp_sentences } from '$lib/server/db/schema';
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

    // MP3 파일만 삭제 (id.mp3)
    const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
    const ttsDirFull = path.resolve(process.cwd(), ttsDir);
    const filePath = path.join(ttsDirFull, `${id}.mp3`);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (e) {
        console.error('Failed to delete MP3 file:', filePath, e);
    }

    // file_tts 초기화
    await db.update(tp_sentences)
        .set({ file_tts: '' })
        .where(eq(tp_sentences.id, id));

    return json({ success: true });
}