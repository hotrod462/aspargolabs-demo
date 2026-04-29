"use client";

import { useEffect, useMemo, useState } from "react";
import { INTAKE_STATES } from "@/lib/intake/schema";
import type { CallSession } from "@/lib/storage/intake-store";
import { createClient } from "@/utils/supabase/client";

export function IntakeMonitorClient({ initialSessions }: { initialSessions: CallSession[] }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [selectedId, setSelectedId] = useState(initialSessions[0]?.id ?? null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const channel = supabase
      .channel("intake-monitor")
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

  const selected = sessions.find((session) => session.id === selectedId) ?? sessions[0] ?? null;

  return (
    <main className="mx-auto flex max-w-7xl gap-6 px-6 py-10">
      <aside className="w-80 rounded-2xl border border-black/10 p-4 dark:border-white/15">
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

      <section className="flex-1 rounded-2xl border border-black/10 p-6 dark:border-white/15">
        {!selected ? (
          <p>No calls yet.</p>
        ) : (
          <>
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

            <ol className="mt-8 grid grid-cols-1 gap-2 md:grid-cols-2">
              {INTAKE_STATES.map((state) => {
                const active = selected.current_state === state;
                return (
                  <li
                    key={state}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      active ? "border-zinc-950 dark:border-white" : "border-black/10 dark:border-white/15"
                    }`}
                  >
                    {state}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
    </main>
  );
}
