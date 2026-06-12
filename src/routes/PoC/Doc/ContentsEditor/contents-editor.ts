export interface DocumentItem {
	id: string;
	title: string;
	content: string;
	createdAt: Date | string;
	updatedAt: Date | string;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function formatDate(dateInput: Date | string | number | null | undefined) {
	if (!dateInput) return '';
	const d = new Date(dateInput);
	return d.toLocaleDateString('ko-KR', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export async function createDocument(): Promise<DocumentItem | null> {
	try {
		const res = await fetch('/api/documents', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: '제목 없는 문서',
				content: '<p>여기에 내용을 작성하세요...</p>'
			})
		});

		if (res.ok) {
			return await res.json();
		}
	} catch (error) {
		console.error(error);
	}
	return null;
}

export async function updateDocument(
	id: string,
	title: string,
	content: string
): Promise<DocumentItem | null> {
	try {
		const res = await fetch(`/api/documents/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: title || '제목 없는 문서',
				content
			})
		});

		if (res.ok) {
			return await res.json();
		}
	} catch (error) {
		console.error(error);
	}
	return null;
}

export async function deleteDocumentById(id: string): Promise<boolean> {
	try {
		const res = await fetch(`/api/documents/${id}`, {
			method: 'DELETE'
		});
		return res.ok;
	} catch (error) {
		console.error(error);
		return false;
	}
}

export async function updateHomepageDocument(id: string | null): Promise<boolean> {
	try {
		const res = await fetch('/api/config', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ value: id })
		});
		return res.ok;
	} catch (error) {
		console.error(error);
		return false;
	}
}
