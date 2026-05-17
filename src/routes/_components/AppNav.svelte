<script>
	import NavLeft from './NavLeft.svelte';
	import NavRight from './NavRight.svelte';

	let { navRightData } = $props();
</script>

<nav class="flex w-full items-center justify-between border-b border-gray-200 pr-8 pl-4">
	<NavLeft />
	<NavRight data={navRightData} />
</nav>
