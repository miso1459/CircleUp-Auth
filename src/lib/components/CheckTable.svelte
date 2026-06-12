<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		Sparkles,
		Database,
		AlertTriangle,
		Search,
		X,
		Languages,
		Tag,
		Play
	} from '@lucide/svelte';

	interface Sentence {
		id: number;
		sent: string;
		lang: string;
		voice?: string | null;
		speed?: string | null;
		tag?: string | null;
		createdAt: string;
		file_tts?: string | null;
		file_image?: string | null;
		check_img?: number | null;
		tran?: string | null;
		tranLang?: string | null;
	}

	let {
		sentences = [],
		searchQuery = '',
		imgFilter = 'unchecked',
		imgBaseUrl = '',
		ttsBaseUrl = '',
		form
	}: {
		sentences: Sentence[];
		searchQuery: string;
		imgFilter: string;
		imgBaseUrl: string;
		ttsBaseUrl: string;
		form?: { error?: string; success?: boolean } | null;
	} = $props();

	let _imgFilter = $state<'all' | 'checked' | 'unchecked'>((imgFilter as 'all' | 'checked' | 'unchecked') || 'unchecked');
	let _searchQuery = $state(searchQuery);
	let errorMessage = $state<string | null>(null);

	let audioUrl = $state('');
	let audioPlayer = $state<HTMLAudioElement | null>(null);

	function playAudio(filename: string | null) {
		if (!filename) return;
		const fullUrl = `${ttsBaseUrl}/${filename}`;
		audioUrl = fullUrl;
		setTimeout(() => {
			if (audioPlayer) {
				audioPlayer.load();
				audioPlayer.play().catch((e: Error) => console.warn('playAudio:', e));
			}
		}, 50);
	}

	const filteredSentences = $derived(sentences.filter((s) => {
		if (_imgFilter === 'all') return true;
		if (_imgFilter === 'checked') return s.check_img === 1;
		return s.check_img === 0;
	}));

	$effect(() => {
		if (form?.error) {
			errorMessage = form.error;
		}
		if (form?.success) {
			errorMessage = null;
		}
	});

	function handleSearch() {
		const searchParam = _searchQuery.trim() ? `search=${encodeURIComponent(_searchQuery)}` : '';
		const filterParam = `imgFilter=${_imgFilter}`;
		const params = searchParam ? `?${filterParam}&${searchParam}` : `?${filterParam}`;
		goto(`${window.location.pathname}${params}`, { invalidateAll: true });
	}

	async function handleDeleteImage(id: number) {
		if (!confirm('이미지를 삭제하시겠습니까?')) return;
		try {
			const formData = new FormData();
			formData.append('id', String(id));
			const res = await fetch('?/deleteImage', {
				method: 'POST',
				headers: { 'X-SvelteKit-Action': 'true' },
				body: formData
			});
			if (!res.ok) throw new Error('이미지 삭제 실패');
			await invalidate('app:sentences');
		} catch (e: unknown) {
			errorMessage = e instanceof Error ? e.message : '알 수 없는 오류';
		}
	}

	async function toggleCheckImg(id: number, currentValue: number) {
		const formData = new FormData();
		formData.append('id', String(id));
		formData.append('check_img', String(currentValue === 0 ? 1 : 0));
		try {
			const res = await fetch('?/toggleCheckImg', {
				method: 'POST',
				headers: { 'X-SvelteKit-Action': 'true' },
				body: formData
			});
			if (!res.ok) throw new Error('토글 실패');
			await invalidate('app:sentences');
		} catch (e: unknown) {
			errorMessage = e instanceof Error ? e.message : '알 수 없는 오류';
		}
	}
</script>

<div class="space-y-6 p-6">
	<!-- 헤더 영역 -->
	<div class="space-y-1">
		<h1 class="flex items-center gap-2 text-2xl font-bold tracking-tight">
			<Sparkles class="size-6 text-indigo-500" />
			Check
		</h1>
		<p class="text-muted-foreground text-sm">
			이미지 체크 상태를 관리합니다.
		</p>
	</div>

	<!-- 저장된 문장 -->
	<Card.Root class="border-muted">
		<Card.Header>
			<Card.Title class="text-base flex items-center gap-2">
				<Database class="size-4 text-indigo-500" />
				저장된 문장
			</Card.Title>
			<Card.Description>데이터베이스에 저장된 문장들입니다. (ID 역순, 최대 100개)</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<!-- 이미지 체크 필터 -->
			<div class="flex items-center gap-4 text-sm">
				<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">이미지 체크 필터</span>
				<label class="flex items-center gap-2">
					<input type="radio" name="imgFilter" value="all" bind:group={_imgFilter} onchange={handleSearch} />
					전체
				</label>
				<label class="flex items-center gap-2">
					<input type="radio" name="imgFilter" value="checked" bind:group={_imgFilter} onchange={handleSearch} />
					이미지 체크
				</label>
				<label class="flex items-center gap-2">
					<input type="radio" name="imgFilter" value="unchecked" bind:group={_imgFilter} onchange={handleSearch} />
					이미지 미체크
				</label>
			</div>

			<!-- 검색바 -->
			<div class="flex items-center gap-2">
				<div class="relative flex-1">
					<Input
						bind:value={_searchQuery}
						placeholder="문장 검색..."
						class="pl-9 h-9 text-sm"
						onkeydown={(e) => e.key === 'Enter' && handleSearch()}
					/>
					<Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
				</div>
				<Button size="sm" onclick={handleSearch}>검색</Button>
				<Button size="sm" variant="outline" onclick={() => { _searchQuery = ''; handleSearch(); }}>
					<X class="size-4" />
				</Button>
			</div>

		<!-- 문장 테이블 -->
		<div class="rounded-md border overflow-x-auto">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-16">ID</Table.Head>
						<Table.Head class="w-20">Lang</Table.Head>
						<Table.Head>문장</Table.Head>
						<Table.Head class="w-20">체크</Table.Head>
						<Table.Head class="w-44">Created At</Table.Head>
						<Table.Head class="w-20 sticky right-20 bg-background z-10 shadow-[-1px_0_0_0_var(--border)]">재생</Table.Head>
						<Table.Head class="w-20 sticky right-0 bg-background z-10 shadow-[-1px_0_0_0_var(--border)]">이미지삭제</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if filteredSentences.length === 0}
						<Table.Row>
							<Table.Cell colspan={7} class="text-center text-muted-foreground py-8 text-sm">
								저장된 문장이 없습니다.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each filteredSentences as s (s.id)}
							<!-- 원문 행 -->
							<Table.Row class="hover:bg-muted/50 transition-colors">
								<Table.Cell class="font-semibold text-muted-foreground text-xs align-top pt-3">{s.id}</Table.Cell>
								<Table.Cell class="text-xs font-mono align-top pt-3">{s.lang}</Table.Cell>
								<Table.Cell class="text-sm leading-relaxed break-words">{s.sent}</Table.Cell>
								<Table.Cell class="align-top pt-3">
									<input
										type="checkbox"
										checked={s.check_img === 1}
										onchange={() => toggleCheckImg(s.id, s.check_img ?? 0)}
										class="size-4"
									/>
								</Table.Cell>
								<Table.Cell class="text-xs text-muted-foreground whitespace-nowrap align-top pt-3">
									{new Date(s.createdAt).toLocaleString('ko-KR')}
								</Table.Cell>
								<Table.Cell class="sticky right-20 bg-background z-10 shadow-[-1px_0_0_0_var(--border)] align-top pt-2">
									<Button
										size="sm"
										variant="outline"
										disabled={!s.file_tts}
										onclick={(e) => { e.stopPropagation(); playAudio(s.file_tts); }}
									>
										<Play class="size-4" />
									</Button>
								</Table.Cell>
								<Table.Cell class="sticky right-0 bg-background z-10 shadow-[-1px_0_0_0_var(--border)] align-top pt-2">
									<Button
										size="sm"
										variant="destructive"
										onclick={() => handleDeleteImage(s.id)}
										disabled={!s.file_image}
									>
										삭제
									</Button>
								</Table.Cell>
							</Table.Row>
							<!-- 번역 결과 행 -->
							<Table.Row class="bg-muted/20">
								<Table.Cell colspan={2} class="text-xs font-semibold text-muted-foreground pl-4">
									{#if s.tranLang}
										<span class="inline-flex items-center gap-1">
											<Languages class="size-3" />
											{s.tranLang}
										</span>
									{:else}
										<span class="text-muted-foreground/50">미번역</span>
									{/if}
								</Table.Cell>
								<Table.Cell class="text-sm leading-relaxed break-words text-muted-foreground" colspan={5}>
									{s.tran || '-'}
								</Table.Cell>
							</Table.Row>
							<!-- 태그 결과 행 -->
							<Table.Row class="bg-muted/20">
								<Table.Cell colspan={2} class="text-xs font-semibold text-muted-foreground pl-4">
									<span class="inline-flex items-center gap-1">
										<Tag class="size-3" />
										태그
									</span>
								</Table.Cell>
								<Table.Cell class="text-sm leading-relaxed break-words text-muted-foreground" colspan={5}>
									{#if s.tag && s.tag !== ''}
										{s.tag}
									{:else}
										<span class="text-muted-foreground/50">미생성</span>
									{/if}
								</Table.Cell>
							</Table.Row>
							<!-- 이미지 표시 행 -->
							{#if s.file_image}
								<Table.Row class="bg-muted/10">
									<Table.Cell colspan={7}>
										<img
											src="{imgBaseUrl}/{s.file_image}"
											alt="Sentence {s.id}"
											class="w-full rounded-md"
										/>
									</Table.Cell>
								</Table.Row>
							{/if}
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</div>
		</Card.Content>
	</Card.Root>

	<!-- 피드백 메시지 -->
	{#if errorMessage}
		<div class="bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-2 rounded-lg border p-4 text-sm">
			<AlertTriangle class="size-4 shrink-0 mt-0.5" />
			<div>{errorMessage}</div>
		</div>
	{/if}

	{#if audioUrl}
		<audio controls bind:this={audioPlayer} src={audioUrl} class="w-full"></audio>
	{/if}
</div>
