import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function generateTTS(params: {
    text: string;
    languageCode?: string;
    voiceName?: string;
    speakingRate?: number;
    filename?: string;
}): Promise<{ url: string; filename: string }> {
    const { text, languageCode = 'ko-KR', voiceName = 'ko-KR-Neural2-A', speakingRate = 1.0 } = params;

    const apiKey = env.GOOGLE_TTS_API_KEY || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Google API Key is not configured on the server');
    }

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            input: { text },
            voice: { languageCode, name: voiceName },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: parseFloat(String(speakingRate)) || 1.0
            }
        })
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('Google Cloud TTS API error:', data);
        const errMsg = data.error?.message || 'Failed to synthesize speech';
        throw new Error(`Google TTS API Error: ${errMsg}`);
    }

    if (!data.audioContent) {
        throw new Error('No audio content received from Google TTS API');
    }

    const ttsDir = env.TTS_DIR || process.env.TTS_DIR;
    const ttsDirFull = path.resolve(process.cwd(), ttsDir ?? 'static/TTS');

    const filename = params.filename ?? `${crypto.randomUUID()}.mp3`;

    if (!fs.existsSync(ttsDirFull)) {
        fs.mkdirSync(ttsDirFull, { recursive: true });
    }

    const filePath = path.join(ttsDirFull, filename);
    const audioBuffer = Buffer.from(data.audioContent, 'base64');
    fs.writeFileSync(filePath, audioBuffer);

    const ttsBaseUrl = process.env.TTS_BASE_URL ?? 'http://localhost:5173/TTS';
    const publicUrl = `${ttsBaseUrl}/${filename}`;

    return { url: publicUrl, filename };
}
