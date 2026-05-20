import type { Editor, Extensions } from '@tiptap/core';
import type { EditorView } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import FileHandler from '@tiptap/extension-file-handler';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

const IMAGE_MIME_TYPES = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/svg+xml',
	'image/bmp'
];

export function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

/** Word / Excel / PowerPoint 등 Office HTML 붙여넣기 정리 */
export function cleanOfficePastedHtml(html: string): string {
	return (
		html
			.replace(/<!--[\s\S]*?-->/g, '')
			.replace(/<!\[if[^\]]*\]>[\s\S]*?<!\[endif\]>/gi, '')
			.replace(/<\/?o:[^>]*>/gi, '')
			.replace(/<\/?w:[^>]*>/gi, '')
			.replace(/<\/?m:[^>]*>/gi, '')
			.replace(/<\/?v:[^>]*>/gi, '')
			.replace(/ class="Mso[^"]*"/gi, '')
			.replace(/\s*mso-[^:]+:[^;"]+;?/gi, '')
			.replace(/\s*tab-stops:[^;"]+;?/gi, '')
			.replace(/<p[^>]*>\s*<\/p>/gi, '')
			.replace(/<span[^>]*>\s*<\/span>/gi, '')
			.trim()
	);
}

function insertImageSrc(editor: Editor, src: string) {
	editor.chain().focus().setImage({ src }).run();
}

export function createTiptapExtensions(): Extensions {
	return [
		StarterKit,
		Link.configure({
			openOnClick: false,
			autolink: true,
			HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' }
		}),
		Image.configure({
			inline: false,
			allowBase64: true,
			HTMLAttributes: { class: 'editor-image' }
		}),
		Youtube.configure({
			addPasteHandler: true,
			controls: true,
			nocookie: true,
			width: 640,
			height: 360,
			HTMLAttributes: { class: 'editor-youtube' }
		}),
		Table.configure({ resizable: true }),
		TableRow,
		TableHeader,
		TableCell,
		FileHandler.configure({
			allowedMimeTypes: IMAGE_MIME_TYPES,
			onPaste: async (editor, files, pasteContent) => {
				if (pasteContent?.trim()) {
					editor
						.chain()
						.focus()
						.insertContent(cleanOfficePastedHtml(pasteContent))
						.run();
					return;
				}
				for (const file of files) {
					const src = await readFileAsDataUrl(file);
					insertImageSrc(editor, src);
				}
			},
			onDrop: async (editor, files) => {
				for (const file of files) {
					const src = await readFileAsDataUrl(file);
					insertImageSrc(editor, src);
				}
			}
		})
	];
}

function handleClipboardImagePaste(
	_view: EditorView,
	event: ClipboardEvent,
	getEditor: () => Editor | null
): boolean {
	const clipboard = event.clipboardData;
	if (!clipboard) return false;

	const imageItems = Array.from(clipboard.items).filter((item) =>
		item.type.startsWith('image/')
	);
	if (imageItems.length === 0) return false;

	event.preventDefault();
	const editor = getEditor();
	if (!editor) return true;

	void Promise.all(
		imageItems.map(async (item) => {
			const file = item.getAsFile();
			if (!file) return;
			const src = await readFileAsDataUrl(file);
			insertImageSrc(editor, src);
		})
	);

	return true;
}

export function createEditorProps(getEditor: () => Editor | null) {
	return {
		attributes: {
			class:
				'prose dark:prose-invert max-w-none focus:outline-none min-h-[450px] px-6 py-4'
		},
		transformPastedHTML: cleanOfficePastedHtml,
		handlePaste: (view: EditorView, event: ClipboardEvent) =>
			handleClipboardImagePaste(view, event, getEditor)
	};
}

export function insertImageFromUrl(editor: Editor, url?: string) {
	const src = (url ?? prompt('이미지 URL을 입력하세요'))?.trim();
	if (src) {
		editor.chain().focus().setImage({ src }).run();
	}
}

export function insertYoutubeVideo(editor: Editor, url?: string) {
	const src = (url ?? prompt('YouTube URL을 입력하세요 (예: https://www.youtube.com/watch?v=...)'))?.trim();
	if (src) {
		editor.chain().focus().setYoutubeVideo({ src }).run();
	}
}

export async function insertImagesFromFiles(editor: Editor, files: FileList | File[]) {
	const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
	for (const file of list) {
		const src = await readFileAsDataUrl(file);
		insertImageSrc(editor, src);
	}
}
