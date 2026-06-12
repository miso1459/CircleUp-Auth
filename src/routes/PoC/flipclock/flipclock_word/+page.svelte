<script lang="ts">
  let sentence1 = $state("The quick brown fox jumps over the lazy dog.");
  let sentence2 = $state("The lazy brown cat sleeps under the warm sun.");
  let animating = $state(false);
  let flipped = $state(new Set<number>());

  // Word split: trim + split(/\s+/) — handles leading/trailing/consecutive spaces
  const words1 = $derived(sentence1.trim().split(/\s+/));
  const words2 = $derived(sentence2.trim().split(/\s+/));
  const maxLen = $derived(Math.max(words1.length, words2.length));
  const indices = $derived(Array.from({ length: maxLen }, (_, i) => i));

  // GETTER: returns word at index or '' if out of bounds
  function getWord(arr: string[], i: number) {
    return i < arr.length ? arr[i] : '';
  }

  // flipMask: true when w1 exists and differs from w2
  // - w1 !== w2 → flip (includes w2 shorter: w2='' → w1!=='' → flip to blank)
  // - w1 === w2 → no flip
  // - w1 === '' (sentence1 shorter) → no flip, just display w2
  const flipMask = $derived.by(() => {
    const mask: boolean[] = [];
    for (let i = 0; i < maxLen; i++) {
      const w1 = getWord(words1, i);
      const w2 = getWord(words2, i);
      if (w1 !== '' && w1 !== w2) {
        mask[i] = true;
      } else {
        mask[i] = false;
      }
    }
    return mask;
  });

  // Sequential flip: 120ms between each word
  async function startFlip() {
    animating = true;
    flipped = new Set();
    for (const i of indices) {
      if (flipMask[i]) {
        await new Promise(r => setTimeout(r, 120));
        flipped.add(i);
        flipped = new Set(flipped);
      }
    }
    await new Promise(r => setTimeout(r, 600));
    animating = false;
  }

  // diffClear: keep only words at same position that are identical
  function diffClear() {
    const w1 = words1;
    const w2 = words2;
    const max = Math.max(w1.length, w2.length);
    sentence1 = w2.join(' ');
    let result: string[] = [];
    for (let i = 0; i < max; i++) {
      const word1 = getWord(w1, i);
      const word2 = getWord(w2, i);
      if (word1 !== '' && word2 !== '' && word1 === word2) {
        result.push(word2);
      }
    }
    sentence2 = result.join(' ');
  }
</script>

<div class="container">
  <h1>Flip Clock Word</h1>

  <div class="inputs">
    <label>
      Sentence 1
      <input bind:value={sentence1} disabled={animating} />
    </label>
    <label>
      Sentence 2
      <input bind:value={sentence2} disabled={animating} />
    </label>
  </div>

  <div class="btn-group">
    <button onclick={startFlip} disabled={animating}>
      {animating ? 'Flipping...' : 'Flip!'}
    </button>
    <button onclick={diffClear}>
      Diff Clear
    </button>
  </div>

  <div class="display">
    {#each indices as i}
      {@const w1 = getWord(words1, i)}
      {@const w2 = getWord(words2, i)}
      {#if !flipMask[i]}
        <span class="word">{w2 || w1 || ''}</span>
      {:else if flipped.has(i)}
        <span class="flip-card" style="width: {Math.max(w1.length, w2.length) + 1}ch;">
          <span class="flip-inner flipped">
            <span class="front">{w1}</span>
            <span class="back">{w2}</span>
          </span>
        </span>
      {:else}
        <span class="flip-card" style="width: {Math.max(w1.length, w2.length) + 1}ch;">
          <span class="flip-inner">
            <span class="front">{w1}</span>
            <span class="back">{w2}</span>
          </span>
        </span>
      {/if}
    {/each}
  </div>
</div>

<style>
  .container {
    max-width: 600px;
    margin: 40px auto;
    padding: 20px;
    font-family: system-ui, sans-serif;
    text-align: center;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 24px;
  }

  .inputs {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
  }

  .inputs label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    color: #555;
    text-align: left;
  }

  .inputs input {
    padding: 8px 12px;
    font-size: 16px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-family: inherit;
  }

  button {
    padding: 10px 28px;
    font-size: 15px;
    border: 1px solid #888;
    border-radius: 8px;
    background: #222;
    color: #fff;
    cursor: pointer;
    font-family: inherit;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button:hover:not(:disabled) {
    background: #444;
  }

  .btn-group {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-bottom: 32px;
  }

  .display {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 20px;
    background: #111;
    border-radius: 10px;
    font-size: 24px;
    color: #eee;
    font-weight: bold;
  }

  .word {
    padding: 4px 8px;
    background: #1a1a1a;
    border-radius: 6px;
    margin: 3px 0;
  }

  .flip-card {
    padding: 4px 8px;
    background: #1a1a1a;
    border-radius: 6px;
    display: inline-flex;
    perspective: 500px;
    min-width: 3ch;
  }

  .flip-inner {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
  }

  .flip-inner.flipped {
    animation: flip 0.5s ease-in-out forwards;
  }

  .front,
  .back {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
  }

  .front {
    background: #1a1a1a;
    color: #eee;
  }

  .back {
    background: #1a1a1a;
    color: #4fc3f7;
    transform: rotateX(180deg);
  }

  @keyframes flip {
    0% { transform: rotateX(0deg); }
    50% { transform: rotateX(90deg); }
    100% { transform: rotateX(180deg); }
  }
</style>
