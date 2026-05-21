<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { ImagePlus, Loader2, Sparkles, Trash2, Upload } from '@lucide/svelte';

	let sentence = $state('A small cabin glows beside a quiet lake at sunset.');
	let prompt = $state(
		'따뜻한 시네마틱 조명, 섬세한 배경, 이야기책 삽화 느낌으로 그려줘: {sentence}'
	);
	let selectedImage = $state<string | null>(null);
	let selectedFileName = $state('');
	let generatedImage = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let loading = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);

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

	function onFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) {
			return;
		}
		if (!file.type.startsWith('image/')) {
			errorMessage = '이미지 파일만 선택할 수 있습니다.';
			input.value = '';
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			selectedImage = String(reader.result);
			selectedFileName = file.name;
			errorMessage = null;
		};
		reader.onerror = () => {
			errorMessage = '이미지를 읽지 못했습니다.';
		};
		reader.readAsDataURL(file);
	}

	function clearSelectedImage() {
		selectedImage = null;
		selectedFileName = '';
		if (fileInput) {
			fileInput.value = '';
		}
	}

	function clearGeneratedImage() {
		generatedImage = null;
	}

	async function generateImage() {
		loading = true;
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
			loading = false;
		}
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
	</div>

	<div class="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
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
						class="resize-none text-sm"
					/>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">프롬프트 입력</Card.Title>
					<Card.Description>
						<code class="rounded bg-muted px-1 text-xs">{`{sentence}`}</code> 자리에 문장이 치환됩니다.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<Textarea
						bind:value={prompt}
						rows={6}
						placeholder="스타일, 구도, 색감, 분위기를 입력하세요."
						class="resize-none text-sm"
					/>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">참조 이미지</Card.Title>
					<Card.Description>선택 이미지가 없으면 마지막 생성 이미지를 참조합니다.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="flex flex-wrap gap-2">
						<Button type="button" variant="outline" onclick={() => fileInput?.click()}>
							<Upload class="size-4" />
							이미지 선택
						</Button>
						<input
							bind:this={fileInput}
							type="file"
							accept="image/png,image/jpeg,image/webp"
							class="hidden"
							onchange={onFileChange}
						/>
						<Button
							type="button"
							variant="outline"
							disabled={!selectedImage}
							onclick={clearSelectedImage}
						>
							<Trash2 class="size-4" />
							선택 이미지 지우기
						</Button>
					</div>

					{#if selectedImage}
						<div class="space-y-2">
							<p class="text-xs text-muted-foreground">{selectedFileName}</p>
							<img
								src={selectedImage}
								alt="선택한 참조 이미지"
								class="aspect-4/3 w-full rounded-md border object-cover"
							/>
						</div>
					{:else}
						<div
							class="flex aspect-4/3 items-center justify-center rounded-md border border-dashed border-muted-foreground/25 text-sm text-muted-foreground"
						>
							선택된 참조 이미지 없음
						</div>
					{/if}

					<Button type="button" class="w-full" disabled={loading} onclick={generateImage}>
						{#if loading}
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
				</Card.Content>
			</Card.Root>
		</div>

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
