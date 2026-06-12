import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sentences, sentences_tran, config } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { translateSingle } from '$lib/server/translate';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	// config에서 저장된 번역 언어 조회
	const savedConfigTransLang = await db
		.select()
		.from(config)
		.where(eq(config.key, 'Trans_lang'))
		.limit(1);

	return {
		geminiConfigured: Boolean(env.GEMINI_API_KEY),
		sentences: [],
		savedTransLang: savedConfigTransLang[0]?.value || 'EN'
	};
}) satisfies PageServerLoad;

export const actions = {
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

		// 문장 조회
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

		// sentences_tran에 저장 (upsert)
		await db
			.insert(sentences_tran)
			.values({
				id: sentenceId,
				lang: targetLang,
				sent: result.text!
			})
			.onConflictDoUpdate({
				target: [sentences_tran.id],
				set: { lang: targetLang, sent: result.text! }
			});

		// config에 Trans_lang 저장
		await db
			.insert(config)
			.values({ key: 'Trans_lang', value: targetLang })
			.onConflictDoUpdate({
				target: [config.key],
				set: { value: targetLang }
			});

		return { success: true };
	},

	batchTranslate: async ({ request, locals, url }) => {
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

		// 미번역 문장만 필터링
		const translatedIds = await db
			.select({ id: sentences_tran.id })
			.from(sentences_tran);
		const translatedIdSet = new Set(translatedIds.map(t => t.id));
		const untranslatedIds = ids.filter(id => !translatedIdSet.has(id));

		if (untranslatedIds.length === 0) {
			return fail(400, { error: '모든 문장이 이미 번역되었습니다.' });
		}

		// 문장들 조회
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
					.values({
						id: record.id,
						lang: targetLang,
						sent: result.text!
					})
					.onConflictDoUpdate({
						target: [sentences_tran.id],
						set: { lang: targetLang, sent: result.text! }
					});
				successCount++;
			} catch {
				errorCount++;
			}
		}

		// config에 Trans_lang 저장
		await db
			.insert(config)
			.values({ key: 'Trans_lang', value: targetLang })
			.onConflictDoUpdate({
				target: [config.key],
				set: { value: targetLang }
			});

		return { success: true, successCount, errorCount };
	}
} satisfies Actions;
