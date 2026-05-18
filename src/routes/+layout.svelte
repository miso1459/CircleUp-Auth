<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppNav from './_components/AppNav.svelte';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();
</script>

<svelte:head>
	<title>Circle UP</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex min-h-screen flex-col">
	<!-- 상단 네비게이션 (고정) -->
	<div class="fixed top-0 right-0 left-0 z-50 bg-white">
		<AppNav navRightData={data.navRightData} />
	</div>

	<!-- 컨텐츠 영역 (네비게이션 높이만큼 상단 여백) -->
	<main class="mt-16 m-4 flex-1 rounded-2xl border border-gray-300 p-4">
		{@render children()}
	</main>
</div>

<!-- i18n 숨김 링크 -->
<div style="display:none">
	{#each locales as locale (locale)}
		<a href={resolve(localizeHref(page.url.pathname, { locale }) as Pathname)}>{locale}</a>
	{/each}
</div>
