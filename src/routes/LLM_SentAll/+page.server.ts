import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { transformSentencesWithPrompt, generateSentencesFromPrompt } from '$lib/server/gemini';
import { generateTTS } from '$lib/server/tts';
import { translateSingle } from '$lib/server/translate';
import { db } from '$lib/server/db';
import { config, sentences, sentences_tran } from '$lib/server/db/schema';
import { eq, inArray, like, desc, and, ne } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import type { Actions, PageServerLoad } from './$types';

const LANG_INSTRUCTION: Record<string, string> = {
	'en-US': '\n\n[Important] All generated sentences must be written in English (en-US) only.',
	'ko-KR': '\n\n[중요] 생성되는 모든 문장은 반드시 한국어(ko-KR)로 작성해주세요.'
};

export const load = (async ({ locals, url, depends }) => {
	depends('app:sentences');

	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	// config에서 저장된 프롬프트와 언어 조회
	const savedConfigPrompt = await db
		.select()
		.from(config)
		.where(eq(config.key, 'LLM_SentToSent'))
		.limit(1);

	const savedConfigLang = await db
		.select()
		.from(config)
		.where(eq(config.key, 'LLM_Sent_Lang'))
		.limit(1);

	// TTS 설정
	const ttsBaseUrl = env.TTS_BASE_URL || process.env.TTS_BASE_URL || 'http://localhost:5173/TTS';

	const savedConfigVoice = await db
		.select()
		.from(config)
		.where(eq(config.key, 'TTS_Voice'))
		.limit(1);

	// 번역 설정
	const savedConfigTransLang = await db
		.select()
		.from(config)
		.where(eq(config.key, 'Trans_lang'))
		.limit(1);

	// 태그 설정
	const savedConfigTagPrompt = await db
		.select()
		.from(config)
		.where(eq(config.key, 'LLM_Tag'))
		.limit(1);

	// Check 설정
	const imgBaseUrl = (env.IMG_BASE_URL || process.env.IMG_BASE_URL || 'http://localhost:5173/IMG_files').replace(/\/+$/, '');

	// URL 검색 파라미터 처리
	const searchQuery = url.searchParams.get('search') || '';
	const imgFilter = url.searchParams.get('imgFilter') || 'unchecked';

	// sentences 테이블 조회 (ID 역순, 최대 100개)
	const selectFields = {
		id: sentences.id,
		lang: sentences.lang,
		voice: sentences.voice,
		speed: sentences.speed,
		sent: sentences.sent,
		tag: sentences.tag,
		createdAt: sentences.createdAt,
		file_tts: sentences.file_tts,
		file_image: sentences.file_image,
		check_img: sentences.check_img
	};

	let sentenceRows;
	const searchFilter = like(sentences.sent, `%${searchQuery}%`);

	if (imgFilter === 'checked') {
		sentenceRows = await db
			.select(selectFields)
			.from(sentences)
			.where(and(searchFilter, eq(sentences.check_img, 1)))
			.orderBy(desc(sentences.id))
			.limit(100);
	} else if (imgFilter === 'unchecked') {
		sentenceRows = await db
			.select(selectFields)
			.from(sentences)
			.where(and(searchFilter, eq(sentences.check_img, 0)))
			.orderBy(desc(sentences.id))
			.limit(100);
	} else {
		sentenceRows = await db
			.select(selectFields)
			.from(sentences)
			.where(searchFilter)
			.orderBy(desc(sentences.id))
			.limit(100);
	}

	// 번역 데이터 조회
	const sentenceIds = sentenceRows.map(s => s.id);
	const translations = sentenceIds.length > 0
		? await db
			.select()
			.from(sentences_tran)
			.where(inArray(sentences_tran.id, sentenceIds))
		: [];

	const translationMap = new Map(translations.map(t => [t.id, t]));
	const sentencesWithTrans = sentenceRows.map(s => ({
		...s,
		tran: translationMap.get(s.id)?.sent || null,
		tranLang: translationMap.get(s.id)?.lang || null
	}));

	return {
		geminiConfigured: Boolean(env.GEMINI_API_KEY),
		savedPrompt: savedConfigPrompt[0]?.value || '',
		savedLang: savedConfigLang[0]?.value || 'en',
		savedVoice: savedConfigVoice[0]?.value || 'en-US-Neural2-F',
		savedTransLang: savedConfigTransLang[0]?.value || 'EN',
		savedTagPrompt: savedConfigTagPrompt[0]?.value || '',
		ttsBaseUrl,
		imgBaseUrl,
		imgFilter,
		sentences: sentencesWithTrans,
		searchQuery
	};
}) satisfies PageServerLoad;

export const actions = {
	process: async ({ request }) => {
		const formData = await request.formData();
		const prompt = String(formData.get('prompt') ?? '').trim();
		const lang = String(formData.get('lang') ?? 'en').trim();
		const sentence = String(formData.get('sentence') ?? '').trim();

		if (!prompt) {
			return fail(400, { error: '프롬프트를 입력해 주세요.' });
		}
		if (!lang) {
			return fail(400, { error: '언어 코드를 입력해 주세요.' });
		}
		if (!env.GEMINI_API_KEY) {
			return fail(500, { error: 'GEMINI_API_KEY 환경 변수를 설정해 주세요.' });
		}

		try {
			// 1. config 테이블에 프롬프트 및 언어 저장 (없으면 추가, 있으면 업데이트)
			await db
				.insert(config)
				.values({ key: 'LLM_SentToSent', value: prompt })
				.onConflictDoUpdate({
					target: config.key,
					set: { value: prompt }
				});

			await db
				.insert(config)
				.values({ key: 'LLM_Sent_Lang', value: lang })
				.onConflictDoUpdate({
					target: config.key,
					set: { value: lang }
				});

			// 2. Gemini API 호출하여 입력 문장을 프롬프트에 따라 변환
			// 언어 지시문을 프롬프트에 추가하여 대상 언어로 결과가 생성되도록 함
			const langInstruction = LANG_INSTRUCTION[lang] || '';
			const generatedRows = sentence
				? await transformSentencesWithPrompt([sentence], prompt + langInstruction)
				: await generateSentencesFromPrompt(prompt + langInstruction);

			if (generatedRows.length === 0) {
				return fail(500, { error: '생성된 문장이 없습니다.' });
			}

			const statements = generatedRows.map(row => row.statement.trim()).filter(Boolean);

			let newStatements: string[] = [];
			let duplicateCount = 0;

			if (statements.length > 0) {
				// 3. 중복 제외 로직
				const existing = await db
					.select({ sent: sentences.sent })
					.from(sentences)
					.where(inArray(sentences.sent, statements));

				const existingSet = new Set(existing.map(r => r.sent.trim()));
				newStatements = statements.filter(s => !existingSet.has(s));
				duplicateCount = statements.length - newStatements.length;

				// 4. 중복 제외된 새 문장들만 DB sentences 테이블에 저장
				if (newStatements.length > 0) {
					const insertData = newStatements.map((sent) => ({
						lang,
						sent,
						voice: '',
						speed: '1.0',
						tag: '',
						file_tts: '',
						file_image: '',
						createdAt: new Date()
					}));

					await db.insert(sentences).values(insertData);
				}
			}

			return {
				success: true,
				rows: generatedRows,
				insertedCount: newStatements.length,
				duplicateCount,
				savedPrompt: prompt
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'LLM 처리 중 오류가 발생했습니다.';
			return fail(500, { error: message });
		}
	},
	ttsProcess: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized: Admin access required' });
		}

		const formData = await request.formData();
		const sentenceId = Number(formData.get('sentenceId'));
		const voice = String(formData.get('voice') ?? '').trim();
		const speed = Number(formData.get('speed') ?? 1.0);
		const lang = String(formData.get('lang') ?? '').trim();

		if (!sentenceId) {
			return fail(400, { error: '문장을 선택해 주세요.' });
		}

		try {
			const [record] = await db
				.select({ sent: sentences.sent, file_tts: sentences.file_tts, lang: sentences.lang })
				.from(sentences)
				.where(eq(sentences.id, sentenceId))
				.limit(1);

			if (!record) {
				return fail(404, { error: '문장을 찾을 수 없습니다.' });
			}

			// 기존 MP3 파일 삭제
			if (record.file_tts && record.file_tts.trim()) {
				const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
				const ttsDirFull = path.resolve(process.cwd(), ttsDir);
				const filePath = path.join(ttsDirFull, record.file_tts);
				try {
					if (fs.existsSync(filePath)) {
						fs.unlinkSync(filePath);
					}
				} catch (e) {
					console.error('Failed to delete MP3 file:', filePath, e);
				}
			}

			const ttsResult = await generateTTS({
				text: record.sent,
				languageCode: lang || record.lang,
				voiceName: voice,
				speakingRate: speed
			});

			await db
				.update(sentences)
				.set({ file_tts: ttsResult.filename, voice, speed: String(speed), lang: lang || record.lang })
				.where(eq(sentences.id, sentenceId));

			// TTS 설정 저장
			await db
				.insert(config)
				.values({ key: 'TTS_Lang', value: lang || record.lang })
				.onConflictDoUpdate({
					target: config.key,
					set: { value: lang || record.lang }
				});

			await db
				.insert(config)
				.values({ key: 'TTS_Voice', value: voice })
				.onConflictDoUpdate({
					target: config.key,
					set: { value: voice }
				});

			return { success: true, file_tts: ttsResult.filename };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'TTS 생성 중 오류가 발생했습니다.';
			return fail(500, { error: message });
		}
	},
	ttsProcessAll: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized: Admin access required' });
		}

		const formData = await request.formData();
		const idsStr = String(formData.get('ids') || '');
		const voice = String(formData.get('voice') ?? '').trim();
		const speed = Number(formData.get('speed') ?? 1.0);
		const lang = String(formData.get('lang') ?? '').trim();

		const ids = idsStr.split(',').map(Number).filter(Boolean);

		if (ids.length === 0) {
			return fail(400, { error: '생성할 문장이 없습니다.' });
		}

		// 이미 생성된 문장 필터링
		const existingRecords = await db
			.select({ id: sentences.id, file_tts: sentences.file_tts })
			.from(sentences)
			.where(inArray(sentences.id, ids));

		const existingTtsIds = new Set(
			existingRecords.filter(r => r.file_tts && r.file_tts.trim()).map(r => r.id)
		);
		const ungeneratedIds = ids.filter(id => !existingTtsIds.has(id));

		if (ungeneratedIds.length === 0) {
			return fail(400, { error: '모든 문장의 TTS가 이미 생성되었습니다.' });
		}

		const records = await db
			.select({
				id: sentences.id,
				sent: sentences.sent,
				file_tts: sentences.file_tts,
				lang: sentences.lang
			})
			.from(sentences)
			.where(inArray(sentences.id, ungeneratedIds));

		const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
		const ttsDirFull = path.resolve(process.cwd(), ttsDir);
		let successCount = 0;
		let errorCount = 0;
		const errors: string[] = [];

		for (const record of records) {
			try {
				// 기존 MP3 파일 삭제
				if (record.file_tts && record.file_tts.trim()) {
					const filePath = path.join(ttsDirFull, record.file_tts);
					try {
						if (fs.existsSync(filePath)) {
							fs.unlinkSync(filePath);
						}
					} catch (e) {
						console.error('Failed to delete MP3 file:', filePath, e);
					}
				}

				const ttsResult = await generateTTS({
					text: record.sent,
					languageCode: lang || record.lang,
					voiceName: voice,
					speakingRate: speed
				});

				await db
					.update(sentences)
					.set({ file_tts: ttsResult.filename, voice, speed: String(speed), lang: lang || record.lang })
					.where(eq(sentences.id, record.id));

				successCount++;
			} catch (err) {
				const message = err instanceof Error ? err.message : 'TTS 생성 중 오류가 발생했습니다.';
				errors.push(`ID ${record.id}: ${message}`);
				errorCount++;
			}
		}

		// TTS 설정 저장
		await db
			.insert(config)
			.values({ key: 'TTS_Lang', value: lang })
			.onConflictDoUpdate({
				target: config.key,
				set: { value: lang }
			});

		await db
			.insert(config)
			.values({ key: 'TTS_Voice', value: voice })
			.onConflictDoUpdate({
				target: config.key,
				set: { value: voice }
			});

		return { success: true, successCount, errorCount };
	},
	translate: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const sentenceId = Number(formData.get('sentenceId'));
		const targetLang = String(formData.get('targetLang') ?? 'EN').trim();

		if (!sentenceId) {
			return fail(400, { error: '문장을 선택해 주세요.' });
		}

		const [record] = await db
			.select({ sent: sentences.sent, lang: sentences.lang })
			.from(sentences)
			.where(eq(sentences.id, sentenceId))
			.limit(1);

		if (!record) {
			return fail(404, { error: '문장을 찾을 수 없습니다.' });
		}

		const result = await translateSingle(record.sent, targetLang);
		if (result.error) return fail(500, { error: result.error });

		await db
			.insert(sentences_tran)
			.values({ id: sentenceId, lang: targetLang, sent: result.text! })
			.onConflictDoUpdate({
				target: [sentences_tran.id],
				set: { lang: targetLang, sent: result.text! }
			});

		await db
			.insert(config)
			.values({ key: 'Trans_lang', value: targetLang })
			.onConflictDoUpdate({
				target: [config.key],
				set: { value: targetLang }
			});

		return { success: true };
	},
	batchTranslate: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const targetLang = String(formData.get('targetLang') ?? 'EN').trim();
		const idsStr = String(formData.get('ids') || '');
		const ids = idsStr.split(',').map(Number).filter(Boolean);

		if (ids.length === 0) {
			return fail(400, { error: '번역할 문장이 없습니다.' });
		}

		const translatedIds = await db
			.select({ id: sentences_tran.id })
			.from(sentences_tran);
		const translatedIdSet = new Set(translatedIds.map(t => t.id));
		const untranslatedIds = ids.filter(id => !translatedIdSet.has(id));

		if (untranslatedIds.length === 0) {
			return fail(400, { error: '모든 문장이 이미 번역되었습니다.' });
		}

		const records = await db
			.select({ id: sentences.id, sent: sentences.sent, lang: sentences.lang })
			.from(sentences)
			.where(inArray(sentences.id, untranslatedIds));

		let successCount = 0;
		let errorCount = 0;

		for (const record of records) {
			const result = await translateSingle(record.sent, targetLang);
			if (result.error) {
				errorCount++;
				continue;
			}

			try {
				await db
					.insert(sentences_tran)
					.values({ id: record.id, lang: targetLang, sent: result.text! })
					.onConflictDoUpdate({
						target: [sentences_tran.id],
						set: { lang: targetLang, sent: result.text! }
					});
				successCount++;
			} catch {
				errorCount++;
			}
		}

		await db
			.insert(config)
			.values({ key: 'Trans_lang', value: targetLang })
			.onConflictDoUpdate({
				target: [config.key],
				set: { value: targetLang }
			});

		return { success: true, successCount, errorCount };
	},
	tagProcess: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const prompt = String(formData.get('prompt') ?? '').trim();
		const selectedSentenceId = Number(formData.get('selectedSentenceId'));

		if (!prompt) {
			return fail(400, { error: '프롬프트를 입력해 주세요.' });
		}
		if (!selectedSentenceId) {
			return fail(400, { error: '문장을 선택해 주세요.' });
		}
		if (!env.GEMINI_API_KEY) {
			return fail(500, { error: 'GEMINI_API_KEY 환경 변수를 설정해 주세요.' });
		}

		try {
			await db
				.insert(config)
				.values({ key: 'LLM_Tag', value: prompt })
				.onConflictDoUpdate({
					target: config.key,
					set: { value: prompt }
				});

			const [record] = await db
				.select({ sent: sentences.sent })
				.from(sentences)
				.where(eq(sentences.id, selectedSentenceId))
				.limit(1);

			if (!record) {
				return fail(404, { error: '문장을 찾을 수 없습니다.' });
			}

			const generatedRows = await transformSentencesWithPrompt([record.sent], prompt);

			if (generatedRows.length === 0) {
				return fail(500, { error: '생성된 태그가 없습니다.' });
			}

			const tag = generatedRows.map(row => row.statement.trim()).filter(Boolean).join(', ');

			await db
				.update(sentences)
				.set({ tag })
				.where(eq(sentences.id, selectedSentenceId));

			return { success: true, updatedId: selectedSentenceId, tag };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'LLM 처리 중 오류가 발생했습니다.';
			return fail(500, { error: message });
		}
	},
	batchGenerateTags: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const idsStr = String(formData.get('ids') || '');
		const ids = idsStr.split(',').map(Number).filter(Boolean);

		if (ids.length === 0) {
			return fail(400, { error: '태그를 생성할 문장이 없습니다.' });
		}

		if (!env.GEMINI_API_KEY) {
			return fail(500, { error: 'GEMINI_API_KEY 환경 변수를 설정해 주세요.' });
		}

		const savedConfig = await db
			.select()
			.from(config)
			.where(eq(config.key, 'LLM_Tag'))
			.limit(1);

		const prompt = savedConfig[0]?.value || '';
		if (!prompt) {
			return fail(400, { error: '저장된 프롬프트가 없습니다. 먼저 단일 태그 생성을 실행해 주세요.' });
		}

		const taggedSentences = await db
			.select({ id: sentences.id })
			.from(sentences)
			.where(ne(sentences.tag, ''));

		const taggedIdSet = new Set(taggedSentences.map(s => s.id));
		const untaggedIds = ids.filter(id => !taggedIdSet.has(id));

		if (untaggedIds.length === 0) {
			return fail(400, { error: '모든 문장에 이미 태그가 있습니다.' });
		}

		const records = await db
			.select({ id: sentences.id, sent: sentences.sent })
			.from(sentences)
			.where(inArray(sentences.id, untaggedIds));

		let successCount = 0;
		let errorCount = 0;

		for (const record of records) {
			try {
				const generatedRows = await transformSentencesWithPrompt([record.sent], prompt);
				if (generatedRows.length === 0) {
					errorCount++;
					continue;
				}

				const tag = generatedRows.map(row => row.statement.trim()).filter(Boolean).join(', ');

				await db
					.update(sentences)
					.set({ tag })
					.where(eq(sentences.id, record.id));

				successCount++;
			} catch {
				errorCount++;
			}
		}

		return { success: true, successCount, errorCount };
	},
	clearTag: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const sentenceId = Number(formData.get('sentenceId'));

		if (!sentenceId) {
			return fail(400, { error: '문장을 선택해 주세요.' });
		}

		await db
			.update(sentences)
			.set({ tag: '' })
			.where(eq(sentences.id, sentenceId));

		return { success: true };
	},
	toggleCheckImg: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const checkImg = Number(formData.get('check_img'));

		if (!id) {
			return fail(400, { error: 'ID가 필요합니다.' });
		}

		await db
			.update(sentences)
			.set({ check_img: checkImg })
			.where(eq(sentences.id, id));

		return { success: true };
	},
	deleteImage: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const id = Number(formData.get('id'));

		if (!id) {
			return fail(400, { error: 'ID가 필요합니다.' });
		}

		const [record] = await db
			.select({ file_image: sentences.file_image })
			.from(sentences)
			.where(eq(sentences.id, id))
			.limit(1);

		if (record?.file_image && record.file_image.trim()) {
			const imgDir = env.IMG_DIR || process.env.IMG_DIR || 'static/IMG';
			const imgDirFull = path.resolve(process.cwd(), imgDir);
			const imgFilePath = path.join(imgDirFull, record.file_image);
			try {
				if (fs.existsSync(imgFilePath)) {
					fs.unlinkSync(imgFilePath);
				}
			} catch (e) {
				console.error('Failed to delete image file:', imgFilePath, e);
			}
		}

		await db
			.update(sentences)
			.set({ file_image: '' })
			.where(eq(sentences.id, id));

		return { success: true };
	},
	deleteAll: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const id = Number(formData.get('id'));

		if (!id) {
			return fail(400, { error: 'ID가 필요합니다.' });
		}

		// 문장 + MP3 + 이미지 정보 조회
		const [record] = await db
			.select({ file_tts: sentences.file_tts, file_image: sentences.file_image })
			.from(sentences)
			.where(eq(sentences.id, id))
			.limit(1);

		if (!record) {
			return fail(404, { error: '문장을 찾을 수 없습니다.' });
		}

		// MP3 파일 삭제
		if (record.file_tts && record.file_tts.trim()) {
			const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
			const ttsDirFull = path.resolve(process.cwd(), ttsDir);
			const ttsPath = path.join(ttsDirFull, record.file_tts);
			try {
				if (fs.existsSync(ttsPath)) fs.unlinkSync(ttsPath);
			} catch (e) {
				console.error('Failed to delete MP3 file:', ttsPath, e);
			}
		}

		// 이미지 파일 삭제
		if (record.file_image && record.file_image.trim()) {
			const imgDir = env.IMG_DIR || process.env.IMG_DIR || 'static/IMG';
			const imgDirFull = path.resolve(process.cwd(), imgDir);
			const imgPath = path.join(imgDirFull, record.file_image);
			try {
				if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
			} catch (e) {
				console.error('Failed to delete image file:', imgPath, e);
			}
		}

		// 번역 데이터 삭제
		await db.delete(sentences_tran).where(eq(sentences_tran.id, id));

		// 문장 삭제
		await db.delete(sentences).where(eq(sentences.id, id));

		return { success: true };
	}
} satisfies Actions;
