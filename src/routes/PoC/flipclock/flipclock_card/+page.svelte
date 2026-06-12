<script>
  import { onMount } from 'svelte';

  // 1. Svelte 5 룬($state) 기반 상태 관리
  let sentence1 = $state("Let me go home now");
  let sentence2 = $state("I want to go early"); 

  let cards = $state([]);
  let isGlobalFlipping = $state(false);

  // 문장을 분석하여 단어 단위의 구조화된 카드 배열 데이터 생성
  function generateCards() {
    const arr1 = sentence1.split(" ").filter(w => w !== "");
    const arr2 = sentence2.split(" ").filter(w => w !== "");
    const maxLen = Math.max(arr1.length, arr2.length);

    const newCards = [];
    for (let i = 0; i < maxLen; i++) {
      const w1 = arr1[i] || "";
      const w2 = arr2[i] || "";
      const maxCharCount = Math.max(w1.length, w2.length);

      newCards.push({
        id: i,
        word1: w1, // 항상 시작점은 문장1 (검은색)
        word2: w2, // 항상 도착점은 문장2 (와인색)
        displayTextTop: w1,    // 상단 노출 텍스트 (초기는 문장1)
        displayTextBottom: w1, // 하단 노출 텍스트 (초기는 문장1)
        charCount: maxCharCount > 0 ? maxCharCount : 1,
        flipping: false,
        useWineColorTop: false,    // 초기 색상은 검은색
        useWineColorBottom: false, // 초기 색상은 검은색
        isDifferent: w1 !== w2,    // 두 단어가 다른지 여부
        visible: w1 !== "" || w2 !== ""
      });
    }
    cards = newCards;
  }

  // 🚀 항상 [문장1 ➔ 문장2]로만 순차 플립하는 코어 함수
  async function triggerFlip() {
    if (isGlobalFlipping) return;
    isGlobalFlipping = true;

    // 만약 이미 문장2 상태라면, 화면을 애니메이션 없이 조용히 문장1로 먼저 리셋합니다.
    // 이를 통해 언제 버튼을 누르든 무조건 [문장1 ➔ 문장2] 효과가 보장됩니다.
    if (cards.some(c => c.useWineColorBottom === true)) {
      generateCards();
      // 브라우저가 리셋된 상태를 한 프레임 그릴 수 있도록 살짝 대기
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // 앞에서부터 순서대로 한 단어씩 순차 제어
    for (let i = 0; i < cards.length; i++) {
      // 💡 예외처리: 두 문장의 단어가 완벽히 같다면 플립 애니메이션 및 색상 변경을 패스
      if (!cards[i].isDifferent) {
        continue;
      }

      // 개별 카드 회전 애니메이션 가동 (0도 -> 90도 수평 상태로 진입)
      cards[i].flipping = true;

      // 카드가 정확히 90도로 꺾여 글자가 숨겨지는 절묘한 시점(200ms)
      setTimeout(() => {
        // 상하단 텍스트를 문장2(도착점)의 단어로 일제히 교체
        cards[i].displayTextTop = cards[i].word2;
        cards[i].displayTextBottom = cards[i].word2;
        
        // 글자 색상을 동시에 와인색(true)으로 변경하여 상하단 색상 일치 보장
        cards[i].useWineColorTop = true;
        cards[i].useWineColorBottom = true;
      }, 200);

      // 애니메이션 사이클 종료(400ms) 후 회전 상태 해제
      setTimeout(() => {
        cards[i].flipping = false;
      }, 400);

      // 다음 카드로 제어권이 넘어가기 전 도미노 시차 딜레이 (150ms 단위)
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // 모든 시퀀스가 완전히 완료되면 전역 마우스 락 해제
    isGlobalFlipping = false;
  }

  // 입력창 타이핑 시 즉시 데이터 동기화 리셋
  function handleInput() {
    generateCards();
  }

  onMount(() => {
    generateCards();
  });
</script>

<main class="container">
  <!-- 문장 컨트롤러 상단 바 -->
  <div class="input-section">
    <div class="input-group">
      <label for="s1">문장 1 :</label>
      <input id="s1" type="text" bind:value={sentence1} oninput={handleInput} />
    </div>
    <div class="input-group">
      <label for="s2">문장 2 :</label>
      <input id="s2" type="text" bind:value={sentence2} oninput={handleInput} />
    </div>
    <button onclick={triggerFlip} disabled={isGlobalFlipping}>
      {isGlobalFlipping ? 'FLIPPING...' : 'SEQUENCE FLIP'}
    </button>
  </div>

  <hr />

  <!-- 플립 전광판 시계 보드 영역 -->
  <div class="clock-display">
    {#each cards as card (card.id)}
      {#if card.visible}
        <div class="flip-card" style="--char-count: {card.charCount};">
          
          <!-- 상단 반쪽 패널 (애니메이션 3D 회전 기둥) -->
          <div class="card-half top-half {card.flipping ? 'apply-flip' : ''}">
            <span class="text {card.useWineColorTop ? 'wine' : 'black'}">
              {card.displayTextTop}
            </span>
          </div>

          <!-- 하단 반쪽 패널 (수평 고정 기저 바닥) -->
          <div class="card-half bottom-half">
            <span class="text {card.useWineColorBottom ? 'wine' : 'black'}">
              {card.displayTextBottom}
            </span>
          </div>

          <!-- 디자인 디테일: 아날로그 힌지 중앙 절단선 및 좌우 핀 가이드 홈 -->
          <div class="center-line"></div>
          <div class="notch left"></div>
          <div class="notch right"></div>
        </div>
      {/if}
    {/each}
  </div>
</main>

<style>
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    font-family: 'Georgia', serif;
    background-color: #f4f3ef;
    min-height: 100vh;
  }

  .input-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
    width: 100%;
    max-width: 500px;
  }

  .input-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .input-group label {
    width: 60px;
    font-weight: bold;
    color: #444;
  }

  input {
    flex: 1;
    padding: 10px;
    border: 2px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    outline: none;
  }

  button {
    padding: 12px;
    background-color: #800040;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
    font-size: 1.1rem;
  }

  button:disabled {
    background-color: #bbb;
    cursor: not-allowed;
  }

  hr {
    width: 100%;
    max-width: 800px;
    border: 0;
    border-top: 1px solid #ddd;
    margin: 30px 0;
  }

  .clock-display {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    justify-content: center;
    padding: 20px;
  }

  /* 글자 수 기반 반응형 자동 폭 연산식 */
  .flip-card {
    position: relative;
    width: calc((var(--char-count) * 28px) + 40px);
    height: 140px;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
    border-radius: 12px;
    background: #ffffff;
    overflow: visible;
  }

  .card-half {
    position: absolute;
    left: 0;
    width: 100%;
    height: 50%;
    overflow: hidden;
    display: flex;
    justify-content: center;
    background: #ffffff;
    box-sizing: border-box;
  }

  .top-half {
    top: 0;
    align-items: flex-end;
    border-top-left-radius: 12px;
    border-top-right-radius: 12px;
    transform-origin: bottom;
    z-index: 5;
    border-bottom: 1px solid rgba(0, 0, 0, 0.02);
  }

  .bottom-half {
    bottom: 0;
    align-items: flex-start;
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
  }

  .text {
    white-space: nowrap;
    font-size: 3rem;
    letter-spacing: -1px;
    transition: color 0.05s ease-in-out;
  }

  .top-half .text { transform: translateY(50%); }
  .bottom-half .text { transform: translateY(-50%); }

  /* 타이포그래피 정적 테마 컬러 피팅 */
  .text.black {
    color: #1a1a1a;
    font-weight: normal;
  }
  .text.wine {
    color: #800040;
    font-weight: bold;
  }

  /* 안전한 제자리 한 바퀴(0도 -> -90도 -> 0도) 3D 하강 효과 */
  .apply-flip {
    animation: smoothFlipEffect 0.4s ease-in forwards;
  }

  @keyframes smoothFlipEffect {
    0% {
      transform: rotateX(0deg);
      background-color: #ffffff;
    }
    50% {
      transform: rotateX(-90deg);
      background-color: #eee; /* 하강 모션 시 발생하는 입체 쉐도우 음영 구현 */
    }
    100% {
      transform: rotateX(0deg);
      background-color: #ffffff;
    }
  }

  /* 아날로그 인터페이스 장식선 */
  .center-line {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 2px;
    background: rgba(0, 0, 0, 0.06);
    z-index: 10;
  }

  .notch {
    position: absolute;
    top: calc(50% - 6px);
    width: 6px;
    height: 12px;
    background-color: #f4f3ef;
    z-index: 11;
  }
  .notch.left { left: 0; border-radius: 0 6px 6px 0; }
  .notch.right { right: 0; border-radius: 6px 0 0 6px; }
</style>
