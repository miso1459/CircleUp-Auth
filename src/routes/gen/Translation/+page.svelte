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
	let ttsFilter = $state<'all' | 'translated' | 'not_translated'>(data.ttsFilter || 'not_translated');
	let loading = $state(false);
	let bulkLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	let searchQuery = $state(data.searchQuery);

	const sentences = $derived(data.sentences);

	const filteredSentences = $derived(sentences.filter((s) => {
		if (ttsFilter === 'all') return true;
		const hasTran = s.tran && s.tran !== '';
		if (ttsFilter === 'translated') return hasTran;
		return !hasTran;
	}));

	$effect(() => {
		if (form?.error) {
			errorMessage = form.error;
		}
		if (form?.success) {
			errorMessage = null;
		}
	});

	$effect(() => {
		if (bulkLoading) {
			const interval = setInterval(() => {
				invalidate('app:sentences');
			}, 2000);
			return () => clearInterval(interval);
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

	function onTranslateAll() {
		bulkLoading = true;
		errorMessage = null;
		successMessage = null;
		return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: () => Promise<void> }) => {
			await update();
			bulkLoading = false;
			if (result?.type === 'success' && result?.data) {
				const d = result.data;
				const successCount = (d.successCount as number) ?? 0;
				const failCount = (d.failCount as number) ?? 0;
				successMessage = `번역 완료: ${successCount}개 성공, ${failCount}개 실패`;
				await invalidate('app:sentences');
			} else if (result?.type === 'failure') {
				errorMessage = (result?.data?.error as string) || '일괄 번역 중 오류가 발생했습니다.';
			}
		};
	}

	function handleSearch() {
		const searchParam = searchQuery.trim() ? `search=${encodeURIComponent(searchQuery)}` : '';
		const filterParam = `ttsFilter=${ttsFilter}`;
		const params = searchParam ? `?${filterParam}&${searchParam}` : `?${filterParam}`;
		window.location.href = `/gen/Translation${params}`;
	}

	async function handleDelete(id: number) {
		if (!confirm('삭제하시겠습니까?')) return;
		try {
			const res = await fetch('/gen/Translation', {
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
			<!-- Translation 필터 -->
			<div class="flex items-center gap-4 text-sm">
				<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">Translation 필터</span>
				<label class="flex items-center gap-2">
					<input type="radio" name="ttsFilter" value="all" bind:group={ttsFilter} onchange={handleSearch} />
					전체
				</label>
				<label class="flex items-center gap-2">
					<input type="radio" name="ttsFilter" value="translated" bind:group={ttsFilter} onchange={handleSearch} />
					번역됨
				</label>
				<label class="flex items-center gap-2">
					<input type="radio" name="ttsFilter" value="not_translated" bind:group={ttsFilter} onchange={handleSearch} />
					미번역
				</label>
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

			<!-- 미번역 필터일 때 전체 번역 버튼 -->
			{#if ttsFilter === 'not_translated'}
				<form method="POST" action="?/translateAll" use:enhance={onTranslateAll} class="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20 p-3">
					<input type="hidden" name="targetLang" value={targetLang} />
					<Button
						type="submit"
						size="sm"
						class="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
						disabled={bulkLoading || filteredSentences.length === 0}
					>
						{#if bulkLoading}
							<Loader2 class="size-4 animate-spin mr-2" />
							전체 번역 중...
						{:else}
							<Languages class="size-4 mr-2" />
							전체 번역
						{/if}
					</Button>
					<span class="text-xs text-muted-foreground">
						미번역 문장 {filteredSentences.length}개 대상
					</span>
				</form>
			{/if}

		<!-- 문장 테이블 -->
		<div class="rounded-md border overflow-x-auto">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-16">ID</Table.Head>
						<Table.Head class="w-16">Lang</Table.Head>
						<Table.Head>문장</Table.Head>
						<Table.Head>번역</Table.Head>
						<Table.Head class="w-44">Created At</Table.Head>
						<Table.Head class="w-20 sticky right-0 bg-background z-10 shadow-[-1px_0_0_0_var(--border)]">삭제</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if filteredSentences.length === 0}
						<Table.Row>
							<Table.Cell colspan={6} class="text-center text-muted-foreground py-8 text-sm">
								저장된 문장이 없습니다.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each filteredSentences as s (s.id)}
							<Table.Row
								class="hover:bg-muted/50 transition-colors cursor-pointer {selectedSentenceId === s.id ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''}"
								onclick={() => { selectedSentenceId = s.id; }}
							>
								<Table.Cell class="font-semibold text-muted-foreground text-xs">{s.id}</Table.Cell>
								<Table.Cell class="text-xs font-mono">{s.lang}</Table.Cell>
								<Table.Cell class="text-sm leading-relaxed break-words">{s.sent}</Table.Cell>
								<Table.Cell class="text-sm leading-relaxed break-words text-muted-foreground">{s.tran || '-'}</Table.Cell>
								<Table.Cell class="text-xs text-muted-foreground whitespace-nowrap">
									{new Date(s.createdAt).toLocaleString('ko-KR')}
								</Table.Cell>
								<Table.Cell class="sticky right-0 bg-background z-10 shadow-[-1px_0_0_0_var(--border)]">
									<Button
										size="sm"
										variant="destructive"
										onclick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
									>
										삭제
									</Button>
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
