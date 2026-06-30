import fs from 'fs';
import { createClient } from '@libsql/client';

// Read .env manually
const envContent = fs.readFileSync('.env', 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  envVars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const c = createClient({
  url: envVars.TURSO_DATABASE_URL,
  authToken: envVars.TURSO_AUTH_TOKEN
});

async function main() {
  // 1. sentences only (no JOIN)
  const r1 = await c.execute(
    "SELECT s.id, s.passage_id, s.word_count, s.char_count, s.audio_file " +
    "FROM sentences s WHERE s.work_id=2 AND (s.audio_file IS NULL OR s.audio_file!=1) " +
    "AND (s.word_count>1 OR s.char_count>2) ORDER BY s.id DESC LIMIT 1000"
  );
  console.log('1. sentences only (no JOIN):', r1.rows.length);

  // 2. WITH JOIN + content_type='body'
  const r2 = await c.execute(
    "SELECT s.id, s.passage_id, p.content_type " +
    "FROM sentences s INNER JOIN passages p ON s.passage_id=p.id " +
    "WHERE s.work_id=2 AND (s.audio_file IS NULL OR s.audio_file!=1) " +
    "AND (s.word_count>1 OR s.char_count>2) AND p.content_type='body' " +
    "ORDER BY s.id DESC LIMIT 1000"
  );
  console.log('2. WITH JOIN + content_type=body:', r2.rows.length);

  // 3. WITH JOIN (no content_type filter)
  const r3 = await c.execute(
    "SELECT s.id, s.passage_id, p.content_type " +
    "FROM sentences s INNER JOIN passages p ON s.passage_id=p.id " +
    "WHERE s.work_id=2 AND (s.audio_file IS NULL OR s.audio_file!=1) " +
    "AND (s.word_count>1 OR s.char_count>2) " +
    "ORDER BY s.id DESC LIMIT 1000"
  );
  console.log('3. WITH JOIN (no content_type filter):', r3.rows.length);

  // 4. content_type distribution
  const r4 = await c.execute(
    "SELECT p.content_type, COUNT(*) as cnt " +
    "FROM sentences s INNER JOIN passages p ON s.passage_id=p.id " +
    "WHERE s.work_id=2 AND (s.audio_file IS NULL OR s.audio_file!=1) " +
    "AND (s.word_count>1 OR s.char_count>2) " +
    "GROUP BY p.content_type"
  );
  console.log('4. content_type distribution:');
  r4.rows.forEach(x => console.log('   ' + x.content_type + ': ' + x.cnt));

  // 5. passages not matching
  const r5 = await c.execute(
    "SELECT s.id, s.passage_id FROM sentences s " +
    "WHERE s.work_id=2 AND (s.audio_file IS NULL OR s.audio_file!=1) " +
    "AND (s.word_count>1 OR s.char_count>2) " +
    "AND s.passage_id NOT IN (SELECT id FROM passages) " +
    "LIMIT 100"
  );
  console.log('5. sentences with passage_id NOT in passages:', r5.rows.length);

  // 6. total without word/char filter
  const r6 = await c.execute(
    "SELECT COUNT(*) as cnt FROM sentences s " +
    "WHERE s.work_id=2 AND (s.audio_file IS NULL OR s.audio_file!=1)"
  );
  console.log('6. work_id=2, audio_file!=1 (no word/char filter):', r6.rows[0].cnt);

  // 7. filtered by word/char
  const r7 = await c.execute(
    "SELECT COUNT(*) as cnt FROM sentences s " +
    "WHERE s.work_id=2 AND (s.audio_file IS NULL OR s.audio_file!=1) " +
    "AND (s.word_count<=1 AND s.char_count<=2)"
  );
  console.log('7. filtered out by word_count/char_count:', r7.rows[0].cnt);

  // 8. work_id=2 전체 sentences 수
  const r8 = await c.execute("SELECT COUNT(*) as cnt FROM sentences WHERE work_id=2");
  console.log('8. work_id=2 total:', r8.rows[0].cnt);

  // 9. audio_file=1 count for work_id=2
  const r9 = await c.execute("SELECT COUNT(*) as cnt FROM sentences WHERE work_id=2 AND audio_file=1");
  console.log('9. work_id=2 audio_file=1:', r9.rows[0].cnt);
}

main().catch(console.error);
