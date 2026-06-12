<script lang="ts">
	import type { PageProps } from './$types';
	import LLMSentPanel from '$lib/components/LLMSentPanel.svelte';
	import TTSPanel from '$lib/components/TTSPanel.svelte';
	import TranslationPanel from '$lib/components/TranslationPanel.svelte';
	import LLMTagPanel from '$lib/components/LLMTagPanel.svelte';

	let { data, form }: PageProps = $props();
</script>

<LLMSentPanel
	savedPrompt={data.savedPrompt}
	savedLang={data.savedLang}
	geminiConfigured={data.geminiConfigured}
	{form}
/>

<TTSPanel
	sentences={data.sentences}
	savedLang={data.savedLang}
	savedVoice={data.savedVoice}
	ttsBaseUrl={data.ttsBaseUrl}
	formAction="?/ttsProcess"
	{form}
/>

<TranslationPanel sentences={data.sentences} savedTransLang={data.savedTransLang} {form} />

<LLMTagPanel
	sentences={data.sentences}
	savedPrompt={data.savedTagPrompt}
	geminiConfigured={data.geminiConfigured}
	formAction="?/tagProcess"
	{form}
/>
