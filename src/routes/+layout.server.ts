import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// NavRight에서 필요한 데이터
	const navRightData = {
		user: locals.user ?? null,         // 로그인 유저 정보 (예시)
		settings: {
			theme: 'light',
			language: 'ko',
		},
	};

	return {
		navRightData,
	};
};

