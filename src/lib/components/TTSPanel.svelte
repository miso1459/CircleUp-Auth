<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import {
		Loader2,
		Sparkles,
		Languages,
		Database,
		AlertTriangle
	} from '@lucide/svelte';

	const LANG_MAP = {
		'en-US': '영어 (English)',
		'ko-KR': '한국어 (Korean)'
	} as const;

	type LangCode = keyof typeof LANG_MAP;

	interface Sentence {
		id: number;
		sent: string;
		lang: string;
		voice?: string | null;
		speed?: string | null;
	}

	let {
		sentences = [],
		savedLang = 'en-US',
		savedVoice = 'en-US-Neural2-F',
		ttsBaseUrl = '',
		formAction = '?/process',
		compact = false,
		form,
		selectedSentenceId = $bindable(null)
	}: {
		sentences: Sentence[];
		savedLang: string;
		savedVoice: string;
		ttsBaseUrl: string;
		formAction?: string;
		compact?: boolean;
		form?: { error?: string; success?: boolean; file_tts?: string } | null;
		selectedSentenceId?: number | null;
	} = $props();

	let selectedLanguage = $state<LangCode>((savedLang as LangCode) || 'en-US');
	let selectedVoice = $state(savedVoice || 'en-US-Neural2-F');
	let rate = $state(1.0);
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

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

	const langLabel = $derived(LANG_MAP[selectedLanguage] || '선택');
</script>

<div class={compact ? 'space-y-2 p-2' : 'space-y-6 p-6'}>
	<Accordion.Root type="single" collapsible>
		<Accordion.Item value="tts-section">
			<Accordion.Trigger class={compact ? 'text-2xl font-bold tracking-tight py-1' : 'text-2xl font-bold tracking-tight py-4'}>
				<div class="flex items-center gap-2">
					<Sparkles class="size-6 text-indigo-500" />
					<span>TTS</span>
				</div>
			</Accordion.Trigger>
			<Accordion.Content>
				<div class="space-y-6">
					<p class="text-muted-foreground text-sm">
						선택한 문장에 대해 TTS 음성을 생성하고 데이터베이스에 저장합니다.
					</p>

					<div class="grid gap-6 lg:grid-cols-3">
						<Card.Root class="lg:col-span-1 border-muted">
							<Card.Header>
								<Card.Title class="text-base flex items-center gap-2">
									<Languages class="size-4 text-indigo-500" />
									생성 설정
								</Card.Title>
								<Card.Description>언어, 음성 모델 및 속도를 설정합니다.</Card.Description>
							</Card.Header>
							<Card.Content>
								<form method="POST" action={formAction} use:enhance={onSubmit} id="generator-form" class="space-y-4">
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
			</Accordion.Content>
		</Accordion.Item>
	</Accordion.Root>
</div>
