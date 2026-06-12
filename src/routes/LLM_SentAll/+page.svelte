<script lang="ts">
	import type { PageProps } from './$types';
	import LLMSentPanel from '$lib/components/LLMSentPanel.svelte';
	import TTSPanel from '$lib/components/TTSPanel.svelte';

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
