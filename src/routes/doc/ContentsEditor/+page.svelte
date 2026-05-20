<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import type { PageProps } from './$types';
	import {
		formatDate,
		createDocument,
		updateDocument,
		deleteDocumentById,
		updateHomepageDocument,
		type DocumentItem,
		type SaveStatus
	} from './contents-editor';
	import {
		createTiptapExtensions,
		createEditorProps,
		insertImageFromUrl,
		insertYoutubeVideo,
		insertImagesFromFiles
	} from './tiptap-editor';
	import {
		Plus,
		Trash2,
		Search,
		FileText,
		Home,
		Check,
		Loader2,
		Sparkles,
		Bold,
		Italic,
		Strikethrough,
		Heading1,
		Heading2,
		Heading3,
		Quote,
		List,
		ListOrdered,
		Code,
		Undo2,
		Redo2,
		Save,
		FileEdit,
		Image,
		ImagePlus,
		Video
	} from '@lucide/svelte';

	let { data }: PageProps = $props();

	let documents = $state<DocumentItem[]>([]);
	let activeDocId = $state<string | null>(null);
	let homepageDocId = $state<string | null>(null);

	$effect(() => {
		documents = data.documents;
		homepageDocId = data.homepageDocId;
	});
	let searchQuery = $state('');
	let saveStatus = $state<SaveStatus>('idle');

	let editorElement = $state<HTMLDivElement>();
	let editor = $state<Editor | null>(null);
	let imageFileInput = $state<HTMLInputElement>();

	let isBold = $state(false);
	let isItalic = $state(false);
	let isStrike = $state(false);
	let isH1 = $state(false);
	let isH2 = $state(false);
	let isH3 = $state(false);
	let isBulletList = $state(false);
	let isOrderedList = $state(false);
	let isBlockquote = $state(false);
	let isCodeBlock = $state(false);

	let currentTitle = $state('');

	let autoSaveTimeout: ReturnType<typeof setTimeout> | undefined;

	const activeDoc = $derived(documents.find((d) => d.id === activeDocId) || null);
	const filteredDocuments = $derived(
		documents.filter(
			(doc) =>
				doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(doc.content && doc.content.toLowerCase().includes(searchQuery.toLowerCase()))
		)
	);

	$effect(() => {
		if (documents.length > 0 && !activeDocId) {
			selectDocument(documents[0].id);
		}
	});

	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
		if (autoSaveTimeout) {
			clearTimeout(autoSaveTimeout);
		}
	});

	function syncToolbarState(ed: Editor) {
		isBold = ed.isActive('bold');
		isItalic = ed.isActive('italic');
		isStrike = ed.isActive('strike');
		isH1 = ed.isActive('heading', { level: 1 });
		isH2 = ed.isActive('heading', { level: 2 });
		isH3 = ed.isActive('heading', { level: 3 });
		isBulletList = ed.isActive('bulletList');
		isOrderedList = ed.isActive('orderedList');
		isBlockquote = ed.isActive('blockquote');
		isCodeBlock = ed.isActive('codeBlock');
	}

	function initTiptap(initialContent: string) {
		if (editor) {
			editor.destroy();
		}

		editor = new Editor({
			element: editorElement,
			extensions: createTiptapExtensions(),
			content: initialContent,
			editorProps: createEditorProps(() => editor),
			onUpdate: ({ editor: ed }) => {
				syncToolbarState(ed);
				triggerAutoSave();
			},
			onSelectionUpdate: ({ editor: ed }) => {
				syncToolbarState(ed);
			}
		});
	}

	function selectDocument(id: string) {
		if (autoSaveTimeout) {
			clearTimeout(autoSaveTimeout);
			saveActiveDocumentImmediately();
		}

		activeDocId = id;
		const doc = documents.find((d) => d.id === id);
		if (doc) {
			currentTitle = doc.title;
			if (editor) {
				editor.commands.setContent(doc.content || '');
			} else {
				setTimeout(() => {
					initTiptap(doc.content || '');
				}, 50);
			}
		}
	}

	async function createNewDocument() {
		saveStatus = 'saving';
		const newDoc = await createDocument();

		if (newDoc) {
			documents = [newDoc, ...documents];
			selectDocument(newDoc.id);
			saveStatus = 'saved';
			setTimeout(() => {
				saveStatus = 'idle';
			}, 2000);
		} else {
			saveStatus = 'error';
		}
	}

	function triggerAutoSave() {
		saveStatus = 'saving';
		if (autoSaveTimeout) clearTimeout(autoSaveTimeout);

		autoSaveTimeout = setTimeout(async () => {
			await saveActiveDocumentImmediately();
		}, 1500);
	}

	async function saveActiveDocumentImmediately() {
		if (!activeDocId || !editor) return;

		const updated = await updateDocument(
			activeDocId,
			currentTitle || '제목 없는 문서',
			editor.getHTML()
		);

		if (updated) {
			documents = documents.map((d) => (d.id === activeDocId ? updated : d));
			saveStatus = 'saved';
			setTimeout(() => {
				if (saveStatus === 'saved') saveStatus = 'idle';
			}, 2000);
		} else {
			saveStatus = 'error';
		}
	}

	async function deleteDocument(id: string, event: MouseEvent) {
		event.stopPropagation();

		if (!confirm('정말로 이 문서를 삭제하시겠습니까?')) return;

		const ok = await deleteDocumentById(id);

		if (ok) {
			documents = documents.filter((d) => d.id !== id);

			if (activeDocId === id) {
				editor?.destroy();
				editor = null;
				activeDocId = null;
				currentTitle = '';

				if (documents.length > 0) {
					selectDocument(documents[0].id);
				}
			}

			if (homepageDocId === id) {
				await setAsHomepageDocument(null);
			}
		}
	}

	async function setAsHomepageDocument(id: string | null) {
		const ok = await updateHomepageDocument(id);
		if (ok) {
			homepageDocId = id;
		}
	}

	function openImageFilePicker() {
		imageFileInput?.click();
	}

	async function onImageFileSelected(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!editor || !input.files?.length) return;
		await insertImagesFromFiles(editor, input.files);
		input.value = '';
	}
</script>

<div class="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
	
	<!-- LEFT SIDEBAR: Document List -->
	<aside class="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
		<!-- Sidebar Header -->
		<div class="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3">
			<div class="flex items-center justify-between">
				<h2 class="text-xl font-bold tracking-tight flex items-center gap-2">
					<Sparkles class="w-5 h-5 text-indigo-500 animate-pulse" />
					문서 관리함
				</h2>
				<button 
					onclick={createNewDocument}
					class="p-2 bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md flex items-center justify-center cursor-pointer"
					title="새 문서 만들기"
				>
					<Plus class="w-5 h-5" />
				</button>
			</div>

			<!-- Search Bar -->
			<div class="relative w-full">
				<Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
				<input
					type="text"
					placeholder="문서 제목 또는 내용 검색..."
					bind:value={searchQuery}
					class="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
				/>
			</div>
		</div>

		<!-- Document Cards Container -->
		<div class="flex-1 overflow-y-auto p-3 space-y-2">
			{#if filteredDocuments.length === 0}
				<div class="text-center py-12 text-slate-400">
					<FileText class="w-12 h-12 mx-auto stroke-1 mb-2 opacity-50" />
					<p class="text-sm">검색 결과가 없거나<br/>생성된 문서가 없습니다.</p>
				</div>
			{:else}
				{#each filteredDocuments as doc (doc.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div 
						onclick={() => selectDocument(doc.id)}
						class="group relative p-4 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col gap-1.5 select-none
							{activeDocId === doc.id 
								? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 dark:border-indigo-400/80 shadow-md shadow-indigo-500/5' 
								: 'bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm'}"
					>
						<div class="flex items-start justify-between gap-2">
							<span class="font-bold text-sm line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
								{doc.title || '제목 없는 문서'}
							</span>
							
							<!-- Action Button Container (Trash) -->
							<button 
								onclick={(e) => deleteDocument(doc.id, e)}
								class="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 rounded-md transition-all duration-200 cursor-pointer"
								title="문서 삭제"
							>
								<Trash2 class="w-3.5 h-3.5" />
							</button>
						</div>

						<div class="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-1">
							<span>수정일: {formatDate(doc.updatedAt)}</span>
							
							{#if homepageDocId === doc.id}
								<span class="px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full font-bold flex items-center gap-0.5 border border-emerald-500/20 shadow-sm animate-pulse">
									<Home class="w-2.5 h-2.5" />
									대표
								</span>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</aside>

	<!-- RIGHT CONTENT: Editor -->
	<main class="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
		{#if activeDoc}
			<!-- Editor Top Header (Title + Auto Save state + Homepage Toggler) -->
			<div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
				<div class="flex-1 min-w-0">
					<input 
						type="text" 
						bind:value={currentTitle}
						oninput={triggerAutoSave}
						placeholder="문서 제목을 입력하세요..."
						class="w-full text-2xl font-extrabold tracking-tight bg-transparent border-0 focus:outline-none focus:ring-0 p-0 text-slate-950 dark:text-white"
					/>
				</div>

				<div class="flex items-center gap-3">
					<!-- Auto Save Status Indicator -->
					<div class="text-xs font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1.5 select-none">
						{#if saveStatus === 'saving'}
							<Loader2 class="w-3.5 h-3.5 animate-spin text-indigo-500" />
							<span>저장 중...</span>
						{:else if saveStatus === 'saved'}
							<Check class="w-3.5 h-3.5 text-emerald-500" />
							<span class="text-emerald-500 font-semibold">저장 완료</span>
						{:else if saveStatus === 'error'}
							<span class="text-red-500 font-semibold">저장 실패</span>
						{:else}
							<span>자동 저장 활성화</span>
						{/if}
					</div>

					<!-- Homepage Toggle Button -->
					{#if homepageDocId === activeDoc.id}
						<button 
							onclick={() => setAsHomepageDocument(null)}
							class="px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
						>
							<Home class="w-3.5 h-3.5" />
							대표 게시중
						</button>
					{:else}
						<button 
							onclick={() => setAsHomepageDocument(activeDoc.id)}
							class="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-850 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
						>
							<Home class="w-3.5 h-3.5" />
							홈페이지 대표로 지정
						</button>
					{/if}

					<!-- Save immediately button -->
					<button 
						onclick={saveActiveDocumentImmediately}
						class="p-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
						title="즉시 저장"
					>
						<Save class="w-4 h-4" />
					</button>
				</div>
			</div>

			<!-- Tiptap Custom Toolbar (Sleek design) -->
			{#if editor}
				<div class="px-6 py-2 border-b border-slate-150 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap gap-1 items-center shrink-0">
					<!-- Undo / Redo -->
					<button 
						onclick={() => editor?.chain().focus().undo().run()} 
						class="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg transition-all cursor-pointer"
						title="실행 취소 (Ctrl+Z)"
					>
						<Undo2 class="w-4 h-4" />
					</button>
					<button 
						onclick={() => editor?.chain().focus().redo().run()} 
						class="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg transition-all cursor-pointer"
						title="다시 실행 (Ctrl+Y)"
					>
						<Redo2 class="w-4 h-4" />
					</button>

					<div class="w-px h-5 bg-slate-250 dark:bg-slate-850 mx-1"></div>

					<!-- Bold / Italic / Strike -->
					<button 
						onclick={() => editor?.chain().focus().toggleBold().run()} 
						class="p-2 rounded-lg transition-all cursor-pointer {isBold ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}"
						title="굵게 (Ctrl+B)"
					>
						<Bold class="w-4 h-4" />
					</button>
					<button 
						onclick={() => editor?.chain().focus().toggleItalic().run()} 
						class="p-2 rounded-lg transition-all cursor-pointer {isItalic ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}"
						title="기울임 (Ctrl+I)"
					>
						<Italic class="w-4 h-4" />
					</button>
					<button 
						onclick={() => editor?.chain().focus().toggleStrike().run()} 
						class="p-2 rounded-lg transition-all cursor-pointer {isStrike ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}"
						title="취소선"
					>
						<Strikethrough class="w-4 h-4" />
					</button>

					<div class="w-px h-5 bg-slate-250 dark:bg-slate-850 mx-1"></div>

					<!-- Headings -->
					<button 
						onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} 
						class="p-2 rounded-lg transition-all cursor-pointer {isH1 ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}"
						title="제목 1"
					>
						<Heading1 class="w-4 h-4" />
					</button>
					<button 
						onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} 
						class="p-2 rounded-lg transition-all cursor-pointer {isH2 ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}"
						title="제목 2"
					>
						<Heading2 class="w-4 h-4" />
					</button>
					<button 
						onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} 
						class="p-2 rounded-lg transition-all cursor-pointer {isH3 ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}"
						title="제목 3"
					>
						<Heading3 class="w-4 h-4" />
					</button>

					<div class="w-px h-5 bg-slate-250 dark:bg-slate-850 mx-1"></div>

					<!-- Lists & Code Block -->
					<button 
						onclick={() => editor?.chain().focus().toggleBulletList().run()} 
						class="p-2 rounded-lg transition-all cursor-pointer {isBulletList ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}"
						title="기호 리스트"
					>
						<List class="w-4 h-4" />
					</button>
					<button 
						onclick={() => editor?.chain().focus().toggleOrderedList().run()} 
						class="p-2 rounded-lg transition-all cursor-pointer {isOrderedList ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}"
						title="숫자 리스트"
					>
						<ListOrdered class="w-4 h-4" />
					</button>
					<button 
						onclick={() => editor?.chain().focus().toggleBlockquote().run()} 
						class="p-2 rounded-lg transition-all cursor-pointer {isBlockquote ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}"
						title="인용구"
					>
						<Quote class="w-4 h-4" />
					</button>
					<button 
						onclick={() => editor?.chain().focus().toggleCodeBlock().run()} 
						class="p-2 rounded-lg transition-all cursor-pointer {isCodeBlock ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}"
						title="코드 블록"
					>
						<Code class="w-4 h-4" />
					</button>

					<div class="w-px h-5 bg-slate-250 dark:bg-slate-850 mx-1"></div>

					<button
						onclick={openImageFilePicker}
						class="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg transition-all cursor-pointer"
						title="이미지 파일 추가 (붙여넣기·드래그 지원)"
					>
						<Image class="w-4 h-4" />
					</button>
					<button
						onclick={() => editor && insertImageFromUrl(editor)}
						class="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg transition-all cursor-pointer"
						title="이미지 URL로 추가"
					>
						<ImagePlus class="w-4 h-4" />
					</button>
					<button
						onclick={() => editor && insertYoutubeVideo(editor)}
						class="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-red-500 dark:text-red-400 rounded-lg transition-all cursor-pointer"
						title="YouTube 동영상 삽입 (URL 붙여넣기 지원)"
					>
						<Video class="w-4 h-4" />
					</button>

					<input
						bind:this={imageFileInput}
						type="file"
						accept="image/*"
						multiple
						class="hidden"
						onchange={onImageFileSelected}
					/>
				</div>
			{/if}

			<!-- Editor Content Area -->
			<div class="flex-1 overflow-y-auto bg-white dark:bg-slate-900 border-none">
				<div bind:this={editorElement} class="outline-none min-h-125"></div>
			</div>
		{:else}
			<!-- Empty State -->
			<div class="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 select-none p-6">
				<div class="relative mb-6">
					<div class="w-24 h-24 bg-linear-to-tr from-indigo-500/10 to-purple-500/10 dark:from-indigo-400/5 dark:to-purple-400/5 rounded-3xl flex items-center justify-center">
						<FileEdit class="w-12 h-12 stroke-[1.2] text-indigo-500/70" />
					</div>
					<Sparkles class="w-6 h-6 text-indigo-400 absolute -top-1 -right-1 animate-bounce" />
				</div>
				<h3 class="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">
					선택된 문서가 없습니다
				</h3>
				<p class="text-sm text-center max-w-xs mb-6 text-slate-400 dark:text-slate-500">
					좌측 사이드바에서 문서를 선택하거나, 새 문서를 만들어 고급스러운 TipTap 에디터로 작성해 보세요.
				</p>
				<button 
					onclick={createNewDocument}
					class="px-5 py-2.5 bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-semibold shadow-md transition-all duration-300 transform hover:scale-102 flex items-center gap-2 cursor-pointer"
				>
					<Plus class="w-4 h-4" />
					새 문서 생성하기
				</button>
			</div>
		{/if}
	</main>
</div>

<style>
	/* Custom TipTap Tiptap Editor focus styles inside global prose */
	:global(.ProseMirror) {
		outline: none !important;
	}

	:global(.ProseMirror .editor-image) {
		max-width: 100%;
		height: auto;
		border-radius: 0.5rem;
		margin: 0.75rem 0;
	}

	:global(.ProseMirror .editor-youtube) {
		display: block;
		width: 100%;
		max-width: 640px;
		aspect-ratio: 16 / 9;
		height: auto;
		margin: 1rem 0;
		border-radius: 0.5rem;
		border: 0;
	}

	:global(.ProseMirror table) {
		border-collapse: collapse;
		width: 100%;
		margin: 0.75rem 0;
	}

	:global(.ProseMirror th),
	:global(.ProseMirror td) {
		border: 1px solid #cbd5e1;
		padding: 0.375rem 0.5rem;
		min-width: 3rem;
	}

	:global(.dark .ProseMirror th),
	:global(.dark .ProseMirror td) {
		border-color: #475569;
	}
	
	/* Style scrollbars gently */
	::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}
	::-webkit-scrollbar-track {
		background: transparent;
	}
	::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 9999px;
	}
	:global(.dark) ::-webkit-scrollbar-thumb {
		background: #334155;
	}
	::-webkit-scrollbar-thumb:hover {
		background: #94a3b8;
	}
</style>
