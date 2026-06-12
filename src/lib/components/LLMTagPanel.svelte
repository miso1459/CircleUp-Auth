<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import { invalidate } from '$app/navigation';
	import {
		Loader2,
		Sparkles,
		FileJson,
		Database,
		AlertTriangle,
		CheckCircle2
	} from '@lucide/svelte';

	interface Sentence {
		id: number;
		sent: string;
		lang: string;
	}

	let {
		sentences = [],
		savedPrompt = '',
		geminiConfigured = true,
		formAction = '?/process',
		compact = false,
		form
	}: {
		sentences: Sentence[];
		savedPrompt: string;
		geminiConfigured: boolean;
		formAction?: string;
		compact?: boolean;
		form?: { error?: string; success?: boolean; successCount?: number; errorCount?: number } | null;
	} = $props();

	let prompt = $state('');
	let selectedSentenceId = $state<number | null>(null);
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	// 초기 로드 시 DB에서 불러온 프롬프트를 할당하되, 로컬에서 입력할 때는 종속적 반응을 제거
	$effect(() => {
		untrack(() => {
			if (savedPrompt) {
				prompt = savedPrompt;
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
</script>

<div class={compact ? 'space-y-2 p-2' : 'space-y-6 p-6'}>
	<Accordion.Root type="single" collapsible>
		<Accordion.Item value="llm-tag-section">
			<Accordion.Trigger class={compact ? 'text-2xl font-bold tracking-tight py-1' : 'text-2xl font-bold tracking-tight py-4'}>
				<div class="flex items-center gap-2">
					<Sparkles class="size-6 text-indigo-500" />
					<span>LLM Tag</span>
				</div>
			</Accordion.Trigger>
			<Accordion.Content>
				<div class="space-y-6">
					<p class="text-muted-foreground text-sm">
						선택한 문장에 대해 Google Gemini API를 활용하여 태그를 생성하고 데이터베이스에 저장합니다.
					</p>

					{#if !geminiConfigured}
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
					<form method="POST" action={formAction} use:enhance={onGenerateTag} id="tag-generate-form">
						<input type="hidden" name="selectedSentenceId" value={selectedSentenceId} />
						<input type="hidden" name="prompt" value={prompt} />
					</form>

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
			</Accordion.Content>
		</Accordion.Item>
	</Accordion.Root>
</div>
