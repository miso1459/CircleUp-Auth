// server.js
import 'dotenv-flow/config';
import fs from 'fs';
import path from 'path';
import http from 'http';

// TTS 파일만 별도 포트로 서빙 (예: 3001)
const ttsServer = http.createServer((req, res) => {
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
    } else {
        res.writeHead(404);
        res.end();
    }
});

ttsServer.listen(3001, '0.0.0.0', () => {
    console.log('TTS server on http://0.0.0.0:3001');
});

// SvelteKit 서버는 그대로 실행 (3000 포트)
await import('./build/index.js');