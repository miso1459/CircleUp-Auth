<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';

	let { data } = $props();
</script>

<NavigationMenu.Root>
	<NavigationMenu.List>
		<NavigationMenu.Item>
			<NavigationMenu.Link>
				<a href={resolve('/' as Pathname)}>Home</a>
			</NavigationMenu.Link>
		   </NavigationMenu.Item>
		{#if data?.role == 'admin'}
		<NavigationMenu.Item>
		<NavigationMenu.Trigger>Docs</NavigationMenu.Trigger>
			<NavigationMenu.Content>
				<ul class="grid w-[300px] gap-4 p-2">
					<NavigationMenu.Link>
						<a href={resolve('/doc/ContentsEditor' as Pathname)}>ContentsEditor</a>
					</NavigationMenu.Link>
				</ul>
			</NavigationMenu.Content>
		</NavigationMenu.Item>
		<NavigationMenu.Item>
			<NavigationMenu.Trigger>LLM</NavigationMenu.Trigger>
			<NavigationMenu.Content>
				<ul class="grid w-[300px] gap-4 p-2">
					<NavigationMenu.Link>
						<a href={resolve('/llm/StS' as Pathname)}>Gen Sentence to Sentence</a>
					</NavigationMenu.Link>
				</ul>
			</NavigationMenu.Content>
		</NavigationMenu.Item>
		<NavigationMenu.Item>
			<NavigationMenu.Trigger>TTS</NavigationMenu.Trigger>
			<NavigationMenu.Content>
				<ul class="grid w-[300px] gap-4 p-2">
					<NavigationMenu.Link>
						<a href={resolve('/tts/StT' as Pathname)}>Gen Sentence to Voice</a>
					</NavigationMenu.Link>
				</ul>
			</NavigationMenu.Content>
		</NavigationMenu.Item>
		{/if}
	</NavigationMenu.List>
</NavigationMenu.Root>
