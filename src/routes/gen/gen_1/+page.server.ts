import type { PageServerLoad, Actions } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sentences } from '$lib/server/db/schema';
import { like, desc, eq } from 'drizzle-orm';


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

        const data = await request.formData();
        const id = Number(data.get('id'));

        if (!id) {
            throw error(400, 'ID is required');
        }

        await db.delete(sentences).where(eq(sentences.id, id));
        return { success: true };
    }
};
