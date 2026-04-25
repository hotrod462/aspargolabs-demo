"use client";

import { useEffect, useMemo, useState } from "react";
import Vapi from "@vapi-ai/web";

type CallStatus = "idle" | "connecting" | "in-call" | "ending" | "error";

export function VapiCallButton() {
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? "";
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ?? "";
  const callOutNumber = "+14435589279";
  const callOutHref = `tel:${callOutNumber}`;

  const vapi = useMemo(() => {
    if (!publicKey) return null;
    return new Vapi(publicKey);
  }, [publicKey]);

  const [status, setStatus] = useState<CallStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);

  const canCall = Boolean(vapi && assistantId);

  useEffect(() => {
    if (!vapi) return;

    const onCallStart = () => {
      setLastError(null);
      setStatus("in-call");
    };
    const onCallEnd = () => setStatus("idle");
    const onError = (e: unknown) => {
      const message =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      setLastError(message);
      setStatus("error");
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("error", onError);
    };
  }, [vapi]);

  async function onToggleCall() {
    if (!vapi) return;

    if (status === "in-call" || status === "connecting") {
      setStatus("ending");
      try {
        vapi.stop();
      } catch (e) {
        const message =
          e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
        setLastError(message);
        setStatus("error");
      }
      return;
    }

    if (!assistantId) return;

    setStatus("connecting");
    setLastError(null);
    try {
      await vapi.start(assistantId);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      setLastError(message);
      setStatus("error");
    }
  }

  const label =
    status === "in-call"
      ? "End call"
      : status === "connecting"
        ? "Connecting…"
        : status === "ending"
          ? "Ending…"
          : "Talk to the agent";

  return (
    <div className="flex w-full flex-col items-center gap-3 sm:items-start">
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onToggleCall}
          disabled={!canCall || status === "ending"}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-5 text-base font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 sm:w-[220px]"
        >
          {label}
        </button>

        <div className="flex w-full items-center justify-center gap-2 sm:w-auto sm:justify-start">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">or call on this number</span>
          <a
            href={callOutHref}
            className="inline-flex h-12 items-center justify-center rounded-full border border-solid border-black/10 bg-white px-5 text-base font-medium text-zinc-950 shadow-sm transition-colors hover:border-black/20 hover:bg-zinc-50 dark:border-white/15 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900"
          >
            Call out
          </a>
        </div>
      </div>

      {!canCall ? (
        <p className="max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Set <code className="font-mono">NEXT_PUBLIC_VAPI_PUBLIC_KEY</code> and{" "}
          <code className="font-mono">NEXT_PUBLIC_VAPI_ASSISTANT_ID</code> in{" "}
          <code className="font-mono">.env.local</code> to enable voice.
        </p>
      ) : null}

      {lastError ? (
        <p className="max-w-md text-sm leading-6 text-red-600 dark:text-red-400">
          {lastError}
        </p>
      ) : null}
    </div>
  );
}

