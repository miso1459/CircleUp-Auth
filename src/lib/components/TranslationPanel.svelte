<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import {
		Loader2,
		Sparkles,
		Languages,
		Database,
		AlertTriangle
	} from '@lucide/svelte';

	const TARGET_LANG_MAP = {
		'KO': '한국어',
		'EN': '영어',
		'JA': '일본어',
		'ZH': '중국어'
	} as const;

	type TargetLangCode = keyof typeof TARGET_LANG_MAP;

	interface Sentence {
		id: number;
		sent: string;
		lang: string;
	}

	let {
		sentences = [],
		savedTransLang = 'EN',
		compact = false,
		form
	}: {
		sentences: Sentence[];
		savedTransLang: string;
		compact?: boolean;
		form?: { error?: string; success?: boolean } | null;
	} = $props();

	let targetLang = $state<TargetLangCode>((savedTransLang as TargetLangCode) || 'EN');
	let selectedSentenceId = $state<number | null>(null);
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	$effect(() => {
		if (form?.error) {
			errorMessage = form.error;
		}
		if (form?.success) {
			errorMessage = null;
		}
	});

	const langLabel = $derived(TARGET_LANG_MAP[targetLang] || '선택');

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
</script>

<div class={compact ? 'space-y-2 p-2' : 'space-y-6 p-6'}>
	<Accordion.Root type="single" collapsible>
		<Accordion.Item value="translation-section">
			<Accordion.Trigger class={compact ? 'text-2xl font-bold tracking-tight py-1' : 'text-2xl font-bold tracking-tight py-4'}>
				<div class="flex items-center gap-2">
					<Sparkles class="size-6 text-indigo-500" />
					<span>Translation</span>
				</div>
			</Accordion.Trigger>
			<Accordion.Content>
				<div class="space-y-6">
					<p class="text-muted-foreground text-sm">
						선택한 문장에 대해 번역을 생성하고 데이터베이스에 저장합니다.
					</p>

					<!-- 메인 폼 및 설정 카드 -->
					<div class="grid gap-6 lg:grid-cols-3">
						<!-- 1. 번역 설정 (좌측 1/3) -->
						<Card.Root class="lg:col-span-1 border-muted">
							<Card.Header>
								<Card.Title class="text-base flex items-center gap-2">
									<Languages class="size-4 text-indigo-500" />
									번역 설정
								</Card.Title>
								<Card.Description>대상 언어를 선택하고 번역을 실행합니다.</Card.Description>
							</Card.Header>
							<Card.Content>
								<form method="POST" action="?/translate" use:enhance={onTranslate} id="translator-form" class="space-y-4">
									<input type="hidden" name="sentenceId" value={selectedSentenceId} />
									<input type="hidden" name="targetLang" value={targetLang} />

									<div class="space-y-2">
										<label for="lang-select" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">대상 언어</label>
										<Select.Root type="single" bind:value={targetLang}>
											<Select.Trigger id="lang-select" class="h-10 w-full text-sm font-medium">
												{langLabel}
											</Select.Trigger>
											<Select.Content>
												{#each Object.entries(TARGET_LANG_MAP) as [code, label] (code)}
													<Select.Item value={code}>{label}</Select.Item>
												{/each}
											</Select.Content>
										</Select.Root>
									</div>

									<div class="pt-2">
										<Button
											type="submit"
											class="w-full py-5 text-sm font-semibold shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-all duration-200"
											disabled={loading || selectedSentenceId === null}
										>
											{#if loading}
												<Loader2 class="size-4 animate-spin mr-2" />
												번역 중...
											{:else}
												<Languages class="size-4 mr-2" />
												번역 실행
											{/if}
										</Button>
									</div>
								</form>
							</Card.Content>
						</Card.Root>

						<!-- 2. 선택된 문장 미리보기 (우측 2/3) -->
						<Card.Root class="lg:col-span-2 border-muted">
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
			</Accordion.Content>
		</Accordion.Item>
	</Accordion.Root>
</div>
