<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { invalidate } from '$app/navigation';
	import { Input } from '$lib/components/ui/input/index.js';
	import { 
		Loader2, 
		Sparkles, 
		FileJson, 
		Tag, 
		Database, 
		AlertTriangle, 
		CheckCircle2,
		Search,
		X,
		Trash2
	} from '@lucide/svelte';

	let { data, form }: PageProps = $props();

	let prompt = $state('');
	let selectedSentenceId = $state<number | null>(null);
	let tagFilter = $state<'all' | 'generated' | 'not-generated'>((data.tagFilter as 'all' | 'generated' | 'not-generated') || 'not-generated');
	let loading = $state(false);
	let batchLoading = $state(false);
	let clearTagLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let clearTagId = $state<number | null>(null);

	let searchQuery = $state(data.searchQuery);

	const sentences = $derived(data.sentences);

	const filteredSentences = $derived(sentences.filter((s) => {
		if (tagFilter === 'all') return true;
		const hasTag = s.tag && s.tag !== '';
		if (tagFilter === 'generated') return hasTag;
		return !hasTag; // not-generated
	}));

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
		}
		if (form?.success) {
			errorMessage = null;
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

	function onBatchGenerateTags() {
		batchLoading = true;
		errorMessage = null;
		return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: () => Promise<void> }) => {
			await update();
			batchLoading = false;
			if (result?.type === 'success' && result?.data?.success) {
				await invalidate('app:sentences');
			}
		};
	}

	function handleSearch() {
		const searchParam = searchQuery.trim() ? `search=${encodeURIComponent(searchQuery)}` : '';
		const filterParam = `tagFilter=${tagFilter}`;
		const params = searchParam ? `?${filterParam}&${searchParam}` : `?${filterParam}`;
		window.location.href = `/gen/LLM_Tag${params}`;
	}

	async function handleDelete(id: number) {
		if (!confirm('삭제하시겠습니까?')) return;
		try {
			const res = await fetch('/gen/LLM_Tag', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.message || '삭제 오류');
			}
			await invalidate('app:sentences');
		} catch (e: unknown) {
			errorMessage = e instanceof Error ? e.message : '알 수 없는 오류';
		}
	}

	function onClearTag() {
		clearTagLoading = true;
		errorMessage = null;
		return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: () => Promise<void> }) => {
			await update();
			clearTagLoading = false;
			clearTagId = null;
			if (result?.type === 'success' && result?.data?.success) {
				await invalidate('app:sentences');
			}
		};
	}

	function handleClearTag(id: number) {
		if (!confirm('태그를 삭제하시겠습니까?')) return;
		clearTagId = id;
		// hidden form을 통해 제출
		const form = document.getElementById('clear-tag-form') as HTMLFormElement;
		if (form) {
			form.requestSubmit();
		}
	}
</script>

<div class="space-y-6 p-6">
	<!-- 헤더 영역 -->
	<div class="space-y-1">
		<h1 class="flex items-center gap-2 text-2xl font-bold tracking-tight">
			<Sparkles class="size-6 text-indigo-500" />
			LLM Tag Generation
		</h1>
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

	<!-- 메인 폼 및 설정 카드 -->
	<div class="grid gap-6 lg:grid-cols-3">
		<!-- 생성 설정 (좌측 1/3) -->
		<Card.Root class="lg:col-span-1 border-muted">
			<Card.Header>
				<Card.Title class="text-base flex items-center gap-2">
					<Database class="size-4 text-indigo-500" />
					선택된 문장
				</Card.Title>
				<Card.Description>테이블에서 문장을 클릭하여 선택하세요.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-3">
				<div class="min-h-[6rem] rounded-lg border border-muted bg-muted/30 p-4 text-sm leading-relaxed">
					{#if selectedSentenceId !== null}
						{@const selected = sentences.find(s => s.id === selectedSentenceId)}
						{#if selected}
							<p class="font-medium">{selected.sent}</p>
							<p class="text-xs text-muted-foreground mt-2">ID: {selected.id} | Lang: {selected.lang}</p>
						{:else}
							<p class="text-muted-foreground">문장을 찾을 수 없습니다.</p>
						{/if}
					{:else}
						<p class="text-muted-foreground">문장을 선택해 주세요.</p>
					{/if}
				</div>

				<!-- 태그 생성 설정 -->
				<div class="pt-2">
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
			</Card.Content>
		</Card.Root>

		<!-- 프롬프트 입력 (우측 2/3) -->
		<Card.Root class="lg:col-span-2 border-muted">
			<Card.Header>
				<Card.Title class="text-base flex items-center gap-2">
					<FileJson class="size-4 text-indigo-500" />
					프롬프트 지시사항
				</Card.Title>
				<Card.Description>Gemini가 문장에 어떤 태그를 생성할지 구체적으로 지시합니다.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-3">
			<Textarea
				form="tag-generate-form"
				name="prompt"
				bind:value={prompt}
				placeholder="예: 입력된 문장에 적합한 태그를 3~5개 생성해줘."
				class="w-full resize-none border-muted focus-visible:ring-indigo-500 text-lg leading-relaxed max-h-[calc(5*1.5rem)] overflow-y-auto"
			/>
				<p class="text-xs text-muted-foreground">
					프롬프트 입력 완료 후 왼쪽의 <strong>[Tag 생성하기]</strong> 버튼을 클릭하세요.
				</p>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- 숨겨진 태그 생성 폼 -->
	<form method="POST" action="?/process" use:enhance={onGenerateTag} id="tag-generate-form">
		<input type="hidden" name="selectedSentenceId" value={selectedSentenceId} />
		<input type="hidden" name="prompt" value={prompt} />
	</form>

	<!-- 일괄 태그 생성 폼 -->
	<form method="POST" action="?/batchGenerateTags" use:enhance={onBatchGenerateTags} id="batch-tag-generate-form">
		<input type="hidden" name="prompt" value={prompt} />
		<input type="hidden" name="ids" value={filteredSentences.map(s => s.id).join(',')} />
	</form>

	<!-- 태그 삭제 폼 -->
	<form method="POST" action="?/clearTag" use:enhance={onClearTag} id="clear-tag-form">
		<input type="hidden" name="sentenceId" value={clearTagId} />
	</form>


	<!-- 저장된 문장 -->
	<Card.Root class="border-muted">
		<Card.Header>
			<Card.Title class="text-base flex items-center gap-2">
				<Database class="size-4 text-indigo-500" />
				저장된 문장
			</Card.Title>
			<Card.Description>데이터베이스에 저장된 문장들입니다. (ID 역순, 최대 100개)</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<!-- Tag 필터 및 일괄 태그 생성 -->
			<div class="flex items-center gap-4 text-sm">
				<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">Tag 필터</span>
				<label class="flex items-center gap-2">
					<input type="radio" name="tagFilter" value="all" bind:group={tagFilter} onchange={handleSearch} />
					전체
				</label>
				<label class="flex items-center gap-2">
					<input type="radio" name="tagFilter" value="generated" bind:group={tagFilter} onchange={handleSearch} />
					생성됨
				</label>
				<label class="flex items-center gap-2">
					<input type="radio" name="tagFilter" value="not-generated" bind:group={tagFilter} onchange={handleSearch} />
					미생성
				</label>
				{#if tagFilter === 'not-generated'}
					<div class="ml-auto shrink-0">
						<Button
							type="submit"
							form="batch-tag-generate-form"
							size="sm"
							class="bg-indigo-600 hover:bg-indigo-700 text-white"
							disabled={batchLoading || filteredSentences.length === 0 || !prompt.trim()}
						>
							{#if batchLoading}
								<Loader2 class="size-4 animate-spin mr-2" />
								일괄 태그 생성 중...
							{:else}
								<Sparkles class="size-4 mr-2" />
								일괄 태그 생성 ({filteredSentences.length}건)
							{/if}
						</Button>
					</div>
				{/if}
			</div>

			<!-- 검색바 -->
			<div class="flex items-center gap-2">
				<div class="relative flex-1">
					<Input
						bind:value={searchQuery}
						placeholder="문장 검색..."
						class="pl-9 h-9 text-sm"
						onkeydown={(e) => e.key === 'Enter' && handleSearch()}
					/>
					<Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
				</div>
				<Button size="sm" onclick={handleSearch}>검색</Button>
				<Button size="sm" variant="outline" onclick={() => { searchQuery = ''; handleSearch(); }}>
					<X class="size-4" />
				</Button>
			</div>

			<!-- 문장 테이블 (2행 레이아웃: 문장 행 + 태그 행) -->
			<div class="rounded-md border overflow-x-auto">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-16">ID</Table.Head>
							<Table.Head class="w-20">Lang</Table.Head>
							<Table.Head>문장 / 태그</Table.Head>
							<Table.Head class="w-44">Created At</Table.Head>
							<Table.Head class="w-20 sticky right-0 bg-background z-10 shadow-[-1px_0_0_0_var(--border)]">삭제</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if filteredSentences.length === 0}
							<Table.Row>
								<Table.Cell colspan={5} class="text-center text-muted-foreground py-8 text-sm">
									저장된 문장이 없습니다.
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each filteredSentences as s (s.id)}
								<!-- 원문 행 -->
								<Table.Row
									class="hover:bg-muted/50 transition-colors cursor-pointer {selectedSentenceId === s.id ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''}"
									onclick={() => { selectedSentenceId = s.id; }}
								>
									<Table.Cell class="font-semibold text-muted-foreground text-xs align-top pt-3">{s.id}</Table.Cell>
									<Table.Cell class="text-xs font-mono align-top pt-3">{s.lang}</Table.Cell>
									<Table.Cell class="text-sm leading-relaxed break-words">{s.sent}</Table.Cell>
									<Table.Cell class="text-xs text-muted-foreground whitespace-nowrap align-top pt-3">
										{new Date(s.createdAt).toLocaleString('ko-KR')}
									</Table.Cell>
									<Table.Cell class="sticky right-0 bg-background z-10 shadow-[-1px_0_0_0_var(--border)] align-top pt-2">
										<Button
											size="sm"
											variant="destructive"
											onclick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
										>
											삭제
										</Button>
									</Table.Cell>
								</Table.Row>
								<!-- 태그 결과 행 -->
								<Table.Row class="bg-muted/20">
									<Table.Cell colspan={2} class="text-xs font-semibold text-muted-foreground pl-4">
										<span class="inline-flex items-center gap-1">
											<Tag class="size-3" />
											태그
										</span>
									</Table.Cell>
									<Table.Cell class="text-sm leading-relaxed break-words text-muted-foreground" colspan={2}>
										{#if s.tag && s.tag !== ''}
											{s.tag}
										{:else}
											<span class="text-muted-foreground/50">미생성</span>
										{/if}
									</Table.Cell>
									<Table.Cell class="sticky right-0 bg-background z-10 shadow-[-1px_0_0_0_var(--border)]">
										{#if s.tag && s.tag !== ''}
											<Button
												size="sm"
												variant="destructive"
												onclick={(e) => { e.stopPropagation(); handleClearTag(s.id); }}
											>
												<Trash2 class="size-3" />
											</Button>
										{/if}
									</Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- 피드백 메시지 -->
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
</div>
