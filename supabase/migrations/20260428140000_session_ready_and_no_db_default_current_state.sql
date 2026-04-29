-- Initial FSM node is defined in application code (`DEFAULT_INTAKE_STATE` in `lib/intake/schema.ts`).
-- New sessions must set `current_state` explicitly on insert; the app always does.
ALTER TABLE public.call_sessions ALTER COLUMN current_state DROP DEFAULT;
