import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { dicWord } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';

export const PATCH: RequestHandler = async ({ request }) => {
	try {
		const { word, check_core } = await request.json();
		if (!word) {
			return json({ message: 'word is required' }, { status: 400 });
		}

		await db
			.update(dicWord)
			.set({ check_core: check_core ? 1 : 0 })
			.where(eq(dicWord.word, word));

		return json({ success: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : '업데이트 중 오류가 발생했습니다.';
		return json({ message }, { status: 500 });
	}
};

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
