CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`qr_code` text,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE `agents` ADD `team_id` integer REFERENCES teams(id);--> statement-breakpoint
ALTER TABLE `agents` ADD `password_policy` text DEFAULT 'changeable';--> statement-breakpoint
ALTER TABLE `invitations` ADD `team_id` integer REFERENCES teams(id);