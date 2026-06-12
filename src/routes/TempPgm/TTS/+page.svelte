<script lang="ts">
	import type { PageProps } from './$types';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { invalidate } from '$app/navigation';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Database,
		Search,
		X,
		Trash2
	} from '@lucide/svelte';
	import TTS from '$lib/components/TTS/TTS.svelte';

	let { data, form }: PageProps = $props();

	let selectedSentenceId = $state<number | null>(null);
	let searchQuery = $state('');

	const sentences = $derived(data.sentences);

	const filteredSentences = $derived(
		searchQuery.trim()
			? sentences.filter(s => s.sent.toLowerCase().includes(searchQuery.toLowerCase()))
			: sentences
	);

	function handleSearch() {
		// client-side filter only
	}

	async function handleDelete(id: number) {
		if (!confirm('삭제하시겠습니까?')) return;
		try {
			const res = await fetch('/TempPgm/TTS', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.message || '삭제 오류');
			}
			await invalidate('app:sentences');
		} catch (e: unknown) {
			console.error(e);
		}
	}
</script>

<div class="space-y-6 p-6">
	<TTS data={data} form={form} {sentences} {selectedSentenceId} />

	<!-- 문장 테이블 -->
	<Card.Root class="border-muted">
		<Card.Header>
			<Card.Title class="text-base flex items-center gap-2">
				<Database class="size-4 text-indigo-500" />
				저장된 문장
			</Card.Title>
			<Card.Description>데이터베이스에 저장된 문장들입니다.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="flex items-center gap-2">
				<div class="relative flex-1">
					<Input
						bind:value={searchQuery}
						placeholder="문장 검색..."
						class="pl-9 h-9 text-sm"
					/>
					<Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
				</div>
				<Button size="sm" variant="outline" onclick={() => { searchQuery = ''; }}>
					<X class="size-4" />
				</Button>
			</div>

			<div class="rounded-md border overflow-x-auto">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-16">ID</Table.Head>
							<Table.Head class="w-20">Lang</Table.Head>
							<Table.Head>문장</Table.Head>
							<Table.Head class="w-28">Voice</Table.Head>
							<Table.Head class="w-20 sticky right-0 bg-background z-10">삭제</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if filteredSentences.length === 0}
							<Table.Row>
								<Table.Cell colspan={5} class="text-center text-muted-foreground py-8 text-sm">
									저장된 문장이 없습니다.
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each filteredSentences as s (s.id)}
								<Table.Row
									class="hover:bg-muted/50 transition-colors cursor-pointer {selectedSentenceId === s.id ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''}"
									onclick={() => { selectedSentenceId = s.id; }}
								>
									<Table.Cell class="font-semibold text-muted-foreground text-xs align-top pt-3">{s.id}</Table.Cell>
									<Table.Cell class="text-xs font-mono align-top pt-3">{s.lang}</Table.Cell>
									<Table.Cell class="text-sm leading-relaxed break-words">{s.sent}</Table.Cell>
									<Table.Cell class="text-xs text-muted-foreground whitespace-nowrap align-top pt-3">
										{s.voice ?? '-'}
									</Table.Cell>
									<Table.Cell class="sticky right-0 bg-background z-10 align-top pt-2">
										<Button
											size="sm"
											variant="destructive"
											onclick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
										>
											<Trash2 class="size-3" />
										</Button>
									</Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</div>
		</Card.Content>
	</Card.Root>
</div>
