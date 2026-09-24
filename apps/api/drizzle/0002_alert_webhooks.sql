CREATE TYPE "public"."alert_webhook_kind" AS ENUM('generic', 'slack');--> statement-breakpoint
CREATE TABLE "alert_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"url" text NOT NULL,
	"kind" "alert_webhook_kind" DEFAULT 'generic' NOT NULL,
	"notify_on_new_issue" boolean DEFAULT true NOT NULL,
	"notify_on_regression" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_webhooks" ADD CONSTRAINT "alert_webhooks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_webhooks_project_idx" ON "alert_webhooks" USING btree ("project_id");