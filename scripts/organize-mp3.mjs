/**
 * organizeMp3 스크립트
 *
 * 루트 TTS_files/ 디렉토리의 MP3 파일을 work_id 서브디렉토리로 이동
 * 이미 서브디렉토리에 있으면 루트 파일만 삭제 (중복 정리)
 * turso_sentences의 audio_file/audio_file_path 업데이트
 *
 * 사용법: node scripts/organize-mp3.mjs
 */

import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// 간단한 .env 파서
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv(path.join(projectRoot, '.env'));

const TTS_DIR = process.env.TTS_DIR || 'static/TTS_files';
const TTS_DIR_FULL = path.resolve(projectRoot, TTS_DIR);

async function main() {
  console.log(`=== organizeMp3 시작 ===`);
  console.log(`TTS 디렉토리: ${TTS_DIR_FULL}`);

  if (!fs.existsSync(TTS_DIR_FULL)) {
    console.error(`디렉토리가 없습니다: ${TTS_DIR_FULL}`);
    process.exit(1);
  }

  // 1. 루트 MP3 파일 수집
  const rootFiles = fs.readdirSync(TTS_DIR_FULL).filter(f => f.endsWith('.mp3'));
  console.log(`루트 MP3 파일 수: ${rootFiles.length}`);

  if (rootFiles.length === 0) {
    console.log('정리할 MP3 파일이 없습니다.');
    return;
  }

  const ids = rootFiles.map(f => parseInt(f.replace('.mp3', ''), 10)).filter(id => !isNaN(id));
  console.log(`추출된 ID 수: ${ids.length}`);

  if (ids.length === 0) {
    console.error('ID를 추출할 수 있는 MP3 파일이 없습니다.');
    return;
  }

  // 2. Turso 연결
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl) {
    console.error('TURSO_DATABASE_URL이 설정되지 않았습니다.');
    process.exit(1);
  }

  const client = createClient({ url: tursoUrl, authToken: tursoToken });
  console.log('Turso DB 연결됨');

  // 3. work_id 조회 (배치 처리 - SQLite 변수 제한 999)
  const BATCH_SIZE = 900;
  const recordMap = new Map();

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map(() => '?').join(',');
    const rows = await client.execute({
      sql: `SELECT id, work_id FROM sentences WHERE id IN (${placeholders})`,
      args: batch
    });
    for (const row of rows.rows) {
      recordMap.set(Number(row.id), row.work_id != null ? Number(row.work_id) : null);
    }
  }
  console.log(`DB에서 찾은 레코드: ${recordMap.size} / ${ids.length}`);

  // 4. 처리 계획 수립
  const toMove = [];       // 이동 필요 (타겟에 없음)
  const toDelete = [];     // 이미 타겟에 있음 → 루트 파일만 삭제
  let noWorkIdCount = 0;

  for (const id of ids) {
    const workId = recordMap.get(id);
    if (!workId) {
      noWorkIdCount++;
      continue;
    }
    const workDir = path.join(TTS_DIR_FULL, String(workId));
    const targetFile = path.join(workDir, `${id}.mp3`);
    const audioPath = `${workId}/${id}.mp3`;

    if (fs.existsSync(targetFile)) {
      // 이미 정리됨 → 루트 중복 파일만 삭제
      toDelete.push({ id, audioPath, rootFile: path.join(TTS_DIR_FULL, `${id}.mp3`) });
    } else {
      toMove.push({ id, workId, audioPath, targetDir: workDir });
    }
  }

  console.log(`\n=== 처리 계획 ===`);
  console.log(`이동할 파일: ${toMove.length}개`);
  console.log(`삭제할 중복 파일: ${toDelete.length}개 (이미 서브디렉토리에 존재)`);
  console.log(`work_id 없음: ${noWorkIdCount}개`);

  // 5. 파일 이동
  let movedCount = 0;
  let moveErrorCount = 0;

  if (toMove.length > 0) {
    const uniqueDirs = [...new Set(toMove.map(t => t.targetDir))];
    for (const dir of uniqueDirs) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
    console.log(`\n파일 이동 중...`);
    for (const t of toMove) {
      try {
        fs.renameSync(path.join(TTS_DIR_FULL, `${t.id}.mp3`), path.join(t.targetDir, `${t.id}.mp3`));
        movedCount++;
      } catch (err) {
        console.error(`  이동 실패 ID ${t.id}: ${err.message}`);
        moveErrorCount++;
      }
    }
    console.log(`이동 완료: ${movedCount}개 성공, ${moveErrorCount}개 실패`);
  }

  // 6. 중복 루트 파일 삭제
  let deletedCount = 0;
  let deleteErrorCount = 0;

  if (toDelete.length > 0) {
    console.log(`\n중복 루트 파일 삭제 중...`);
    for (const t of toDelete) {
      try {
        if (fs.existsSync(t.rootFile)) {
          fs.unlinkSync(t.rootFile);
          deletedCount++;
        }
      } catch (err) {
        console.error(`  삭제 실패 ID ${t.id}: ${err.message}`);
        deleteErrorCount++;
      }
    }
    console.log(`삭제 완료: ${deletedCount}개 성공, ${deleteErrorCount}개 실패`);
  }

  // 7. DB 업데이트 (이동 + 삭제 모두 audio_file=1로)
  const allProcessed = [
    ...toMove.filter(t => fs.existsSync(path.join(t.targetDir, `${t.id}.mp3`))).map(t => ({ id: t.id, audioPath: t.audioPath })),
    ...toDelete.map(t => ({ id: t.id, audioPath: t.audioPath }))
  ];

  if (allProcessed.length > 0) {
    console.log(`\nDB 업데이트 중 (${allProcessed.length}개)...`);
    for (let i = 0; i < allProcessed.length; i += BATCH_SIZE) {
      const batch = allProcessed.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(t =>
          client.execute({
            sql: 'UPDATE sentences SET audio_file = 1, audio_file_path = ? WHERE id = ?',
            args: [t.audioPath, t.id]
          })
        )
      );
    }
    console.log(`DB 업데이트 완료`);
  }

  // 8. 최종 요약
  console.log(`\n=== organizeMp3 완료 ===`);
  console.log(`총 ${rootFiles.length}개 루트 파일 처리`);
  console.log(`  이동: ${movedCount}개`);
  console.log(`  중복 삭제: ${deletedCount}개`);
  console.log(`  DB 업데이트: ${allProcessed.length}개`);
  if (noWorkIdCount > 0) console.log(`  work_id 없음: ${noWorkIdCount}개 (미처리)`);
  if (moveErrorCount > 0 || deleteErrorCount > 0) console.log(`  에러: 이동 ${moveErrorCount}개 / 삭제 ${deleteErrorCount}개`);

  // 남은 루트 파일 확인
  const remaining = fs.readdirSync(TTS_DIR_FULL).filter(f => f.endsWith('.mp3')).length;
  if (remaining > 0) {
    console.log(`\n⚠️  루트에 남은 MP3 파일: ${remaining}개`);
  } else {
    console.log(`\n✅ 루트에 남은 MP3 파일 없음 - 모두 정리됨`);
  }

  client.close();
}

main().catch(err => {
  console.error('스크립트 실행 중 오류:', err);
  process.exit(1);
});
