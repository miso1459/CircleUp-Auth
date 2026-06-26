ALTER TABLE `tp_sentences` ADD COLUMN `lang` text DEFAULT 'en-US' NOT NULL;
--> statement-breakpoint
ALTER TABLE `tp_sentences` ADD COLUMN `voice` text DEFAULT '';
--> statement-breakpoint
ALTER TABLE `tp_sentences` ADD COLUMN `speed` text DEFAULT '1.0';
--> statement-breakpoint
ALTER TABLE `tp_sentences` ADD COLUMN `file_tts` text DEFAULT '';
