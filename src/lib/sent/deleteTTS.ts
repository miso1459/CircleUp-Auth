import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { tursoDb } from '$lib/server/db/turso';
import { turso_sentences } from '$lib/server/db/tursoSchema';
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

    // turso_sentences에서 audio_file_path 조회 후 파일 삭제
    const [record] = await tursoDb
        .select({ audio_file_path: turso_sentences.audio_file_path })
        .from(turso_sentences)
        .where(eq(turso_sentences.id, id))
        .limit(1);

    const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
    const ttsDirFull = path.resolve(process.cwd(), ttsDir);

    if (record?.audio_file_path) {
        const filePath = path.join(ttsDirFull, record.audio_file_path);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (e) {
            console.error('Failed to delete MP3 file:', filePath, e);
        }
    }

    // audio_file, audio_file_path 초기화
    await tursoDb.update(turso_sentences)
        .set({ audio_file: 0, audio_file_path: '' })
        .where(eq(turso_sentences.id, id));

    return json({ success: true });
}
