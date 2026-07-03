<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { invalidate } from '$app/navigation';
	import { Input } from '$lib/components/ui/input/index.js';
	import { 
		Loader2, 
		Sparkles, 
		Languages, 
		Database, 
		AlertTriangle, 
		Search,
		X,
		Play,
		Upload
	} from '@lucide/svelte';

	let { data, form }: PageProps = $props();

	const LANG_MAP = {
		'en-US': '영어 (English)',
		'ko-KR': '한국어 (Korean)'
	} as const;

	type LangCode = keyof typeof LANG_MAP;

	let selectedLanguage = $state<LangCode>('en-US');
	let selectedVoice = $state('en-US-Neural2-F');
	let rate = $state(1.0);
	let selectedSentenceId = $state<number | null>(null);
	let ttsFilter = $state<'all' | 'generated' | 'not_generated'>('not_generated');
	let loading = $state(false);
	let bulkLoading = $state(false);

	let r2Loading = $state(false);
	let organizeLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	let selectedWorkId = $state<number | null>(null);
	let searchQuery = $state('');
	let currentPage = $derived(data.page);

	// data에서 한 번만 초기화 (전체 페이지 리로드 시 재생성되므로 문제 없음)
	let _hydrated = false;
	$effect(() => {
		if (!_hydrated) {
			selectedLanguage = (data.savedLang as LangCode) || 'en-US';
			selectedVoice = data.savedVoice || 'en-US-Neural2-F';
			ttsFilter = (data.ttsFilter as 'all' | 'generated' | 'not_generated') || 'not_generated';
			selectedWorkId = data.selectedWorkId;
			searchQuery = data.searchQuery;
			_hydrated = true;
		}
	});

	const sentences = $derived(data.sentences);
	const totalCount = $derived(data.totalCount);
	const totalPages = $derived(data.totalPages);

	const voices = [
		{ code: 'ko-KR', name: 'ko-KR-Chirp3-HD-Achernar', label: '한국어 여성 (Chirp3 - 오디오북 스타일)', gender: '여성' },
		{ code: 'ko-KR', name: 'ko-KR-Chirp3-HD-Achird', label: '한국어 남성 (Chirp3 - 신뢰감 있는 톤)', gender: '남성' },
		{ code: 'ko-KR', name: 'ko-KR-Neural2-A', label: '한국어 여성 A (Neural2 - 차분한 나레이션)', gender: '여성' },
		{ code: 'ko-KR', name: 'ko-KR-Neural2-B', label: '한국어 여성 B (Neural2 - 밝고 경쾌함)', gender: '여성' },
		{ code: 'ko-KR', name: 'ko-KR-Neural2-C', label: '한국어 남성 C (Neural2 - 깔끔한 비즈니스)', gender: '남성' },
		{ code: 'ko-KR', name: 'ko-KR-Wavenet-A', label: '한국어 여성 A (WaveNet - 부드러움)', gender: '여성' },
		{ code: 'ko-KR', name: 'ko-KR-Wavenet-B', label: '한국어 여성 B (WaveNet - 맑은 톤)', gender: '여성' },
		{ code: 'ko-KR', name: 'ko-KR-Wavenet-C', label: '한국어 남성 C (WaveNet - 안정적인 톤)', gender: '남성' },
		{ code: 'ko-KR', name: 'ko-KR-Wavenet-D', label: '한국어 남성 D (WaveNet - 묵직한 중저음)', gender: '남성' },
		{ code: 'en-US', name: 'en-US-Journey-F', label: '영어 여성 (Journey - 초고품질 내레이션)', gender: '여성' },
		{ code: 'en-US', name: 'en-US-Journey-O', label: '영어 남성 (Journey - 초고품질 내레이션)', gender: '남성' },
		{ code: 'en-US', name: 'en-US-Neural2-O', label: '영어 남성 (Neural2)', gender: '남성' },
		{ code: 'en-US', name: 'en-US-Standard-A', label: '영어 여성 (Standard)', gender: '여성' },
		{ code: 'en-US', name: 'en-US-Chirp3-HD-Aoede', label: '영어 여성 (Chirp3 - 자연스러운 대화 톤)', gender: '여성' },
		{ code: 'en-US', name: 'en-US-Chirp3-HD-Asbolus', label: '영어 남성 (Chirp3 - 미디어 나레이션 톤)', gender: '남성' },
		{ code: 'en-US', name: 'en-US-Neural2-A', label: '영어 남성 A (Neural2 - 또박또박한 뉴스 톤)', gender: '남성' },
		{ code: 'en-US', name: 'en-US-Neural2-C', label: '영어 여성 C (Neural2 - 차분한 안내방송)', gender: '여성' },
		{ code: 'en-US', name: 'en-US-Neural2-D', label: '영어 남성 D (Neural2 - 부드러운 라디오 톤)', gender: '남성' },
		{ code: 'en-US', name: 'en-US-Neural2-F', label: '영어 여성 F (Neural2 - 밝고 선명한 톤)', gender: '여성' },
		{ code: 'en-US', name: 'en-US-Wavenet-A', label: '영어 여성 A (WaveNet - 대중적인 여성음)', gender: '여성' },
		{ code: 'en-US', name: 'en-US-Wavenet-B', label: '영어 남성 B (WaveNet - 표준 남성 나레이션)', gender: '남성' },
		{ code: 'en-US', name: 'en-US-Wavenet-C', label: '영어 여성 C (WaveNet - 안정감 있는 톤)', gender: '여성' },
		{ code: 'en-US', name: 'en-US-Wavenet-D', label: '영어 남성 D (WaveNet - 신뢰감 있는 비즈니스)', gender: '남성' }
	];

	const filteredVoices = $derived(voices.filter(v => v.code === selectedLanguage));

	$effect(() => {
		const available = filteredVoices;
		if (available.length > 0 && !available.some(v => v.name === selectedVoice)) {
			selectedVoice = available[0].name;
		}
	});

	$effect(() => {
		if (form?.error) {
			errorMessage = form.error;
		}
		if (form?.success) {
			errorMessage = null;
		}
	});

	$effect(() => {
		if (bulkLoading) {
			const interval = setInterval(() => {
				invalidate('app:sentences');
			}, 2000);
			return () => clearInterval(interval);
		}
	});

	let audioUrl = $state('');
	let audioPlayer = $state<HTMLAudioElement | null>(null);

	function playAudio(filename: string | null) {
		if (!filename) return;
		const fullUrl = `${data.ttsBaseUrl}/${filename}`;
		audioUrl = fullUrl;
		setTimeout(() => {
			if (audioPlayer) {
				audioPlayer.load();
				audioPlayer.play().catch((e: Error) => console.warn('playAudio:', e));
			}
		}, 50);
	}

	function onSubmit() {
		loading = true;
		errorMessage = null;
		return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: () => Promise<void> }) => {
			await update();
			loading = false;
			if (result?.type === 'success' && result?.data?.success && result?.data?.file_tts) {
				playAudio(result.data.file_tts as string);
				await invalidate('app:sentences');
			}
		};
	}

	function onSubmitAll() {
		bulkLoading = true;
		errorMessage = null;
		successMessage = null;
		return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: () => Promise<void> }) => {
			await update();
			bulkLoading = false;
			if (result?.type === 'success' && result?.data?.success) {
				const successCount = (result.data.successCount as number) ?? 0;
				const skippedCount = (result.data.skippedCount as number) ?? 0;
				const errorCount = (result.data.errorCount as number) ?? 0;
				successMessage = `TTS 생성 완료: ${successCount}건 성공`;
				if (skippedCount > 0) {
					successMessage += `, ${skippedCount}건 건너뜀`;
				}
				if (errorCount > 0) {
					successMessage += `, ${errorCount}건 실패`;
				}
				await invalidate('app:sentences');
			} else if (result?.type === 'failure') {
				errorMessage = (result?.data?.error as string) || '일괄 생성 중 오류가 발생했습니다.';
			}
		};
	}

	const langLabel = $derived(LANG_MAP[selectedLanguage] || '선택');

	function buildUrl(page?: number) {
		const params = new URLSearchParams();
		params.set('ttsFilter', ttsFilter);
		if (searchQuery.trim()) params.set('search', searchQuery.trim());
		if (selectedWorkId) params.set('workId', String(selectedWorkId));
		if (page && page > 1) params.set('page', String(page));
		return `/Function/gen/TTS_thePassage?${params.toString()}`;
	}

	function handleSearch() {
		window.location.href = buildUrl(1);
	}

	function handleWorkChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const value = target.value;
		selectedWorkId = value ? Number(value) : null;
		window.location.href = buildUrl(1);
	}

	function goToPage(p: number) {
		if (p < 1 || p > totalPages) return;
		window.location.href = buildUrl(p);
	}

	async function handleDelete(id: number) {
		if (!confirm('삭제하시겠습니까?')) return;
		try {
			const res = await fetch('/Function/gen/TTS', {
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
			errorMessage = e instanceof Error ? e.message : '알 수 없는 오류';
		}
	}

	function onR2UploadSubmit() {
		r2Loading = true;
		errorMessage = null;
		successMessage = null;
		return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: () => Promise<void> }) => {
			await update();
			r2Loading = false;
			if (result?.type === 'success' && result?.data?.success) {
				const uploadedCount = (result.data.uploadedCount as number) ?? 0;
				const skippedCount = (result.data.skippedCount as number) ?? 0;
				const errorCount = (result.data.errorCount as number) ?? 0;
				const total = (result.data.total as number) ?? 0;
				successMessage = `R2 업로드 완료: ${uploadedCount}건 업로드`;
				if (skippedCount > 0) successMessage += `, ${skippedCount}건 이미 있음`;
				if (errorCount > 0) successMessage += `, ${errorCount}건 실패`;
				successMessage += ` (총 ${total}건)`;
			} else if (result?.type === 'failure') {
				errorMessage = (result?.data?.error as string) || 'R2 업로드 중 오류가 발생했습니다.';
			}
		};
	}


</script>

<div class="space-y-6 p-6">
	<!-- 헤더 영역 -->
	<div class="flex items-start justify-between gap-4">
		<div class="space-y-1">
			<h1 class="flex items-center gap-2 text-2xl font-bold tracking-tight">
				<Sparkles class="size-6 text-indigo-500" />
				TTS
			</h1>
			<p class="text-muted-foreground text-sm">
				선택한 문장에 대해 TTS 음성을 생성하고 데이터베이스에 저장합니다.
			</p>
		</div>
		<form method="POST" action="?/uploadToR2" use:enhance={onR2UploadSubmit}>
			<Button
				type="submit"
				variant="outline"
				size="sm"
				class="gap-2 border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-300 dark:hover:bg-sky-950/50"
				disabled={r2Loading}
			>
				{#if r2Loading}
					<Loader2 class="size-4 animate-spin" />
					업로드 중...
				{:else}
					<Upload class="size-4" />
					Cloudflare에 올리기
				{/if}
			</Button>
		</form>
		<form method="POST" action="?/organizeMp3" use:enhance={() => {
			organizeLoading = true;
			errorMessage = null;
			successMessage = null;
			return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: () => Promise<void> }) => {
				await update();
				organizeLoading = false;
				if (result?.type === 'success' && result?.data?.success) {
					const copiedCount = (result.data.copiedCount as number) ?? 0;
					const skippedCount = (result.data.skippedCount as number) ?? 0;
					const errorCount = (result.data.errorCount as number) ?? 0;
					const total = (result.data.total as number) ?? 0;
					successMessage = `MP3 정리 완료: ${copiedCount}건 복사`;
					if (skippedCount > 0) successMessage += `, ${skippedCount}건 건너뜀`;
					if (errorCount > 0) successMessage += `, ${errorCount}건 실패`;
					successMessage += ` (총 ${total}건)`;
					await invalidate('app:sentences');
				} else if (result?.type === 'failure') {
					errorMessage = (result?.data?.error as string) || 'MP3 정리 중 오류가 발생했습니다.';
				}
			};
		}}>
			<Button
				type="submit"
				variant="outline"
				size="sm"
				class="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/50"
				disabled={organizeLoading}
			>
				{#if organizeLoading}
					<Loader2 class="size-4 animate-spin" />
					정리 중...
				{:else}
					<Database class="size-4" />
					MP3 정리
				{/if}
			</Button>
		</form>
	</div>

	<!-- 메인 폼 및 설정 카드 -->
	<div class="grid gap-6 lg:grid-cols-3">
		<!-- 1. 생성 설정 (좌측 1/3) -->
		<Card.Root class="lg:col-span-1 border-muted">
			<Card.Header>
				<Card.Title class="text-base flex items-center gap-2">
					<Languages class="size-4 text-indigo-500" />
					생성 설정
				</Card.Title>
				<Card.Description>언어, 음성 모델 및 속도를 설정합니다.</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="POST" action="?/process" use:enhance={onSubmit} id="generator-form" class="space-y-4">
					<input type="hidden" name="sentenceId" value={selectedSentenceId} />
					<input type="hidden" name="voice" value={selectedVoice} />
					<input type="hidden" name="speed" value={rate} />
					<input type="hidden" name="lang" value={selectedLanguage} />
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<label for="lang-select" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">대상 언어</label>
							<Select.Root type="single" bind:value={selectedLanguage}>
								<Select.Trigger id="lang-select" class="h-10 w-full text-sm font-medium">
									{langLabel}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="en-US">영어 (English)</Select.Item>
									<Select.Item value="ko-KR">한국어 (Korean)</Select.Item>
								</Select.Content>
							</Select.Root>
						</div>
						<div class="space-y-2">
							<label for="voice-select" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">음성 모델</label>
							<Select.Root type="single" bind:value={selectedVoice}>
								<Select.Trigger id="voice-select" class="h-10 w-full text-sm font-medium">
									{filteredVoices.find(v => v.name === selectedVoice)?.label ?? selectedVoice}
								</Select.Trigger>
								<Select.Content>
									{#each filteredVoices as v (v.name)}
										<Select.Item value={v.name}>{v.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
					</div>

					<div class="space-y-2">
						<div class="flex justify-between items-center">
							<div class="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">말하기 속도</div>
							<span class="text-xs font-semibold bg-muted px-2 py-0.5 rounded">{rate.toFixed(2)}배속</span>
						</div>
						<div class="flex items-center gap-2">
							<span class="text-xs text-muted-foreground">0.5×</span>
							<input type="range" min="0.5" max="2.0" step="0.05" bind:value={rate} class="flex-1 h-2 accent-indigo-600" aria-label="말하기 속도" />
							<span class="text-xs text-muted-foreground">2.0×</span>
						</div>
					</div>

					<div class="pt-2">
						<Button
							type="submit"
							class="w-full py-5 text-sm font-semibold shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-all duration-200"
							disabled={loading || selectedSentenceId === null}
						>
							{#if loading}
								<Loader2 class="size-4 animate-spin mr-2" />
								TTS 생성 중...
							{:else}
								<Sparkles class="size-4 mr-2" />
								TTS 생성하기
							{/if}
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>

		<!-- 2. 선택된 문장 미리보기 (우측 2/3) -->
		<Card.Root class="lg:col-span-2 border-muted">
			<Card.Header>
				<Card.Title class="text-base flex items-center gap-2">
					<Database class="size-4 text-indigo-500" />
					선택된 문장
				</Card.Title>
				<Card.Description>테이블에서 문장을 클릭하여 선택하세요.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-3">
				<div class="min-h-[6rem] rounded-lg border border-muted bg-muted/30 p-4 text-sm leading-relaxed">
					{#if selectedSentenceId !== null}
						{@const selected = sentences.find(s => s.id === selectedSentenceId)}
						{#if selected}
							<p class="font-medium">{selected.sent}</p>
							<p class="text-xs text-muted-foreground mt-2">ID: {selected.id} | Lang: {selected.lang} | Voice: {selected.voice ?? '-'} | Speed: {selected.speed ?? '1.0'}</p>
						{:else}
							<p class="text-muted-foreground">문장을 찾을 수 없습니다.</p>
						{/if}
					{:else}
						<p class="text-muted-foreground">문장을 선택해 주세요.</p>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>
</div>

	<!-- 일괄 생성 폼 (전체 건수 기준, 필터 파라미터 전달) -->
	<form method="POST" action="?/processAll" use:enhance={onSubmitAll} id="batch-tts-form">
		<input type="hidden" name="ttsFilter" value={ttsFilter} />
		<input type="hidden" name="workId" value={selectedWorkId ?? ''} />
		<input type="hidden" name="searchQuery" value={searchQuery} />
		<input type="hidden" name="voice" value={selectedVoice} />
		<input type="hidden" name="speed" value={rate} />
		<input type="hidden" name="lang" value={selectedLanguage} />
	</form>

	<!-- 저장된 문장 -->
	<Card.Root class="border-muted">
		<Card.Header>
			<Card.Title class="text-base flex items-center gap-2">
				<Database class="size-4 text-indigo-500" />
				저장된 문장
			</Card.Title>
			<Card.Description>Turso 데이터베이스의 문장들입니다. (ID 역순, {totalCount.toLocaleString()}건)</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<!-- 작품 선택 필터 -->
			<div class="flex items-center gap-3">
				<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono shrink-0">작품</span>
				<select
					onchange={handleWorkChange}
					class="flex h-10 w-[32rem] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<option value="">전체 작품</option>
					{#each data.works as w (w.id)}
						<option value={w.id} selected={selectedWorkId === w.id}>{w.id}. {w.title || `작품 #${w.id}`} {w.mp3Count}/{w.totalCount}</option>
					{/each}
				</select>
			</div>
			<!-- TTS 필터 -->
			<div class="flex items-center gap-4 text-sm">
				<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">TTS 필터</span>
				<label class="flex items-center gap-2">
					<input type="radio" name="ttsFilter" value="all" bind:group={ttsFilter} onchange={handleSearch} />
					전체
				</label>
				<label class="flex items-center gap-2">
					<input type="radio" name="ttsFilter" value="generated" bind:group={ttsFilter} onchange={handleSearch} />
					생성
				</label>
				<label class="flex items-center gap-2">
					<input type="radio" name="ttsFilter" value="not_generated" bind:group={ttsFilter} onchange={handleSearch} />
					미생성
				</label>
				<span class="ml-2 text-xs text-muted-foreground font-mono">총 {totalCount.toLocaleString()}건</span>
				{#if ttsFilter === 'not_generated'}
					<div class="ml-auto shrink-0">
						<Button
							type="submit"
							form="batch-tts-form"
							size="sm"
							class="bg-indigo-600 hover:bg-indigo-700 text-white"
							disabled={bulkLoading || sentences.length === 0}
						>
							{#if bulkLoading}
								<Loader2 class="size-4 animate-spin mr-2" />
								일괄 생성 중...
							{:else}
								<Sparkles class="size-4 mr-2" />
								일괄 생성 ({totalCount.toLocaleString()}건)
							{/if}
						</Button>
					</div>
				{/if}
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

			<!-- 피드백 메시지 (검색 아래, 테이블 위) -->
			{#if errorMessage}
				<div class="bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-2 rounded-lg border p-3 text-sm">
					<AlertTriangle class="size-4 shrink-0 mt-0.5" />
					<div>{errorMessage}</div>
				</div>
			{/if}

			{#if successMessage}
				<div class="bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400 flex items-start gap-2 rounded-lg border p-3 text-sm">
					<Sparkles class="size-4 shrink-0 mt-0.5" />
					<div>{successMessage}</div>
				</div>
			{/if}

		<!-- 문장 테이블 -->
		<div class="rounded-md border overflow-x-auto">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-16">ID</Table.Head>
						<Table.Head class="w-16">Lang</Table.Head>
						<Table.Head class="w-48">Voice</Table.Head>
						<Table.Head class="w-16">Speed</Table.Head>
						<Table.Head>문장</Table.Head>
						<Table.Head class="w-44">Created At</Table.Head>
					<Table.Head class="w-20 sticky right-20 bg-background z-10 shadow-[-1px_0_0_0_var(--border)]">재생</Table.Head>
					<Table.Head class="w-20 sticky right-0 bg-background z-10 shadow-[-1px_0_0_0_var(--border)]">삭제</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if sentences.length === 0}
						<Table.Row>
							<Table.Cell colspan={8} class="text-center text-muted-foreground py-8 text-sm">
								저장된 문장이 없습니다.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each sentences as s (s.id)}
							<Table.Row
								class="hover:bg-muted/50 transition-colors cursor-pointer {selectedSentenceId === s.id ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''}"
								onclick={() => { selectedSentenceId = s.id; }}
							>
								<Table.Cell class="font-semibold text-muted-foreground text-xs">{s.id}</Table.Cell>
								<Table.Cell class="text-xs font-mono">{s.lang}</Table.Cell>
								<Table.Cell class="text-xs text-muted-foreground max-w-48 truncate" title={s.voice ?? ''}>{s.voice ?? '-'}</Table.Cell>
								<Table.Cell class="text-xs text-center font-semibold">{s.speed ?? '1.0'}</Table.Cell>
								<Table.Cell class="text-sm leading-relaxed break-words">{s.sent}</Table.Cell>
								<Table.Cell class="text-xs text-muted-foreground whitespace-nowrap">
									{new Date(s.createdAt).toLocaleString('ko-KR')}
								</Table.Cell>
							<Table.Cell class="sticky right-20 bg-background z-10 shadow-[-1px_0_0_0_var(--border)]">
								<Button
									size="sm"
									variant="outline"
									disabled={!s.hasMp3}
									onclick={(e) => { e.stopPropagation(); playAudio(s.file_tts); }}
								>
									<Play class="size-4" />
								</Button>
							</Table.Cell>
							<Table.Cell class="sticky right-0 bg-background z-10 shadow-[-1px_0_0_0_var(--border)]">
									<Button
										size="sm"
										variant="destructive"
										onclick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
									>
										삭제
									</Button>
								</Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</div>

			<!-- 페이지네이션 -->
			{#if totalPages > 1}
				<div class="flex items-center justify-center gap-4 pt-4">
					<Button size="sm" variant="outline" disabled={currentPage <= 1} onclick={() => goToPage(currentPage - 1)}>
						이전
					</Button>
					<span class="text-xs text-muted-foreground font-mono">
						{currentPage} / {totalPages} 페이지
					</span>
					<Button size="sm" variant="outline" disabled={currentPage >= totalPages} onclick={() => goToPage(currentPage + 1)}>
						다음
					</Button>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	{#if audioUrl}
		<audio controls bind:this={audioPlayer} src={audioUrl} class="w-full"></audio>
	{/if}
</div>
