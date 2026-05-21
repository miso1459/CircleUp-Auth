import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'fs';
import path from 'path';

export const GET: RequestHandler = async ({ params }) => {
    const { filename } = params;

    // 파일 이름 검증 (경로 트래버설 방지)
    if (!filename || !/^[a-zA-Z0-9\-_]+\.[a-zA-Z0-9]+$/.test(filename)) {
        throw error(400, 'Invalid filename');
    }

    const filePath = path.join(path.resolve('static/TTS'), filename);

    // 파일 존재 여부 확인
    if (!fs.existsSync(filePath)) {
        throw error(404, 'File not found');
    }

    try {
        const fileBuffer = fs.readFileSync(filePath);
        return new Response(fileBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': fileBuffer.length.toString(),
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });
    } catch (err) {
        console.error('Error serving TTS file:', err);
        throw error(500, 'Internal Server Error');
    }
};
