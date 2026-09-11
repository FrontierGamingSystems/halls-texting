CREATE TABLE `halls` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`region` text NOT NULL,
	`record` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender` text NOT NULL,
	`body` text NOT NULL,
	`received_at` text NOT NULL,
	`day` text NOT NULL,
	`hall_id` text,
	`candidates` text NOT NULL,
	`status` text NOT NULL,
	`kind` text NOT NULL,
	FOREIGN KEY (`hall_id`) REFERENCES `halls`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_messages_day_received` ON `messages` (`day`,`received_at`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
