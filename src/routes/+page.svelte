<script lang="ts">
	import { FileText, Sparkles, Calendar, ArrowRight, BookOpen } from '@lucide/svelte';
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';

	// Svelte 5 Runes Props
	let { data } = $props();

	// Format last updated date
	function formatDate(dateInput: string | undefined) {
		if (!dateInput) return '';
		const d = new Date(dateInput);
		return d.toLocaleDateString('ko-KR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>CircleUp - 공식 홈페이지</title>
	<meta name="description" content="CircleUp의 지정 대표 문서 및 중요 공지사항을 확인하세요." />
</svelte:head>

<div class="relative min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950 font-sans overflow-hidden flex flex-col items-center justify-start py-12 px-4 sm:px-6 lg:px-8">
	
	<!-- Premium background glow elements -->
	<div class="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-125 bg-linear-to-tr from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/5 dark:to-purple-500/5 rounded-full blur-3xl pointer-events-none z-0"></div>
	<div class="absolute bottom-10 right-10 w-72 h-72 bg-linear-to-br from-emerald-500/5 to-teal-500/5 rounded-full blur-2xl pointer-events-none z-0"></div>

	<!-- Main Wrapper -->
	<div class="w-full max-w-4xl z-10 flex flex-col gap-8">
		
		{#if data.document}
			<!-- Main Article Card -->
			<article class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-100 dark:shadow-none overflow-hidden transition-all duration-300">
				
				<!-- Article Accent Bar -->
				<div class="h-1.5 w-full bg-linear-to-r from-indigo-500 via-purple-500 to-emerald-500"></div>
				
				<!-- Content Area -->
				<div class="p-8 sm:p-12">
					<!-- Title -->
					<h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-8 border-b border-slate-100 dark:border-slate-800 pb-6">
						{data.document.title}
					</h1>

					<!-- TipTap Styled Read-Only Content -->
					<div class="prose prose-indigo dark:prose-invert prose-lg max-w-none" bind:innerHTML={data.document.content} contenteditable="false"></div>
				</div>
			</article>

			{#if data.navRightData?.role == 'admin'}
			<!-- Quick Editor Action (Floating Button style) -->
			<div class="flex justify-center mt-2">
				<a 
					href={resolve('/PoC/Doc/ContentsEditor' as Pathname)} 
					class="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-2xl text-sm font-semibold transition-all duration-300 transform hover:scale-[1.02] shadow-md shadow-slate-900/10 dark:shadow-none cursor-pointer"
				>
					<span>대표 문서 수정하기</span>
					<ArrowRight class="w-4 h-4 text-indigo-400" />
				</a>
			</div>
			{/if}
		{:else}
			<!-- Empty State / No Document Configured -->
			<div class="bg-white/60 dark:bg-slate-900/40 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl p-12 text-center flex flex-col items-center justify-center gap-6 max-w-2xl mx-auto my-12 transition-all duration-300">
				
				<div class="relative">
					<div class="w-20 h-20 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 animate-pulse">
						<FileText class="w-10 h-10 stroke-[1.2]" />
					</div>
					<Sparkles class="w-5 h-5 text-purple-400 absolute -top-1.5 -right-1.5 animate-bounce" />
				</div>

				<div class="space-y-2">
					<h2 class="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-200">
						홈페이지 대표 문서가 없습니다
					</h2>
					<p class="text-sm text-slate-400 dark:text-slate-500 max-w-md mx-auto leading-relaxed">
						현재 홈페이지에 게시하도록 지정된 대표 문서가 없습니다. 
						문서 관리 에디터에서 TipTap 에디터로 문서를 작성하고, 
						<strong>'홈페이지 대표로 지정'</strong>을 눌러 여기에 노출되도록 설정해 보세요.
					</p>
				</div>

				<div class="flex flex-col sm:flex-row gap-3 mt-2">
					<a 
						href={resolve('/doc/ContentsEditor' as Pathname)} 
						class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl text-sm font-bold shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all duration-300 transform hover:scale-[1.02] cursor-pointer"
					>
						<span>문서 편집기 바로가기</span>
						<ArrowRight class="w-4 h-4 text-indigo-200" />
					</a>
				</div>
			</div>
		{/if}

	</div>
</div>

<style>
	/* Make sure embedded HTML styled nicely */
	:global(.prose) {
		line-height: 1.75;
	}
	:global(.prose h1, .prose h2, .prose h3) {
		font-weight: 800;
		letter-spacing: -0.025em;
		margin-top: 1.5em;
		margin-bottom: 0.5em;
	}
	:global(.prose p) {
		margin-bottom: 1.25em;
	}
	:global(.prose blockquote) {
		font-style: italic;
		border-left-width: 4px;
		border-left-color: #6366f1;
		padding-left: 1.25em;
		margin: 1.5em 0;
		color: #4b5563;
	}
	:global(.dark .prose blockquote) {
		color: #9ca3af;
	}
	:global(.prose ul) {
		list-style-type: disc;
		padding-left: 1.5em;
		margin-bottom: 1.25em;
	}
	:global(.prose ol) {
		list-style-type: decimal;
		padding-left: 1.5em;
		margin-bottom: 1.25em;
	}
	:global(.prose code) {
		background-color: #f1f5f9;
		padding: 0.2em 0.4em;
		border-radius: 0.375rem;
		font-size: 0.875em;
		font-family: monospace;
	}
	:global(.dark .prose code) {
		background-color: #1e293b;
	}
	:global(.prose pre) {
		background-color: #0f172a;
		color: #f8fafc;
		padding: 1em 1.5em;
		border-radius: 0.75rem;
		overflow-x: auto;
		margin: 1.5em 0;
	}
</style>
