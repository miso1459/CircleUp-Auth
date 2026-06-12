<script lang="ts">
	import { enhance } from '$app/forms';
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
		Database, 
		AlertTriangle, 
		CheckCircle2,
		Search,
		X
	} from '@lucide/svelte';

	let { data, form }: PageProps = $props();

	let sentence = $state('');
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	let dicInserted = $state<number | null>(null);
	let dicSkipped = $state<number | null>(null);

	$effect(() => {
		if (form?.success) {
			dicInserted = form.dicInserted ?? 0;
			dicSkipped = form.dicSkipped ?? 0;
			errorMessage = null;
		}
		if (form?.error) {
			errorMessage = form.error;
		}
	});

	function onSubmit() {
		loading = true;
		errorMessage = null;
		dicInserted = null;
		dicSkipped = null;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			loading = false;
		};
	}

	let searchQuery = $state(data.searchQuery);

	const sentences = $derived(data.sentences);

	function handleSearch() {
		const params = searchQuery.trim() ? `?search=${encodeURIComponent(searchQuery)}` : '';
		window.location.href = `/Function/gen/LLM_SentToSent${params}`;
	}

	async function handleDelete(id: number) {
		if (!confirm('삭제하시겠습니까?')) return;
		try {
			const res = await fetch('/Function/gen/LLM_SentToSent', {
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
			Dic Word
		</h1>
		<p class="text-muted-foreground text-sm">
			입력한 단어를 dictionaryapi.dev에서 mp3를 추출하여 <code>dic_word</code> 테이블에 저장합니다.
		</p>
	</div>

	<!-- 단어 입력 및 버튼 -->
	<Card.Root class="border-muted">
		<Card.Header>
			<Card.Title class="text-base flex items-center gap-2">
				<Sparkles class="size-4 text-indigo-500" />
				단어 리스트
			</Card.Title>
			<Card.Description>저장할 영단어를 한 줄에 하나씩 입력하세요.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="POST" action="?/process" use:enhance={onSubmit} id="generator-form" class="space-y-4">
				<input type="hidden" name="sentence" value={sentence} />

				<div class="pt-2">
					<Button
						type="submit"
						class="w-full py-5 text-sm font-semibold shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-all duration-200"
						disabled={loading}
					>
						{#if loading}
							<Loader2 class="size-4 animate-spin mr-2" />
							저장 중...
						{:else}
							<Sparkles class="size-4 mr-2" />
							단어 저장하기
						{/if}
					</Button>
				</div>

				<div class="space-y-2">
					<Textarea
						id="sentence-input"
						form="generator-form"
						name="sentence"
						bind:value={sentence}
						placeholder="예:&#10;hello&#10;world&#10;ambitious"
						class="w-full min-h-40 resize-y border-muted focus-visible:ring-indigo-500 text-sm leading-relaxed font-mono"
					/>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<!-- 피드백 메시지 -->
	{#if errorMessage}
		<div class="bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-2 rounded-lg border p-4 text-sm">
			<AlertTriangle class="size-4 shrink-0 mt-0.5" />
			<div>{errorMessage}</div>
		</div>
	{/if}

	{#if dicInserted !== null && dicSkipped !== null}
		<div class="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-950/50 flex items-start gap-3 rounded-lg p-4 text-sm transition-all">
			<CheckCircle2 class="size-5 text-emerald-500 shrink-0 mt-0.5" />
			<div>
				<h3 class="font-semibold text-emerald-900 dark:text-emerald-200">dic_word 저장 결과</h3>
				<p class="text-emerald-700 dark:text-emerald-300 mt-1">
					입력 단어 중 <strong class="text-emerald-900 dark:text-emerald-100">{dicInserted}</strong>개가 <code>dic_word</code> 테이블에 저장되었습니다.
					{#if dicSkipped > 0}
						<span class="text-muted-foreground ml-1 font-normal text-xs">(중복으로 제외된 단어: {dicSkipped}개)</span>
					{/if}
				</p>
			</div>
		</div>
	{/if}

	<!-- 저장된 단어 (sentences) -->
	<Card.Root class="border-muted">
		<Card.Header>
			<Card.Title class="text-base flex items-center gap-2">
				<Database class="size-4 text-indigo-500" />
				저장된 단어
			</Card.Title>
			<Card.Description>데이터베이스에 저장된 단어들입니다. (ID 역순, 최대 100개)</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<!-- 검색바 -->
			<div class="flex items-center gap-2">
				<div class="relative flex-1">
					<Input
						bind:value={searchQuery}
						placeholder="단어 검색..."
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

			<!-- 단어 테이블 -->
			<div class="rounded-md border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-16">ID</Table.Head>
							<Table.Head class="w-16">Lang</Table.Head>
							<Table.Head class="w-48">Voice</Table.Head>
							<Table.Head class="w-16">Speed</Table.Head>
							<Table.Head>단어</Table.Head>
							<Table.Head class="w-44">Created At</Table.Head>
							<Table.Head class="w-20">삭제</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if sentences.length === 0}
							<Table.Row>
								<Table.Cell colspan="7" class="text-center text-muted-foreground py-8 text-sm">
									저장된 단어가 없습니다.
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each sentences as s (s.id)}
								<Table.Row
									class="hover:bg-muted/50 transition-colors cursor-pointer"
									onclick={() => { sentence = s.sent; }}
								>
									<Table.Cell class="font-semibold text-muted-foreground text-xs">{s.id}</Table.Cell>
									<Table.Cell class="text-xs font-mono">{s.lang}</Table.Cell>
									<Table.Cell class="text-xs text-muted-foreground max-w-48 truncate" title={s.voice}>{s.voice}</Table.Cell>
									<Table.Cell class="text-xs text-center font-semibold">{s.speed ?? '1.0'}</Table.Cell>
									<Table.Cell class="text-sm leading-relaxed">{s.sent}</Table.Cell>
									<Table.Cell class="text-xs text-muted-foreground whitespace-nowrap">
										{new Date(s.createdAt).toLocaleString('ko-KR')}
									</Table.Cell>
									<Table.Cell>
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
</div>
