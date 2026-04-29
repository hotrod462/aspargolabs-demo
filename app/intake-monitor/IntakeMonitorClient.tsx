"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { INTAKE_STATES, TERMINAL_STATES } from "@/lib/intake/schema";
import type { CallSession, IntakeEvent } from "@/lib/storage/intake-store";
import { createClient } from "@/utils/supabase/client";

function summarizeEvent(event: IntakeEvent): string {
  const p = event.payload;
  switch (event.event_type) {
    case "transcript": {
      const t = typeof p.transcript === "string" ? p.transcript : "";
      const st = typeof p.state === "string" ? p.state : "";
      const clip = t.length > 120 ? `${t.slice(0, 120)}…` : t;
      return st ? `State ${st}: “${clip}”` : `“${clip}”`;
    }
    case "turn_extraction": {
      const ex = p.extraction as Record<string, unknown> | undefined;
      if (!ex) return "Extraction";
      const parts: string[] = [];
      if (typeof ex.answer === "string") parts.push(`answer=${ex.answer}`);
      if (typeof ex.interrupt === "string") parts.push(`interrupt=${ex.interrupt}`);
      if (typeof ex.confidence === "number") parts.push(`conf=${ex.confidence.toFixed(2)}`);
      const st = typeof p.state === "string" ? p.state : "";
      return st ? `${st}: ${parts.join(", ")}` : parts.join(", ") || "Extraction";
    }
    case "assistant_turn": {
      const say = typeof p.say === "string" ? p.say : "";
      const clip = say.length > 160 ? `${say.slice(0, 160)}…` : say;
      const ec = p.end_call === true ? "end_call" : "continue";
      const st = typeof p.state === "string" ? p.state : "";
      return `Speak (${ec}) state=${st}: “${clip}”`;
    }
    case "final_reconciliation":
      return `Reconciliation (${typeof p.source === "string" ? p.source : "?"})`;
    default:
      return event.event_type;
  }
}

/** Ordered FSM states mentioned in transcript events (one node per turn). */
function statesFromTranscriptEvents(events: IntakeEvent[]): string[] {
  const out: string[] = [];
  for (const e of events) {
    if (e.event_type !== "transcript") continue;
    const st = typeof e.payload?.state === "string" ? e.payload.state : null;
    if (st) out.push(st);
  }
  return out;
}

export function IntakeMonitorClient({ initialSessions }: { initialSessions: CallSession[] }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [selectedId, setSelectedId] = useState(initialSessions[0]?.id ?? null);
  const [events, setEvents] = useState<IntakeEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const selected = sessions.find((session) => session.id === selectedId) ?? sessions[0] ?? null;

  useEffect(() => {
    const channel = supabase
      .channel("intake-monitor-sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_sessions" },
        (payload) => {
          const next = payload.new as CallSession;
          if (!next?.id) return;
          setSessions((prev) => {
            const withoutCurrent = prev.filter((session) => session.id !== next.id);
            return [next, ...withoutCurrent].sort((a, b) => b.started_at.localeCompare(a.started_at));
          });
          setSelectedId((current) => current ?? next.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const loadEvents = useCallback(
    async (sessionId: string) => {
      setEventsLoading(true);
      setEvents([]);
      setEventsError(null);
      const { data, error } = await supabase
        .from("intake_events")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      setEventsLoading(false);
      if (error) {
        setEventsError(error.message);
        setEvents([]);
        return;
      }
      setEvents((data ?? []) as IntakeEvent[]);
    },
    [supabase],
  );

  useEffect(() => {
    if (!selectedId) return;

    queueMicrotask(() => {
      void loadEvents(selectedId);
    });

    const channel = supabase
      .channel(`intake-events-${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "intake_events",
          filter: `session_id=eq.${selectedId}`,
        },
        (payload) => {
          const row = payload.new as IntakeEvent;
          if (!row?.id) return;
          setEvents((prev) => {
            if (prev.some((e) => e.id === row.id)) return prev;
            return [...prev, row].sort((a, b) =>
              String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
            );
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId, supabase, loadEvents]);

  const transcriptPath = useMemo(() => statesFromTranscriptEvents(events), [events]);

  const intakeIdx = selected
    ? INTAKE_STATES.findIndex((s) => s === selected.current_state)
    : -1;
  const terminalActive = selected
    ? (TERMINAL_STATES as readonly string[]).includes(selected.current_state)
    : false;

  return (
    <main className="mx-auto flex max-w-7xl gap-6 px-6 py-10">
      <aside className="w-80 shrink-0 rounded-2xl border border-black/10 p-4 dark:border-white/15">
        <h1 className="text-xl font-semibold">Intake Calls</h1>
        <div className="mt-4 space-y-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => setSelectedId(session.id)}
              className="block w-full rounded-xl border border-black/10 px-3 py-2 text-left text-sm dark:border-white/15"
            >
              <div className="font-medium">{session.patient_phone ?? session.call_id}</div>
              <div className="text-zinc-500">
                {session.status} · {session.current_state}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="min-w-0 flex-1 space-y-8">
        {!selected ? (
          <p>No calls yet.</p>
        ) : (
          <>
            <div className="rounded-2xl border border-black/10 p-6 dark:border-white/15">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">{selected.patient_phone ?? "Unknown caller"}</h2>
                  <p className="text-sm text-zinc-500">{selected.call_id}</p>
                </div>
                <div className="rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-900">
                  {selected.status}
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex justify-between text-sm">
                  <span>Current state: {selected.current_state}</span>
                  <span>{selected.completion_pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-2 rounded-full bg-zinc-950 dark:bg-white"
                    style={{ width: `${selected.completion_pct}%` }}
                  />
                </div>
              </div>

              <div className="mt-8">
                <h3 className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">FSM progress</h3>
                <div className="flex flex-wrap gap-2">
                  {INTAKE_STATES.map((state, i) => {
                    let tone =
                      "border-black/15 bg-transparent text-zinc-600 dark:border-white/15 dark:text-zinc-400";
                    if (intakeIdx >= 0) {
                      if (i < intakeIdx) {
                        tone =
                          "border-emerald-600/40 bg-emerald-50 text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:text-emerald-100";
                      } else if (i === intakeIdx && !terminalActive) {
                        tone =
                          "border-zinc-950 ring-2 ring-zinc-950 dark:border-white dark:ring-white";
                      }
                    } else if (terminalActive) {
                      const visited = transcriptPath.includes(state);
                      if (visited) {
                        tone =
                          "border-emerald-600/40 bg-emerald-50 text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:text-emerald-100";
                      }
                    }
                    return (
                      <span
                        key={state}
                        className={`rounded-lg border px-2 py-1 text-xs ${tone}`}
                        title={transcriptPath.includes(state) ? "Seen in transcript trace" : undefined}
                      >
                        {state}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs text-zinc-500">Terminals:</span>
                  {TERMINAL_STATES.map((state) => {
                    const on = selected.current_state === state;
                    return (
                      <span
                        key={state}
                        className={`rounded-lg border px-2 py-1 text-xs ${
                          on
                            ? "border-amber-500 ring-2 ring-amber-500 dark:border-amber-400 dark:ring-amber-400"
                            : "border-black/10 text-zinc-500 dark:border-white/15"
                        }`}
                      >
                        {state}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 p-6 dark:border-white/15">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold">Run trace</h3>
                {eventsLoading && <span className="text-xs text-zinc-500">Loading events…</span>}
              </div>
              {eventsError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{eventsError}</p>
              )}
              {!eventsLoading && events.length === 0 && !eventsError && (
                <p className="mt-2 text-sm text-zinc-500">No events recorded for this session yet.</p>
              )}
              <ol className="relative mt-4 border-l border-zinc-300 pl-6 dark:border-zinc-600">
                {events.map((ev) => {
                  const key = ev.id ?? `${ev.event_type}-${ev.created_at}`;
                  const open = expandedId === key;
                  return (
                    <li key={key} className="mb-6 last:mb-0">
                      <span className="absolute -left-1.5 top-2 h-3 w-3 rounded-full bg-zinc-950 dark:bg-white" />
                      <button
                        type="button"
                        onClick={() => setExpandedId(open ? null : key)}
                        className="text-left text-sm"
                      >
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
                          {ev.event_type}
                        </span>
                        {ev.created_at && (
                          <span className="ml-2 text-xs text-zinc-500">{new Date(ev.created_at).toLocaleString()}</span>
                        )}
                        <div className="mt-1 text-zinc-700 dark:text-zinc-300">{summarizeEvent(ev)}</div>
                      </button>
                      {open && (
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-900 dark:text-zinc-200">
                          {JSON.stringify(ev.payload ?? {}, null, 2)}
                        </pre>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
