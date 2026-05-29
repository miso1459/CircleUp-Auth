import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { sentences } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';

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

    if (record?.file_tts && record.file_tts.trim()) {
        const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
        const ttsDirFull = path.resolve(process.cwd(), ttsDir);
        const filePath = path.join(ttsDirFull, record.file_tts);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (e) {
            // 파일 삭제 실패는 DB 삭제를 막지 않음
            console.error('Failed to delete MP3 file:', filePath, e);
        }
    }

    await db.delete(sentences).where(eq(sentences.id, id));
    return json({ success: true });
};
