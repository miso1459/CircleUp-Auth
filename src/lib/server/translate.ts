import { env } from '$env/dynamic/private';

interface TranslateResult {
	text?: string;
	error?: string;
}

export async function translateSingle(text: string, targetLang: string): Promise<TranslateResult> {
	const apiKey = env.DEEPL_API_KEY;
	if (!apiKey) {
		return { error: 'DEEPL_API_KEY 미설정' };
	}

	const isFreeKey = apiKey.endsWith(':fx');
	const apiUrl = isFreeKey
		? 'https://api-free.deepl.com/v2/translate'
		: 'https://api.deepl.com/v2/translate';

	try {
		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: {
				'Authorization': `DeepL-Auth-Key ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				text: [text],
				target_lang: targetLang
			})
		});

		if (!response.ok) {
			return { error: `DeepL API 오류: ${response.status}` };
		}

		const data = await response.json();
		return { text: data.translations[0].text };
	} catch (err) {
		return { error: err instanceof Error ? err.message : '번역 중 오류 발생' };
	}
}
