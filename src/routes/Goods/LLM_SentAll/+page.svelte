<script lang="ts">
	import type { PageProps } from './$types';
	import { invalidate } from '$app/navigation';
	import { tick } from 'svelte';
	import { Loader2, Zap } from '@lucide/svelte';
	import LLMSentPanel from '$lib/components/LLMSentPanel.svelte';
	import TTSPanel from '$lib/components/TTSPanel.svelte';
	import TranslationPanel from '$lib/components/TranslationPanel.svelte';
	import LLMTagPanel from '$lib/components/LLMTagPanel.svelte';
	import CheckTable from '$lib/components/CheckTable.svelte';

	let { data, form }: PageProps = $props();

	let selectedId = $state<number | null>(null);
	let selectedSentence = $state('');

	// 파이프라인 상태
	let pipelineRunning = $state(false);
	let pipelineStep = $state('');
	let pipelineError = $state<string | null>(null);
	let pipelineDone = $state(false);
	let pipelineAudioUrl = $state('');
	let pipelineAudioPlayer = $state<HTMLAudioElement | null>(null);

	function handleSelectSentence(id: number, sent: string) {
		if (pipelineRunning) return;
		selectedId = id;
		selectedSentence = sent;
	}

	function delay(ms: number) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	async function runPipeline() {
		pipelineRunning = true;
		pipelineDone = false;
		pipelineError = null;

		// 선택 변경 감지를 위해 이전 ID 기록
		const previousId = selectedId;

		try {
			// ## 문장이 생성되면 저장된 문장 갱신
			pipelineStep = '저장된 문장 갱신 중...';
			await invalidate('app:sentences');
			await tick();
			await delay(300);

			const sentences = data.sentences;
			if (!sentences || sentences.length === 0) {
				pipelineStep = '저장된 문장이 없습니다.';
				pipelineDone = true;
				return;
			}

			// ## 저장된 문장 중에서 마지막 생성 문장 선택
			// sentences는 desc(id) 정렬이므로 [0]이 가장 최신 생성 문장
			const lastGenerated = sentences[0];
			const sentenceId = lastGenerated.id;
			const sentenceLang = lastGenerated.lang;

			// ## 선택된 문장으로 각 단계에 설정
			selectedId = sentenceId;
			selectedSentence = lastGenerated.sent;

			// ## TTL 생성은 선택된 문장이 변경된 후에 진행
			if (previousId === sentenceId && previousId !== null) {
				pipelineStep = '선택된 문장이 변경되지 않아 TTS를 건너뜁니다.';
				await delay(500);
				pipelineDone = true;
				return;
			}

			// Step 1: 1초 딜레이 → TTS
			pipelineStep = 'TTS 생성 중... (1/4)';
			await delay(1000);

			const ttsFormData = new FormData();
			ttsFormData.append('sentenceId', String(sentenceId));
			ttsFormData.append('voice', data.savedVoice);
			ttsFormData.append('speed', '1.0');
			ttsFormData.append('lang', sentenceLang);
			const ttsRes = await fetch('?/ttsProcess', {
				method: 'POST',
				headers: { 'X-SvelteKit-Action': 'true' },
				body: ttsFormData
			});
			if (!ttsRes.ok) throw new Error('TTS 생성 실패');

			// Step 2: 5초 딜레이 → 번역
			pipelineStep = '번역 중... (2/4)';
			await delay(5000);

			const transFormData = new FormData();
			transFormData.append('sentenceId', String(sentenceId));
			transFormData.append('targetLang', data.savedTransLang);
			const transRes = await fetch('?/translate', {
				method: 'POST',
				headers: { 'X-SvelteKit-Action': 'true' },
				body: transFormData
			});
			if (!transRes.ok) throw new Error('번역 실패');

			// Step 3: 3초 딜레이 → Tag
			pipelineStep = '태그 생성 중... (3/4)';
			await delay(3000);

			const tagFormData = new FormData();
			tagFormData.append('selectedSentenceId', String(sentenceId));
			tagFormData.append('prompt', data.savedTagPrompt);
			const tagRes = await fetch('?/tagProcess', {
				method: 'POST',
				headers: { 'X-SvelteKit-Action': 'true' },
				body: tagFormData
			});
			if (!tagRes.ok) throw new Error('태그 생성 실패');

			// Step 4: 3초 딜레이 → MP3 재생
			pipelineStep = 'MP3 재생 준비 중... (4/4)';
			await delay(3000);

			await invalidate('app:sentences');
			await tick();
			await delay(300);

			const updatedTop = data.sentences.find(s => s.id === sentenceId);
			if (updatedTop?.file_tts) {
				pipelineAudioUrl = `${data.ttsBaseUrl}/${updatedTop.file_tts}`;
				await tick();
				setTimeout(() => {
					if (pipelineAudioPlayer) {
						pipelineAudioPlayer.load();
						pipelineAudioPlayer.play().catch((e: Error) => console.error('pipeline playAudio:', e));
					}
				}, 100);
			}

			pipelineStep = '완료!';
			pipelineDone = true;
		} catch (e: unknown) {
			pipelineError = e instanceof Error ? e.message : '파이프라인 실행 중 오류';
			pipelineDone = true;
		}
	}

	function handleGenerateComplete() {
		runPipeline();
	}

	function closePipelineOverlay() {
		pipelineRunning = false;
	}
</script>

<LLMSentPanel
	savedPrompt={data.savedPrompt}
	savedLang={data.savedLang}
	geminiConfigured={data.geminiConfigured}
	compact={true}
	{form}
	bind:sentence={selectedSentence}
	onGenerateComplete={handleGenerateComplete}
/>

<TTSPanel
	sentences={data.sentences}
	savedLang={data.savedLang}
	savedVoice={data.savedVoice}
	ttsBaseUrl={data.ttsBaseUrl}
	formAction="?/ttsProcess"
	compact={true}
	{form}
	bind:selectedSentenceId={selectedId}
/>

<TranslationPanel
	sentences={data.sentences}
	savedTransLang={data.savedTransLang}
	compact={true}
	{form}
	bind:selectedSentenceId={selectedId}
/>

<LLMTagPanel
	sentences={data.sentences}
	savedPrompt={data.savedTagPrompt}
	geminiConfigured={data.geminiConfigured}
	formAction="?/tagProcess"
	compact={true}
	{form}
	bind:selectedSentenceId={selectedId}
/>

<CheckTable
	sentences={data.sentences}
	searchQuery={data.searchQuery}
	imgFilter={data.imgFilter}
	imgBaseUrl={data.imgBaseUrl}
	ttsBaseUrl={data.ttsBaseUrl}
	compact={true}
	{form}
	{selectedId}
	onSelectSentence={handleSelectSentence}
/>

<!-- 파이프라인 진행 오버레이 -->
{#if pipelineRunning}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
		<div class="bg-card border rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-5">
			{#if !pipelineDone}
				<Loader2 class="size-10 text-indigo-500 animate-spin mx-auto" />
			{:else if pipelineError}
				<div class="size-10 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
					<Zap class="size-6 text-destructive" />
				</div>
			{:else}
				<div class="size-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
					<Zap class="size-6 text-emerald-600" />
				</div>
			{/if}

			<div>
				<h3 class="text-lg font-bold tracking-tight">
					{#if pipelineError}
						오류 발생
					{:else if pipelineDone}
						파이프라인 완료
					{:else}
						자동 실행 중
					{/if}
				</h3>
				<p class="text-sm text-muted-foreground mt-1">{pipelineStep}</p>
				{#if pipelineError}
					<p class="text-sm text-destructive mt-2">{pipelineError}</p>
				{/if}
			</div>

			{#if pipelineDone}
				<button
					onclick={closePipelineOverlay}
					class="mt-2 px-6 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
				>
					닫기
				</button>
			{/if}
		</div>
	</div>
{/if}

<!-- 파이프라인 오디오 플레이어 (숨김) -->
{#if pipelineAudioUrl}
	<audio controls bind:this={pipelineAudioPlayer} src={pipelineAudioUrl} class="hidden"></audio>
{/if}
