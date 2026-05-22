import type { PageLoad } from './$types';

export interface Voice {
    code: string;
    name: string;
    label: string;
    gender: string;
}

export interface Language {
    code: string;
    label: string;
}

export const load: PageLoad = async () => {
    const voices: Voice[] = [
        { code: 'ko-KR', name: 'ko-KR-Chirp3-HD-Achernar', label: '한국어 여성 (Chirp3 - 오디오북 스타일)', gender: '여성' },
        { code: 'ko-KR', name: 'ko-KR-Chirp3-HD-Achird', label: '한국어 남성 (Chirp3 - 신뢰감 있는 톤)', gender: '남성' },
        { code: 'ko-KR', name: 'ko-KR-Neural2-A', label: '한국어 여성 A (Neural2 - 차분한 나레이션)', gender: '여성' },
        { code: 'ko-KR', name: 'ko-KR-Neural2-B', label: '한국어 여성 B (Neural2 - 밝고 경쾌함)', gender: '여성' },
        { code: 'ko-KR', name: 'ko-KR-Neural2-C', label: '한국어 남성 C (Neural2 - 깔끔한 비즈니스)', gender: '남성' },
        { code: 'ko-KR', name: 'ko-KR-Wavenet-A', label: '한국어 여성 A (WaveNet - 부드러움)', gender: '여성' },
        { code: 'ko-KR', name: 'ko-KR-Wavenet-B', label: '한국어 여성 B (WaveNet - 맑은 톤)', gender: '여성' },
        { code: 'ko-KR', name: 'ko-KR-Wavenet-C', label: '한국어 남성 C (WaveNet - 안정적인 톤)', gender: '남성' },
        { code: 'ko-KR', name: 'ko-KR-Wavenet-D', label: '한국어 남성 D (WaveNet - 묵직한 중저음)', gender: '남성' },
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

    const languages: Language[] = [
        { code: 'ko-KR', label: '한국어 (Korean)' },
        { code: 'en-US', label: '영어 (English - US)' }
    ];

    return { voices, languages };
};
