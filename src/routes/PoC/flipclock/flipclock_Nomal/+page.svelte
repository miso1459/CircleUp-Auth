<script lang="ts">
  let sentence1 = $state("I am a boy.");
  let sentence2 = $state("I am a girl.");
  let animating = $state(false);
  let flipped = $state(new Set<number>());

  const chars1 = $derived(sentence1.split(''));
  const chars2 = $derived(sentence2.split(''));
  const maxLen = $derived(Math.max(chars1.length, chars2.length));
  const indices = $derived(Array.from({ length: maxLen }, (_, i) => i));

  function getChar(arr: string[], i: number) {
    return i < arr.length ? arr[i] : '';
  }

  const flipMask = $derived.by(() => {
    const mask: boolean[] = [];
    for (let i = 0; i < maxLen; i++) {
      if (getChar(chars1, i) !== getChar(chars2, i)) {
        mask[i] = true;
      } else if (getChar(chars2, i) === ' ') {
        mask[i] = false;
      } else if (i > 0 && mask[i - 1]) {
        mask[i] = true;
      } else {
        mask[i] = false;
      }
    }
    return mask;
  });

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

  function diffClear() {
    const s1 = sentence1;
    const s2 = sentence2;
    const max = Math.max(s1.length, s2.length);

    sentence1 = s2;

    let result = '';
    for (let i = 0; i < max; i++) {
      if (s1[i] === s2[i]) {
        result += s2[i];
      }
    }
    sentence2 = result;
  }
</script>

<div class="container">
  <h1>Flip Clock</h1>

  <div class="inputs">
    <label>
      문장 1
      <input bind:value={sentence1} disabled={animating} />
    </label>
    <label>
      문장 2
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
      {@const ch1 = getChar(chars1, i)}
      {@const ch2 = getChar(chars2, i)}
      {#if !flipMask[i]}
        <span class="char">{ch2}</span>
      {:else if flipped.has(i)}
        <span class="flip-card">
          <span class="flip-inner flipped">
            <span class="front">{ch1}</span>
            <span class="back">{ch2}</span>
          </span>
        </span>
      {:else}
        <span class="flip-card">
          <span class="flip-inner">
            <span class="front">{ch1}</span>
            <span class="back">{ch2}</span>
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
    font-family: 'Courier New', monospace;
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
    font-family: 'Courier New', monospace;
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
    justify-content: center;
    gap: 2px;
    min-height: 60px;
    padding: 16px;
    background: #111;
    border-radius: 10px;
    border: 2px solid #333;
    font-size: 28px;
    color: #eee;
    font-weight: bold;
  }

  .char {
    width: 0.7em;
    height: 1.2em;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .flip-card {
    perspective: 400px;
    width: 0.7em;
    height: 1.2em;
    display: inline-flex;
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
    border-radius: 3px;
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
