<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { invalidate } from '$app/navigation';
	import { 
		Loader2, 
		Sparkles, 
		FileJson, 
		Database, 
		AlertTriangle, 
		CheckCircle2,
		ChevronDown,
		ChevronRight
	} from '@lucide/svelte';

	let { data, form }: PageProps = $props();

	let prompt = $state('');
	let selectedSentenceId = $state<number | null>(null);
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	// Collapsible 상태
	let headerOpen = $state(false);
	let settingsOpen = $state(false);
	let feedbackOpen = $state(false);

	const sentences = $derived(data.sentences);

	// 초기 로드 시 DB에서 불러온 프롬프트를 할당하되, 로컬에서 입력할 때는 종속적 반응을 제거
	$effect(() => {
		untrack(() => {
			if (data.savedPrompt) {
				prompt = data.savedPrompt;
			}
		});
	});

	$effect(() => {
		if (form?.error) {
			errorMessage = form.error;
			feedbackOpen = true;
		}
		if (form?.success) {
			errorMessage = null;
			feedbackOpen = true;
			if (form?.successCount !== undefined) {
				successMessage = `태그 생성 완료: ${form.successCount}건 성공`;
				if (form?.errorCount && form.errorCount > 0) {
					successMessage += `, ${form.errorCount}건 실패`;
				}
			} else {
				successMessage = null;
			}
		}
	});

	function onGenerateTag() {
		loading = true;
		errorMessage = null;
		return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: () => Promise<void> }) => {
			await update();
			loading = false;
			if (result?.type === 'success' && result?.data?.success) {
				await invalidate('app:sentences');
			}
		};
	}

</script>

<div class="space-y-6 p-6">
	<!-- 헤더 영역 -->
	<Collapsible.Root bind:open={headerOpen}>
		<Collapsible.Trigger class="flex w-full items-center justify-between rounded-lg border border-muted bg-muted/20 p-4 hover:bg-muted/40 transition-colors">
			<div class="flex items-center gap-2">
				<Sparkles class="size-6 text-indigo-500" />
				<h1 class="text-2xl font-bold tracking-tight">LLM Tag Generation</h1>
			</div>
			{#if headerOpen}
				<ChevronDown class="size-5 text-muted-foreground" />
			{:else}
				<ChevronRight class="size-5 text-muted-foreground" />
			{/if}
		</Collapsible.Trigger>
		<Collapsible.Content class="pt-3">
			<div class="space-y-1 pl-1">
				<p class="text-muted-foreground text-sm">
					선택한 문장에 대해 Google Gemini API를 활용하여 태그를 생성하고 데이터베이스에 저장합니다.
				</p>
				{#if !data.geminiConfigured}
					<div class="bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-2 rounded-lg border p-3.5 text-sm mt-3">
						<AlertTriangle class="size-4.5 mt-0.5 shrink-0" />
						<div>
							<p class="font-semibold">Gemini API Key 미설정</p>
							<p class="text-muted-foreground mt-0.5">
								<code>GEMINI_API_KEY</code>가 설정되지 않았습니다. 태그를 생성하려면 <code>.env</code> 파일에 API 키를 추가해 주세요.
							</p>
						</div>
					</div>
				{/if}
			</div>
		</Collapsible.Content>
	</Collapsible.Root>

	<!-- 설정 영역 -->
	<Collapsible.Root bind:open={settingsOpen}>
		<Collapsible.Trigger class="flex w-full items-center justify-between rounded-lg border border-muted bg-muted/20 p-4 hover:bg-muted/40 transition-colors">
			<div class="flex items-center gap-2">
				<Database class="size-5 text-indigo-500" />
				<h2 class="text-lg font-semibold">생성 설정</h2>
			</div>
			{#if settingsOpen}
				<ChevronDown class="size-5 text-muted-foreground" />
			{:else}
				<ChevronRight class="size-5 text-muted-foreground" />
			{/if}
		</Collapsible.Trigger>
		<Collapsible.Content class="pt-3">
			<div class="space-y-4">
				<!-- 문장 선택 드롭다운 -->
				<div class="space-y-1.5">
					<label for="sentence-select" class="text-sm font-medium">문장 선택</label>
					<select
						id="sentence-select"
						bind:value={selectedSentenceId}
						class="w-full rounded-md border border-muted bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
					>
						<option value={null}>-- 문장을 선택하세요 --</option>
						{#each sentences as s (s.id)}
							<option value={s.id}>{s.id} - {s.sent}</option>
						{/each}
					</select>
				</div>

				<!-- 프롬프트 입력 -->
				<div class="space-y-1.5">
					<label for="prompt-textarea" class="text-sm font-medium flex items-center gap-2">
						<FileJson class="size-4 text-indigo-500" />
						프롬프트 지시사항
					</label>
					<p class="text-xs text-muted-foreground">Gemini가 문장에 어떤 태그를 생성할지 구체적으로 지시합니다.</p>
					<Textarea
						id="prompt-textarea"
						form="tag-generate-form"
						name="prompt"
						bind:value={prompt}
						placeholder="예: 입력된 문장에 적합한 태그를 3~5개 생성해줘."
						class="w-full resize-none border-muted focus-visible:ring-indigo-500 text-lg leading-relaxed max-h-[calc(5*1.5rem)] overflow-y-auto"
					/>
				</div>

				<!-- 태그 생성 버튼 -->
				<Button
					type="submit"
					form="tag-generate-form"
					class="w-full py-5 text-sm font-semibold shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-all duration-200"
					disabled={loading || selectedSentenceId === null || !prompt.trim()}
				>
					{#if loading}
						<Loader2 class="size-4 animate-spin mr-2" />
						생성 중...
					{:else}
						<Sparkles class="size-4 mr-2" />
						Tag 생성하기
					{/if}
				</Button>
			</div>
		</Collapsible.Content>
	</Collapsible.Root>

	<!-- 숨겨진 태그 생성 폼 -->
	<form method="POST" action="?/process" use:enhance={onGenerateTag} id="tag-generate-form">
		<input type="hidden" name="selectedSentenceId" value={selectedSentenceId} />
		<input type="hidden" name="prompt" value={prompt} />
	</form>

	<!-- 피드백 메시지 -->
	<Collapsible.Root bind:open={feedbackOpen}>
		<Collapsible.Trigger class="flex w-full items-center justify-between rounded-lg border border-muted bg-muted/20 p-4 hover:bg-muted/40 transition-colors">
			<div class="flex items-center gap-2">
				<CheckCircle2 class="size-5 text-indigo-500" />
				<h2 class="text-lg font-semibold">피드백</h2>
			</div>
			{#if feedbackOpen}
				<ChevronDown class="size-5 text-muted-foreground" />
			{:else}
				<ChevronRight class="size-5 text-muted-foreground" />
			{/if}
		</Collapsible.Trigger>
		<Collapsible.Content class="pt-3">
			<div class="space-y-3">
				{#if errorMessage}
					<div class="bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-2 rounded-lg border p-4 text-sm">
						<AlertTriangle class="size-4 shrink-0 mt-0.5" />
						<div>{errorMessage}</div>
					</div>
				{/if}

				{#if successMessage}
					<div class="bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400 flex items-start gap-2 rounded-lg border p-4 text-sm">
						<CheckCircle2 class="size-4 shrink-0 mt-0.5" />
						<div>{successMessage}</div>
					</div>
				{/if}

				{#if !errorMessage && !successMessage}
					<p class="text-muted-foreground text-sm">아직 피드백이 없습니다.</p>
				{/if}
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
</div>
