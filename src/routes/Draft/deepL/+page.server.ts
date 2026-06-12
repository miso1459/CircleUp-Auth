import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	return {
		deeplConfigured: Boolean(env.DEEPL_API_KEY)
	};
}) satisfies PageServerLoad;

export const actions = {
	translate: async ({ request }) => {
		const formData = await request.formData();
		const text = String(formData.get('text') ?? '').trim();
		const sourceLang = String(formData.get('sourceLang') ?? 'auto').trim();
		const targetLang = String(formData.get('targetLang') ?? 'KO').trim();

		if (!text) {
			return fail(400, { error: '번역할 텍스트를 입력해 주세요.' });
		}

		const apiKey = env.DEEPL_API_KEY;
		if (!apiKey) {
			return fail(500, { error: 'DEEPL_API_KEY 환경 변수가 설정되지 않았습니다. .env 파일에 추가해 주세요.' });
		}

		const isFreeKey = apiKey.endsWith(':fx');
		const url = isFreeKey
			? 'https://api-free.deepl.com/v2/translate'
			: 'https://api.deepl.com/v2/translate';

		try {
			const body: {
				text: string[];
				target_lang: string;
				source_lang?: string;
			} = {
				text: [text],
				target_lang: targetLang
			};

			if (sourceLang && sourceLang !== 'auto') {
				body.source_lang = sourceLang;
			}

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `DeepL-Auth-Key ${apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			if (!response.ok) {
				const errText = await response.text();
				let errMsg = `DeepL API 오류가 발생했습니다. (Status: ${response.status})`;
				try {
					const errJson = JSON.parse(errText);
					if (errJson.message) {
						errMsg = errJson.message;
					}
				} catch {
					// JSON 파싱 실패시 기본 에러 메시지 유지
				}
				return fail(response.status >= 500 ? 500 : 400, { error: errMsg });
			}

			const data = await response.json();
			if (!data.translations || data.translations.length === 0) {
				return fail(500, { error: '번역 응답 결과가 올바르지 않습니다.' });
			}

			return {
				translatedText: data.translations[0].text,
				detectedSourceLanguage: data.translations[0].detected_source_language,
				originalText: text,
				sourceLang,
				targetLang
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : '번역 처리 중 예기치 못한 오류가 발생했습니다.';
			return fail(500, { error: message });
		}
	}
} satisfies Actions;
