import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';

function getR2Config() {
	const endpoint = env.CLOUDFLARE_R2_ENDPOINT;
	const accessKeyId = env.CLOUDFLARE_R2_ACCESS_KEY_ID;
	const secretAccessKey = env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
	const bucket = env.CLOUDFLARE_R2_BUCKET;
	const folder = env.CLOUDFLARE_R2_FOLDER || '';

	if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
		throw new Error('CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET must be set');
	}

	return { endpoint, accessKeyId, secretAccessKey, bucket, folder };
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
	if (!s3Client) {
		const config = getR2Config();
		s3Client = new S3Client({
			region: 'auto',
			endpoint: config.endpoint,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey
			}
		});
	}
	return s3Client;
}

/**
 * R2에 파일이 존재하는지 확인
 */
export async function fileExists(key: string): Promise<boolean> {
	try {
		const config = getR2Config();
		const client = getS3Client();
		await client.send(new HeadObjectCommand({
			Bucket: config.bucket,
			Key: key
		}));
		return true;
	} catch {
		return false;
	}
}

/**
 * TTS_files 디렉토리의 모든 파일을 재귀적으로 R2에 업로드
 * 서브디렉토리 구조를 그대로 R2 키로 사용
 * 이미 존재하는 파일은 건너뜀
 */
export async function uploadAllFilesToR2(): Promise<{
	uploaded: { filePath: string; key: string }[];
	skipped: { filePath: string; key: string }[];
	errors: { filePath: string; error: string }[];
}> {
	const config = getR2Config();
	const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
	const ttsDirFull = path.resolve(process.cwd(), ttsDir);

	// 모든 파일 재귀 수집
	function collectAllFiles(dir: string): { filePath: string; relativePath: string }[] {
		const results: { filePath: string; relativePath: string }[] = [];
		try {
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					results.push(...collectAllFiles(fullPath));
				} else if (entry.isFile()) {
					const relativePath = path.relative(ttsDirFull, fullPath).replace(/\\/g, '/');
					results.push({ filePath: fullPath, relativePath });
				}
			}
		} catch (err) {
			console.error('Error reading directory:', dir, err);
		}
		return results;
	}

	const allFiles = collectAllFiles(ttsDirFull);

	const uploaded: { filePath: string; key: string }[] = [];
	const skipped: { filePath: string; key: string }[] = [];
	const errors: { filePath: string; error: string }[] = [];

	const client = getS3Client();

	for (const file of allFiles) {
		const key = config.folder ? `${config.folder}/${file.relativePath}` : file.relativePath;

		try {
			if (await fileExists(key)) {
				skipped.push({ filePath: file.filePath, key });
				continue;
			}

			const fileContent = fs.readFileSync(file.filePath);
			await client.send(new PutObjectCommand({
				Bucket: config.bucket,
				Key: key,
				Body: fileContent,
				ContentType: getContentType(file.filePath)
			}));

			uploaded.push({ filePath: file.filePath, key });
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			errors.push({ filePath: file.filePath, error: message });
		}
	}

	return { uploaded, skipped, errors };
}

function getContentType(filePath: string): string {
	if (filePath.endsWith('.mp3')) return 'audio/mpeg';
	if (filePath.endsWith('.wav')) return 'audio/wav';
	if (filePath.endsWith('.ogg')) return 'audio/ogg';
	if (filePath.endsWith('.json')) return 'application/json';
	return 'application/octet-stream';
}


