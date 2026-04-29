"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  EXTRACTION_INTERRUPTS,
  INTERRUPT_DISPLAY,
  SYNTHETIC_DISPLAY,
  SYNTHETIC_SIGNAL_IDS,
  summarizeCallSignalsFromEvents,
} from "@/lib/intake/monitor-extraction";
import {
  CALL_STATUSES,
  FIELD_KEYS,
  INTAKE_STATES,
  TERMINAL_STATES,
  type CallStatus,
} from "@/lib/intake/schema";
import type { CallSession, IntakeEvent, IntakeField } from "@/lib/storage/intake-store";
import { createClient } from "@/utils/supabase/client";

/** Radix collapsible wrapper for intake monitor panels (accessible trigger + chevron affordance). */
function MonitorCollapsible({
  title,
  defaultOpen,
  children,
  className,
  titleClassName = "text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400",
  contentClassName = "border-t border-black/10 px-4 pb-4 pt-3 dark:border-white/15",
  aside,
  triggerClassName,
}: {
  title: ReactNode;
  defaultOpen: boolean;
  children: ReactNode;
  className?: string;
  /** Applied to `<h3>` only when `title` is a string. */
  titleClassName?: string;
  /** Extra padding/border wrapper for expandable body. */
  contentClassName?: string;
  /** Optional slot after title (e.g. loading spinner) inside the trigger row */
  aside?: ReactNode;
  /** Trigger row padding / alignment overrides */
  triggerClassName?: string;
}) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen}>
      <div
        className={
          className ??
          "mt-6 rounded-xl border border-black/10 bg-zinc-50/80 dark:border-white/15 dark:bg-zinc-900/40"
        }
      >
        <Collapsible.Trigger
          type="button"
          className={
            triggerClassName ??
            "flex w-full items-start justify-between gap-3 rounded-t-xl px-4 py-3 text-left outline-none hover:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-zinc-400/80 dark:hover:bg-white/[0.05] dark:focus-visible:ring-zinc-500/70 [&[data-state=open]_.monitor-collapse-chevron]:rotate-180"
          }
        >
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <div className="min-w-0 flex-1">
              {typeof title === "string" ? (
                <h3 className={titleClassName}>{title}</h3>
              ) : (
                title
              )}
            </div>
            {aside ? <span className="mt-px shrink-0">{aside}</span> : null}
          </div>
          <ChevronDown
            className="monitor-collapse-chevron mt-0.5 h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 dark:text-zinc-400"
            aria-hidden
          />
        </Collapsible.Trigger>
        <Collapsible.Content className="data-[state=closed]:hidden">
          <div className={contentClassName}>{children}</div>
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  );
}

function formatMsPretty(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  return `${Math.round(ms).toLocaleString()} ms`;
}

/** Relative time from `started_at` for the five newest rows in the call list. */
function formatStartedRelativeAgo(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const sec = Math.floor((nowMs - t) / 1000);
  if (sec < 0) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

/** Wall-clock start time for calls after the five most recent in the list. */
function formatStartedAbsolute(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const y = d.getFullYear();
  const nowY = new Date().getFullYear();
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  if (y !== nowY) opts.year = "numeric";
  return d.toLocaleString(undefined, opts);
}

/** Sum persisted per-turn extraction LLM durations (fallback when metadata not yet synced). */
function sumLlmLatencyFromExtractEvents(events: IntakeEvent[]): { totalMs: number; turns: number } {
  let totalMs = 0;
  let turns = 0;
  for (const e of events) {
    if (e.event_type !== "turn_extraction") continue;
    const ms = e.payload?.llm_latency_ms;
    if (typeof ms !== "number") continue;
    totalMs += ms;
    turns += 1;
  }
  return { totalMs, turns };
}

function callStatusBadgeClass(status: CallStatus): string {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-600/35 dark:bg-emerald-950/55 dark:text-emerald-100 dark:ring-emerald-500/35";
    case "in_progress":
      return "bg-amber-100 text-amber-950 ring-1 ring-amber-500/40 dark:bg-amber-950/55 dark:text-amber-100 dark:ring-amber-400/35";
    case "needs_review":
      return "bg-violet-100 text-violet-950 ring-1 ring-violet-500/35 dark:bg-violet-950/55 dark:text-violet-100";
    case "emergency":
      return "bg-red-100 text-red-950 ring-1 ring-red-500/40 dark:bg-red-950/60 dark:text-red-100";
    case "hard_stop":
      return "bg-orange-100 text-orange-950 ring-1 ring-orange-500/40 dark:bg-orange-950/55 dark:text-orange-100";
    case "ineligible":
      return "bg-slate-200 text-slate-950 ring-1 ring-slate-500/30 dark:bg-slate-800 dark:text-slate-100";
    case "proxy_caller":
      return "bg-sky-100 text-sky-950 ring-1 ring-sky-500/35 dark:bg-sky-950/55 dark:text-sky-100";
    case "abandoned":
      return "bg-zinc-200 text-zinc-900 ring-1 ring-zinc-500/25 dark:bg-zinc-800 dark:text-zinc-100";
    default:
      return "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100";
  }
}

function callStatusFilterLabel(status: CallStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    case "hard_stop":
      return "Hard stop";
    case "ineligible":
      return "Ineligible";
    case "emergency":
      return "Emergency";
    case "proxy_caller":
      return "Proxy caller";
    case "needs_review":
      return "Needs review";
    case "abandoned":
      return "Abandoned";
    default:
      return status;
  }
}

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
      const ms = typeof p.llm_latency_ms === "number" ? p.llm_latency_ms : null;
      if (!ex) return ms != null ? `Extraction · ${ms} ms` : "Extraction";
      const parts: string[] = [];
      if (typeof ex.answer === "string") parts.push(`answer=${ex.answer}`);
      if (typeof ex.interrupt === "string") parts.push(`interrupt=${ex.interrupt}`);
      if (typeof ex.confidence === "number") parts.push(`conf=${ex.confidence.toFixed(2)}`);
      const st = typeof p.state === "string" ? p.state : "";
      const base = st ? `${st}: ${parts.join(", ")}` : parts.join(", ") || "Extraction";
      return ms != null ? `${base} · ${ms} ms LLM` : base;
    }
    case "turn_extraction_error": {
      const st = typeof p.state === "string" ? p.state : "";
      const se = p.serialized_error as Record<string, unknown> | undefined;
      const ms = typeof p.llm_latency_ms === "number" ? p.llm_latency_ms : null;
      let detail = "unknown";
      if (se && typeof se.message === "string") detail = se.message.slice(0, 140);
      else if (se && typeof se.type === "string") detail = se.type;
      const head = `Extraction failed${st ? ` @ ${st}` : ""}${ms != null ? ` · ${ms} ms` : ""}`;
      return `${head}: ${detail}`;
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

function TurnExtractionDetail({ payload }: { payload: Record<string, unknown> }) {
  const extraction = payload.extraction as Record<string, unknown> | undefined;
  const state = typeof payload.state === "string" ? payload.state : "";

  if (!extraction) {
    return (
      <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-900 dark:text-zinc-200">
        {JSON.stringify(payload, null, 2)}
      </pre>
    );
  }

  const slots = extraction.futureSlots;
  const slotRows = Array.isArray(slots) ? slots : [];

  return (
    <div className="mt-2 space-y-4">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        FSM state at ingest: {state || "—"}
      </p>
      <div className="flex flex-wrap gap-3 rounded-lg border border-teal-200/80 bg-teal-50/80 px-3 py-2 text-xs dark:border-teal-900/60 dark:bg-teal-950/40">
        <span className="text-teal-900 dark:text-teal-100">
          Groq latency:{" "}
          <strong className="font-mono">
            {typeof payload.llm_latency_ms === "number" ? `${payload.llm_latency_ms} ms` : "—"}
          </strong>
        </span>
        <span className="text-zinc-600 dark:text-zinc-400">
          model:{" "}
          <code className="text-[11px] text-zinc-800 dark:text-zinc-200">
            {typeof payload.intake_llm_model === "string" ? payload.intake_llm_model : "—"}
          </code>
        </span>
      </div>

      <dl className="grid gap-2 rounded-lg border border-black/10 bg-white p-3 text-xs dark:border-white/15 dark:bg-zinc-950 sm:grid-cols-2">
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">answer</dt>
        <dd className="font-mono text-zinc-900 dark:text-zinc-100">{fmt(extraction.answer)}</dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">interrupt</dt>
        <dd className="font-mono text-zinc-900 dark:text-zinc-100">
          {fmt(extraction.interrupt)}
          {typeof extraction.interrupt === "string" && INTERRUPT_DISPLAY[extraction.interrupt] != null ? (
            <span className="ml-2 text-[11px] text-zinc-500">
              ({INTERRUPT_DISPLAY[extraction.interrupt]})
            </span>
          ) : null}
        </dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">confidence</dt>
        <dd className="font-mono text-zinc-900 dark:text-zinc-100">
          {typeof extraction.confidence === "number" ? extraction.confidence.toFixed(3) : fmt(extraction.confidence)}
        </dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">evidence</dt>
        <dd className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200 sm:col-span-1">
          {typeof extraction.evidence === "string" ? extraction.evidence : fmt(extraction.evidence)}
        </dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">clarificationTopic</dt>
        <dd className="font-mono text-zinc-900 dark:text-zinc-100">{fmt(extraction.clarificationTopic)}</dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">suggestedSay</dt>
        <dd className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200 sm:col-span-1">
          {typeof extraction.suggestedSay === "string" ? extraction.suggestedSay : fmt(extraction.suggestedSay)}
        </dd>
      </dl>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          futureSlots (volunteered answers)
        </h4>
        {slotRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 px-3 py-2 text-xs text-zinc-500 dark:border-white/20">
            None
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
            <table className="w-full min-w-[28rem] border-collapse text-left text-xs">
              <thead className="bg-zinc-100 dark:bg-zinc-900">
                <tr>
                  <th className="border border-black/10 px-2 py-1.5 dark:border-white/15">fieldKey</th>
                  <th className="border border-black/10 px-2 py-1.5 dark:border-white/15">value</th>
                  <th className="border border-black/10 px-2 py-1.5 dark:border-white/15">confidence</th>
                  <th className="border border-black/10 px-2 py-1.5 dark:border-white/15">evidence</th>
                </tr>
              </thead>
              <tbody>
                {slotRows.map((row, idx) => {
                  const slot = row as Record<string, unknown>;
                  const conf =
                    typeof slot.confidence === "number" ? slot.confidence.toFixed(3) : fmt(slot.confidence);
                  return (
                    <tr key={idx} className="align-top">
                      <td className="border border-black/10 px-2 py-1.5 font-mono dark:border-white/15">
                        {fmt(slot.fieldKey)}
                      </td>
                      <td className="border border-black/10 px-2 py-1.5 dark:border-white/15">{fmt(slot.value)}</td>
                      <td className="border border-black/10 px-2 py-1.5 font-mono dark:border-white/15">{conf}</td>
                      <td className="max-w-[18rem] border border-black/10 px-2 py-1.5 whitespace-pre-wrap dark:border-white/15">
                        {typeof slot.evidence === "string" ? slot.evidence : fmt(slot.evidence)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <details className="rounded-lg border border-black/10 dark:border-white/15">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Raw extraction JSON
        </summary>
        <pre className="overflow-x-auto border-t border-black/10 px-3 py-2 text-[11px] dark:border-white/15 dark:text-zinc-200">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "undefined") return "undefined";
  if (typeof v === "string") return v;
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return "[unreadable]";
  }
}

function EventPayloadDetail({ event }: { event: IntakeEvent }) {
  const p = event.payload ?? {};
  if (event.event_type === "turn_extraction") {
    return <TurnExtractionDetail payload={p} />;
  }
  if (event.event_type === "turn_extraction_error") {
    return <TurnExtractionErrorDetail payload={p} />;
  }
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-900 dark:text-zinc-200">
      {JSON.stringify(p, null, 2)}
    </pre>
  );
}

function TurnExtractionErrorDetail({ payload }: { payload: Record<string, unknown> }) {
  const serialized = payload.serialized_error as Record<string, unknown> | undefined;
  const state = typeof payload.state === "string" ? payload.state : "";
  const transcript =
    typeof payload.transcript === "string"
      ? payload.transcript.length > 4000
        ? `${payload.transcript.slice(0, 4000)}…`
        : payload.transcript
      : "";
  const chars = typeof payload.transcript_chars === "number" ? payload.transcript_chars : null;

  return (
    <div className="mt-2 space-y-4">
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs dark:border-rose-900/60 dark:bg-rose-950/40">
        <p className="font-medium text-rose-900 dark:text-rose-100">ExtractIntakeTurn failed</p>
        <p className="mt-1 text-rose-800/90 dark:text-rose-200/90">
          FSM state: <span className="font-mono">{state || "—"}</span>
          {chars != null ? ` · transcript length ${chars} chars` : null}
          {typeof payload.llm_latency_ms === "number"
            ? ` · failed after ${payload.llm_latency_ms} ms LLM`
            : null}
        </p>
        {transcript ? (
          <p className="mt-2 whitespace-pre-wrap rounded border border-rose-200/70 bg-white/80 px-2 py-1 font-mono text-[11px] text-zinc-800 dark:border-rose-900/40 dark:bg-zinc-950 dark:text-zinc-200">
            {transcript}
          </p>
        ) : null}
        {serialized && typeof serialized.type === "string" ? (
          <p className="mt-2 text-rose-900 dark:text-rose-100">
            <span className="font-semibold">{serialized.type}:</span>{" "}
            {typeof serialized.message === "string" ? serialized.message : ""}
          </p>
        ) : null}
      </div>
      <details className="rounded-lg border border-black/10 dark:border-white/15">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Full error payload JSON
        </summary>
        <pre className="overflow-x-auto border-t border-black/10 px-3 py-2 text-[11px] dark:border-white/15 dark:text-zinc-200">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </details>
    </div>
  );
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

type FieldSlotKind = "collected" | "open" | "issue";

function classifyIntakeFieldSlot(field: IntakeField | undefined): FieldSlotKind {
  if (!field) return "open";
  switch (field.status) {
    case "confirmed":
    case "captured":
    case "skipped":
      return "collected";
    case "unclear":
    case "error":
      return "issue";
    default:
      return "open";
  }
}

function fieldRowByKey(fields: IntakeField[]): Map<string, IntakeField> {
  const m = new Map<string, IntakeField>();
  for (const f of fields) m.set(f.field_key, f);
  return m;
}

function formatFieldKeyLabel(key: string): string {
  return key.replace(/_/g, " ");
}

function mergeFieldsRecord(prev: Record<string, IntakeField[]>, row: IntakeField): Record<string, IntakeField[]> {
  const sid = row.session_id;
  const list = [...(prev[sid] ?? [])];
  const idx = list.findIndex((x) => x.field_key === row.field_key);
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  return { ...prev, [sid]: list };
}

function removeFieldsRow(
  prev: Record<string, IntakeField[]>,
  sessionId: string,
  fieldKey: string,
): Record<string, IntakeField[]> {
  const list = (prev[sessionId] ?? []).filter((x) => x.field_key !== fieldKey);
  return { ...prev, [sessionId]: list };
}

function intakeFieldSummary(fields: IntakeField[]): {
  collected: number;
  issue: number;
  total: number;
} {
  const byKey = fieldRowByKey(fields);
  let collected = 0;
  let issue = 0;
  for (const key of FIELD_KEYS) {
    const kind = classifyIntakeFieldSlot(byKey.get(key));
    if (kind === "collected") collected++;
    else if (kind === "issue") issue++;
  }
  return { collected, issue, total: FIELD_KEYS.length };
}

function IntakeFieldsProgressStrip({ fields }: { fields: IntakeField[] }) {
  const { collected, issue, total } = intakeFieldSummary(fields);
  const byKey = fieldRowByKey(fields);
  return (
    <div className="mt-2 border-t border-black/10 pt-2 dark:border-white/15">
      <p className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
        Intake fields{" "}
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {collected}/{total}
        </span>{" "}
        collected
        {issue > 0 ? (
          <span className="text-amber-700 dark:text-amber-400"> · {issue} need attention</span>
        ) : null}
      </p>
      <div className="mt-1 flex flex-wrap gap-0.5" aria-label="Intake field slots">
        {FIELD_KEYS.map((key) => {
          const kind = classifyIntakeFieldSlot(byKey.get(key));
          const dot =
            kind === "collected"
              ? "bg-emerald-500 dark:bg-emerald-400"
              : kind === "issue"
                ? "bg-amber-500 dark:bg-amber-300"
                : "bg-zinc-300 dark:bg-zinc-600";
          const kindLabel = kind === "collected" ? "Collected" : kind === "issue" ? "Unclear or error" : "Not collected yet";
          return (
            <span
              key={key}
              title={`${formatFieldKeyLabel(key)}: ${kindLabel}`}
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function IntakeFieldsDetailPanel({ fields }: { fields: IntakeField[] }) {
  const byKey = fieldRowByKey(fields);
  const { collected, issue, total } = intakeFieldSummary(fields);

  return (
    <>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Rows from <code className="rounded bg-zinc-100 px-1 text-[11px] dark:bg-zinc-800">intake_fields</code>.{" "}
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {collected}/{total}
        </span>{" "}
        collected
        {issue > 0 ? (
          <span className="text-amber-700 dark:text-amber-400"> · {issue} unclear or error</span>
        ) : null}
        . Green dot strip in the call list matches this checklist (hover dots for names).
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
        <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="border border-black/10 px-2 py-1.5 font-medium dark:border-white/15">Field</th>
              <th className="border border-black/10 px-2 py-1.5 font-medium dark:border-white/15">Collected</th>
              <th className="border border-black/10 px-2 py-1.5 font-medium dark:border-white/15">Status</th>
              <th className="border border-black/10 px-2 py-1.5 font-medium dark:border-white/15">Value</th>
              <th className="border border-black/10 px-2 py-1.5 font-medium dark:border-white/15">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {FIELD_KEYS.map((key) => {
              const row = byKey.get(key);
              const kind = classifyIntakeFieldSlot(row);
              const collectedLabel =
                kind === "collected" ? "Yes" : kind === "issue" ? "Needs attention" : "Not yet";
              const collectedCls =
                kind === "collected"
                  ? "text-emerald-800 dark:text-emerald-200"
                  : kind === "issue"
                    ? "text-amber-800 dark:text-amber-200"
                    : "text-zinc-500 dark:text-zinc-400";
              return (
                <tr key={key} className="align-top">
                  <td className="border border-black/10 px-2 py-1.5 font-medium text-zinc-800 dark:border-white/15 dark:text-zinc-200">
                    {formatFieldKeyLabel(key)}
                  </td>
                  <td className={`border border-black/10 px-2 py-1.5 dark:border-white/15 ${collectedCls}`}>
                    {collectedLabel}
                  </td>
                  <td className="border border-black/10 px-2 py-1.5 font-mono text-[11px] dark:border-white/15">
                    {row?.status ?? "—"}
                  </td>
                  <td className="max-w-[14rem] border border-black/10 px-2 py-1.5 font-mono text-[11px] break-words whitespace-pre-wrap dark:border-white/15">
                    {row ? fmt(row.value) : "—"}
                  </td>
                  <td className="border border-black/10 px-2 py-1.5 font-mono dark:border-white/15">
                    {row?.confidence != null ? row.confidence.toFixed(3) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function IntakeMonitorClient({
  initialSessions,
  initialFieldsBySessionId,
}: {
  initialSessions: CallSession[];
  initialFieldsBySessionId: Record<string, IntakeField[]>;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [fieldsBySessionId, setFieldsBySessionId] = useState(initialFieldsBySessionId);
  const [selectedId, setSelectedId] = useState<string | null>(initialSessions[0]?.id ?? null);
  const [events, setEvents] = useState<IntakeEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [includedStatuses, setIncludedStatuses] = useState<Set<CallStatus>>(
    () => new Set([...CALL_STATUSES]),
  );
  /** Refreshes relative “Xs ago” labels for the five newest visible calls. */
  const [nowTick, setNowTick] = useState(() => Date.now());

  const supabase = useMemo(() => createClient(), []);

  const filteredSessions = useMemo(
    () => sessions.filter((s) => includedStatuses.has(s.status as CallStatus)),
    [sessions, includedStatuses],
  );

  const sortedFilteredSessions = useMemo(
    () => [...filteredSessions].sort((a, b) => b.started_at.localeCompare(a.started_at)),
    [filteredSessions],
  );

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, []);

  const statusCounts = useMemo(() => {
    const m = new Map<CallStatus, number>();
    for (const st of CALL_STATUSES) m.set(st, 0);
    for (const s of sessions) {
      m.set(s.status as CallStatus, (m.get(s.status as CallStatus) ?? 0) + 1);
    }
    return m;
  }, [sessions]);

  const toggleStatusInFilter = useCallback((st: CallStatus) => {
    setIncludedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(st)) {
        if (next.size <= 1) return prev;
        next.delete(st);
      } else {
        next.add(st);
      }
      return next;
    });
  }, []);

  const resolvedSelectedId = useMemo(() => {
    if (sortedFilteredSessions.length === 0) return null;
    if (selectedId && sortedFilteredSessions.some((s) => s.id === selectedId)) return selectedId;
    return sortedFilteredSessions[0]!.id;
  }, [sortedFilteredSessions, selectedId]);

  const selected = useMemo(() => {
    if (!resolvedSelectedId) return null;
    return sessions.find((session) => session.id === resolvedSelectedId) ?? null;
  }, [sessions, resolvedSelectedId]);

  const selectedFields = useMemo(() => {
    if (!resolvedSelectedId) return [];
    return fieldsBySessionId[resolvedSelectedId] ?? [];
  }, [fieldsBySessionId, resolvedSelectedId]);

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

  useEffect(() => {
    const channel = supabase
      .channel("intake-monitor-fields")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "intake_fields" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { session_id?: string; field_key?: string };
            if (oldRow.session_id && oldRow.field_key) {
              setFieldsBySessionId((prev) =>
                removeFieldsRow(prev, oldRow.session_id!, oldRow.field_key!),
              );
            }
            return;
          }
          const row = payload.new as IntakeField;
          if (!row?.session_id || !row.field_key) return;
          setFieldsBySessionId((prev) => mergeFieldsRecord(prev, row));
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
    if (!resolvedSelectedId) return;

    queueMicrotask(() => {
      void loadEvents(resolvedSelectedId);
    });

    const channel = supabase
      .channel(`intake-events-${resolvedSelectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "intake_events",
          filter: `session_id=eq.${resolvedSelectedId}`,
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
  }, [resolvedSelectedId, supabase, loadEvents]);

  const transcriptPath = useMemo(() => statesFromTranscriptEvents(events), [events]);

  const callSignals = useMemo(() => summarizeCallSignalsFromEvents(events), [events]);

  const timingPanel = useMemo(() => {
    if (!selected) return null;
    const meta = (selected.metadata ?? {}) as Record<string, unknown>;
    const metaTotal =
      typeof meta.llm_extraction_ms_total === "number" ? meta.llm_extraction_ms_total : null;
    const metaTurns =
      typeof meta.llm_extraction_turns === "number" ? meta.llm_extraction_turns : null;
    const lastMs = typeof meta.last_llm_latency_ms === "number" ? meta.last_llm_latency_ms : null;
    const model = typeof meta.intake_llm_model === "string" ? meta.intake_llm_model : null;

    const fromEv = sumLlmLatencyFromExtractEvents(events);
    const llmTotalEffective =
      metaTotal != null ? metaTotal : fromEv.totalMs > 0 ? fromEv.totalMs : null;
    const extractionTurns =
      metaTurns != null ? metaTurns : fromEv.turns > 0 ? fromEv.turns : null;

    const avgMs =
      llmTotalEffective != null && extractionTurns != null && extractionTurns > 0
        ? Math.round(llmTotalEffective / extractionTurns)
        : null;

    const startMs = new Date(selected.started_at).getTime();
    const wallAvailable =
      selected.ended_at != null &&
      typeof selected.ended_at === "string" &&
      String(selected.ended_at).trim() !== "";

    const callWallClockMs =
      wallAvailable ? Math.max(0, new Date(selected.ended_at!).getTime() - startMs) : null;

    return {
      wallAvailable,
      llmTotalEffective,
      extractionTurns,
      avgMs,
      callWallClockMs,
      lastMs,
      model,
      fromEvTotal: fromEv.totalMs,
      fromEvTurns: fromEv.turns,
    };
  }, [selected, events]);

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
        <p className="mt-1 text-xs text-zinc-500">Showing counts for the newest {sessions.length} calls loaded.</p>

        <details className="mt-4 rounded-xl border border-black/10 px-3 py-2 dark:border-white/15">
          <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Filter by call status
          </summary>
          <div className="mt-3 space-y-2 border-t border-black/10 pt-3 dark:border-white/15">
            <button
              type="button"
              onClick={() => setIncludedStatuses(new Set([...CALL_STATUSES]))}
              className="text-xs font-medium text-teal-700 underline underline-offset-2 dark:text-teal-400"
            >
              Reset all statuses
            </button>
            {CALL_STATUSES.map((status) => {
              const count = statusCounts.get(status) ?? 0;
              const on = includedStatuses.has(status);
              return (
                <label
                  key={status}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-xs ${
                    on ? "" : "opacity-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="rounded border-black/30 dark:border-white/35"
                    checked={on}
                    onChange={() => toggleStatusInFilter(status)}
                  />
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${callStatusBadgeClass(status)}`}
                  >
                    {callStatusFilterLabel(status)}
                  </span>
                  <span className="ml-auto tabular-nums text-zinc-500">{count}</span>
                </label>
              );
            })}
          </div>
        </details>

        <div className="mt-4 space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">No sessions yet.</p>
          ) : sortedFilteredSessions.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing matches · select more statuses.</p>
          ) : (
            sortedFilteredSessions.map((session, index) => {
              const active = resolvedSelectedId === session.id;
              const startedLabel =
                index < 5
                  ? `Started ${formatStartedRelativeAgo(session.started_at, nowTick)}`
                  : `Started ${formatStartedAbsolute(session.started_at)}`;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedId(session.id)}
                  className={`block w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                    active
                      ? "border-zinc-950 ring-2 ring-zinc-950 dark:border-white dark:ring-white"
                      : "border-black/10 dark:border-white/15"
                  }`}
                >
                  <div className="font-medium">{session.patient_phone ?? session.call_id}</div>
                  <p className="mt-0.5 font-mono text-[11px] leading-snug text-zinc-500 tabular-nums">
                    {startedLabel}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${callStatusBadgeClass(
                        session.status as CallStatus,
                      )}`}
                    >
                      {session.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-[11px] text-zinc-500">{session.current_state}</span>
                  </div>
                  <IntakeFieldsProgressStrip fields={fieldsBySessionId[session.id] ?? []} />
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="min-w-0 flex-1 space-y-8">
        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-black/10 p-8 dark:border-white/15">
            <p className="text-zinc-600 dark:text-zinc-300">No intake sessions recorded yet.</p>
          </div>
        ) : !selected ? (
          <div className="rounded-2xl border border-black/10 p-8 dark:border-white/15">
            <p className="text-zinc-600 dark:text-zinc-300">
              No sessions match the current filter. Select more statuses in the sidebar, or reset the filter.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-black/10 p-6 dark:border-white/15">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">{selected.patient_phone ?? "Unknown caller"}</h2>
                  <p className="text-sm text-zinc-500">{selected.call_id}</p>
                </div>
                <div
                  className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${callStatusBadgeClass(
                    selected.status as CallStatus,
                  )}`}
                >
                  {selected.status.replace(/_/g, " ")}
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

              {timingPanel && (
                <MonitorCollapsible defaultOpen={false} title="Timing & throughput">
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-zinc-500">Call wall time</dt>
                      <dd className="text-zinc-900 dark:text-zinc-100">
                        {timingPanel.wallAvailable && timingPanel.callWallClockMs != null ? (
                          <>
                            <span className="font-mono">{formatMsPretty(timingPanel.callWallClockMs)}</span>
                            <span className="ml-2 text-[11px] text-zinc-500">
                              (started {new Date(selected.started_at).toLocaleString()}
                              {selected.ended_at
                                ? ` → ended ${new Date(selected.ended_at).toLocaleString()}`
                                : ""}
                              )
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-zinc-600 dark:text-zinc-300">
                            Unavailable — call hasn&apos;t completed yet (no ended_at).
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">LLM extraction — total</dt>
                      <dd className="font-mono text-zinc-900 dark:text-zinc-100">
                        {timingPanel.llmTotalEffective != null
                          ? formatMsPretty(timingPanel.llmTotalEffective)
                          : "—"}{" "}
                        <span className="text-[11px] text-zinc-500">
                          {timingPanel.extractionTurns != null ? `· ${timingPanel.extractionTurns} turn(s)` : ""}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">Avg extraction latency / turn</dt>
                      <dd className="font-mono text-zinc-900 dark:text-zinc-100">
                        {timingPanel.avgMs != null ? formatMsPretty(timingPanel.avgMs) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">Last extraction</dt>
                      <dd className="font-mono text-zinc-900 dark:text-zinc-100">
                        {timingPanel.lastMs != null ? formatMsPretty(timingPanel.lastMs) : "—"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2 border-t border-black/10 pt-2 dark:border-white/15">
                      <dt className="text-xs text-zinc-500">Approx. non-LLM time (wall − LLM extraction sum)</dt>
                      <dd className="font-mono text-xs text-zinc-800 dark:text-zinc-200">
                        {timingPanel.wallAvailable &&
                        timingPanel.callWallClockMs != null &&
                        timingPanel.llmTotalEffective != null ? (
                          <>
                            {formatMsPretty(
                              Math.max(0, timingPanel.callWallClockMs - timingPanel.llmTotalEffective),
                            )}{" "}
                            <span className="text-[11px] text-zinc-500">
                              (orchestration, DB, voice platform; rough)
                            </span>
                          </>
                        ) : (
                          <span className="text-sm font-normal text-zinc-600 dark:text-zinc-300">
                            Unavailable — call hasn&apos;t completed yet.
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-zinc-500">Model (from session metadata)</dt>
                      <dd className="font-mono text-xs text-zinc-800 dark:text-zinc-200">
                        {timingPanel.model ?? "—"}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-[11px] text-zinc-500">
                    Totals update on <code className="rounded bg-zinc-200/70 px-1 dark:bg-zinc-800">call_sessions.metadata</code> after each
                    successful extraction. Event rows also store <code className="rounded bg-zinc-200/70 px-1 dark:bg-zinc-800">llm_latency_ms</code>{" "}
                    per turn for cross-checking pipelines (Vapi, alternate models, etc.).
                  </p>
                </MonitorCollapsible>
              )}

              <MonitorCollapsible
                defaultOpen
                title="Intake fields (database)"
                className="mt-6 rounded-xl border border-black/10 bg-white dark:border-white/15 dark:bg-zinc-950/40"
                contentClassName="border-t border-black/10 px-4 pb-4 pt-3 dark:border-white/15"
              >
                <IntakeFieldsDetailPanel fields={selectedFields} />
              </MonitorCollapsible>

              <MonitorCollapsible
                defaultOpen
                title="FSM progress & visit order"
                titleClassName="text-sm font-medium normal-case tracking-normal text-zinc-600 dark:text-zinc-400"
                className="mt-8 rounded-xl border border-black/10 bg-zinc-50/80 dark:border-white/15 dark:bg-zinc-900/40"
                contentClassName="border-t border-black/10 px-4 pb-4 pt-3 dark:border-white/15"
              >
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

                <div className="mt-6 border-t border-black/10 pt-6 dark:border-white/15">
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                    Visit order (each user turn · repeats → same-step / clarification loop)
                  </h4>
                  <p className="break-words rounded-lg border border-black/10 bg-zinc-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-800 dark:border-white/15 dark:bg-zinc-900/80 dark:text-zinc-200">
                    {transcriptPath.length === 0 ? "—" : transcriptPath.join(" → ")}
                  </p>
                </div>
              </MonitorCollapsible>

              <MonitorCollapsible
                defaultOpen
                title="Extractor signals"
                titleClassName="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400"
                className="mt-6 rounded-xl border border-black/10 bg-zinc-50/80 dark:border-white/15 dark:bg-zinc-900/40"
                contentClassName="border-t border-black/10 px-4 pb-4 pt-3 dark:border-white/15"
              >
                <p className="mb-3 text-[11px] text-zinc-500">
                  Interrupts and conditions hit on this call (from extractions).
                </p>
                <div className="flex flex-wrap gap-2">
                  {EXTRACTION_INTERRUPTS.filter((id) => id !== "none").map((id) => {
                    const active = callSignals.interruptHits.has(id);
                    return (
                      <span
                        key={id}
                        title={`${id}: ${INTERRUPT_DISPLAY[id] ?? id}`}
                        className={`rounded-lg border px-2 py-1 text-[11px] ${
                          active
                            ? "border-violet-500 ring-2 ring-violet-500/40 dark:border-violet-400 dark:ring-violet-500/35"
                            : "border-dashed border-black/15 text-zinc-400 dark:border-white/20"
                        }`}
                      >
                        {INTERRUPT_DISPLAY[id] ?? id}
                      </span>
                    );
                  })}
                  {SYNTHETIC_SIGNAL_IDS.map((id) => {
                    const active =
                      (id === "answer_unclear" && callSignals.answerUnclear) ||
                      (id === "low_confidence" && callSignals.lowConfidence) ||
                      (id === "extraction_failed" && callSignals.extractionError);
                    return (
                      <span
                        key={id}
                        className={`rounded-lg border px-2 py-1 text-[11px] ${
                          active
                            ? "border-rose-500 ring-2 ring-rose-400/35 dark:border-rose-400"
                            : "border-dashed border-black/15 text-zinc-400 dark:border-white/20"
                        }`}
                      >
                        {SYNTHETIC_DISPLAY[id]}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-zinc-500">
                  Violet = interrupt flagged on ≥1 extraction. Rose = ambiguous answer, confidence &lt; 0.7, or
                  extractor error. Inactive chips are shown dimmed so you can see everything the model might surface.
                </p>
              </MonitorCollapsible>
            </div>

            <MonitorCollapsible
              defaultOpen={false}
              title={<span className="text-lg font-semibold tracking-tight">Run trace</span>}
              aside={
                eventsLoading ? <span className="text-xs text-zinc-500">Loading events…</span> : undefined
              }
              className="rounded-2xl border border-black/10 bg-white dark:border-white/15 dark:bg-zinc-950/20"
              contentClassName="border-t border-black/10 px-6 pb-6 pt-3 dark:border-white/15"
              triggerClassName="flex w-full items-center justify-between gap-4 rounded-t-2xl px-6 py-6 text-left outline-none hover:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-zinc-400/80 dark:hover:bg-white/[0.05] dark:focus-visible:ring-zinc-500/70 [&[data-state=open]_.monitor-collapse-chevron]:rotate-180"
            >
              {eventsError && (
                <p className="mb-4 text-sm text-red-600 dark:text-red-400">{eventsError}</p>
              )}
              {!eventsLoading && events.length === 0 && !eventsError && (
                <p className="mb-4 text-sm text-zinc-500">No events recorded for this session yet.</p>
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
                      {open && <EventPayloadDetail event={ev} />}
                    </li>
                  );
                })}
              </ol>
            </MonitorCollapsible>
          </>
        )}
      </section>
    </main>
  );
}
