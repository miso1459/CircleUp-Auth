<script lang="ts">
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  let inputSentence = $state('I am feeling down today, but let\'s hold onto hope for tomorrow.');
  let prompt = $state('Rewrite this sentence to be more positive and uplifting.');
  let selectedLanguage = $state('en-US');
  let selectedVoice = $state('en-US-Neural2-F');
  let searchQuery = $state(data.searchQuery);
  let sentences: Array<{ id: number; lang: string; sent: string; tag: string | null; file_tts: string | null; file_image: string | null; voice: string | null; createdAt: Date }> = $state(data.sentences);
  let isGenerating = $state(false);
  let errorMsg = $state('');
  let audioUrl = $state('');
  let audioPlayer = $state<HTMLAudioElement | null>(null);

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

  // SentToTTS_Google과 동일한 패턴: setTimeout + load() + play()
  async function handleGenerate() {
    if (!inputSentence.trim()) {
      errorMsg = "문장을 입력해주세요.";
      return;
    }
    isGenerating = true;
    errorMsg = '';

    try {
      const res = await fetch('/gen/gen_1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence: inputSentence,
          prompt: prompt,
          languageCode: selectedLanguage,
          voiceName: selectedVoice
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || '생성 요청이 실패했습니다.');
      }

      const result = await res.json();

      // +server.ts → return json({ success, inserted }) → 직접 JSON
      console.log('[gen_1] response:', result);

      const inserted = result?.inserted;

      if (inserted && inserted.length > 0) {
        const first = inserted[0];
        const audioSrc = first.url || `${data.ttsBaseUrl}/TTS/${first.file_tts}`;

        // 오디오 재생 (SentToTTS_Google 패턴)
        audioUrl = audioSrc;
        setTimeout(() => {
          if (audioPlayer) {
            audioPlayer.load();
            audioPlayer.play().catch((e: Error) => console.warn('autoplay:', e));
          }
        }, 50);

        // 테이블 업데이트
        const newItems = inserted.map((item: any, idx: number) => ({
          id: -(idx + 1),
          lang: item.lang,
          sent: item.sent,
          tag: null as string | null,
          voice: item.voice,
          file_tts: item.file_tts,
          file_image: null as string | null,
          createdAt: new Date()
        }));
        sentences = [...newItems, ...sentences];
      } else {
        console.warn('[gen_1] no inserted in response, reloading...', result);
        window.location.href = '/gen/gen_1';
      }
    } catch (e: any) {
      console.error('[gen_1] generate error:', e);
      errorMsg = e.message;
    } finally {
      isGenerating = false;
    }
  }

  async function handleSearch() {
    const params = searchQuery.trim() ? `?search=${encodeURIComponent(searchQuery)}` : '';
    window.location.href = `/gen/gen_1${params}`;
  }

  async function handleDelete(id: number) {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      const res = await fetch('/gen/gen_1?/delete', { method: 'POST', headers: { accept: 'application/json' }, body: new URLSearchParams({ id: String(id) }) });
      const result = await res.json();
      if (result.type === 'error') throw new Error(result.data?.message || '삭제 오류');
      sentences = sentences.filter(s => s.id !== id);
    } catch (e: any) {
      console.error('delete error:', e);
      errorMsg = e.message;
    }
  }

  function playAudio(filename: string | null) {
    if (!filename) return;
    const fullUrl = `${data.ttsBaseUrl}/TTS/${filename}`;
    audioUrl = fullUrl;
    setTimeout(() => {
      if (audioPlayer) {
        audioPlayer.load();
        audioPlayer.play().catch((e: Error) => console.warn('playAudio:', e));
      }
    }, 50);
  }
</script>

<div class="container">
  <h1>LLM → TTS → Storage</h1>

  <div class="layout">
    <section class="card">
      <h2>문장 생성</h2>
      <div class="form">
        <label>
          입력 문장
          <textarea bind:value={inputSentence} rows={3}></textarea>
        </label>
        <label>
          프롬프트
          <textarea bind:value={prompt} rows={3}></textarea>
        </label>
        <div class="row">
          <label>
            언어
            <select bind:value={selectedLanguage}>
              <option value="en-US">English (US)</option>
              <option value="ko-KR">한국어</option>
            </select>
          </label>
          <label>
            음성 모델
            <select bind:value={selectedVoice}>
              {#each filteredVoices as v (v.name)}
                <option value={v.name}>{v.label}</option>
              {/each}
            </select>
          </label>
        </div>
        <div class="voice-info">
          음성 모델: <strong>{selectedVoice}</strong>
        </div>
        <button onclick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? '생성 중...' : 'LLM 생성 + TTS 저장'}
        </button>
        {#if errorMsg}
          <p class="error">{errorMsg}</p>
        {/if}
      </div>
    </section>

    <section class="card">
      <h2>저장된 문장</h2>
      <div class="search-bar">
        <input bind:value={searchQuery} placeholder="문장 검색..." onkeydown={(e) => e.key === 'Enter' && handleSearch()} />
        <button onclick={handleSearch}>검색</button>
        <button class="clear-btn" onclick={() => { searchQuery = ''; handleSearch(); }}>지우기</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Lang</th>
            <th>Voice</th>
            <th>문장</th>
            <th>Created At</th>
            <th>재생</th>
            <th>삭제</th>
          </tr>
        </thead>
        <tbody>
          {#each sentences as s (s.id)}
            <tr>
              <td>{s.id}</td>
              <td>{s.lang}</td>
            <td class="voice-cell">{s.voice}</td>
            <td>{s.sent}</td>
            <td class="date">{new Date(s.createdAt).toLocaleString()}</td>
            <td>
                <button onclick={() => playAudio(s.file_tts)} disabled={!s.file_tts}>
                  ▶
                </button>
              </td>
              <td>
                <button class="delete" onclick={() => handleDelete(s.id)}>✕</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

      {#if audioUrl}
        <div class="player">
          <audio controls bind:this={audioPlayer} src={audioUrl}></audio>
        </div>
      {/if}
    </section>
  </div>
</div>

<style>
  .container {
    max-width: 1920px;
    margin: 0 auto;
    padding: 16px;
    font-family: system-ui, sans-serif;
  }
  h1 { font-size: 1.4rem; margin-bottom: 20px; }
  .layout {
    display: grid;
    grid-template-columns: 40% 60%;
    gap: 12px;
    align-items: start;
  }
  .card {
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 14px;
  }
  .card h2 { font-size: 1.1rem; margin: 0 0 16px; }
  .form { display: flex; flex-direction: column; gap: 12px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #555; }
  textarea, select, input {
    padding: 8px 10px; font-size: 14px; border: 1px solid #ccc; border-radius: 6px; font-family: inherit;
  }
  .row { display: flex; gap: 12px; }
  .row label { flex: 1; }
  button {
    padding: 8px 18px; font-size: 14px; border: 1px solid #888;
    border-radius: 6px; background: #222; color: #fff; cursor: pointer;
  }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  button:hover:not(:disabled) { background: #444; }
  button.delete { background: #922; padding: 4px 10px; }
  button.delete:hover { background: #b33; }
  button.clear-btn { background: #555; padding: 8px 14px; }
  button.clear-btn:hover { background: #777; }
  .error { color: #c33; font-size: 13px; margin: 0; }
  .search-bar { display: flex; gap: 8px; margin-bottom: 12px; }
  .search-bar input { flex: 1; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #eee; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  .date { white-space: nowrap; font-size: 12px; }
  .voice-cell { font-size: 12px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .voice-info { font-size: 13px; color: #555; text-align: center; }
  .player { margin-top: 12px; }
</style>
