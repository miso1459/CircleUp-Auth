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
					<ul class="grid w-75 gap-4 p-2">
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a
										href={resolve('/doc/ContentsEditor' as Pathname)}
										data-sveltekit-reload
										{...props}
									>
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
					<ul class="grid w-75 gap-4 p-2">
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a href={resolve('/llm/SentToSent' as Pathname)} data-sveltekit-reload {...props}>
										Gen Sentence to Sentence
									</a>
								{/snippet}
							</NavigationMenu.Link>
						</li>
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a
										href={resolve('/llm/SentToImage' as Pathname)}
										data-sveltekit-reload
										{...props}
									>
										Sentence to Image
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
					<ul class="grid w-75 gap-4 p-2">
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a href={resolve('/tts/SentToTTS' as Pathname)} data-sveltekit-reload {...props}>
										Gen Sentence to Voice
									</a>
								{/snippet}
							</NavigationMenu.Link>
						</li>
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a href={resolve('/tts/SentToTTS_Google' as Pathname)} data-sveltekit-reload {...props}>
										Gen Sentence to Voice Google
									</a>
								{/snippet}
							</NavigationMenu.Link>
						</li>
					</ul>
				</NavigationMenu.Content>
			</NavigationMenu.Item>
			<NavigationMenu.Item>
				<NavigationMenu.Trigger>Flip Clock</NavigationMenu.Trigger>
				<NavigationMenu.Content>
					<ul class="grid w-75 gap-4 p-2">
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a href={resolve('/flipclock/flipclock_Nomal' as Pathname)} data-sveltekit-reload {...props}>
										Flip Clock Nomal
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
	<div class="absolute top-full left-0 w-full">
		<NavigationMenu.Viewport />
	</div>
</NavigationMenu.Root>
