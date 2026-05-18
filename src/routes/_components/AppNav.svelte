<script>
	import NavLeft from './NavLeft.svelte';
	import NavRight from './NavRight.svelte';

	let { navRightData } = $props();
</script>

<nav class="relative z-50 flex w-full items-center justify-between border-b border-gray-200 pr-8 pl-4 bg-background">
	<NavLeft data={navRightData} />
	<NavRight data={navRightData} />
</nav>
