import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

/**
 * Turso DB의 passages 테이블 (원본 The Passage 데이터)
 * tp_passages로 가져와서 매핑됨
 */
export const turso_passages = sqliteTable('passages', {
	id: integer('id').primaryKey(),
	work_id: integer('work_id'),
	chapter_id: integer('chapter_id'),
	order: integer('order'),
	chapter_order: integer('chapter_order'),
	text: text('text'),
	word_count: integer('word_count'),
	char_count: integer('char_count'),
	created_at: integer('created_at'),
	content_type: text('content_type')
});

/**
 * Turso DB의 sentences 테이블 (원본 The Passage 데이터)
 * tp_sentences로 가져와서 매핑됨
 */
/**
 * Turso DB의 works 테이블 (작품 정보)
 */
export const turso_works = sqliteTable('works', {
	id: integer('id').primaryKey(),
	title: text('title'),
	created_at: integer('created_at')
});

/**
 * Turso DB의 sentences 테이블 (원본 The Passage 데이터)
 * tp_sentences로 가져와서 매핑됨
 */
export const turso_sentences = sqliteTable('sentences', {
	id: integer('id').primaryKey(),
	work_id: integer('work_id'),
	chapter_id: integer('chapter_id'),
	passage_id: integer('passage_id'),
	order: integer('order'),
	chapter_order: integer('chapter_order'),
	passage_order: integer('passage_order'),
	text: text('text'),
	normalized_text: text('normalized_text'),
	word_count: integer('word_count'),
	char_count: integer('char_count'),
	created_at: integer('created_at', { mode: 'timestamp' })
});
