<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import {
		Loader2,
		Sparkles,
		FileJson,
		Languages,
		AlertTriangle
	} from '@lucide/svelte';

	const LANG_MAP = {
		'en-US': '영어 (English)',
		'ko-KR': '한국어 (Korean)'
	} as const;

	type LangCode = keyof typeof LANG_MAP;

	let {
		savedPrompt = '',
		savedLang = 'en-US',
		geminiConfigured = true,
		compact = false,
		form,
		sentence = $bindable(''),
		onGenerateComplete
	}: {
		savedPrompt: string;
		savedLang: string;
		geminiConfigured: boolean;
		compact?: boolean;
		form?: {
			success?: boolean;
			error?: string;
			rows?: { index: number; original: string; statement: string }[];
			insertedCount?: number;
			duplicateCount?: number;
			savedPrompt?: string;
		} | null;
		sentence?: string;
		onGenerateComplete?: () => void;
	} = $props();

	let prompt = $state('');
	let lang = $state<LangCode>('en-US');
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	$effect(() => {
		untrack(() => {
			if (savedPrompt) {
				prompt = savedPrompt;
			}
			if (savedLang) {
				lang = savedLang as LangCode;
			}
		});
	});

	$effect(() => {
		if (form?.success) {
			errorMessage = null;
			prompt = form.savedPrompt ?? prompt;
			const rows = form.rows ?? [];
			if (rows.length > 0) {
				sentence = rows[rows.length - 1].statement;
			}
		}
		if (form?.error) {
			errorMessage = form.error;
		}
	});

	function onSubmit() {
		loading = true;
		errorMessage = null;
		return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: () => Promise<void> }) => {
			await update();
			loading = false;
			if (result?.type === 'success') {
				onGenerateComplete?.();
			}
		};
	}

	const langLabel = $derived(LANG_MAP[lang] || '선택');
</script>

<div class={compact ? 'space-y-2 p-2' : 'space-y-6 p-6'}>
	<!-- 헤더 영역 -->
	<div class="space-y-1">
		<h1 class="flex items-center gap-2 text-2xl font-bold tracking-tight">
			<Sparkles class="size-6 text-indigo-500" />
			LLM Sentence Generator
		</h1>
		<p class="text-muted-foreground text-sm">
			입력한 문장을 Google Gemini API를 활용하여 프롬프트에 따라 변환하고 데이터베이스에 저장합니다.
		</p>
		{#if !geminiConfigured}
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
							disabled={loading || !prompt.trim() || !geminiConfigured}
						>
							{#if loading}
								<Loader2 class="size-4 animate-spin mr-2" />
								생성 및 저장 중...
							{:else}
								<Sparkles class="size-4 mr-2" />
								문장 생성하기
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
					프롬프트 입력 완료 후 왼쪽의 <strong>[문장 생성하기]</strong> 버튼을 클릭하세요. 생성 시 기존 데이터베이스의 중복 문장은 자동으로 제외됩니다.
				</p>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- 피드백 메시지 -->
	{#if errorMessage}
		<div class="bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-2 rounded-lg border p-4 text-sm">
			<AlertTriangle class="size-4 shrink-0 mt-0.5" />
			<div>{errorMessage}</div>
		</div>
	{/if}
</div>
