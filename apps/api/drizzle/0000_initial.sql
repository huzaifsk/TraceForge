CREATE TYPE "public"."environment" AS ENUM('development', 'staging', 'production');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('error', 'unhandled_rejection', 'api_error', 'api_request', 'web_vital', 'navigation', 'performance');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('unresolved', 'resolved', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('javascript', 'react', 'nextjs');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."web_vital_name" AS ENUM('LCP', 'INP', 'CLS', 'FCP', 'TTFB');--> statement-breakpoint
CREATE TYPE "public"."web_vital_rating" AS ENUM('good', 'needs-improvement', 'poor');--> statement-breakpoint
CREATE TABLE "api_requests" (
	"id" uuid NOT NULL,
	"project_id" text NOT NULL,
	"environment" "environment" NOT NULL,
	"method" text NOT NULL,
	"endpoint" text NOT NULL,
	"status" smallint NOT NULL,
	"duration_ms" double precision NOT NULL,
	"error_kind" text,
	"route" text,
	"browser" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	CONSTRAINT "api_requests_pkey" PRIMARY KEY("project_id","id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid NOT NULL,
	"project_id" text NOT NULL,
	"type" "event_type" NOT NULL,
	"fingerprint" text,
	"environment" "environment" NOT NULL,
	"release" text,
	"session_id" text NOT NULL,
	"anonymous_id" text,
	"path" text NOT NULL,
	"route" text,
	"browser" text NOT NULL,
	"os" text NOT NULL,
	"device_type" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"context" jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_pkey" PRIMARY KEY("project_id","id")
);
--> statement-breakpoint
CREATE TABLE "issue_users" (
	"issue_id" uuid NOT NULL,
	"user_key" text NOT NULL,
	CONSTRAINT "issue_users_pkey" PRIMARY KEY("issue_id","user_key")
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"type" "event_type" NOT NULL,
	"title" text NOT NULL,
	"culprit" text,
	"first_seen" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"occurrence_count" bigint DEFAULT 0 NOT NULL,
	"affected_users" integer DEFAULT 0 NOT NULL,
	"status" "issue_status" DEFAULT 'unresolved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"platform" "platform" DEFAULT 'react' NOT NULL,
	"public_key" text NOT NULL,
	"allowed_origins" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_vitals" (
	"id" uuid NOT NULL,
	"project_id" text NOT NULL,
	"environment" "environment" NOT NULL,
	"name" "web_vital_name" NOT NULL,
	"value" double precision NOT NULL,
	"rating" "web_vital_rating" NOT NULL,
	"path" text NOT NULL,
	"route" text,
	"browser" text NOT NULL,
	"device_type" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	CONSTRAINT "web_vitals_pkey" PRIMARY KEY("project_id","id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_requests" ADD CONSTRAINT "api_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_users" ADD CONSTRAINT "issue_users_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_vitals" ADD CONSTRAINT "web_vitals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_requests_project_time_idx" ON "api_requests" USING btree ("project_id","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "api_requests_project_endpoint_idx" ON "api_requests" USING btree ("project_id","endpoint","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_project_time_idx" ON "events" USING btree ("project_id","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_project_type_time_idx" ON "events" USING btree ("project_id","type","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_project_fingerprint_idx" ON "events" USING btree ("project_id","fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "issues_project_fingerprint_idx" ON "issues" USING btree ("project_id","fingerprint");--> statement-breakpoint
CREATE INDEX "issues_project_last_seen_idx" ON "issues" USING btree ("project_id","last_seen" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "projects_public_key_idx" ON "projects" USING btree ("public_key");--> statement-breakpoint
CREATE INDEX "projects_owner_idx" ON "projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "web_vitals_project_name_time_idx" ON "web_vitals" USING btree ("project_id","name","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");