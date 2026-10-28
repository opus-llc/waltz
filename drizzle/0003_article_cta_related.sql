ALTER TABLE `articles` ADD `cta_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `articles` ADD `related_slugs` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `articles` ADD `related_links` text DEFAULT '[]' NOT NULL;