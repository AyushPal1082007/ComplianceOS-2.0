-- Additive SENTINEL and orchestration foundations. This migration is printed for review only.
-- It is not applied to any database by this change.

CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users"("phone");

ALTER TABLE "business_profiles"
  ADD COLUMN IF NOT EXISTS "turnover_band" TEXT,
  ADD COLUMN IF NOT EXISTS "employees_band" TEXT;

ALTER TABLE "compliance_deadlines" ADD COLUMN IF NOT EXISTS "dedupe_key" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "compliance_deadlines_dedupe_key_key"
  ON "compliance_deadlines"("dedupe_key");

ALTER TABLE "sentinel_alerts" ADD COLUMN IF NOT EXISTS "change_id" TEXT;
CREATE INDEX IF NOT EXISTS "sentinel_alerts_change_id_idx" ON "sentinel_alerts"("change_id");

CREATE TABLE IF NOT EXISTS "profile_fields" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB,
  "status" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "source" TEXT NOT NULL,
  "evidence" JSONB,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "profile_fields_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "profile_fields_user_id_key_key" ON "profile_fields"("user_id", "key");
CREATE INDEX IF NOT EXISTS "profile_fields_user_id_idx" ON "profile_fields"("user_id");

CREATE TABLE IF NOT EXISTS "conversation_states" (
  "user_id" TEXT NOT NULL,
  "state" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "last_inbound_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversation_states_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE IF NOT EXISTS "inbound_events" (
  "id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inbound_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "inbound_events_channel_external_id_key"
  ON "inbound_events"("channel", "external_id");

CREATE TABLE IF NOT EXISTS "consent_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "text_version" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consent_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "consent_logs_user_id_idx" ON "consent_logs"("user_id");

CREATE TABLE IF NOT EXISTS "agent_trace_events" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "user_id" TEXT,
  "agent" TEXT NOT NULL,
  "node" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "duration_ms" INTEGER NOT NULL,
  "summary" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_trace_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agent_trace_events_run_id_idx" ON "agent_trace_events"("run_id");
CREATE INDEX IF NOT EXISTS "agent_trace_events_user_id_created_at_idx"
  ON "agent_trace_events"("user_id", "created_at");
