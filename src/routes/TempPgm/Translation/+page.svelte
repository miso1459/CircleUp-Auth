<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { invalidate } from '$app/navigation';
	import { 
		Loader2, 
		Sparkles, 
		Languages, 
		Database, 
		AlertTriangle
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
						{@const selected = data.sentences.find(s => s.id === selectedSentenceId)}
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

	<!-- 피드백 메시지 -->
	{#if errorMessage}
		<div class="bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-2 rounded-lg border p-4 text-sm">
			<AlertTriangle class="size-4 shrink-0 mt-0.5" />
			<div>{errorMessage}</div>
		</div>
	{/if}
</div>
