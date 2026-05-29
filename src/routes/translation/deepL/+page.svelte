<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { 
		Loader2, 
		Languages, 
		ArrowRightLeft, 
		Copy, 
		Check, 
		AlertCircle,
		Sparkles
	} from '@lucide/svelte';

	let { data, form }: PageProps = $props();

	// 언어 옵션 맵
	const LANG_MAP = {
		'auto': '자동 감지 (Auto)',
		'KO': '한국어 (Korean)',
		'EN': '영어 (English)',
		'JA': '일본어 (Japanese)',
		'ZH': '중국어 (Chinese)'
	} as const;

	type LangCode = keyof typeof LANG_MAP;

	let text = $state('');
	let translatedText = $state('');
	let sourceLang = $state<LangCode>('auto');
	let targetLang = $state<LangCode>('KO');
	let detectedSourceLang = $state<string | null>(null);
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	// 복사 상태에 대한 미크로 피드백
	let copiedSource = $state(false);
	let copiedTarget = $state(false);

	// 폼 처리 이후의 효과
	$effect(() => {
		if (form?.translatedText) {
			translatedText = form.translatedText;
			detectedSourceLang = form.detectedSourceLanguage ?? null;
			errorMessage = null;
		}
		if (form?.error) {
			errorMessage = form.error;
		}
	});

	// submit 핸들러
	function onSubmit() {
		loading = true;
		errorMessage = null;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			loading = false;
		};
	}

	// Swap 기능
	function handleSwap() {
		const tempText = text;
		const tempTrans = translatedText;

		const tempSrc = sourceLang;
		const tempTgt = targetLang;

		// 소스 언어가 'auto'인 경우, 도착 언어로 이동할 수 없음 (도착어엔 auto가 없으므로)
		// 따라서 감지된 소스 언어가 있고 그것이 지원 범위 내에 있다면 그것을 사용하고,
		// 그렇지 않다면 기본값인 'EN'로 스왑함.
		let newTgt: LangCode = tempSrc;
		if (newTgt === 'auto') {
			if (detectedSourceLang && detectedSourceLang in LANG_MAP) {
				newTgt = detectedSourceLang as LangCode;
			} else {
				newTgt = 'EN';
			}
		}

		// 도착 언어는 항상 지원 범위 내에 있으므로 그대로 소스 언어로 전달
		sourceLang = tempTgt;
		targetLang = newTgt;

		text = tempTrans;
		translatedText = tempText;
	}

	// 텍스트 클립보드 복사
	async function copyToClipboard(content: string, type: 'source' | 'target') {
		if (!content) return;
		try {
			await navigator.clipboard.writeText(content);
			if (type === 'source') {
				copiedSource = true;
				setTimeout(() => copiedSource = false, 2000);
			} else {
				copiedTarget = true;
				setTimeout(() => copiedTarget = false, 2000);
			}
		} catch (err) {
			console.error('클립보드 복사 실패:', err);
		}
	}

	const sourceLangLabel = $derived(LANG_MAP[sourceLang] || '선택');
	const targetLangLabel = $derived(LANG_MAP[targetLang] || '선택');
</script>

<div class="mx-auto max-w-5xl space-y-6 p-6">
	<!-- 헤더 영역 -->
	<div class="space-y-1">
		<h1 class="flex items-center gap-2 text-2xl font-bold tracking-tight">
			<Languages class="size-6 text-indigo-500" />
			DeepL Translation
		</h1>
		<p class="text-muted-foreground text-sm">
			DeepL 번역 API를 활용한 빠르고 자연스러운 기계 번역 서비스입니다.
		</p>
		{#if !data.deeplConfigured}
			<div class="bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-2 rounded-lg border p-3.5 text-sm mt-3">
				<AlertCircle class="size-4.5 mt-0.5 shrink-0" />
				<div>
					<p class="font-semibold">DeepL API Key 미설정</p>
					<p class="text-muted-foreground mt-0.5">
						<code>DEEPL_API_KEY</code>가 설정되지 않았습니다. 번역을 테스트하려면 <code>.env</code> 파일에 API 키를 추가해 주세요.
					</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- 번역 카드 그리드 -->
	<div class="grid gap-4 lg:grid-cols-2">
		<!-- 원문 입력 카드 -->
		<Card.Root class="flex flex-col">
			<Card.Header class="pb-3">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">출발어</span>
						<Select.Root type="single" bind:value={sourceLang}>
							<Select.Trigger class="h-9 w-45-xs font-medium">
								{sourceLangLabel}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="auto">자동 감지 (Auto)</Select.Item>
								<Select.Item value="KO">한국어 (Korean)</Select.Item>
								<Select.Item value="EN">영어 (English)</Select.Item>
								<Select.Item value="JA">일본어 (Japanese)</Select.Item>
								<Select.Item value="ZH">중국어 (Chinese)</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
					{#if text}
						<Button
							variant="ghost"
							size="icon"
							class="size-8"
							onclick={() => copyToClipboard(text, 'source')}
							title="원문 복사"
						>
							{#if copiedSource}
								<Check class="size-4 text-emerald-500" />
							{:else}
								<Copy class="size-4 text-muted-foreground" />
							{/if}
						</Button>
					{/if}
				</div>
			</Card.Header>
			<Card.Content class="flex-1 pb-4">
				<form method="POST" action="?/translate" use:enhance={onSubmit} id="translate-form" class="flex flex-col h-full gap-3">
					<input type="hidden" name="sourceLang" value={sourceLang} />
					<input type="hidden" name="targetLang" value={targetLang} />
					
					<Textarea
						name="text"
						bind:value={text}
						placeholder="번역할 내용을 입력하세요..."
						class="flex-1 min-h-[220px] resize-none border-muted focus-visible:ring-indigo-500 text-sm leading-relaxed"
					/>
				</form>
			</Card.Content>
		</Card.Root>

		<!-- 번역 결과 카드 -->
		<Card.Root class="flex flex-col relative border">
			<!-- Swap 버튼 (두 카드 사이 중앙 배치) -->
			<div class="absolute -left-5 top-1/2 -translate-y-1/2 z-10 hidden lg:block">
				<Button
					variant="outline"
					size="icon"
					class="size-10 rounded-full border bg-background shadow-md hover:bg-muted hover:text-indigo-500 transition-all duration-200"
					onclick={handleSwap}
					title="언어 및 텍스트 전환"
				>
					<ArrowRightLeft class="size-4" />
				</Button>
			</div>

			<Card.Header class="pb-3">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">도착어</span>
						<Select.Root type="single" bind:value={targetLang}>
							<Select.Trigger class="h-9 w-45 text-xs font-medium">
								{targetLangLabel}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="KO">한국어 (Korean)</Select.Item>
								<Select.Item value="EN">영어 (English)</Select.Item>
								<Select.Item value="JA">일본어 (Japanese)</Select.Item>
								<Select.Item value="ZH">중국어 (Chinese)</Select.Item>
							</Select.Content>
						</Select.Root>
						
						<!-- 모바일용 Swap 버튼 (화면이 작을 때 상단에 표시) -->
						<Button
							variant="ghost"
							size="icon"
							class="size-8 lg:hidden ml-1"
							onclick={handleSwap}
							title="언어 및 텍스트 전환"
						>
							<ArrowRightLeft class="size-4" />
						</Button>
					</div>
					{#if translatedText}
						<Button
							variant="ghost"
							size="icon"
							class="size-8"
							onclick={() => copyToClipboard(translatedText, 'target')}
							title="번역문 복사"
						>
							{#if copiedTarget}
								<Check class="size-4 text-emerald-500" />
							{:else}
								<Copy class="size-4 text-muted-foreground" />
							{/if}
						</Button>
					{/if}
				</div>
			</Card.Header>
			<Card.Content class="flex-1 pb-4 flex flex-col justify-between">
				<div class="relative flex-1 min-h-[220px] bg-muted/20 border rounded-md p-3 font-normal text-sm leading-relaxed text-foreground select-text whitespace-pre-wrap">
					{#if loading}
						<div class="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-[1px] rounded-md transition-all">
							<div class="flex flex-col items-center gap-2 text-indigo-500">
								<Loader2 class="size-6 animate-spin" />
								<span class="text-xs font-medium text-muted-foreground">번역 중...</span>
							</div>
						</div>
					{/if}
					
					{#if translatedText}
						{translatedText}
					{:else if !loading}
						<span class="text-muted-foreground italic">번역 결과가 여기에 표시됩니다.</span>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- 번역 실행 버튼 및 피드백 -->
	<div class="flex flex-col items-center gap-3 pt-2">
		<Button
			type="submit"
			form="translate-form"
			class="px-8 py-5 text-sm font-semibold shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-all duration-200"
			disabled={loading || !text.trim()}
		>
			{#if loading}
				<Loader2 class="size-4.5 animate-spin mr-2" />
				번역 요청 중...
			{:else}
				<Sparkles class="size-4.5 mr-2" />
				번역하기
			{/if}
		</Button>
		
		{#if detectedSourceLang && sourceLang === 'auto'}
			<p class="text-xs text-muted-foreground">
				감지된 언어: <span class="font-semibold text-indigo-500">{LANG_MAP[detectedSourceLang as LangCode] || detectedSourceLang}</span>
			</p>
		{/if}
		
		{#if errorMessage}
			<p class="text-sm font-medium text-destructive flex items-center gap-1.5 bg-destructive/10 px-4 py-2 rounded-full border border-destructive/20">
				<AlertCircle class="size-4" />
				{errorMessage}
			</p>
		{/if}
	</div>
</div>
