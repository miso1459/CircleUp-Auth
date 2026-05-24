// server.js
import 'dotenv-flow/config';
import fs from 'fs';
import path from 'path';
import http from 'http';

// 파일 서빙 전용 서버 (포트: 3001)
const assetServer = http.createServer((req, res) => {
    // 1. TTS 오디오 파일 서빙 (.mp3)
    if (req.url.startsWith('/TTS_files/')) {
        const filePath = path.resolve('static', req.url.slice(1));
        if (fs.existsSync(filePath)) {
            res.writeHead(200, { 
                'Content-Type': 'audio/mpeg',
                'Access-Control-Allow-Origin': '*'
            });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    } 
    // 2. IMG 이미지 파일 서빙 (.jpeg)
    else if (req.url.startsWith('/IMG_files/')) {
        const filePath = path.resolve('static', req.url.slice(1));
        if (fs.existsSync(filePath)) {
            res.writeHead(200, { 
                'Content-Type': 'image/jpeg',
                'Access-Control-Allow-Origin': '*'
            });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    } 
    // 그 외 경로
    else {
        res.writeHead(404);
        res.end();
    }
});

assetServer.listen(3001, '0.0.0.0', () => {
    console.log('Asset server running on http://0.0.0.0:3001');
});

// SvelteKit 서버 실행 (3000 포트)
await import('./build/index.js');
