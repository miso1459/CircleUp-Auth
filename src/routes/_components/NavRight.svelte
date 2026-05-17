<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';

	let { data } = $props();
</script>

<NavigationMenu.Root viewport={false}>
	<NavigationMenu.List>
		<NavigationMenu.Item>
			<NavigationMenu.Trigger>
				<!-- 유저 정보가 있으면 이름 표시 -->
				{data?.user ? data.user.name : 'Login'}
			</NavigationMenu.Trigger>
			<NavigationMenu.Content
				class="right-0 left-auto min-w-[120px]"
				style="--tw-enter-translate-x: 0px; --tw-exit-translate-x: 0px;"
			>
				<ul class="grid gap-4 p-2">
					{#if data?.user}
						<NavigationMenu.Link>
							<a href={resolve('/profile' as Pathname)}>Profile</a>
						</NavigationMenu.Link>
						<NavigationMenu.Link>
							<a href={resolve('/logout' as Pathname)} data-sveltekit-reload>Logout</a>
						</NavigationMenu.Link>
					{:else}
						<NavigationMenu.Link>
							<a href={resolve('/login?provider=google' as Pathname)} data-sveltekit-reload
								>Google</a
							>
						</NavigationMenu.Link>
						<NavigationMenu.Link>
							<a href={resolve('/login?provider=github' as Pathname)} data-sveltekit-reload
								>Github</a
							>
						</NavigationMenu.Link>
					{/if}
				</ul>
			</NavigationMenu.Content>
		</NavigationMenu.Item>
	</NavigationMenu.List>
</NavigationMenu.Root>
