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

export * from './auth.schema';

