<!-- src/routes/tts/SentToTTS_Google/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { resolve } from '$app/navigation';
  import type { Pathname } from '$app/types';
  import { 
    Play, 
    Pause, 
    Square, 
    Download, 
    Trash2, 
    Sparkles, 
    AlertCircle, 
    History, 
    Volume2, 
    Clock, 
    Mic, 
    FileText,
    ChevronRight,
    VolumeX
  } from 'lucide-svelte';

  // 폼 상태
  let text = $state("I am feeling down today, but let's hold onto hope for tomorrow.");
  let selectedLanguage = $state("en-US");
  let selectedVoice = $state("en-US-Neural2-F");
  let rate = $state(1.0);

  // 로딩 및 에러 상태
  let isGenerating = $state(false);
  let errorMsg = $state("");
  let successMsg = $state("");

  // 오디오 플레이어 상태
  let audioUrl = $state("");
  let audioPlayer = $state<HTMLAudioElement | null>(null);
  let isPlaying = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);
  let volume = $state(1.0);
  let isMuted = $state(false);

  // 히스토리 상태
  let history = $state<{
    id: string;
    text: string;
    voiceName: string;
    languageCode: string;
    rate: number;
    url: string;
    date: string;
  }[]>([]);

  // 구글 TTS 지원 목소리 프리셋
  const voices = [
    { code: 'ko-KR', name: 'ko-KR-Neural2-A', label: '한국어 여성 A (Neural2 - 부드러움)', gender: '여성' },
    { code: 'ko-KR', name: 'ko-KR-Neural2-B', label: '한국어 여성 B (Neural2 - 차분함)', gender: '여성' },
    { code: 'ko-KR', name: 'ko-KR-Neural2-C', label: '한국어 남성 (Neural2 - 신뢰감)', gender: '남성' },
    { code: 'ko-KR', name: 'ko-KR-Standard-A', label: '한국어 여성 A (Standard)', gender: '여성' },
    { code: 'ko-KR', name: 'ko-KR-Standard-B', label: '한국어 남성 A (Standard)', gender: '남성' },
    { code: 'ko-KR', name: 'ko-KR-Standard-C', label: '한국어 여성 B (Standard)', gender: '여성' },
    { code: 'ko-KR', name: 'ko-KR-Standard-D', label: '한국어 남성 B (Standard)', gender: '남성' },
    { code: 'en-US', name: 'en-US-Journey-F', label: '영어 여성 (Journey - 초고품질 내레이션)', gender: '여성' },
    { code: 'en-US', name: 'en-US-Journey-O', label: '영어 남성 (Journey - 초고품질 내레이션)', gender: '남성' },
    { code: 'en-US', name: 'en-US-Neural2-F', label: '영어 여성 (Neural2)', gender: '여성' },
    { code: 'en-US', name: 'en-US-Neural2-O', label: '영어 남성 (Neural2)', gender: '남성' },
    { code: 'en-US', name: 'en-US-Standard-A', label: '영어 여성 (Standard)', gender: '여성' }
  ];

  // 선택한 언어에 따른 목소리 필터링
  let filteredVoices = $derived(voices.filter(v => v.code === selectedLanguage));

  // 언어 변경 시 자동으로 첫 번째 목소리 선택
  $effect(() => {
    const available = filteredVoices;
    if (available.length > 0 && !available.some(v => v.name === selectedVoice)) {
      selectedVoice = available[0].name;
    }
  });

  onMount(() => {
    // 로컬 스토리지에서 최근 사용 내역 로드
    const saved = localStorage.getItem('tts_history_google');
    if (saved) {
      try {
        history = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse TTS history', e);
      }
    }
  });

  // 오디오 스트리밍 생성 요청
  async function generateSpeech() {
    if (!text.trim()) {
      errorMsg = "변환할 텍스트를 입력해주세요.";
      return;
    }

    errorMsg = "";
    successMsg = "";
    isGenerating = true;

    try {
      const response = await fetch('/tts/SentToTTS_Google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text.trim(),
          languageCode: selectedLanguage,
          voiceName: selectedVoice,
          speakingRate: rate
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || '음성 합성 요청이 실패했습니다.');
      }

      const data = await response.json();
      audioUrl = data.url;
      successMsg = "음성이 성공적으로 생성되었습니다!";

      // 히스토리 항목 추가
      const newHistoryItem = {
        id: data.guid || Math.random().toString(36).substring(2, 11),
        text: text.trim(),
        voiceName: selectedVoice,
        languageCode: selectedLanguage,
        rate: rate,
        url: data.url,
        date: new Date().toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      };

      history = [newHistoryItem, ...history.slice(0, 19)]; // 최근 20개만 유지
      localStorage.setItem('tts_history_google', JSON.stringify(history));

      // 오디오 로드 및 자동 재생 실행
      setTimeout(() => {
        if (audioPlayer) {
          audioPlayer.load();
          audioPlayer.play().catch(e => console.warn("Auto-play prevented by browser policy", e));
        }
      }, 50);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errorMsg = message || "음성 생성 과정에서 오류가 발생했습니다.";
    } finally {
      isGenerating = false;
    }
  }

  // 플레이어 제어기 함수들
  function togglePlay() {
    if (!audioPlayer || !audioUrl) return;
    if (isPlaying) {
      audioPlayer.pause();
    } else {
      audioPlayer.play().catch(e => console.error(e));
    }
  }

  function stopAudio() {
    if (!audioPlayer) return;
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    isPlaying = false;
  }

  function handleProgressChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const newTime = parseFloat(target.value);
    if (audioPlayer) {
      audioPlayer.currentTime = newTime;
      currentTime = newTime;
    }
  }

  function handleVolumeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const newVol = parseFloat(target.value);
    volume = newVol;
    if (audioPlayer) {
      audioPlayer.volume = newVol;
    }
    isMuted = newVol === 0;
  }

  function toggleMute() {
    isMuted = !isMuted;
    if (audioPlayer) {
      audioPlayer.muted = isMuted;
    }
  }

  // 시간 포맷팅 헬퍼 (예: 74 -> "01:14")
  function formatTime(secs: number) {
    if (isNaN(secs) || !isFinite(secs)) return "00:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // 과거 히스토리 재생 로드
  function loadFromHistory(item: { text: string; languageCode: string; voiceName: string; rate: number; url: string }) {
    text = item.text;
    selectedLanguage = item.languageCode;
    selectedVoice = item.voiceName;
    rate = item.rate;
    audioUrl = item.url;
    
    successMsg = "히스토리에서 오디오를 로드했습니다.";
    errorMsg = "";

    setTimeout(() => {
      if (audioPlayer) {
        audioPlayer.load();
        audioPlayer.play().catch(e => console.warn(e));
      }
    }, 50);
  }

  // 히스토리 항목 삭제
  function deleteHistoryItem(id: string, event: Event) {
    event.stopPropagation();
    history = history.filter(item => item.id !== id);
    localStorage.setItem('tts_history_google', JSON.stringify(history));
  }

  // 히스토리 전체 삭제
  function clearAllHistory() {
    if (confirm("모든 생성 내역을 삭제하시겠습니까?")) {
      history = [];
      localStorage.removeItem('tts_history_google');
    }
  }
</script>

<!-- 오디오 태그 바인딩 -->
{#if audioUrl}
  <audio
    bind:this={audioPlayer}
    src={audioUrl}
    onplay={() => isPlaying = true}
    onpause={() => isPlaying = false}
    onended={() => isPlaying = false}
    ontimeupdate={() => { if (audioPlayer) currentTime = audioPlayer.currentTime; }}
    onloadedmetadata={() => { if (audioPlayer) duration = audioPlayer.duration; }}
  ></audio>
{/if}

<main class="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">
  <div class="max-w-4xl mx-auto space-y-8">
    
    <!-- 헤더 영역 -->
    <header class="text-center space-y-4">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-950/20 text-violet-400 text-xs font-semibold tracking-wider uppercase backdrop-blur-md">
        <Sparkles class="w-3.5 h-3.5 animate-pulse text-violet-400" />
        Google Cloud Service
      </div>
      <h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight bg-linear-to-r from-violet-400 via-indigo-200 to-cyan-400 bg-clip-text text-transparent">
        AI Text to Speech Studio
      </h1>
      <p class="text-slate-400 max-w-lg mx-auto text-sm sm:text-base">
        구글의 독자적인 신경망 기술을 사용하여 실제 사람처럼 자연스럽고 또렷한 고품질 목소리를 생성합니다.
      </p>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      
      <!-- 설정 및 입력 메인 영역 -->
      <section class="lg:col-span-2 space-y-6">
        <div class="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-xl space-y-6">
          
          <!-- 텍스트 입력창 -->
          <div class="space-y-2">
            <label for="tts-text" class="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <FileText class="w-4 h-4 text-violet-400" />
              재생 및 변환할 문장
            </label>
            <textarea
              id="tts-text"
              bind:value={text}
              placeholder="음성으로 변환할 한국어 또는 영어 문장을 입력하세요..."
              rows="5"
              class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all resize-none text-base leading-relaxed"
            ></textarea>
          </div>

          <!-- 음성 제어 설정 카드 -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <!-- 언어 선택 -->
            <div class="space-y-2">
              <label for="language-select" class="text-xs font-bold uppercase tracking-wider text-slate-400 block">언어 (Language)</label>
              <select
                id="language-select"
                bind:value={selectedLanguage}
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all cursor-pointer"
              >
                <option value="ko-KR">한국어 (Korean)</option>
                <option value="en-US">영어 (English - US)</option>
              </select>
            </div>

            <!-- 목소리 모델 선택 -->
            <div class="space-y-2">
              <label for="voice-select" class="text-xs font-bold uppercase tracking-wider text-slate-400 block">음성 모델 (Voice Model)</label>
              <select
                id="voice-select"
                bind:value={selectedVoice}
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all cursor-pointer"
              >
                {#each filteredVoices as voice (voice.name)}
                  <option value={voice.name}>{voice.label}</option>
                {/each}
              </select>
            </div>
          </div>

           <!-- 선택된 코드 값 표시 -->
           <div class="space-y-2 pt-2">
             <div class="flex justify-between items-center">
               <label for="code-display" class="text-xs font-bold uppercase tracking-wider text-slate-400">선택된 코드 값</label>
               <div class="text-xs font-bold px-2 py-0.5 bg-slate-800 text-violet-400 rounded-md border border-slate-700">
                 언어: {selectedLanguage} | 음성: {selectedVoice}
               </div>
             </div>
           </div>

           <!-- 속도 슬라이더 -->
           <div class="space-y-2 pt-2">
             <div class="flex justify-between items-center">
               <label for="rate-slider" class="text-xs font-bold uppercase tracking-wider text-slate-400">말하기 속도</label>
               <span class="text-xs font-bold px-2 py-0.5 bg-slate-800 text-violet-400 rounded-md border border-slate-700">{rate.toFixed(2)}배속</span>
             </div>
             <div class="flex items-center gap-4">
               <span class="text-xs text-slate-600">0.5×</span>
               <input
                 id="rate-slider"
                 type="range"
                 min="0.5"
                 max="2.0"
                 step="0.05"
                 bind:value={rate}
                 class="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-violet-500 focus:outline-none"
               />
               <span class="text-xs text-slate-600">2.0×</span>
             </div>
           </div>

          <!-- 에러 및 성공 피드백 -->
          {#if errorMsg}
            <div transition:slide class="flex items-start gap-3 p-3.5 bg-red-950/30 border border-red-500/20 text-red-300 rounded-xl text-sm">
              <AlertCircle class="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          {/if}

          {#if successMsg}
            <div transition:slide class="flex items-start gap-3 p-3.5 bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 rounded-xl text-sm">
              <Sparkles class="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          {/if}

          <!-- 변환 버튼 -->
          <button
            onclick={generateSpeech}
            disabled={isGenerating}
            class="w-full py-4.5 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-violet-950/30
              {isGenerating 
                ? 'bg-violet-950/40 text-violet-400 border border-violet-800/40 cursor-not-allowed' 
                : 'bg-linear-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] border border-violet-500/30 hover:shadow-violet-500/20'}"
          >
            {#if isGenerating}
              <div class="w-5 h-5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin"></div>
              음성 합성 중...
            {:else}
              <Mic class="w-5 h-5" />
              AI 음성 생성 및 로드
            {/if}
          </button>

        </div>

        <!-- 커스텀 플레이어 영역 (오디오 주소가 있을 때만 렌더링) -->
        {#if audioUrl}
          <div transition:slide={{ duration: 300 }} class="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-xl space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Volume2 class="w-4 h-4 text-cyan-400 animate-pulse" />
              TTS 오디오 플레이어
            </h3>

            <!-- 진행 상황 슬라이더 및 시간 -->
            <div class="space-y-1">
              <div class="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.05"
                  value={currentTime}
                  oninput={handleProgressChange}
                  class="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                />
              </div>
              <div class="flex justify-between text-xs text-slate-500 font-medium px-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <!-- 플레이어 컨트롤 컨트롤 그룹 -->
            <div class="flex flex-wrap items-center justify-between gap-4 pt-1">
              
              <!-- 기본 버튼 세트 -->
              <div class="flex items-center gap-2">
                <button
                  onclick={togglePlay}
                  class="w-12 h-12 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center hover:bg-cyan-400 active:scale-95 transition-all shadow-md shadow-cyan-500/10 cursor-pointer"
                  title={isPlaying ? "일시정지" : "재생"}
                >
                  {#if isPlaying}
                    <Pause class="w-5 h-5 fill-slate-950" />
                  {:else}
                    <Play class="w-5 h-5 fill-slate-950 ml-0.5" />
                  {/if}
                </button>
                <button
                  onclick={stopAudio}
                  class="w-10 h-10 rounded-full border border-slate-800 bg-slate-950/60 text-slate-300 flex items-center justify-center hover:bg-slate-900 hover:text-white active:scale-95 transition-all cursor-pointer"
                  title="정지"
                >
                  <Square class="w-4 h-4 fill-current" />
                </button>
              </div>

              <!-- 볼륨 바 및 음소거 -->
              <div class="flex items-center gap-2 bg-slate-950/40 px-3.5 py-1.5 rounded-full border border-slate-800/60">
                <button 
                  onclick={toggleMute} 
                  class="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  title={isMuted ? "음소거 해제" : "음소거"}
                >
                  {#if isMuted || volume === 0}
                    <VolumeX class="w-4 h-4" />
                  {:else}
                    <Volume2 class="w-4 h-4" />
                  {/if}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  oninput={handleVolumeChange}
                  class="w-16 sm:w-20 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                />
              </div>

              <!-- 다운로드 버튼 -->
              <a
                href={resolve(audioUrl as Pathname)}
                download={`google-tts-${new Date().getTime()}.mp3`}
                class="inline-flex items-center gap-2 px-4 py-2 border border-slate-800 bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-cyan-400 rounded-xl text-sm font-semibold transition-all cursor-pointer active:scale-95"
              >
                <Download class="w-4 h-4" />
                다운로드
              </a>

            </div>

          </div>
        {/if}

      </section>

      <!-- 생성 히스토리 세션 -->
      <aside class="space-y-6">
        <div class="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-xl space-y-4">
          
          <div class="flex justify-between items-center border-b border-slate-850 pb-3">
            <h2 class="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <History class="w-4 h-4 text-violet-400" />
              최근 생성 내역
            </h2>
            {#if history.length > 0}
              <button
                onclick={clearAllHistory}
                class="text-xs text-red-400 hover:text-red-300 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 class="w-3 h-3" />
                전체 삭제
              </button>
            {/if}
          </div>

          {#if history.length === 0}
            <div class="text-center py-10 px-4 border-2 border-dashed border-slate-800 rounded-xl text-slate-600 space-y-2">
              <Clock class="w-8 h-8 mx-auto stroke-1" />
              <p class="text-xs font-semibold">최근 변환한 음성 파일이 없습니다.</p>
            </div>
          {:else}
            <div class="space-y-3 max-h-115 overflow-y-auto pr-1 custom-scrollbar">
              {#each history as item (item.id)}
                <div
                  class="group relative bg-slate-950/80 hover:bg-slate-900/80 border border-slate-800/80 hover:border-violet-500/30 rounded-xl p-3.5 transition-all duration-200 block"
                >
                  <button
                    type="button"
                    onclick={() => loadFromHistory(item)}
                    class="w-full text-left focus:outline-none cursor-pointer"
                  >
                    <!-- 오버레이 효과 -->
                    <div class="absolute inset-y-0 right-3 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight class="w-4 h-4 text-violet-400" />
                    </div>
                    
                    <div class="space-y-1.5 pr-5">
                      <!-- 텍스트 스니펫 -->
                      <p class="text-xs text-slate-300 font-medium line-clamp-2 leading-relaxed">
                        {item.text}
                      </p>
                      
                      <!-- 메타 정보 -->
                      <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-500 font-semibold">
                        <span class="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-850">
                          {item.voiceName.split('-').slice(-2).join('-')}
                        </span>
                        <span>{item.rate}x 속도</span>
                        <span class="text-slate-600">•</span>
                        <span>{item.date}</span>
                      </div>
                    </div>
                  </button>

                  <!-- 개별 삭제 버튼 -->
                  <button
                    type="button"
                    onclick={(e) => deleteHistoryItem(item.id, e)}
                    class="absolute top-2.5 right-2.5 p-1 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-950/20 opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10"
                    title="삭제"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              {/each}
            </div>
          {/if}

        </div>
      </aside>

    </div>

  </div>
</main>

<style>
  /* 커스텀 스크롤바 디자인 */
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #1e293b;
    border-radius: 9999px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #334155;
  }
</style>