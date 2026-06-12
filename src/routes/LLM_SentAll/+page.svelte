<script lang="ts">
	import type { PageProps } from './$types';
	import LLMSentPanel from '$lib/components/LLMSentPanel.svelte';
	import TTSPanel from '$lib/components/TTSPanel.svelte';
	import TranslationPanel from '$lib/components/TranslationPanel.svelte';
	import LLMTagPanel from '$lib/components/LLMTagPanel.svelte';
	import CheckTable from '$lib/components/CheckTable.svelte';

	let { data, form }: PageProps = $props();

	let selectedId = $state<number | null>(null);
	let selectedSentence = $state('');

	function handleSelectSentence(id: number, sent: string) {
		selectedId = id;
		selectedSentence = sent;
	}
</script>

<LLMSentPanel
	savedPrompt={data.savedPrompt}
	savedLang={data.savedLang}
	geminiConfigured={data.geminiConfigured}
	compact={true}
	{form}
	bind:sentence={selectedSentence}
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
