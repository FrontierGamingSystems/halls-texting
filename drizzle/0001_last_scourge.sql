CREATE TABLE `link_mappings` (
	`url` text PRIMARY KEY NOT NULL,
	`final_url` text NOT NULL,
	`hall_ids` text NOT NULL,
	`evidence` text NOT NULL,
	`checked_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `message_halls` (
	`message_id` text NOT NULL,
	`hall_id` text NOT NULL,
	`evidence` text NOT NULL,
	PRIMARY KEY(`message_id`, `hall_id`),
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hall_id`) REFERENCES `halls`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_message_halls_hall` ON `message_halls` (`hall_id`);