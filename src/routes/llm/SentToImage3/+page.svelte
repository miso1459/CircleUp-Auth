<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Wand2, Loader2, Copy, FileAudio, Search, X } from '@lucide/svelte';

	let { data, form }: PageProps = $props();

	let sentence = $state('I am having a pleasant meal with my friends.');
	let prompt = $state('');
	let sentenceForPrompt = $state(`{sentence}를 영어를 모르는 사람도 이해가 되는 이미지를 생성하도록 하는 프롬프트를 영어로 생성해줘.

프롬프트 작성 규칙:
- 반드시 영문으로 작성
- 생성된 프롬프트에는 반드시 "{sentence}" 포함
- "{sentence}" 자리에 실제 문장이 들어갈 것을 고려하여 자연스럽게 연결되도록 작성
- 영어를 몰라도 이미지 내용을 이해할 수 있도록 시각적으로 명확하게 표현
- 이미지에 텍스트, 글자, 단어가 포함되지 않도록 함
- 순수한 시각적 메시지로 전달
- 구체적인 시각적 디테일 포함 (색상, 조명, 구도, 분위기)
- 예술 스타일이나 미적 기준을 포함
- 프롬프트만 출력하고 다른 설명은 하지 마세요
- 첫 줄에 필수 추가
***minimal vector cartoon, clean line illustration, flat art***
***no text, no words, no letters***
***Clearly express the eyes, nose, and mouth***

`);
	let errorMessage = $state<string | null>(null);
	let promptLoading = $state(false);

	// Table + search states (adapted from gen_1)
	let searchQuery = $state(data.searchQuery);
	let sentences = $state(data.sentences);
	let ttsBaseUrl = $state(data.ttsBaseUrl);
	let audioUrl = $state('');
	let audioPlayer = $state<HTMLAudioElement | null>(null);

	// UI feedback
	let copySuccess = $state<string | null>(null);
	let searchLoading = $state(false);

	// Sync form data from server (from SentToImage2)
	$effect(() => {
		if (form?.prompt) {
			prompt = form.prompt;
			errorMessage = null;
		}
		if (form?.error) {
			errorMessage = form.error;
		}
	});

	// Sync DB data when load refreshes (from gen_1)
	$effect(() => {
		sentences = data.sentences;
		searchQuery = data.searchQuery;
		ttsBaseUrl = data.ttsBaseUrl;
	});

	function onPromptSubmit() {
		promptLoading = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			promptLoading = false;
		};
	}

	// 검색 (URL params 방식)
	function handleSearch() {
		searchLoading = true;
		copySuccess = null;
		const params = searchQuery.trim() ? `?search=${encodeURIComponent(searchQuery)}` : '';
		window.location.href = `/llm/SentToImage3${params}`;
	}

	// 검색어 초기화
	function clearSearch() {
		searchQuery = '';
		window.location.href = '/llm/SentToImage3';
	}

	// 문장 복사 (첫 번째 행의 sent 값)
	async function copyFirstSentence() {
		copySuccess = null;
		if (!sentences.length) return;
		try {
			await navigator.clipboard.writeText(sentences[0].sent);
			copySuccess = 'sentence';
			setTimeout(() => { copySuccess = null; }, 2000);
		} catch {
			errorMessage = '클립보드 복사에 실패했습니다.';
		}
	}

	// MP3 복사 (첫 번째 행 file_tts - .mp3 확장자 제거)
	async function copyFirstMp3() {
		copySuccess = null;
		if (!sentences.length || !sentences[0].file_tts) return;
		try {
			const filename = sentences[0].file_tts;
			const valueToCopy = filename.endsWith('.mp3') ? filename.slice(0, -4) : filename;
			await navigator.clipboard.writeText(valueToCopy);
			copySuccess = 'mp3';
			setTimeout(() => { copySuccess = null; }, 2000);
		} catch {
			errorMessage = '클립보드 복사에 실패했습니다.';
		}
	}

	// 오디오 재생 (from gen_1)
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
</script>

<div class="mx-auto max-w-6xl space-y-6 p-6">
	<!-- Header -->
	<div class="space-y-1">
		<h1 class="flex items-center gap-2 text-2xl font-bold tracking-tight">
			<Wand2 class="size-6 text-indigo-500" />
			Sentence to Image 3
		</h1>
		<p class="text-sm text-muted-foreground">
			저장된 문장 조회 및 프롬프트 생성
		</p>
		{#if !data.geminiConfigured}
			<p class="text-sm font-medium text-destructive">
				GEMINI_API_KEY가 설정되지 않았습니다.
			</p>
		{/if}
	</div>

	<div class="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
		<!-- LEFT COLUMN -->
		<div class="space-y-6">
			<!-- 문장 입력 Card -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">문장 입력</Card.Title>
					<Card.Description>LLM 프롬프트 생성의 기준이 되는 문장을 입력합니다.</Card.Description>
				</Card.Header>
				<Card.Content>
					<Textarea
						bind:value={sentence}
						rows={4}
						placeholder="이미지로 만들 문장을 입력하세요."
						class="font-mono text-sm"
					/>
				</Card.Content>
			</Card.Root>

			<!-- 프롬프트 생성 Card (from SentToImage2) -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2 text-base">
						<Wand2 class="size-4" />
						프롬프트 생성
					</Card.Title>
					<Card.Description>
						<code class="rounded bg-muted px-1 text-xs">{`{sentence}`}</code> 자리에 문장이 치환됩니다.
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-3">
					<Textarea
						bind:value={sentenceForPrompt}
						rows={14}
						placeholder="프롬프트 생성 규칙을 입력하세요."
						class="font-mono text-sm"
					/>
					<form
						method="POST"
						action="?/generatePrompt"
						use:enhance={onPromptSubmit}
					>
						<input type="hidden" name="sentenceForPrompt" value={sentenceForPrompt} />
						<input type="hidden" name="mainSentence" value={sentence} />
						<Button type="submit" class="w-full" disabled={promptLoading || !data.geminiConfigured}>
							{#if promptLoading}
								<Loader2 class="size-4 animate-spin" />
								생성 중...
							{:else}
								<Wand2 class="size-4" />
								프롬프트 생성
							{/if}
						</Button>
					</form>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- RIGHT COLUMN -->
		<div class="space-y-6">
			<!-- 프롬프트 입력 Card (display only, no image gen) -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">프롬프트 입력</Card.Title>
					<Card.Description>생성된 프롬프트를 확인하고 필요시 수정합니다.</Card.Description>
				</Card.Header>
				<Card.Content>
					<Textarea
						bind:value={prompt}
						rows={6}
						placeholder="생성된 프롬프트가 여기에 표시됩니다."
						class="font-mono text-sm"
					/>
				</Card.Content>
			</Card.Root>

			<!-- 저장된 문장 Card -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">저장된 문장</Card.Title>
					<Card.Description>file_image가 없는 레코드만 표시</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<!-- Search Bar -->
					<div class="flex gap-2">
						<input
							type="search"
							bind:value={searchQuery}
							placeholder="문장 검색..."
							class="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
							onkeydown={(e) => e.key === 'Enter' && handleSearch()}
						/>
						<Button onclick={handleSearch} disabled={searchLoading} size="sm">
							<Search class="size-4" />
							검색
						</Button>
						<Button onclick={clearSearch} variant="outline" size="sm">
							<X class="size-4" />
							지우기
						</Button>
					</div>

					<!-- Copy Buttons -->
					<div class="flex items-center gap-2">
						<Button onclick={copyFirstSentence} disabled={!sentences.length} size="sm">
							<Copy class="size-4" />
							문장 복사
						</Button>
						<Button onclick={copyFirstMp3}
							disabled={!sentences.length || !sentences[0]?.file_tts} size="sm">
							<FileAudio class="size-4" />
							MP3 복사
						</Button>
						{#if copySuccess === 'sentence'}
							<span class="text-xs text-green-600">문장이 복사되었습니다</span>
						{:else if copySuccess === 'mp3'}
							<span class="text-xs text-green-600">MP3 파일명이 복사되었습니다</span>
						{/if}
					</div>

					<!-- shadcn Table -->
					{#if sentences.length > 0}
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>ID</Table.Head>
									<Table.Head>Lang</Table.Head>
									<Table.Head>Voice</Table.Head>
									<Table.Head>Speed</Table.Head>
									<Table.Head>문장</Table.Head>
									<Table.Head>MP3</Table.Head>
									<Table.Head>Created At</Table.Head>
									<Table.Head>재생</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each sentences as s (s.id)}
									<Table.Row>
										<Table.Cell class="font-mono text-xs">{s.id}</Table.Cell>
										<Table.Cell class="text-xs">{s.lang}</Table.Cell>
										<Table.Cell class="max-w-[150px] truncate text-xs">{s.voice}</Table.Cell>
										<Table.Cell class="text-center text-xs">{s.speed ?? '1.0'}</Table.Cell>
										<Table.Cell class="max-w-[250px] truncate">{s.sent}</Table.Cell>
										<Table.Cell class="font-mono text-xs">
											{#if s.file_tts}
												{s.file_tts}
											{:else}
												<span class="text-muted-foreground">-</span>
											{/if}
										</Table.Cell>
										<Table.Cell class="whitespace-nowrap text-xs">
											{new Date(s.createdAt).toLocaleString()}
										</Table.Cell>
										<Table.Cell>
											<button
												onclick={() => playAudio(s.file_tts)}
												disabled={!s.file_tts}
												class="rounded-md p-1 hover:bg-muted disabled:opacity-50"
											>▶</button>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					{:else}
						<div class="flex items-center justify-center rounded-md border border-dashed py-8 text-sm text-muted-foreground">
							{searchQuery ? '검색 결과가 없습니다.' : '저장된 문장이 없습니다.'}
						</div>
					{/if}

					<!-- Audio Player -->
					{#if audioUrl}
						<div class="pt-2">
							<audio controls bind:this={audioPlayer} src={audioUrl} class="w-full"></audio>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>

	<!-- Error Message -->
	{#if errorMessage}
		<p class="text-sm text-destructive">{errorMessage}</p>
	{/if}
</div>
