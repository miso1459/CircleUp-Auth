<script lang="ts">
	import type { PageProps } from './$types';
	import TTSPanel from '$lib/components/TTSPanel.svelte';

	let { data, form }: PageProps = $props();
</script>

<TTSPanel
	sentences={data.sentences}
	savedLang={data.savedLang}
	savedVoice={data.savedVoice}
	ttsBaseUrl={data.ttsBaseUrl}
	{form}
/>
