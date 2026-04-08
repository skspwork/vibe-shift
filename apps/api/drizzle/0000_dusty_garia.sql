CREATE TABLE `changelog_reasons` (
	`id` text PRIMARY KEY NOT NULL,
	`changelog_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`changelog_id`) REFERENCES `changelogs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `changelogs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `edges` (
	`id` text PRIMARY KEY NOT NULL,
	`from_node_id` text NOT NULL,
	`to_node_id` text NOT NULL,
	`link_type` text DEFAULT 'derives' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`from_node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `node_changelogs` (
	`id` text PRIMARY KEY NOT NULL,
	`node_id` text NOT NULL,
	`changelog_id` text NOT NULL,
	`purpose` text DEFAULT '作成時' NOT NULL,
	`linked_at` text NOT NULL,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changelog_id`) REFERENCES `changelogs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`url` text,
	`changelog_id` text,
	`requirement_category` text,
	`created_by` text DEFAULT 'user' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`disabled_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changelog_id`) REFERENCES `changelogs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active_lanes` text NOT NULL,
	`node_instructions` text,
	`methodology` text DEFAULT 'strict' NOT NULL,
	`created_at` text NOT NULL
);
