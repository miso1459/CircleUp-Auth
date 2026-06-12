<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';

	let { data } = $props();

	let openMenu = $state<string | null>(null);
	let closeTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let contentStyles = $state<Record<string, string>>({});

	function getContentStyle(triggerId: string): string {
		if (typeof document === 'undefined') return '';
		const trigger = document.getElementById(triggerId);
		if (!trigger) return '';
		const rect = trigger.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;
		const MARGIN = 8;
		const MAX_HEIGHT = viewportHeight - MARGIN * 2;

		// 아래쪽 여유 공간
		const spaceBelow = viewportHeight - rect.bottom - MARGIN;
		// 위쪽 여유 공간
		const spaceAbove = rect.top - MARGIN;

		let topStyle: string;
		let maxHeightStyle: string;

		if (spaceBelow >= 100 || spaceBelow >= spaceAbove) {
			// 아래로 열기
			const availableHeight = Math.min(spaceBelow, MAX_HEIGHT);
			topStyle = `top:${rect.bottom + 4}px`;
			maxHeightStyle = `max-height:${availableHeight}px`;
		} else {
			// 위로 열기 (flip)
			const availableHeight = Math.min(spaceAbove, MAX_HEIGHT);
			topStyle = `bottom:${viewportHeight - rect.top + 4}px; top:auto`;
			maxHeightStyle = `max-height:${availableHeight}px`;
		}

		// 오른쪽 넘침 방지
		const left = Math.min(rect.left, viewportWidth - MARGIN);
		const leftStyle = `left:${left}px`;

		return `position:fixed; ${topStyle}; ${leftStyle}; z-index:9999; ${maxHeightStyle}; overflow-y:auto;`;
	}

	function handleTriggerEnter(menuId: string, triggerId: string) {
		if (closeTimer) {
			clearTimeout(closeTimer);
			closeTimer = null;
		}
		contentStyles[triggerId] = getContentStyle(triggerId);
		openMenu = menuId;
	}

	function handleLeave() {
		closeTimer = setTimeout(() => {
			openMenu = null;
		}, 150);
	}

	function handleContentEnter() {
		if (closeTimer) {
			clearTimeout(closeTimer);
			closeTimer = null;
		}
	}
</script>

<NavigationMenu.Root class="relative" viewport={false}>
	<NavigationMenu.List class="flex flex-wrap justify-start gap-1">
		<NavigationMenu.Item>
			<NavigationMenu.Link href={resolve('/' as Pathname)} data-sveltekit-reload>
				Home
			</NavigationMenu.Link>
		</NavigationMenu.Item>
		{#if data?.role == 'admin'}
			<NavigationMenu.Item class="relative">
				<NavigationMenu.Trigger
					id="trigger-draft"
					onmouseenter={() => handleTriggerEnter('draft', 'trigger-draft')}
					onmouseleave={handleLeave}
				>Draft</NavigationMenu.Trigger>
				{#if openMenu === 'draft'}
					<div
						role="menu"
						tabindex="-1"
						style={contentStyles['trigger-draft']}
						class="rounded-md border bg-popover shadow-md"
						onmouseenter={handleContentEnter}
						onmouseleave={handleLeave}
					>
						<ul class="grid w-max gap-1 p-2 whitespace-nowrap">
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Draft/SentToSent' as Pathname)} data-sveltekit-reload {...props}>
											Gen Sentence to Sentence
										</a>
									{/snippet}
								</NavigationMenu.Link>
							</li>
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Draft/SentToImage' as Pathname)} data-sveltekit-reload {...props}>
											Sentence to Image
										</a>
									{/snippet}
								</NavigationMenu.Link>
							</li>
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Draft/SentToImage2' as Pathname)} data-sveltekit-reload {...props}>
											Gen Sentence to Image 2
										</a>
									{/snippet}
								</NavigationMenu.Link>
							</li>
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Draft/SentToImage3' as Pathname)} data-sveltekit-reload {...props}>
											Gen Sentence to Image 3
										</a>
									{/snippet}
								</NavigationMenu.Link>
							</li>
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Draft/gen_1' as Pathname)} data-sveltekit-reload {...props}>
											Generator 1
										</a>
									{/snippet}
								</NavigationMenu.Link>
							</li>
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Draft/deepL' as Pathname)} data-sveltekit-reload {...props}>
											DeepL
										</a>
									{/snippet}
								</NavigationMenu.Link>
							</li>
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Draft/SentToTTS' as Pathname)} data-sveltekit-reload {...props}>
											Gen Sentence to Voice
										</a>
									{/snippet}
								</NavigationMenu.Link>
							</li>
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Draft/SentToTTS_Google' as Pathname)} data-sveltekit-reload {...props}>
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
					id="trigger-docs"
					onmouseenter={() => handleTriggerEnter('docs', 'trigger-docs')}
					onmouseleave={handleLeave}
				>Docs</NavigationMenu.Trigger>
				{#if openMenu === 'docs'}
					<div
						role="menu"
						tabindex="-1"
						style={contentStyles['trigger-docs']}
						class="rounded-md border bg-popover shadow-md"
						onmouseenter={handleContentEnter}
						onmouseleave={handleLeave}
					>
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
					id="trigger-flipclock"
					onmouseenter={() => handleTriggerEnter('flipclock', 'trigger-flipclock')}
					onmouseleave={handleLeave}
				>Flip Clock</NavigationMenu.Trigger>
				{#if openMenu === 'flipclock'}
					<div
						role="menu"
						tabindex="-1"
						style={contentStyles['trigger-flipclock']}
						class="rounded-md border bg-popover shadow-md"
						onmouseenter={handleContentEnter}
						onmouseleave={handleLeave}
					>
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
					id="trigger-function"
					onmouseenter={() => handleTriggerEnter('function', 'trigger-function')}
					onmouseleave={handleLeave}
				>Function</NavigationMenu.Trigger>
				{#if openMenu === 'function'}
					<div
						role="menu"
						tabindex="-1"
						style={contentStyles['trigger-function']}
						class="rounded-md border bg-popover shadow-md"
						onmouseenter={handleContentEnter}
						onmouseleave={handleLeave}
					>
						<ul class="grid w-max gap-1 p-2 whitespace-nowrap">
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Function/gen/LLM_Sent' as Pathname)} data-sveltekit-reload {...props}>
											LLM Sent
										</a>
									{/snippet}
								</NavigationMenu.Link>
							</li>
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Function/gen/LLM_SentToSent' as Pathname)} data-sveltekit-reload {...props}>
											LLM Sent To Sent
										</a>
									{/snippet}
								</NavigationMenu.Link>
							</li>
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Function/gen/LLM_Tag' as Pathname)} data-sveltekit-reload {...props}>
											LLM Tag
										</a>
									{/snippet}
								</NavigationMenu.Link>
							</li>
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Function/gen/TTS' as Pathname)} data-sveltekit-reload {...props}>
											TTS
										</a>
									{/snippet}
								</NavigationMenu.Link>
							</li>
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Function/gen/Translation' as Pathname)} data-sveltekit-reload {...props}>
											Translation
										</a>
									{/snippet}
								</NavigationMenu.Link>
							</li>
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Function/gen/SentToImage' as Pathname)} data-sveltekit-reload {...props}>
											Sent To Image
										</a>
									{/snippet}
								</NavigationMenu.Link>
							</li>
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Function/gen/Check' as Pathname)} data-sveltekit-reload {...props}>
											Check
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
					id="trigger-goods"
					onmouseenter={() => handleTriggerEnter('goods', 'trigger-goods')}
					onmouseleave={handleLeave}
				>Goods</NavigationMenu.Trigger>
				{#if openMenu === 'goods'}
					<div
						role="menu"
						tabindex="-1"
						style={contentStyles['trigger-goods']}
						class="rounded-md border bg-popover shadow-md"
						onmouseenter={handleContentEnter}
						onmouseleave={handleLeave}
					>
						<ul class="grid w-max gap-1 p-2 whitespace-nowrap">
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Goods/SentToImage' as Pathname)} data-sveltekit-reload {...props}>
											Sent To Image
										</a>
									{/snippet}
								</NavigationMenu.Link>
							</li>
							<li>
								<NavigationMenu.Link>
									{#snippet child(props)}
										<a href={resolve('/Goods/LLM_SentAll' as Pathname)} data-sveltekit-reload {...props}>
											LLM Sent All
										</a>
									{/snippet}
								</NavigationMenu.Link>
							</li>
						</ul>
					</div>
				{/if}
			</NavigationMenu.Item>

			<NavigationMenu.Item>
				<NavigationMenu.Link href={resolve('/TempPgm/TTS' as Pathname)} data-sveltekit-reload>
					TempPGM
				</NavigationMenu.Link>
			</NavigationMenu.Item>
		{/if}
	</NavigationMenu.List>
</NavigationMenu.Root>