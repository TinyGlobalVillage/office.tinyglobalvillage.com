CREATE TABLE "office"."projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" varchar(32) DEFAULT 'pending_contract' NOT NULL,
	"deadline" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sort_index" integer,
	"vscode_uri" text,
	"repo_path" text,
	"thumbnail_url" text,
	"notes" text
);
