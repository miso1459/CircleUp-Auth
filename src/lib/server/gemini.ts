import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';

export type SentenceRow = {
	index: number;
	original: string;
	statement: string;
};

/** format.json 구조 기반 LLM 응답 타입 */
export type WordInfo = {
	word: string;
	core_meaning: string;
	pronunciation?: { ipa?: string; audio_url?: string };
	pos?: string[];
	level?: string;
	frequency?: string;
	senses?: unknown[];
	phrasal_verbs?: unknown[];
};

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

function extractJsonObject(text: string): unknown {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const candidate = (fenced?.[1] ?? text).trim();

	const start = candidate.indexOf('{');
	const end = candidate.lastIndexOf('}');
	if (start === -1 || end === -1 || end <= start) {
		throw new Error('LLM 응답에서 JSON 객체를 찾을 수 없습니다.');
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

	const apiKey = env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
	}

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

	const genAI = new GoogleGenAI({ apiKey });
	const response = await genAI.models.generateContent({
		model: env.GEMINI_MODEL ?? 'gemini-2.0-flash',
		contents: userMessage,
	});

	const text = response.text ?? '';
	const parsed = extractJsonArray(text);

	return normalizeRows(parsed, sentences);
}

export function rowsToJson(rows: SentenceRow[]): string {
	return JSON.stringify(rows, null, 2);
}

/** 단어 하나에 대해 프롬프트 지시사항을 적용하여 format.json 구조의 단어 정보를 생성 */
export async function generateWordInfo(
	word: string,
	prompt: string
): Promise<WordInfo> {
	if (!word.trim()) {
		throw new Error('단어가 비어 있습니다.');
	}
	if (!prompt.trim()) {
		throw new Error('프롬프트를 입력해 주세요.');
	}

	const apiKey = env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
	}

	const userMessage = `다음 영어 단어에 대해 아래 프롬프트 지시사항을 적용하여 단어 정보를 생성하세요.

[프롬프트 지시사항]
${prompt.trim()}

[대상 단어]
"${word.trim()}"

반드시 아래 JSON 형식으로만 출력하세요. 다른 설명이나 마크다운은 절대 금지합니다.
{
  "word": "${word.trim()}",
  "core_meaning": "핵심 의미",
  "pronunciation": { "ipa": "발음기호", "audio_url": "" },
  "pos": ["품사"],
  "level": "난이도",
  "frequency": "사용빈도",
  "senses": [
    {
      "sense_id": 1,
      "definition_en": "영문 정의",
      "meaning_ko": "한글 의미",
      "example": { "en": "영문 예문", "ko": "한글 예문" },
      "collocations": [],
      "synonyms": [],
      "antonyms": [],
      "cefr_level": ""
    }
  ],
  "phrasal_verbs": []
}`;

	const genAI = new GoogleGenAI({ apiKey });
	const response = await genAI.models.generateContent({
		model: env.GEMINI_MODEL ?? 'gemini-2.0-flash',
		contents: userMessage,
	});

	const text = response.text ?? '';
	const parsed = extractJsonObject(text) as WordInfo;

	return parsed;
}

export async function generateSentencesFromPrompt(
	prompt: string
): Promise<SentenceRow[]> {
	if (!prompt.trim()) {
		throw new Error('프롬프트를 입력해 주세요.');
	}

	const apiKey = env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
	}

	const userMessage = `다음 지시사항에 따라 문장들을 생성해 주세요.

[지시사항]
${prompt.trim()}

반드시 아래 JSON 배열 형식으로만 출력하세요. 다른 설명이나 마크다운 외 텍스트는 절대 금지합니다.
[
  { "index": 1, "original": "", "statement": "생성된 문장" }
]`;

	const genAI = new GoogleGenAI({ apiKey });
	const response = await genAI.models.generateContent({
		model: env.GEMINI_MODEL ?? 'gemini-2.0-flash',
		contents: userMessage,
	});

	const text = response.text ?? '';
	const parsed = extractJsonArray(text);

	return normalizeRows(parsed, []);
}

