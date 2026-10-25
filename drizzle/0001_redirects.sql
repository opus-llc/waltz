CREATE TABLE `redirects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_path` text NOT NULL,
	`to_path` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `redirects_from_path_unique` ON `redirects` (`from_path`);