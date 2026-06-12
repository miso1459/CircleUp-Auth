import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getTTSLoadData, ttsActions } from '$lib/server/tts-actions';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	const ttsData = await getTTSLoadData({ locals });

	return {
		geminiConfigured: Boolean(env.GEMINI_API_KEY),
		sentences: [],
		...ttsData
	};
}) satisfies PageServerLoad;

export const actions = {
	...ttsActions
} satisfies Actions;