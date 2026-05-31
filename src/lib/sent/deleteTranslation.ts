import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sentences_tran } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function deleteTranslation(event: RequestEvent) {
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

    await db.delete(sentences_tran).where(eq(sentences_tran.id, id));

    return json({ success: true });
}