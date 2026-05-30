<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';

	let { data } = $props();
</script>

<NavigationMenu.Root class="relative" viewport={false}>
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
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a href={resolve('/llm/SentToImage2' as Pathname)} data-sveltekit-reload {...props}>
										Gen Sentence to Image 2
									</a>
								{/snippet}
							</NavigationMenu.Link>
						</li>
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a href={resolve('/llm/SentToImage3' as Pathname)} data-sveltekit-reload {...props}>
										Gen Sentence to Image 3
									</a>
								{/snippet}
							</NavigationMenu.Link>
						</li>
					</ul>
				</NavigationMenu.Content>
			</NavigationMenu.Item>
			<NavigationMenu.Item>
				<NavigationMenu.Trigger>Translation</NavigationMenu.Trigger>
				<NavigationMenu.Content>
					<ul class="grid w-75 gap-4 p-2">
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a href={resolve('/translation/deepL' as Pathname)} data-sveltekit-reload {...props}>
										DeepL
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
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a href={resolve('/flipclock/flipclock_word' as Pathname)} data-sveltekit-reload {...props}>
										Flip Clock Word
									</a>
								{/snippet}
							</NavigationMenu.Link>
						</li>
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a href={resolve('/flipclock/flipclock_card' as Pathname)} data-sveltekit-reload {...props}>
										Flip Clock Card
									</a>
								{/snippet}
							</NavigationMenu.Link>
						</li>
					</ul>
				</NavigationMenu.Content>
			</NavigationMenu.Item>
			<NavigationMenu.Item>
				<NavigationMenu.Trigger>Generator</NavigationMenu.Trigger>
				<NavigationMenu.Content>
					<ul class="grid w-75 gap-4 p-2">
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a href={resolve('/gen/gen_1' as Pathname)} data-sveltekit-reload {...props}>
										Generator 1
									</a>
								{/snippet}
							</NavigationMenu.Link>
						</li>
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a href={resolve('/gen/LLM_Sent' as Pathname)} data-sveltekit-reload {...props}>
										LLM Sent
									</a>
								{/snippet}
							</NavigationMenu.Link>
						</li>
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a href={resolve('/gen/LLM_SentToSent' as Pathname)} data-sveltekit-reload {...props}>
										LLM Sent To Sent
									</a>
								{/snippet}
							</NavigationMenu.Link>
						</li>
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a href={resolve('/gen/TTS' as Pathname)} data-sveltekit-reload {...props}>
										TTS
									</a>
								{/snippet}
							</NavigationMenu.Link>
						</li>
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a href={resolve('/gen/Translation' as Pathname)} data-sveltekit-reload {...props}>
										Translation
									</a>
								{/snippet}
							</NavigationMenu.Link>
						</li>
						<li>
							<NavigationMenu.Link>
								{#snippet child({ props })}
									<a href={resolve('/gen/Check' as Pathname)} data-sveltekit-reload {...props}>
										Check
									</a>
								{/snippet}
							</NavigationMenu.Link>
						</li>
					</ul>
				</NavigationMenu.Content>
			</NavigationMenu.Item>
		{/if}
	</NavigationMenu.List>
</NavigationMenu.Root>
