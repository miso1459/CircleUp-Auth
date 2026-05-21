<!-- src/routes/tts/+page.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let text = $state("I am feeling down today, but let's hold onto hope for tomorrow.");
  let voices = $state<SpeechSynthesisVoice[]>([]);
  let selectedVoiceIndex = $state(0);
  let rate = $state(1.0);
  let status = $state<'idle' | 'playing' | 'paused'>('idle');
  let errorMsg = $state('');

  let utterance: SpeechSynthesisUtterance | null = null;

  function getSynth(): SpeechSynthesis | null {
    if (typeof window === 'undefined') return null;
    return window.speechSynthesis;
  }

  function loadVoices() {
    const synth = getSynth();
    if (!synth) return;
    voices = synth.getVoices().filter((v) => v.lang.startsWith('en'));
  }

  onMount(() => {
    const synth = getSynth();
    if (!synth) {
      errorMsg = '이 브라우저는 Web Speech API를 지원하지 않습니다.';
      return;
    }
    loadVoices();
    synth.onvoiceschanged = loadVoices;
  });

  onDestroy(() => {
    getSynth()?.cancel();
  });

  function play() {
    errorMsg = '';
    const synth = getSynth();
    if (!synth) return;

    if (!text.trim()) {
      errorMsg = '텍스트를 입력해 주세요.';
      return;
    }

    // 일시정지 상태면 재개
    if (status === 'paused') {
      synth.resume();
      status = 'playing';
      return;
    }

    synth.cancel();

    utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.lang = 'en-US';

    if (voices[selectedVoiceIndex]) {
      utterance.voice = voices[selectedVoiceIndex];
      utterance.lang = voices[selectedVoiceIndex].lang;
    }

    utterance.onstart = () => { status = 'playing'; };
    utterance.onend   = () => { status = 'idle'; };
    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') errorMsg = `TTS 오류: ${e.error}`;
      status = 'idle';
    };

    synth.speak(utterance);
  }

  function pause() {
    getSynth()?.pause();
    status = 'paused';
  }

  function stop() {
    getSynth()?.cancel();
    status = 'idle';
  }
</script>

<main>
  <h1>English TTS Player</h1>

  <div class="tts-player">
    <label class="field-label">
      재생할 영어 문장
      <textarea
        bind:value={text}
        placeholder="Enter English text here..."
        rows="4"
      ></textarea>
    </label>

    <div class="options">
      <label class="field-label">
        목소리
        <select bind:value={selectedVoiceIndex}>
          {#if voices.length === 0}
            <option value={0}>기본 목소리</option>
          {:else}
            {#each voices as voice, i (voice.name)}
              <option value={i}>{voice.name}</option>
            {/each}
          {/if}
        </select>
      </label>

      <label class="field-label">
        속도: {rate.toFixed(1)}×
        <input type="range" min="0.5" max="2" step="0.1" bind:value={rate} />
      </label>
    </div>

    <div class="btn-row">
      <button onclick={play} disabled={status === 'playing'}>
        {status === 'paused' ? '▶ 재개' : '▶ 재생'}
      </button>
      <button onclick={pause} disabled={status !== 'playing'}>⏸ 일시정지</button>
      <button onclick={stop}  disabled={status === 'idle'}>⏹ 정지</button>
      {#if status !== 'idle'}
        <span class="status-msg">
          {status === 'playing' ? '재생 중...' : '일시정지됨'}
        </span>
      {/if}
    </div>

    {#if errorMsg}
      <p class="error">{errorMsg}</p>
    {/if}
  </div>
</main>

<style>
  main {
    padding: 2rem;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
  }

  .tts-player {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 560px;
  }

  .field-label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: #555;
  }

  textarea {
    width: 100%;
    padding: 10px 12px;
    font-size: 15px;
    line-height: 1.6;
    border: 1px solid #d0d0d0;
    border-radius: 8px;
    resize: vertical;
    box-sizing: border-box;
    font-family: inherit;
  }

  .options {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }

  select {
    padding: 7px 10px;
    font-size: 14px;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    background: white;
  }

  input[type='range'] {
    width: 140px;
    margin-top: 4px;
  }

  .btn-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  button {
    padding: 8px 18px;
    font-size: 14px;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    transition: background 0.15s;
  }

  button:hover:not(:disabled) {
    background: #f5f5f5;
  }

  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .status-msg {
    font-size: 13px;
    color: #888;
    margin-left: 4px;
  }

  .error {
    margin: 0;
    font-size: 13px;
    color: #c0392b;
  }
</style>