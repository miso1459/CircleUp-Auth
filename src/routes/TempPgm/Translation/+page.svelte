<script lang="ts">
	import type { PageProps } from './$types';
	import TranslationPanel from '$lib/components/TranslationPanel.svelte';

	let { data, form }: PageProps = $props();
</script>

<TranslationPanel sentences={data.sentences} savedTransLang={data.savedTransLang} {form} />
