import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';
import { eq } from 'drizzle-orm';
import { auth } from '$lib/server/auth';

export const PATCH: RequestHandler = async ({ request }) => {
	// 현재 로그인된 유저 세션 확인
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session?.user) {
		return json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}

	const body = await request.json();
	const newName = body.name?.trim();

	if (!newName || newName.length === 0) {
		return json({ error: '사용자를 입력해주세요.' }, { status: 400 });
	}

	if (newName.length > 50) {
		return json({ error: '사용자는 50자 이내로 입력해주세요.' }, { status: 400 });
	}

	try {
		await db
			.update(user)
			.set({ name: newName })
			.where(eq(user.id, session.user.id));

		return json({ success: true, name: newName });
	} catch (err) {
		console.error('사용자 변경 실패:', err);
		return json({ error: '사용자 변경에 실패했습니다.' }, { status: 500 });
	}
};
