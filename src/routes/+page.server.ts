import { db } from '$lib/server/db';
import { document, config } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

const HOMEPAGE_DOC_KEY = 'homepage_document_id';

export const load: PageServerLoad = async () => {
	try {
		// 1. Fetch the designated homepage document ID from config
		const configResult = await db
			.select()
			.from(config)
			.where(eq(config.key, HOMEPAGE_DOC_KEY))
			.limit(1);

		const homepageDocId = configResult.length > 0 ? configResult[0].value : null;

		if (!homepageDocId) {
			return { document: null };
		}

		// 2. Retrieve the document details
		const docResult = await db
			.select()
			.from(document)
			.where(eq(document.id, homepageDocId))
			.limit(1);

		if (docResult.length === 0) {
			return { document: null };
		}

		return {
			document: {
				id: docResult[0].id,
				title: docResult[0].title,
				content: docResult[0].content,
				updatedAt: docResult[0].updatedAt.toISOString() // Serialize date for transmission
			}
		};
	} catch (error: any) {
		console.error('Failed to load homepage document:', error);
		return { document: null, error: error.message };
	}
};
