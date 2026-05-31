<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';

	let { data } = $props();

	// 열려있는 메뉴 추적
	let openMenu = $state<string | null>(null);

	// 각 Trigger의 DOM 위치를 기반으로 Content 위치 계산
	function getContentStyle(triggerId: string): string {
		if (typeof document === 'undefined') return '';
		const trigger = document.getElementById(triggerId);
		if (!trigger) return '';
		const rect = trigger.getBoundingClientRect();
		return `position:fixed; top:${rect.bottom + 4}px; left:${rect.left}px; z-index:9999;`;
	}

	let contentStyles = $state<Record<string, string>>({});

	function updatePosition(triggerId: string) {
		contentStyles[triggerId] = getContentStyle(triggerId);
	}
</script>

<div class="relative w-full">
	<NavigationMenu.Root class="w-full max-w-none" viewport={false}>
		<NavigationMenu.List class="flex flex-wrap gap-1">
			<NavigationMenu.Item>
				<NavigationMenu.Link href={resolve('/' as Pathname)} data-sveltekit-reload>
					Home
				</NavigationMenu.Link>
			</NavigationMenu.Item>
			{#if data?.role == 'admin'}
				<NavigationMenu.Item class="relative">
					<NavigationMenu.Trigger
						id="trigger-docs"
						onclick={() => { updatePosition('trigger-docs'); openMenu = openMenu === 'docs' ? null : 'docs'; }}
					>Docs</NavigationMenu.Trigger>
					{#if openMenu === 'docs'}
						<div style={contentStyles['trigger-docs']} class="rounded-md border bg-popover shadow-md">
							<ul class="grid w-max gap-1 p-2 whitespace-nowrap">
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/doc/ContentsEditor' as Pathname)} data-sveltekit-reload {...props}>
												ContentsEditor
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
							</ul>
						</div>
					{/if}
				</NavigationMenu.Item>

				<NavigationMenu.Item class="relative">
					<NavigationMenu.Trigger
						id="trigger-llm"
						onclick={() => { updatePosition('trigger-llm'); openMenu = openMenu === 'llm' ? null : 'llm'; }}
					>LLM</NavigationMenu.Trigger>
					{#if openMenu === 'llm'}
						<div style={contentStyles['trigger-llm']} class="rounded-md border bg-popover shadow-md">
							<ul class="grid w-max gap-1 p-2 whitespace-nowrap">
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/llm/SentToSent' as Pathname)} data-sveltekit-reload {...props}>
												Gen Sentence to Sentence
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/llm/SentToImage' as Pathname)} data-sveltekit-reload {...props}>
												Sentence to Image
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/llm/SentToImage2' as Pathname)} data-sveltekit-reload {...props}>
												Gen Sentence to Image 2
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/llm/SentToImage3' as Pathname)} data-sveltekit-reload {...props}>
												Gen Sentence to Image 3
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/llm/gen_1' as Pathname)} data-sveltekit-reload {...props}>
												Generator 1
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
							</ul>
						</div>
					{/if}
				</NavigationMenu.Item>

				<NavigationMenu.Item class="relative">
					<NavigationMenu.Trigger
						id="trigger-translation"
						onclick={() => { updatePosition('trigger-translation'); openMenu = openMenu === 'translation' ? null : 'translation'; }}
					>Translation</NavigationMenu.Trigger>
					{#if openMenu === 'translation'}
						<div style={contentStyles['trigger-translation']} class="rounded-md border bg-popover shadow-md">
							<ul class="grid w-max gap-1 p-2 whitespace-nowrap">
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/translation/deepL' as Pathname)} data-sveltekit-reload {...props}>
												DeepL
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
							</ul>
						</div>
					{/if}
				</NavigationMenu.Item>

				<NavigationMenu.Item class="relative">
					<NavigationMenu.Trigger
						id="trigger-tts"
						onclick={() => { updatePosition('trigger-tts'); openMenu = openMenu === 'tts' ? null : 'tts'; }}
					>TTS</NavigationMenu.Trigger>
					{#if openMenu === 'tts'}
						<div style={contentStyles['trigger-tts']} class="rounded-md border bg-popover shadow-md">
							<ul class="grid w-max gap-1 p-2 whitespace-nowrap">
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/tts/SentToTTS' as Pathname)} data-sveltekit-reload {...props}>
												Gen Sentence to Voice
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/tts/SentToTTS_Google' as Pathname)} data-sveltekit-reload {...props}>
												Gen Sentence to Voice Google
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
							</ul>
						</div>
					{/if}
				</NavigationMenu.Item>

				<NavigationMenu.Item class="relative">
					<NavigationMenu.Trigger
						id="trigger-flipclock"
						onclick={() => { updatePosition('trigger-flipclock'); openMenu = openMenu === 'flipclock' ? null : 'flipclock'; }}
					>Flip Clock</NavigationMenu.Trigger>
					{#if openMenu === 'flipclock'}
						<div style={contentStyles['trigger-flipclock']} class="rounded-md border bg-popover shadow-md">
							<ul class="grid w-max gap-1 p-2 whitespace-nowrap">
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/flipclock/flipclock_Nomal' as Pathname)} data-sveltekit-reload {...props}>
												Flip Clock Nomal
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/flipclock/flipclock_word' as Pathname)} data-sveltekit-reload {...props}>
												Flip Clock Word
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/flipclock/flipclock_card' as Pathname)} data-sveltekit-reload {...props}>
												Flip Clock Card
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
							</ul>
						</div>
					{/if}
				</NavigationMenu.Item>

				<NavigationMenu.Item class="relative">
					<NavigationMenu.Trigger
						id="trigger-generator"
						onclick={() => { updatePosition('trigger-generator'); openMenu = openMenu === 'generator' ? null : 'generator'; }}
					>Generator</NavigationMenu.Trigger>
					{#if openMenu === 'generator'}
						<div style={contentStyles['trigger-generator']} class="rounded-md border bg-popover shadow-md">
							<ul class="grid w-max gap-1 p-2 whitespace-nowrap">
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/gen/LLM_Sent' as Pathname)} data-sveltekit-reload {...props}>
												LLM Sent
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/gen/LLM_SentToSent' as Pathname)} data-sveltekit-reload {...props}>
												LLM Sent To Sent
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/gen/LLM_Tag' as Pathname)} data-sveltekit-reload {...props}>
												LLM Tag
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/gen/TTS' as Pathname)} data-sveltekit-reload {...props}>
												TTS
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/gen/Translation' as Pathname)} data-sveltekit-reload {...props}>
												Translation
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/gen/SentToImage' as Pathname)} data-sveltekit-reload {...props}>
												Sent To Image
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
								<li>
									<NavigationMenu.Link>
										{#snippet child(props)}
											<a href={resolve('/gen/Check' as Pathname)} data-sveltekit-reload {...props}>
												Check
											</a>
										{/snippet}
									</NavigationMenu.Link>
								</li>
							</ul>
						</div>
					{/if}
				</NavigationMenu.Item>
			{/if}
		</NavigationMenu.List>
	</NavigationMenu.Root>
</div>

<!-- 외부 클릭시 메뉴 닫기 -->
<svelte:window onclick={(e) => {
	const target = e.target as HTMLElement;
	if (!target.closest('[id^="trigger-"]') && !target.closest('.bg-popover')) {
		openMenu = null;
	}
}} />