import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { dicWord } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';

export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const { word } = await request.json();
		if (!word) {
			return json({ message: 'word is required' }, { status: 400 });
		}

		await db.delete(dicWord).where(eq(dicWord.word, word));

		return json({ success: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.';
		return json({ message }, { status: 500 });
	}
};
