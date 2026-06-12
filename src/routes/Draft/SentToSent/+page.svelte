<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import type { SentenceRow } from '$lib/server/gemini';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Loader2, Sparkles, List, FileJson } from '@lucide/svelte';

	let { data, form }: PageProps = $props();

	let sentences = $state('I am a boy.');
	let prompt = $state(
		'다음 문장을 명사만 변경해서 영어 문장 10개 만들어줘: {sentence}'
	);

	let parsedPreview = $state<string[]>([]);
	let promptPreview = $state<{ index: number; applied: string }[]>([]);
	let rows = $state<SentenceRow[]>([]);
	let resultJson = $state('');
	let errorMessage = $state<string | null>(null);
	let loading = $state(false);

	$effect(() => {
		if (form?.rows) {
			rows = form.rows;
			resultJson = form.json ?? '';
			errorMessage = null;
		}
		if (form?.parsed) {
			parsedPreview = form.parsed;
			errorMessage = null;
		}
		if (form?.preview) {
			promptPreview = form.preview;
			errorMessage = null;
		}
		if (form?.error) {
			errorMessage = form.error;
		}
	});

	function onSubmit() {
		loading = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			loading = false;
		};
	}
</script>

<div class="mx-auto max-w-5xl space-y-6 p-6">
	<div class="space-y-1">
		<h1 class="flex items-center gap-2 text-2xl font-bold tracking-tight">
			<Sparkles class="size-6 text-indigo-500" />
			Sentence to Statement
		</h1>
		<p class="text-muted-foreground text-sm">
			구글 Gemini API로 문장에 프롬프트를 적용하고, 결과를 JSON 문장 리스트로 표시합니다.
		</p>
		{#if !data.geminiConfigured}
			<p class="text-destructive text-sm font-medium">
				GEMINI_API_KEY가 설정되지 않았습니다. .env에 API 키를 추가해 주세요.
			</p>
		{/if}
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<!-- 1. 문장 전달 -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2 text-base">
					<List class="size-4" />
					문장 전달
				</Card.Title>
				<Card.Description>한 줄에 문장 하나씩 입력합니다.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-3">
				<Textarea
					bind:value={sentences}
					rows={8}
					placeholder="문장을 한 줄에 하나씩 입력하세요."
					class="font-mono text-sm"
				/>
				<form method="POST" action="?/parseSentences" use:enhance={onSubmit}>
					<input type="hidden" name="sentences" value={sentences} />
					<Button type="submit" variant="outline" disabled={loading}>
						문장 파싱
					</Button>
				</form>
				{#if parsedPreview.length > 0}
					<ul class="bg-muted/50 rounded-md border p-3 text-sm">
						{#each parsedPreview as line, i (i)}
							<li class="py-0.5">
								<span class="text-muted-foreground mr-2">{i + 1}.</span>{line}
							</li>
						{/each}
					</ul>
				{/if}
			</Card.Content>
		</Card.Root>

		<!-- 2. 프롬프트 전달 -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">프롬프트 전달</Card.Title>
				<Card.Description>
					<code class="bg-muted rounded px-1 text-xs">{`{sentence}`}</code> 자리에 각 문장이
					치환됩니다.
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-3">
				<Textarea
					bind:value={prompt}
					rows={8}
					placeholder={'예: 다음 문장을 영어로 번역하세요: {sentence}'}
					class="text-sm"
				/>
				<form method="POST" action="?/previewPrompt" use:enhance={onSubmit}>
					<input type="hidden" name="sentences" value={sentences} />
					<input type="hidden" name="prompt" value={prompt} />
					<Button type="submit" variant="outline" disabled={loading}>
						프롬프트 미리보기
					</Button>
				</form>
				{#if promptPreview.length > 0}
					<div class="max-h-48 space-y-2 overflow-y-auto text-xs">
						{#each promptPreview as item (item.index)}
							<div class="bg-muted/50 rounded-md border p-2">
								<p class="text-muted-foreground mb-1 font-medium">#{item.index}</p>
								<p class="whitespace-pre-wrap">{item.applied}</p>
							</div>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<!-- 3. LLM 요청 -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">프롬프트 적용 · LLM 요청</Card.Title>
			<Card.Description>문장과 프롬프트를 Gemini에 전달해 변환합니다.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="POST" action="?/process" use:enhance={onSubmit} class="flex flex-wrap gap-3">
				<input type="hidden" name="sentences" value={sentences} />
				<input type="hidden" name="prompt" value={prompt} />
				<Button type="submit" disabled={loading || !data.geminiConfigured}>
					{#if loading}
						<Loader2 class="size-4 animate-spin" />
						처리 중...
					{:else}
						<Sparkles class="size-4" />
						LLM 실행
					{/if}
				</Button>
			</form>
			{#if errorMessage}
				<p class="text-destructive mt-3 text-sm">{errorMessage}</p>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- 4. 결과 Table + JSON -->
	{#if rows.length > 0}
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2 text-base">
					<FileJson class="size-4" />
					결과 (문장 리스트 JSON)
				</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="rounded-md border">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head class="w-16">#</Table.Head>
								<Table.Head>원문</Table.Head>
								<Table.Head>변환 결과</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each rows as row (row.index)}
								<Table.Row>
									<Table.Cell class="font-medium">{row.index}</Table.Cell>
									<Table.Cell class="max-w-xs text-sm">{row.original}</Table.Cell>
									<Table.Cell class="text-sm">{row.statement}</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>

				<div class="space-y-2">
					<p class="text-muted-foreground text-xs font-medium uppercase tracking-wide">JSON</p>
					<pre
						class="bg-muted/50 max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed">{resultJson}</pre>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
