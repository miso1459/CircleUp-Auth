<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';

	let { data } = $props();
</script>

<NavigationMenu.Root class="relative">
	<NavigationMenu.List>
		<NavigationMenu.Item>
			<NavigationMenu.Link href={resolve('/' as Pathname)} data-sveltekit-reload>
				Home
			</NavigationMenu.Link>
		</NavigationMenu.Item>
		{#if data?.role == 'admin'}
		<NavigationMenu.Item>
			<NavigationMenu.Trigger>Docs</NavigationMenu.Trigger>
			<NavigationMenu.Content>
				<ul class="grid w-[300px] gap-4 p-2">
					<li>
						<NavigationMenu.Link>
							{#snippet child({ props })}
							<a href={resolve('/doc/ContentsEditor' as Pathname)} data-sveltekit-reload {...props}>
								ContentsEditor
							</a>
							{/snippet}
						</NavigationMenu.Link>
					</li>
				</ul>
			</NavigationMenu.Content>
		</NavigationMenu.Item>
		<NavigationMenu.Item>
			<NavigationMenu.Trigger>LLM</NavigationMenu.Trigger>
			<NavigationMenu.Content>
				<ul class="grid w-[300px] gap-4 p-2">
					<li>
						<NavigationMenu.Link>
							{#snippet child({ props })}
							<a href={resolve('/llm/StS' as Pathname)} data-sveltekit-reload {...props}>
								Gen Sentence to Sentence
							</a>
							{/snippet}
						</NavigationMenu.Link>
					</li>
				</ul>
			</NavigationMenu.Content>
		</NavigationMenu.Item>
		<NavigationMenu.Item>
			<NavigationMenu.Trigger>TTS</NavigationMenu.Trigger>
			<NavigationMenu.Content>
				<ul class="grid w-[300px] gap-4 p-2">
					<li>
						<NavigationMenu.Link>
							{#snippet child({ props })}
							<a href={resolve('/tts/StT' as Pathname)} data-sveltekit-reload {...props}>
								Gen Sentence to Voice
							</a>
							{/snippet}
						</NavigationMenu.Link>
					</li>
				</ul>
			</NavigationMenu.Content>
		</NavigationMenu.Item>
		{/if}
	</NavigationMenu.List>

	<!-- 추가: List 바로 아래, Root 안에 위치 -->
	<div class="absolute left-0 top-full w-full">
		<NavigationMenu.Viewport />
	</div>
</NavigationMenu.Root>