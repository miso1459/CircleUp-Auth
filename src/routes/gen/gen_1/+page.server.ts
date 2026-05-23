import type { PageServerLoad, Actions } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sentences } from '$lib/server/db/schema';
import { like, desc, eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';


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

        // JSON body로 직접 받음 (FormData 파싱 이슈 우회)
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

        console.log('[gen_1] delete: id=', id, 'file_tts=', record?.file_tts);

        if (record?.file_tts && record.file_tts.trim()) {
            const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
            const ttsDirFull = path.resolve(process.cwd(), ttsDir);
            const filePath = path.join(ttsDirFull, record.file_tts);
            console.log('[gen_1] delete: ttsDir=', ttsDir, 'ttsDirFull=', ttsDirFull, 'filePath=', filePath);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log('[gen_1] Deleted MP3 file:', filePath);
                } else {
                    console.warn('[gen_1] MP3 file not found:', filePath);
                }
            } catch (e) {
                console.error('[gen_1] Failed to delete MP3 file:', filePath, e);
            }
        } else {
            console.warn('[gen_1] No file_tts to delete for id:', id);
        }

        await db.delete(sentences).where(eq(sentences.id, id));
        return { success: true };
    }
};
