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
 * 로컬 MP3 파일을 R2에 업로드 (이미 있으면 건너뜀)
 * @returns 업로드된 파일의 공개 URL 또는 null (건너뛴 경우)
 */
export async function uploadMp3ToR2(sentenceId: number): Promise<{ uploaded: boolean; url?: string; skipped: boolean }> {
	const config = getR2Config();
	const ttsDir = env.TTS_DIR || process.env.TTS_DIR || 'static/TTS';
	const ttsDirFull = path.resolve(process.cwd(), ttsDir);
	const filePath = path.join(ttsDirFull, `${sentenceId}.mp3`);

	if (!fs.existsSync(filePath)) {
		return { uploaded: false, skipped: true };
	}

	const key = config.folder ? `${config.folder}/${sentenceId}.mp3` : `${sentenceId}.mp3`;

	// 이미 존재하면 건너뛰기
	if (await fileExists(key)) {
		return { uploaded: false, skipped: true };
	}

	try {
		const client = getS3Client();
		const fileContent = fs.readFileSync(filePath);

		await client.send(new PutObjectCommand({
			Bucket: config.bucket,
			Key: key,
			Body: fileContent,
			ContentType: 'audio/mpeg'
		}));

		// 공개 URL 구성
		const publicUrl = `${config.endpoint.replace(/\/?$/, '')}/${config.bucket}/${key}`;
		return { uploaded: true, url: publicUrl, skipped: false };
	} catch (err) {
		console.error(`R2 upload failed for sentence ${sentenceId}:`, err);
		throw err;
	}
}
