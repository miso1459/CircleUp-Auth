import { auth } from '$lib/server/auth';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET 요청 처리 (예: <a href="/login"> 클릭 시 바로 GitHub 로그인 실행)
export const GET: RequestHandler = async (event) => {
	const provider = event.url.searchParams.get('provider') ?? 'github';
	const callbackURL = event.url.searchParams.get('callbackURL') ?? '/';

	const result = await auth.api.signInSocial({
		body: {
			provider: provider as 'github' | 'google',
			callbackURL
		}
	});

	if (result.url) {
		return redirect(302, result.url);
	}
	
	throw error(400, 'Social sign-in failed');
};

// POST 요청 처리 (예: 폼을 통한 전송)
export const POST: RequestHandler = async (event) => {
	const formData = await event.request.formData();
	const provider = formData.get('provider')?.toString() ?? 'github';
	const callbackURL = formData.get('callbackURL')?.toString() ?? '/';

	const result = await auth.api.signInSocial({
		body: {
			provider: provider as 'github' | 'google',
			callbackURL
		}
	});

	if (result.url) {
		return redirect(302, result.url);
	}
	
	throw error(400, 'Social sign-in failed');
};
