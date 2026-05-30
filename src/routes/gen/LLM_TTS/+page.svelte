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
		Play
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
	let errorMessage = $state<string | null>(null);

	let searchQuery = $state(data.searchQuery);

	const sentences = $derived(data.sentences);

	const filteredSentences = $derived(sentences.filter((s) => {
		if (ttsFilter === 'all') return true;
		const hasTts = s.file_tts && s.file_tts !== '';
		if (ttsFilter === 'generated') return hasTts;
		return !hasTts;
	}));

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
			selectedSentenceId = null;
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
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			loading = false;
		};
	}

	const langLabel = $derived(LANG_MAP[selectedLanguage] || '선택');

	function handleSearch() {
		const params = searchQuery.trim() ? `?search=${encodeURIComponent(searchQuery)}` : '';
		window.location.href = `/gen/LLM_TTS${params}`;
	}

	async function handleDelete(id: number) {
		if (!confirm('삭제하시겠습니까?')) return;
		try {
			const res = await fetch('/gen/LLM_TTS', {
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

	function handleFilterChange() {
		// 클라이언트 사이드 필터링은 reactive derived가 처리
	}
</script>

<div class="space-y-6 p-6">
	<!-- 헤더 영역 -->
	<div class="space-y-1">
		<h1 class="flex items-center gap-2 text-2xl font-bold tracking-tight">
			<Sparkles class="size-6 text-indigo-500" />
			LLM TTS Generator
		</h1>
		<p class="text-muted-foreground text-sm">
			선택한 문장에 대해 TTS 음성을 생성하고 데이터베이스에 저장합니다.
		</p>
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

					<div class="space-y-2">
						<div class="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">TTS 필터</div>
						<div class="flex gap-4">
							<label class="flex items-center gap-2 text-sm">
								<input type="radio" name="ttsFilter" value="all" bind:group={ttsFilter} onchange={handleFilterChange} />
								전체
							</label>
							<label class="flex items-center gap-2 text-sm">
								<input type="radio" name="ttsFilter" value="generated" bind:group={ttsFilter} onchange={handleFilterChange} />
								생성
							</label>
							<label class="flex items-center gap-2 text-sm">
								<input type="radio" name="ttsFilter" value="not_generated" bind:group={ttsFilter} onchange={handleFilterChange} />
								미생성
							</label>
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
			<div class="rounded-md border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-16">ID</Table.Head>
							<Table.Head class="w-16">Lang</Table.Head>
							<Table.Head class="w-48">Voice</Table.Head>
							<Table.Head class="w-16">Speed</Table.Head>
							<Table.Head>문장</Table.Head>
							<Table.Head class="w-44">Created At</Table.Head>
							<Table.Head class="w-20">재생</Table.Head>
							<Table.Head class="w-20">삭제</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if filteredSentences.length === 0}
							<Table.Row>
								<Table.Cell colspan="8" class="text-center text-muted-foreground py-8 text-sm">
									저장된 문장이 없습니다.
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each filteredSentences as s (s.id)}
								<Table.Row
									class="hover:bg-muted/50 transition-colors cursor-pointer {selectedSentenceId === s.id ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''}"
									onclick={() => { selectedSentenceId = s.id; }}
								>
									<Table.Cell class="font-semibold text-muted-foreground text-xs">{s.id}</Table.Cell>
									<Table.Cell class="text-xs font-mono">{s.lang}</Table.Cell>
									<Table.Cell class="text-xs text-muted-foreground max-w-48 truncate" title={s.voice ?? ''}>{s.voice ?? '-'}</Table.Cell>
									<Table.Cell class="text-xs text-center font-semibold">{s.speed ?? '1.0'}</Table.Cell>
									<Table.Cell class="text-sm leading-relaxed">{s.sent}</Table.Cell>
									<Table.Cell class="text-xs text-muted-foreground whitespace-nowrap">
										{new Date(s.createdAt).toLocaleString('ko-KR')}
									</Table.Cell>
									<Table.Cell>
										<Button
											size="sm"
											variant="outline"
											disabled={!s.file_tts}
											onclick={(e) => { e.stopPropagation(); playAudio(s.file_tts); }}
										>
											<Play class="size-4" />
										</Button>
									</Table.Cell>
									<Table.Cell>
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
