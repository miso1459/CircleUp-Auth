<script lang="ts">
	import type { PageProps } from './$types';
	import LLMTagPanel from '$lib/components/LLMTagPanel.svelte';

	let { data, form }: PageProps = $props();
</script>

<LLMTagPanel
	sentences={data.sentences}
	savedPrompt={data.savedPrompt}
	geminiConfigured={data.geminiConfigured}
	{form}
/>
