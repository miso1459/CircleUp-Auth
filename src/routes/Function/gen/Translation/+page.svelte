<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { invalidate } from '$app/navigation';
	import { Input } from '$lib/components/ui/input/index.js';
	import { 
		Loader2, 
		Sparkles, 
		Languages, 
		Database, 
		AlertTriangle, 
		Search,
		X
	} from '@lucide/svelte';

	let { data, form }: PageProps = $props();

	const TARGET_LANG_MAP = {
		'KO': '한국어',
		'EN': '영어',
		'JA': '일본어',
		'ZH': '중국어'
	} as const;

	let targetLang = $state((data.savedTransLang as string) || 'EN');
	let selectedSentenceId = $state<number | null>(null);
	let tranFilter = $state<'all' | 'translated' | 'not_translated'>((data.tranFilter as 'all' | 'translated' | 'not_translated') || 'not_translated');
	let loading = $state(false);
	let batchLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	let searchQuery = $state(data.searchQuery);

	const sentences = $derived(data.sentences);

	const filteredSentences = $derived(sentences.filter((s) => {
		if (tranFilter === 'all') return true;
		const hasTran = s.tran && s.tran !== '';
		if (tranFilter === 'translated') return hasTran;
		return !hasTran;
	}));

	$effect(() => {
		if (form?.error) {
			errorMessage = form.error;
		}
		if (form?.success) {
			errorMessage = null;
			if (form?.successCount !== undefined) {
				successMessage = `번역 완료: ${form.successCount}건 성공`;
				if (form?.errorCount && form.errorCount > 0) {
					successMessage += `, ${form.errorCount}건 실패`;
				}
			} else {
				successMessage = null;
			}
		}
	});

	function onTranslate() {
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

	function onBatchTranslate() {
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
		const filterParam = `tranFilter=${tranFilter}`;
		const params = searchParam ? `?${filterParam}&${searchParam}` : `?${filterParam}`;
		window.location.href = `/Function/gen/Translation${params}`;
	}

	async function handleDelete(id: number) {
		if (!confirm('삭제하시겠습니까?')) return;
		try {
			const res = await fetch('/Function/gen/Translation', {
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
</script>

<div class="space-y-6 p-6">
	<!-- 헤더 영역 -->
	<div class="space-y-1">
		<h1 class="flex items-center gap-2 text-2xl font-bold tracking-tight">
			<Sparkles class="size-6 text-indigo-500" />
			Translation
		</h1>
		<p class="text-muted-foreground text-sm">
			선택한 문장을 대상 언어로 번역하고 데이터베이스에 저장합니다.
		</p>
	</div>

	<!-- 메인 폼 및 설정 카드 -->
	<div class="grid gap-6">
		<!-- 선택된 문장 (전체 너비) -->
		<Card.Root class="border-muted">
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

				<!-- 번역 설정 -->
				<div class="flex items-center gap-3 pt-3 border-t">
					<label class="text-xs font-semibold text-muted-foreground">대상 언어</label>
					<Select.Root type="single" bind:value={targetLang}>
						<Select.Trigger class="h-9 w-32 text-sm font-medium">
							{TARGET_LANG_MAP[targetLang as keyof typeof TARGET_LANG_MAP] || targetLang}
						</Select.Trigger>
						<Select.Content>
							{#each Object.entries(TARGET_LANG_MAP) as [code, label]}
								<Select.Item value={code}>{label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<Button
						type="submit"
						form="translate-form"
						size="sm"
						class="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
						disabled={loading || selectedSentenceId === null}
					>
						{#if loading}
							<Loader2 class="size-4 animate-spin mr-2" />
							번역 중...
						{:else}
							<Languages class="size-4 mr-2" />
							Translation
						{/if}
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- 숨겨진 번역 폼 -->
	<form method="POST" action="?/translate" use:enhance={onTranslate} id="translate-form">
		<input type="hidden" name="sentenceId" value={selectedSentenceId} />
		<input type="hidden" name="targetLang" value={targetLang} />
	</form>

	<!-- 일괄 번역 폼 -->
	<form method="POST" action="?/batchTranslate" use:enhance={onBatchTranslate} id="batch-translate-form">
		<input type="hidden" name="targetLang" value={targetLang} />
		<input type="hidden" name="ids" value={filteredSentences.map(s => s.id).join(',')} />
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
			<!-- Translation 필터 및 일괄 번역 -->
			<div class="flex items-center gap-4 text-sm">
				<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">Translation 필터</span>
				<label class="flex items-center gap-2">
					<input type="radio" name="tranFilter" value="all" bind:group={tranFilter} onchange={handleSearch} />
					전체
				</label>
				<label class="flex items-center gap-2">
					<input type="radio" name="tranFilter" value="translated" bind:group={tranFilter} onchange={handleSearch} />
					번역됨
				</label>
				<label class="flex items-center gap-2">
					<input type="radio" name="tranFilter" value="not_translated" bind:group={tranFilter} onchange={handleSearch} />
					미번역
				</label>
				{#if tranFilter === 'not_translated'}
					<div class="ml-auto shrink-0">
						<Button
							type="submit"
							form="batch-translate-form"
							size="sm"
							class="bg-indigo-600 hover:bg-indigo-700 text-white"
							disabled={batchLoading || filteredSentences.length === 0}
						>
							{#if batchLoading}
								<Loader2 class="size-4 animate-spin mr-2" />
								일괄 번역 중...
							{:else}
								<Sparkles class="size-4 mr-2" />
								일괄 번역 ({filteredSentences.length}건)
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

		<!-- 문장 테이블 -->
		<div class="rounded-md border overflow-x-auto">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-16">ID</Table.Head>
						<Table.Head class="w-20">Lang</Table.Head>
						<Table.Head>문장 / 번역</Table.Head>
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
							<!-- 번역 결과 행 -->
							<Table.Row class="bg-muted/20">
								<Table.Cell colspan={2} class="text-xs font-semibold text-muted-foreground pl-4">
									{#if s.tranLang}
										<span class="inline-flex items-center gap-1">
											<Languages class="size-3" />
											{TARGET_LANG_MAP[s.tranLang as keyof typeof TARGET_LANG_MAP] || s.tranLang}
										</span>
									{:else}
										<span class="text-muted-foreground/50">미번역</span>
									{/if}
								</Table.Cell>
								<Table.Cell class="text-sm leading-relaxed break-words text-muted-foreground" colspan={3}>
									{s.tran || '-'}
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
			<Sparkles class="size-4 shrink-0 mt-0.5" />
			<div>{successMessage}</div>
		</div>
	{/if}
</div>
