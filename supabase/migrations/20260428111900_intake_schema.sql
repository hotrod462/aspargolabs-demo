-- ============================================================
-- Voice Control Plane: Intake schema
-- ============================================================

-- Needed for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- call_sessions: one row per Vapi call
-- ============================================================
CREATE TABLE IF NOT EXISTS public.call_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id         text UNIQUE NOT NULL, -- Vapi call ID
  assistant_id    text,
  status          text NOT NULL DEFAULT 'in_progress'
                  CHECK (status IN (
                    'in_progress','completed','hard_stop',
                    'ineligible','emergency','proxy_caller',
                    'needs_review','abandoned'
                  )),
  current_state   text NOT NULL DEFAULT 'age_gate',
  patient_phone   text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  completion_pct  smallint NOT NULL DEFAULT 0,
  hard_stop_reason text,
  needs_review    boolean NOT NULL DEFAULT false,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON public.call_sessions(started_at DESC);

-- ============================================================
-- intake_fields: one row per clinical field per call
-- ============================================================
CREATE TABLE IF NOT EXISTS public.intake_fields (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  field_key     text NOT NULL,
  value         text,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','captured','confirmed','skipped','error')),
  confidence    real,
  source        text DEFAULT 'voice',
  evidence      text, -- transcript snippet
  confirmed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, field_key)
);

-- ============================================================
-- intake_events: append-only audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.intake_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  event_type    text NOT NULL, -- 'transcript','state_transition','field_update','hard_stop','tool_call','reconciliation'
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_session ON public.intake_events(session_id, created_at);

-- ============================================================
-- Enable Realtime on tables the monitor UI subscribes to
-- (idempotent via DO blocks)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'call_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'intake_fields'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.intake_fields;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'intake_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.intake_events;
  END IF;
END $$;

-- ============================================================
-- Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sessions_updated ON public.call_sessions;
CREATE TRIGGER trg_sessions_updated
  BEFORE UPDATE ON public.call_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_fields_updated ON public.intake_fields;
CREATE TRIGGER trg_fields_updated
  BEFORE UPDATE ON public.intake_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
