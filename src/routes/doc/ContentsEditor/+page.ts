import type { PageLoad } from './$types';
import type { DocumentItem } from './contents-editor';

export const load: PageLoad = async ({ fetch }) => {
	try {
		const [docsRes, configRes] = await Promise.all([
			fetch('/api/documents'),
			fetch('/api/config')
		]);

		const documents: DocumentItem[] = docsRes.ok ? await docsRes.json() : [];
		let homepageDocId: string | null = null;

		if (configRes.ok) {
			const configData = await configRes.json();
			homepageDocId = configData.value;
		}

		return { documents, homepageDocId };
	} catch (error) {
		console.error('Failed to load data:', error);
		return { documents: [] as DocumentItem[], homepageDocId: null };
	}
};
