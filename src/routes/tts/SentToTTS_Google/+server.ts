import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (locals.user?.role !== 'admin') {
        throw error(403, 'Unauthorized: Admin access required');
    }

    let body;
    try {
        body = await request.json();
    } catch {
        throw error(400, 'Invalid JSON body');
    }

    const { text, languageCode = 'ko-KR', voiceName = 'ko-KR-Neural2-A', speakingRate = 1.0 } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
        throw error(400, 'Text parameter is required');
    }

    const apiKey = env.GOOGLE_TTS_API_KEY || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw error(500, 'Google API Key is not configured on the server');
    }

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text },
                voice: { languageCode, name: voiceName },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: parseFloat(speakingRate) || 1.0
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Google Cloud TTS API error:', data);
            const errMsg = data.error?.message || 'Failed to synthesize speech';
            throw error(response.status, `Google TTS API Error: ${errMsg}`);
        }

        if (!data.audioContent) {
            throw error(500, 'No audio content received from Google TTS API');
        }

        const ttsDir = env.TTS_DIR || process.env.TTS_DIR;
        const ttsDirFull = path.resolve(process.cwd(), ttsDir ?? 'static/TTS');

        const guid = crypto.randomUUID();
        const filename = `${guid}.mp3`;

        if (!fs.existsSync(ttsDirFull)) {
            fs.mkdirSync(ttsDirFull, { recursive: true });
        }

        const filePath = path.join(ttsDirFull, filename);
        const audioBuffer = Buffer.from(data.audioContent, 'base64');
        fs.writeFileSync(filePath, audioBuffer);

        const ttsBaseUrl = process.env.TTS_BASE_URL ?? 'http://localhost:5173';
        const publicUrl = `${ttsBaseUrl}/TTS/${filename}`;

        return json({
            success: true,
            url: publicUrl,
            filename,
            guid
        });

    } catch (err: unknown) {
        console.error('Error during TTS generation:', err);
        if (typeof err === 'object' && err !== null && 'status' in err) {
            throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        throw error(500, `Internal Server Error: ${message}`);
    }
};
