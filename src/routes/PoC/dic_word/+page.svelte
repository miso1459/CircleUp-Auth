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
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { 
		Loader2, 
		Sparkles, 
		FileJson, 
		Database, 
		AlertTriangle, 
		Search,
		X,
		Volume2,
		VolumeX
	} from '@lucide/svelte';

	let { data, form }: PageProps = $props();

	let prompt = $state('');
	let sentence = $state('');
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	let dicInserted = $state<number | null>(null);
	let dicUpdated = $state<number | null>(null);

	// 초기 로드 시 DB에서 불러온 프롬프트 할당
	$effect(() => {
		untrack(() => {
			if (data.savedPrompt) {
				prompt = data.savedPrompt;
			}
		});
	});

	$effect(() => {
		if (form?.success) {
			dicInserted = form.dicInserted ?? 0;
			dicUpdated = form.dicUpdated ?? 0;
			errorMessage = null;
			prompt = form.savedPrompt ?? prompt;
		}
		if (form?.error) {
			errorMessage = form.error;
		}
	});

	function onSubmit() {
		loading = true;
		errorMessage = null;
		dicInserted = null;
		dicUpdated = null;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			loading = false;
		};
	}

	let searchQuery = $state(data.searchQuery);
	let selectedWord = $state('');
	let parsedSenses = $state<ReturnType<typeof parseSenses>>([]);

	const dicWords = $derived(data.dicWords);

	function parseSenses(raw: string | null | undefined) {
		try {
			const arr = JSON.parse(raw || '[]');
			return arr as { sense_id: number; definition_en: string; meaning_ko: string; example: { en: string; ko: string } }[];
		} catch {
			return [];
		}
	}

	function selectWord(w: { word: string; senses?: string | null }) {
		sentence = w.word;
		selectedWord = w.word;
		parsedSenses = parseSenses(w.senses);
	}

	function phrasalCount(w: { phrasal_verbs?: string | null }): string {
		try { const arr = JSON.parse(w.phrasal_verbs || '[]'); return arr.length ? String(arr.length) : '-'; } catch { return '-'; }
	}

	function handleSearch() {
		const params = searchQuery.trim() ? `?search=${encodeURIComponent(searchQuery)}` : '';
		window.location.href = `${window.location.pathname}${params}`;
	}

	async function toggleCheckCore(word: string, checked: boolean) {
		try {
			const res = await fetch(window.location.pathname, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ word, check_core: checked })
			});
			if (res.ok) {
				await invalidate('app:dicword');
			}
		} catch { /* 무시 */ }
	}

	function playAudio(url: string) {
		const audio = new Audio(url);
		audio.play().catch(() => { /* 재생 실패 무시 */ });
	}

	async function handleDelete(word: string) {
		if (!confirm('삭제하시겠습니까?')) return;
		try {
			const res = await fetch(window.location.pathname, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ word })
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.message || '삭제 오류');
			}
			await invalidate('app:dicword');
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
			LLM Dic word
		</h1>
		<p class="text-muted-foreground text-sm">
			입력한 단어를 Google Gemini API를 활용하여 프롬프트에 따라 변환하고 데이터베이스에 저장합니다.
		</p>
		{#if !data.geminiConfigured}
			<div class="bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-2 rounded-lg border p-3.5 text-sm mt-3">
				<AlertTriangle class="size-4.5 mt-0.5 shrink-0" />
				<div>
					<p class="font-semibold">Gemini API Key 미설정</p>
					<p class="text-muted-foreground mt-0.5">
						<code>GEMINI_API_KEY</code>가 설정되지 않았습니다. 단어를 생성하려면 <code>.env</code> 파일에 API 키를 추가해 주세요.
					</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- 메인 폼 및 설정 카드 -->
	<div class="grid gap-6 lg:grid-cols-3">
		<!-- 1. 단어 입력, 프롬프트 및 설정 (좌측 1/3) -->
		<Card.Root class="lg:col-span-1 border-muted">
			<Card.Header>
				<Card.Title class="text-base flex items-center gap-2">
					<Sparkles class="size-4 text-indigo-500" />
					생성 설정
				</Card.Title>
				<Card.Description>변환할 단어를 설정합니다.</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="POST" action="?/process" use:enhance={onSubmit} id="generator-form" class="space-y-4">
					<input type="hidden" name="sentence" value={sentence} />

					<div class="pt-2">
						<Button
							type="submit"
							class="w-full py-5 text-sm font-semibold shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-all duration-200"
							disabled={loading || !prompt.trim() || !data.geminiConfigured}
						>
							{#if loading}
								<Loader2 class="size-4 animate-spin mr-2" />
								생성 및 저장 중...
							{:else}
								<Sparkles class="size-4 mr-2" />
								단어 생성하기
							{/if}
						</Button>
					</div>

					<div class="space-y-2">
						<label for="sentence-input" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">단어 리스트</label>
						<Textarea
							id="sentence-input"
							form="generator-form"
							name="sentence"
							bind:value={sentence}
							placeholder="변환할 단어를 한 줄에 하나씩 입력하세요."
							class="w-full min-h-20 resize-y border-muted focus-visible:ring-indigo-500 text-sm leading-relaxed"
						/>
					</div>
				</form>
			</Card.Content>
		</Card.Root>

		<!-- 2. 프롬프트 입력 (우측 2/3) -->
		<Card.Root class="lg:col-span-2 border-muted">
			<Card.Header>
				<Card.Title class="text-base flex items-center gap-2">
					<FileJson class="size-4 text-indigo-500" />
					프롬프트 지시사항
				</Card.Title>
				<Card.Description>Gemini가 입력된 단어를 어떻게 변환할지 구체적으로 지시합니다.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-3">
				<Textarea
					form="generator-form"
					name="prompt"
					bind:value={prompt}
					placeholder="예: 입력된 단어를 더 자연스럽고 유창한 영어 표현으로 변환해줘."
					class="w-full min-h-40 max-h-40 [field-sizing:fixed] resize-none overflow-y-auto border-muted focus-visible:ring-indigo-500 text-sm leading-relaxed"
				/>
				<p class="text-xs text-muted-foreground">
					프롬프트 입력 완료 후 왼쪽의 <strong>[단어 생성하기]</strong> 버튼을 클릭하세요. 기존 단어는 업데이트, 새 단어는 추가됩니다.
				</p>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- 저장된 단어 -->
	<Card.Root class="border-muted">
		<Card.Header>
			<Card.Title class="text-base flex items-center gap-2">
				<Database class="size-4 text-indigo-500" />
				저장된 단어
			</Card.Title>
			<Card.Description>Dic Word 테이블에 저장된 단어들입니다. (생성일 역순, 최대 100개)</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<!-- 선택된 단어의 Senses -->
			{#if selectedWord && parsedSenses.length > 0}
				<div class="bg-muted/50 rounded-lg border p-3 space-y-2">
					<h4 class="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
						Senses of <span class="font-bold">{selectedWord}</span>
					</h4>
					{#each parsedSenses as sense}
						<div class="bg-background rounded border p-2.5 text-xs space-y-1">
							<div class="flex items-center gap-2">
								<span class="font-mono font-semibold text-muted-foreground">#{sense.sense_id}</span>
								<span class="font-medium">{sense.definition_en}</span>
							</div>
							<div class="text-muted-foreground">{sense.meaning_ko}</div>
							{#if sense.example?.en}
								<div class="text-muted-foreground/70 italic border-l-2 border-muted-foreground/30 pl-2 mt-1">
									{sense.example.en}
									{#if sense.example?.ko}
										<div>{sense.example.ko}</div>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

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
							<Table.Head class="w-24">Word</Table.Head>
							<Table.Head>Core Meaning</Table.Head>
							<Table.Head class="w-24">IPA</Table.Head>
							<Table.Head class="w-16">POS</Table.Head>
							<Table.Head class="w-16">Level</Table.Head>
							<Table.Head class="w-20">Frequency</Table.Head>
							<Table.Head class="w-16">Senses</Table.Head>
							<Table.Head class="w-16">Phrasal</Table.Head>
							<Table.Head class="w-12">Core</Table.Head>
							<Table.Head class="w-44">Created At</Table.Head>
							<Table.Head class="w-12">MP3</Table.Head>
							<Table.Head class="w-20">삭제</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if dicWords.length === 0}
							<Table.Row>
								<Table.Cell colspan="12" class="text-center text-muted-foreground py-8 text-sm">
									저장된 단어가 없습니다.
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each dicWords as w (w.word)}
								<Table.Row
									class="hover:bg-muted/50 transition-colors cursor-pointer"
									onclick={() => { selectWord(w); }}
								>
									<Table.Cell class="font-semibold text-sm max-w-24 truncate">{w.word}</Table.Cell>
									<Table.Cell class="text-xs text-muted-foreground" title={w.core_meaning}>{w.core_meaning || '-'}</Table.Cell>
									<Table.Cell class="text-xs font-mono">{w.ipa || '-'}</Table.Cell>
									<Table.Cell class="text-xs">{w.pos || '-'}</Table.Cell>
									<Table.Cell class="text-xs">{w.level || '-'}</Table.Cell>
									<Table.Cell class="text-xs">{w.frequency || '-'}</Table.Cell>
									<Table.Cell class="text-xs max-w-32 truncate" title={w.senses}>{w.senses || '-'}</Table.Cell>
									<Table.Cell class="text-xs text-center">{phrasalCount(w)}</Table.Cell>
									<Table.Cell class="text-center" onclick={(e: MouseEvent) => e.stopPropagation()}>
										<Checkbox
											checked={Boolean(w.check_core)}
											onCheckedChange={(c: boolean) => toggleCheckCore(w.word, c)}
										/>
									</Table.Cell>
									<Table.Cell class="text-xs text-muted-foreground whitespace-nowrap">
										{new Date(w.createdAt).toLocaleString('ko-KR')}
									</Table.Cell>
									<Table.Cell>
										{#if w.mp3_url}
											<Button
												size="sm"
												variant="outline"
												class="size-7 p-0"
												onclick={(e) => { e.stopPropagation(); playAudio(w.mp3_url!); }}
											>
												<Volume2 class="size-3.5" />
											</Button>
										{:else}
											<Button
												size="sm"
												variant="outline"
												class="size-7 p-0"
												disabled
												onclick={(e) => e.stopPropagation()}
											>
												<VolumeX class="size-3.5" />
											</Button>
										{/if}
									</Table.Cell>
									<Table.Cell>
										<Button
											size="sm"
											variant="destructive"
											onclick={(e) => { e.stopPropagation(); handleDelete(w.word); }}
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

</div>
