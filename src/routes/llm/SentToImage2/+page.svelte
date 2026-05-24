<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { ImagePlus, Loader2, Sparkles, Trash2, Wand2 } from '@lucide/svelte';

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
	let generatedImage = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let imageLoading = $state(false);
	let promptLoading = $state(false);

	$effect(() => {
		if (form?.prompt) {
			prompt = form.prompt;
			errorMessage = null;
		}
		if (form?.error) {
			errorMessage = form.error;
		}
	});

	function buildImagePrompt(sentenceValue: string, promptValue: string) {
		const trimmedSentence = sentenceValue.trim();
		const trimmedPrompt = promptValue.trim();

		if (trimmedPrompt.includes('{sentence}')) {
			return trimmedPrompt.replaceAll('{sentence}', trimmedSentence);
		}

		return `${trimmedPrompt}\n\n기준 문장: ${trimmedSentence}\n위 문장을 핵심 장면으로 삼아 프롬프트 설명대로 이미지를 생성하세요.`;
	}

	function buildPollinationsImageUrl(promptValue: string) {
		const encodedPrompt = encodeURIComponent(promptValue);
		return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=600&nologo=true`;
	}

	function clearGeneratedImage() {
		generatedImage = null;
	}

	async function generateImage() {
		imageLoading = true;
		errorMessage = null;

		try {
			if (!sentence.trim()) {
				throw new Error('문장을 입력해 주세요.');
			}
			if (!prompt.trim()) {
				throw new Error('프롬프트를 입력해 주세요.');
			}

			generatedImage = buildPollinationsImageUrl(buildImagePrompt(sentence, prompt));
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : '이미지를 생성하지 못했습니다.';
		} finally {
			imageLoading = false;
		}
	}

	function onPromptSubmit() {
		promptLoading = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			promptLoading = false;
		};
	}
</script>

<div class="mx-auto max-w-6xl space-y-6 p-6">
	<div class="space-y-1">
		<h1 class="flex items-center gap-2 text-2xl font-bold tracking-tight">
			<ImagePlus class="size-6 text-indigo-500" />
			Sentence to Image
		</h1>
		<p class="text-sm text-muted-foreground">
			문장과 프롬프트를 조합해 Pollinations 이미지 URL을 생성합니다.
		</p>
		{#if !data.geminiConfigured}
			<p class="text-sm font-medium text-destructive">
				GEMINI_API_KEY가 설정되지 않았습니다. .env에 API 키를 추가해 주세요.
			</p>
		{/if}
	</div>

	<div class="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
		<!-- 왼쪽: 문장 입력 + 프롬프트 생성 -->
		<div class="space-y-6">
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">문장 입력</Card.Title>
					<Card.Description>이미지의 기준이 되는 문장 하나를 입력합니다.</Card.Description>
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

			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2 text-base">
						<Wand2 class="size-4" />
						프롬프트 생성
					</Card.Title>
					<Card.Description>
						<code class="rounded bg-muted px-1 text-xs">{`{sentence}`}</code> 자리에 문장이 치환됩니다. LLM으로 프롬프트를 자동 생성합니다.
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-3">
					<Textarea
						bind:value={sentenceForPrompt}
						rows={14}
						placeholder="프롬프트 생성 규칙을 입력하세요. {sentence}는 문장 입력값으로 치환됩니다."
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

		<!-- 오른쪽: 프롬프트 입력 + 생성 버튼 + 생성 결과 -->
		<div class="space-y-6">
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">프롬프트 입력</Card.Title>
					<Card.Description>이미지 생성에 사용할 프롬프트를 입력합니다.</Card.Description>
				</Card.Header>
				<Card.Content>
					<Textarea
						bind:value={prompt}
						rows={6}
						placeholder="스타일, 구도, 색감, 분위기를 입력하세요."
						class="font-mono text-sm"
					/>
				</Card.Content>
			</Card.Root>

			<Button type="button" class="w-full" disabled={imageLoading} onclick={generateImage}>
				{#if imageLoading}
					<Loader2 class="size-4 animate-spin" />
					생성 중...
				{:else}
					<Sparkles class="size-4" />
					이미지 생성
				{/if}
			</Button>

			{#if errorMessage}
				<p class="text-sm text-destructive">{errorMessage}</p>
			{/if}

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">생성 결과</Card.Title>
					<Card.Description>
						{#if generatedImage}
							새 이미지로 생성되었습니다.
						{:else}
							아직 생성된 이미지가 없습니다.
						{/if}
					</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if generatedImage}
						<div class="space-y-3">
							<img
								src={generatedImage}
								alt="생성된 이미지"
								referrerpolicy="no-referrer"
								class="aspect-4/3 w-full rounded-md border object-cover"
							/>
							<Button type="button" variant="outline" onclick={clearGeneratedImage}>
								<Trash2 class="size-4" />
								생성된 이미지 지우기
							</Button>
						</div>
					{:else}
						<div
							class="flex aspect-4/3 items-center justify-center rounded-md border bg-muted/40 text-sm text-muted-foreground"
						>
							이미지 생성 결과
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
