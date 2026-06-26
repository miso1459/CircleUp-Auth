import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const task = sqliteTable('task', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

export const document = sqliteTable('document', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	content: text('content').notNull(), // We will store HTML or JSON as text
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

export const config = sqliteTable('config', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export const sentences = sqliteTable('sentences', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    lang: text('lang').notNull(),
    voice: text('voice').default(''),
    speed: text('speed').default('1.0'),
	sent: text('sent').notNull(),
    tag: text('tag').default(''),
    file_tts: text('file_tts').default(''),
    file_image: text('file_image').default(''),
    check_img: integer('check_img').default(0).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date())
});

export const sentences_tran = sqliteTable('sentences_tran', {
    id: integer('id').primaryKey(),
    lang: text('lang').notNull(),
    sent: text('sent').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date())
});

export const dicWord = sqliteTable('dic_word', {
	word: text('word').primaryKey(),
	mp3_url: text('mp3_url').default(''),
	core_meaning: text('core_meaning').default(''),
	ipa: text('ipa').default(''),
	pos: text('pos').default(''),
	level: text('level').default(''),
	frequency: text('frequency').default(''),
	senses: text('senses').default('[]'),
	phrasal_verbs: text('phrasal_verbs').default('[]'),
	check_core: integer('check_core').default(0).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const tp_passages = sqliteTable('tp_passages', {
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

export const tp_sentences = sqliteTable('tp_sentences', {
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
	created_at: integer('created_at', { mode: 'timestamp' }),
	// TTS 관련 컬럼
	lang: text('lang').notNull().default('en-US'),
	voice: text('voice').default(''),
	speed: text('speed').default('1.0'),
	file_tts: text('file_tts').default('')
});

export * from './auth.schema';

