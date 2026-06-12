import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ts = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
};
const log = (...args: any[]) => console.log(`[${ts()}]`, ...args);
const warn = (...args: any[]) => console.warn(`[${ts()}]`, ...args);
const err = (...args: any[]) => console.error(`[${ts()}]`, ...args);

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
            err('[SentToTTS_Google] Google Cloud TTS API error:', data);
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

        const ttsBaseUrl = process.env.TTS_BASE_URL ?? 'http://localhost:5173/TTS';
        const publicUrl = `${ttsBaseUrl}/${filename}`;

        log('[SentToTTS_Google] TTS generation completed:', publicUrl);

        return json({
            success: true,
            url: publicUrl,
            filename,
            guid
        });

    } catch (e: unknown) {
        err('[SentToTTS_Google] TTS generation error:', e);
        if (typeof e === 'object' && e !== null && 'status' in e) {
            throw e;
        }
        const message = e instanceof Error ? e.message : String(e);
        throw error(500, `Internal Server Error: ${message}`);
    }
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
    if (locals.user?.role !== 'admin') {
        throw error(403, 'Unauthorized: Admin access required');
    }

    let body: { filenames?: string[] };
    try {
        body = await request.json();
    } catch {
        throw error(400, 'Invalid JSON body');
    }

    const filenames = body.filenames;
    if (!Array.isArray(filenames) || filenames.length === 0) {
        throw error(400, 'filenames array is required');
    }

    const ttsDir = env.TTS_DIR || process.env.TTS_DIR;
    const ttsDirFull = path.resolve(process.cwd(), ttsDir ?? 'static/TTS');

    const results: { filename: string; deleted: boolean; error?: string }[] = [];

    for (const filename of filenames) {
        const filePath = path.join(ttsDirFull, filename);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                results.push({ filename, deleted: true });
                log('[SentToTTS_Google] Deleted MP3 file:', filename);
            } else {
                results.push({ filename, deleted: false, error: 'File not found' });
                warn('[SentToTTS_Google] MP3 file not found:', filename);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            results.push({ filename, deleted: false, error: msg });
            err('[SentToTTS_Google] Failed to delete MP3 file:', filename, msg);
        }
    }

    return json({ success: true, results });
};
