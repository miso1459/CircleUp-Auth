import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '$env/dynamic/private';

export type SentenceRow = {
	index: number;
	original: string;
	statement: string;
};

function getModel() {
	const apiKey = env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
	}

	const genAI = new GoogleGenerativeAI(apiKey);
	return genAI.getGenerativeModel({ model: env.GEMINI_MODEL ?? 'gemini-2.0-flash' });
}

export function parseSentences(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

export function applyPromptTemplate(prompt: string, sentence: string): string {
	return prompt.includes('{sentence}')
		? prompt.replaceAll('{sentence}', sentence)
		: `${prompt}\n\n문장: ${sentence}`;
}

function extractJsonArray(text: string): unknown {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const candidate = (fenced?.[1] ?? text).trim();

	const start = candidate.indexOf('[');
	const end = candidate.lastIndexOf(']');
	if (start === -1 || end === -1 || end <= start) {
		throw new Error('LLM 응답에서 JSON 배열을 찾을 수 없습니다.');
	}

	return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeRow(item: unknown, index: number, fallbackOriginal = ''): SentenceRow {
	if (typeof item === 'string') {
		return { index, original: fallbackOriginal, statement: item };
	}

	if (item && typeof item === 'object') {
		const row = item as Record<string, unknown>;
		const statement =
			(typeof row.statement === 'string' && row.statement) ||
			(typeof row.result === 'string' && row.result) ||
			(typeof row.text === 'string' && row.text) ||
			(typeof row.sentence === 'string' && row.sentence) ||
			'';

		return {
			index: typeof row.index === 'number' ? row.index : index,
			original: typeof row.original === 'string' ? row.original : fallbackOriginal,
			statement
		};
	}

	return { index, original: fallbackOriginal, statement: '' };
}

/** LLM 응답 row(배열·단일 객체)를 SentenceRow[]로 변환. 여러 행이면 전체 반환 */
export function normalizeRows(row: unknown, sentences: string[] = []): SentenceRow[] {
	if (Array.isArray(row)) {
		return row.map((item, i) => normalizeRow(item, i + 1, sentences[i] ?? ''));
	}

	if (row !== null && typeof row === 'object') {
		return [normalizeRow(row, 1, sentences[0] ?? '')];
	}

	if (typeof row === 'string') {
		return [normalizeRow(row, 1, sentences[0] ?? '')];
	}

	throw new Error('LLM 응답 형식을 인식할 수 없습니다.');
}

export async function transformSentencesWithPrompt(
	sentences: string[],
	prompt: string
): Promise<SentenceRow[]> {
	if (sentences.length === 0) {
		throw new Error('처리할 문장이 없습니다.');
	}
	if (!prompt.trim()) {
		throw new Error('프롬프트를 입력해 주세요.');
	}

	const model = getModel();
	const numbered = sentences.map((s, i) => `${i + 1}. ${s}`).join('\n');

	const userMessage = `다음 ${sentences.length}개의 문장에 아래 프롬프트를 각 문장에 적용하세요.
프롬프트 안의 {sentence}는 해당 문장으로 치환합니다.

[프롬프트]
${prompt.trim()}

[입력 문장]
${numbered}

반드시 아래 JSON 배열만 출력하세요. 다른 설명은 금지합니다.
[
  { "index": 1, "original": "원문", "statement": "변환 결과" }
]`;

	const result = await model.generateContent(userMessage);
	const text = result.response.text();
	const parsed = extractJsonArray(text);

	return normalizeRows(parsed, sentences);
}

export function rowsToJson(rows: SentenceRow[]): string {
	return JSON.stringify(rows, null, 2);
}
