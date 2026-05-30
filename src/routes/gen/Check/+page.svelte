<script lang="ts">
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { invalidate } from '$app/navigation';
	import { Input } from '$lib/components/ui/input/index.js';
	import { 
		Sparkles, 
		Database, 
		AlertTriangle, 
		Search,
		X,
		Languages,
		Loader2
	} from '@lucide/svelte';

	let { data, form }: PageProps = $props();

	const TARGET_LANG_MAP = {
		'KO': '한국어',
		'EN': '영어',
		'JA': '일본어',
		'ZH': '중국어'
	} as const;

	let imgFilter = $state<'all' | 'checked' | 'unchecked'>((data.imgFilter as 'all' | 'checked' | 'unchecked') || 'unchecked');
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let targetLang = $state((data.savedTransLang as string) || 'EN');
	let selectedSentenceId = $state<number | null>(null);
	let loading = $state(false);

	let searchQuery = $state(data.searchQuery);

	const sentences = $derived(data.sentences);

	const filteredSentences = $derived(sentences.filter((s) => {
		if (imgFilter === 'all') return true;
		if (imgFilter === 'checked') return s.check_img === 1;
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

	function onTranslate() {
		loading = true;
		errorMessage = null;
		return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: () => Promise<void> }) => {
			await update();
			loading = false;
			if (result?.type === 'success' && result?.data?.success) {
				await invalidate('app:sentences');
			}
		};
	}

	function handleSearch() {
		const searchParam = searchQuery.trim() ? `search=${encodeURIComponent(searchQuery)}` : '';
		const filterParam = `imgFilter=${imgFilter}`;
		const params = searchParam ? `?${filterParam}&${searchParam}` : `?${filterParam}`;
		window.location.href = `/gen/Check${params}`;
	}

	async function handleDeleteImage(id: number) {
		if (!confirm('이미지를 삭제하시겠습니까?')) return;
		try {
			const formData = new FormData();
			formData.append('id', String(id));
			const res = await fetch('/gen/Check?/deleteImage', {
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
			const res = await fetch('/gen/Check?/toggleCheckImg', {
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
			<!-- 선택된 문장 및 번역 -->
			<div class="rounded-lg border border-muted bg-muted/30 p-4 space-y-3">
				<div class="min-h-[4rem] text-sm leading-relaxed">
					{#if selectedSentenceId !== null}
						{@const selected = sentences.find(s => s.id === selectedSentenceId)}
						{#if selected}
							<p class="font-medium">{selected.sent}</p>
							<p class="text-xs text-muted-foreground mt-1">ID: {selected.id} | Lang: {selected.lang}</p>
						{:else}
							<p class="text-muted-foreground">문장을 찾을 수 없습니다.</p>
						{/if}
					{:else}
						<p class="text-muted-foreground">테이블에서 문장을 클릭하여 선택하세요.</p>
					{/if}
				</div>

				<!-- 번역 설정 -->
				<div class="flex items-center gap-3 pt-2 border-t">
					<label class="text-xs font-semibold text-muted-foreground">대상 언어</label>
					<Select.Root type="single" bind:value={targetLang}>
						<Select.Trigger class="h-9 w-32 text-sm font-medium">
							{TARGET_LANG_MAP[targetLang as keyof typeof TARGET_LANG_MAP] || targetLang}
						</Select.Trigger>
						<Select.Content>
							{#each Object.entries(TARGET_LANG_MAP) as [code, label]}
								<Select.Item value={code}>{label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<form method="POST" action="?/translate" use:enhance={onTranslate} id="translate-form">
						<input type="hidden" name="sentenceId" value={selectedSentenceId} />
						<input type="hidden" name="targetLang" value={targetLang} />
						<Button
							type="submit"
							size="sm"
							class="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
							disabled={loading || selectedSentenceId === null}
						>
							{#if loading}
								<Loader2 class="size-4 animate-spin mr-2" />
								번역 중...
							{:else}
								<Languages class="size-4 mr-2" />
								번역
							{/if}
						</Button>
					</form>
				</div>
			</div>

			<!-- 이미지 체크 필터 -->
			<div class="flex items-center gap-4 text-sm">
				<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">이미지 체크 필터</span>
				<label class="flex items-center gap-2">
					<input type="radio" name="imgFilter" value="all" bind:group={imgFilter} onchange={handleSearch} />
					전체
				</label>
				<label class="flex items-center gap-2">
					<input type="radio" name="imgFilter" value="checked" bind:group={imgFilter} onchange={handleSearch} />
					이미지 체크
				</label>
				<label class="flex items-center gap-2">
					<input type="radio" name="imgFilter" value="unchecked" bind:group={imgFilter} onchange={handleSearch} />
					이미지 미체크
				</label>
			</div>

			<!-- 검색바 -->
			<div class="flex items-center gap-2">
				<div class="relative flex-1">
					<Input
						bind:value={searchQuery}
						placeholder="문장 검색..."
						class="pl-9 h-9 text-sm"
						onkeydown={(e) => e.key === 'Enter' && handleSearch()}
					/>
					<Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
				</div>
				<Button size="sm" onclick={handleSearch}>검색</Button>
				<Button size="sm" variant="outline" onclick={() => { searchQuery = ''; handleSearch(); }}>
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
						<Table.Head class="w-20 sticky right-0 bg-background z-10 shadow-[-1px_0_0_0_var(--border)]">이미지삭제</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if filteredSentences.length === 0}
						<Table.Row>
							<Table.Cell colspan={6} class="text-center text-muted-foreground py-8 text-sm">
								저장된 문장이 없습니다.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each filteredSentences as s (s.id)}
							<!-- 원문 행 -->
							<Table.Row 
								class="hover:bg-muted/50 transition-colors cursor-pointer {selectedSentenceId === s.id ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''}"
								onclick={() => { selectedSentenceId = s.id; }}
							>
								<Table.Cell class="font-semibold text-muted-foreground text-xs align-top pt-3">{s.id}</Table.Cell>
								<Table.Cell class="text-xs font-mono align-top pt-3">{s.lang}</Table.Cell>
								<Table.Cell class="text-sm leading-relaxed break-words">{s.sent}</Table.Cell>
								<Table.Cell class="align-top pt-3">
									<input 
										type="checkbox" 
										checked={s.check_img === 1}
										onchange={(e) => { e.stopPropagation(); toggleCheckImg(s.id, s.check_img); }}
										class="size-4"
									/>
								</Table.Cell>
								<Table.Cell class="text-xs text-muted-foreground whitespace-nowrap align-top pt-3">
									{new Date(s.createdAt).toLocaleString('ko-KR')}
								</Table.Cell>
								<Table.Cell class="sticky right-0 bg-background z-10 shadow-[-1px_0_0_0_var(--border)] align-top pt-2">
									<Button
										size="sm"
										variant="destructive"
										onclick={(e) => { e.stopPropagation(); handleDeleteImage(s.id); }}
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
											{TARGET_LANG_MAP[s.tranLang as keyof typeof TARGET_LANG_MAP] || s.tranLang}
										</span>
									{:else}
										<span class="text-muted-foreground/50">미번역</span>
									{/if}
								</Table.Cell>
								<Table.Cell class="text-sm leading-relaxed break-words text-muted-foreground" colspan={4}>
									{s.tran || '-'}
								</Table.Cell>
							</Table.Row>
							<!-- 이미지 표시 행 -->
							{#if s.file_image}
								<Table.Row class="bg-muted/10">
									<Table.Cell colspan={6}>
										<img 
											src="{data.imgBaseUrl}/{s.file_image}" 
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

	{#if successMessage}
		<div class="bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400 flex items-start gap-2 rounded-lg border p-4 text-sm">
			<Sparkles class="size-4 shrink-0 mt-0.5" />
			<div>{successMessage}</div>
		</div>
	{/if}
</div>
