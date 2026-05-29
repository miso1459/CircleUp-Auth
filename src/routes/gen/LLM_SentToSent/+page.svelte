<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { invalidate } from '$app/navigation';
	import { Input } from '$lib/components/ui/input/index.js';
	import { 
		Loader2, 
		Sparkles, 
		FileJson, 
		Languages, 
		Database, 
		AlertTriangle, 
		CheckCircle2,
		Search,
		X
	} from '@lucide/svelte';

	let { data, form }: PageProps = $props();

	const LANG_MAP = {
		'en-US': '영어 (English)',
		'ko-KR': '한국어 (Korean)'
	} as const;

	type LangCode = keyof typeof LANG_MAP;

	let prompt = $state('입력된 문장을 더 자연스럽고 유창한 표현으로 바꿔줘.');
	let sentence = $state('');
	let lang = $state<LangCode>('en-US');
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	let generatedRows = $state<{ index: number; original: string; statement: string }[]>([]);
	let insertedCount = $state<number | null>(null);
	let duplicateCount = $state<number | null>(null);

	// 초기 로드 시 DB에서 불러온 프롬프트와 언어를 할당하되, 로컬에서 입력할 때는 종속적 반응을 제거
	$effect(() => {
		untrack(() => {
			if (data.savedPrompt) {
				prompt = data.savedPrompt;
			}
			if (data.savedLang) {
				lang = data.savedLang as LangCode;
			}
		});
	});

	$effect(() => {
		if (form?.success) {
			generatedRows = form.rows ?? [];
			insertedCount = form.insertedCount ?? 0;
			duplicateCount = form.duplicateCount ?? 0;
			errorMessage = null;
		}
		if (form?.error) {
			errorMessage = form.error;
		}
	});

	function onSubmit() {
		loading = true;
		errorMessage = null;
		insertedCount = null;
		duplicateCount = null;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			loading = false;
		};
	}

	const langLabel = $derived(LANG_MAP[lang] || '선택');

	let searchQuery = $state(data.searchQuery);

	const sentences = $derived(data.sentences);

	function handleSearch() {
		const params = searchQuery.trim() ? `?search=${encodeURIComponent(searchQuery)}` : '';
		window.location.href = `/gen/LLM_SentToSent${params}`;
	}

	async function handleDelete(id: number) {
		if (!confirm('삭제하시겠습니까?')) return;
		try {
			const res = await fetch('/gen/LLM_SentToSent', {
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
			LLM Sentence To Sentence
		</h1>
		<p class="text-muted-foreground text-sm">
			입력한 문장을 Google Gemini API를 활용하여 프롬프트에 따라 변환하고 데이터베이스에 저장합니다.
		</p>
		{#if !data.geminiConfigured}
			<div class="bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-2 rounded-lg border p-3.5 text-sm mt-3">
				<AlertTriangle class="size-4.5 mt-0.5 shrink-0" />
				<div>
					<p class="font-semibold">Gemini API Key 미설정</p>
					<p class="text-muted-foreground mt-0.5">
						<code>GEMINI_API_KEY</code>가 설정되지 않았습니다. 문장을 생성하려면 <code>.env</code> 파일에 API 키를 추가해 주세요.
					</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- 메인 폼 및 설정 카드 -->
	<div class="grid gap-6 lg:grid-cols-3">
		<!-- 1. 문장 입력, 프롬프트 및 설정 (좌측 1/3) -->
		<Card.Root class="lg:col-span-1 border-muted">
			<Card.Header>
				<Card.Title class="text-base flex items-center gap-2">
					<Languages class="size-4 text-indigo-500" />
					생성 설정
				</Card.Title>
				<Card.Description>변환할 문장과 언어를 설정합니다.</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="POST" action="?/process" use:enhance={onSubmit} id="generator-form" class="space-y-4">
					<input type="hidden" name="lang" value={lang} />
					<input type="hidden" name="sentence" value={sentence} />
					<div class="space-y-2">
						<label for="sentence-input" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">문장 1</label>
						<Textarea
							id="sentence-input"
							form="generator-form"
							name="sentence"
							bind:value={sentence}
							placeholder="변환할 문장을 입력하세요."
							class="w-full min-h-20 resize-none border-muted focus-visible:ring-indigo-500 text-sm leading-relaxed"
						/>
					</div>
					<div class="space-y-2">
						<label for="lang-select" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">대상 언어</label>
						<Select.Root type="single" bind:value={lang}>
							<Select.Trigger id="lang-select" class="h-10 w-full text-sm font-medium">
								{langLabel}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="en-US">영어 (English)</Select.Item>
								<Select.Item value="ko-KR">한국어 (Korean)</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>

					<div class="pt-2">
						<Button
							type="submit"
							class="w-full py-5 text-sm font-semibold shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-all duration-200"
							disabled={loading || !sentence.trim() || !prompt.trim() || !data.geminiConfigured}
						>
							{#if loading}
								<Loader2 class="size-4 animate-spin mr-2" />
								생성 및 저장 중...
							{:else}
								<Sparkles class="size-4 mr-2" />
								문장 변환하기
							{/if}
						</Button>
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
				<Card.Description>Gemini가 입력된 문장을 어떻게 변환할지 구체적으로 지시합니다.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-3">
				<Textarea
					form="generator-form"
					name="prompt"
					bind:value={prompt}
					placeholder="예: 입력된 문장을 더 자연스럽고 유창한 영어 표현으로 변환해줘."
					class="w-full min-h-40 resize-none border-muted focus-visible:ring-indigo-500 text-sm leading-relaxed"
				/>
				<p class="text-xs text-muted-foreground">
					프롬프트 입력 완료 후 왼쪽의 <strong>[문장 변환하기]</strong> 버튼을 클릭하세요. 생성 시 기존 데이터베이스의 중복 문장은 자동으로 제외됩니다.
				</p>
			</Card.Content>
		</Card.Root>
	</div>

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
			<div class="rounded-md border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-16">ID</Table.Head>
							<Table.Head class="w-16">Lang</Table.Head>
							<Table.Head class="w-48">Voice</Table.Head>
							<Table.Head class="w-16">Speed</Table.Head>
							<Table.Head>문장</Table.Head>
							<Table.Head class="w-44">Created At</Table.Head>
							<Table.Head class="w-20">삭제</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if sentences.length === 0}
							<Table.Row>
								<Table.Cell colspan="7" class="text-center text-muted-foreground py-8 text-sm">
									저장된 문장이 없습니다.
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each sentences as s (s.id)}
								<Table.Row class="hover:bg-muted/50 transition-colors">
									<Table.Cell class="font-semibold text-muted-foreground text-xs">{s.id}</Table.Cell>
									<Table.Cell class="text-xs font-mono">{s.lang}</Table.Cell>
									<Table.Cell class="text-xs text-muted-foreground max-w-48 truncate" title={s.voice}>{s.voice}</Table.Cell>
									<Table.Cell class="text-xs text-center font-semibold">{s.speed ?? '1.0'}</Table.Cell>
									<Table.Cell class="text-sm leading-relaxed">{s.sent}</Table.Cell>
									<Table.Cell class="text-xs text-muted-foreground whitespace-nowrap">
										{new Date(s.createdAt).toLocaleString('ko-KR')}
									</Table.Cell>
									<Table.Cell>
										<Button size="sm" variant="destructive" onclick={() => handleDelete(s.id)}>
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

	{#if insertedCount !== null && duplicateCount !== null}
		<div class="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-950/50 flex items-start gap-3 rounded-lg p-4 text-sm transition-all">
			<CheckCircle2 class="size-5 text-indigo-500 shrink-0 mt-0.5" />
			<div>
				<h3 class="font-semibold text-indigo-900 dark:text-indigo-200">데이터베이스 저장 결과</h3>
				<p class="text-indigo-700 dark:text-indigo-300 mt-1">
					새로 생성된 문장 중 <strong class="text-indigo-900 dark:text-indigo-100">{insertedCount}</strong>개가 <code>sentences</code> 테이블에 저장되었습니다.
					{#if duplicateCount > 0}
						<span class="text-muted-foreground ml-1 font-normal text-xs">(중복으로 제외된 문장: {duplicateCount}개)</span>
					{/if}
				</p>
			</div>
		</div>
	{/if}

	<!-- 결과 테이블 및 JSON -->
	{#if generatedRows.length > 0}
		<div class="grid gap-6 lg:grid-cols-3">
			<!-- 결과 문장 테이블 (2/3) -->
			<Card.Root class="lg:col-span-2 border-muted">
				<Card.Header>
					<Card.Title class="text-base flex items-center gap-2">
						<Database class="size-4 text-indigo-500" />
						생성된 문장 목록
					</Card.Title>
					<Card.Description>Gemini가 생성해 낸 문장들입니다.</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="rounded-md border">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head class="w-16">번호</Table.Head>
									<Table.Head>문장 (Statement)</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each generatedRows as row (row.index)}
									<Table.Row class="hover:bg-muted/50 transition-colors">
										<Table.Cell class="font-semibold text-muted-foreground">{row.index}</Table.Cell>
										<Table.Cell class="font-medium text-foreground text-sm leading-relaxed">{row.statement}</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- 원본 JSON 뷰 (1/3) -->
			<Card.Root class="lg:col-span-1 border-muted flex flex-col h-full">
				<Card.Header>
					<Card.Title class="text-base flex items-center gap-2">
						<FileJson class="size-4 text-indigo-500" />
						Gemini RAW JSON
					</Card.Title>
					<Card.Description>LLM이 반환한 데이터의 원본 JSON 결과입니다.</Card.Description>
				</Card.Header>
				<Card.Content class="flex-1 flex flex-col">
					<pre class="bg-muted/50 dark:bg-muted/30 max-h-95 overflow-auto rounded-lg border p-4 font-mono text-xs leading-relaxed text-indigo-600 dark:text-indigo-400 select-all flex-1">{JSON.stringify(generatedRows, null, 2)}</pre>
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
</div>
