-- Voice control plane: canonical intake schema (see voice-control-plane plan).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text UNIQUE NOT NULL,
  assistant_id text,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN (
      'in_progress',
      'completed',
      'hard_stop',
      'ineligible',
      'emergency',
      'proxy_caller',
      'needs_review',
      'abandoned'
    )),
  current_state text NOT NULL DEFAULT 'age_gate',
  patient_phone text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  completion_pct smallint NOT NULL DEFAULT 0,
  hard_stop_reason text,
  needs_review boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON public.call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_started_at ON public.call_sessions(started_at DESC);

CREATE TABLE IF NOT EXISTS public.intake_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  value jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'asked', 'captured', 'confirmed', 'unclear', 'skipped', 'error')),
  confidence real,
  source text NOT NULL DEFAULT 'voice',
  evidence text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_intake_fields_session_id ON public.intake_fields(session_id);

CREATE TABLE IF NOT EXISTS public.intake_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_events_idempotency
  ON public.intake_events(session_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intake_events_session_created
  ON public.intake_events(session_id, created_at);

CREATE TABLE IF NOT EXISTS public.captured_future_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  value jsonb NOT NULL,
  confidence real,
  evidence text,
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, field_key)
);

CREATE TABLE IF NOT EXISTS public.final_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  source text NOT NULL,
  live_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  structured_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  differences jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_call_sessions_updated ON public.call_sessions;
CREATE TRIGGER trg_call_sessions_updated
  BEFORE UPDATE ON public.call_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_intake_fields_updated ON public.intake_fields;
CREATE TRIGGER trg_intake_fields_updated
  BEFORE UPDATE ON public.intake_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_captured_future_slots_updated ON public.captured_future_slots;
CREATE TRIGGER trg_captured_future_slots_updated
  BEFORE UPDATE ON public.captured_future_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'call_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'intake_fields'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.intake_fields;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'intake_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.intake_events;
  END IF;
END $$;
