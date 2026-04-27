"use client";

import type { MutableRefObject } from "react";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { PhoneCall, PhoneOff } from "lucide-react";
import Vapi from "@vapi-ai/web";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Speaker = "ALEX" | "PATIENT";
type CallStatus = "idle" | "connecting" | "in-call" | "ending" | "error";
type TranscriptLine = {
  speaker: Speaker;
  text: string;
  displayText: string;
  complete?: boolean;
};
type VapiTranscriptMessage = {
  type?: string;
  role?: string;
  transcript?: string;
  transcriptType?: string;
};
type IntakeFormData = {
  edSymptoms: "yes" | "no";
  usesNitratesOrPoppers: "yes" | "no";
  recentCardioEvent: "yes" | "no";
  chestPainOrShortnessOfBreath: "yes" | "no";
  highBpOrAlphaBlockers: "yes" | "no";
  recentNormalBp: "yes" | "no";
  severeConditions: "yes" | "no";
  penileConditions: "yes" | "no";
  bloodConditions: "yes" | "no";
  hasOtherAllergiesOrMedications: "yes" | "no";
  allergies: string;
  otherMedications: string;
};

const CALL_OUT_NUMBER = "+14435589279";
const CALL_OUT_LABEL = "+1 (443) 558-9279";

/** Soft edge on the particle canvas so pulses do not hard-clip to a rectangle */
const PARTICLE_EDGE_MASK =
  "radial-gradient(ellipse 96% 92% at 50% 50%, #000 40%, #000 56%, rgba(0,0,0,0.62) 72%, rgba(0,0,0,0.22) 85%, transparent 100%)";

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

function normalizeTranscriptMessage(message: unknown) {
  if (!message || typeof message !== "object") return null;

  const transcriptMessage = message as VapiTranscriptMessage;
  if (transcriptMessage.type !== "transcript" || !transcriptMessage.transcript) {
    return null;
  }

  const speaker: Speaker =
    transcriptMessage.role === "assistant" ? "ALEX" : "PATIENT";

  return {
    speaker,
    text: transcriptMessage.transcript.trim(),
    complete: transcriptMessage.transcriptType === "final",
  };
}

function ParticleCloudCanvas({
  active,
  micLevelRef,
}: {
  active: boolean;
  micLevelRef: MutableRefObject<number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ active });

  useEffect(() => {
    stateRef.current = { active };
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;
    let width = 0;
    let height = 0;

    const particles = Array.from({ length: 118 }, (_, i) => ({
      angle: (Math.PI * 2 * i) / 118,
      radius: 46 + Math.random() * 138,
      speed: 0.00085 + Math.random() * 0.0013,
      size: 0.8 + Math.random() * 2.1,
      drift: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      x: 0,
      y: 0,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const { active: isActive } = stateRef.current;
      const mic = Math.min(1, Math.max(0, micLevelRef.current));
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Slow global rotation so the ring paths read as visibly moving
      const turn = time * 0.0022;
      const t = time * 0.00095;

      /**
       * Amplitude is only from the mic while a call is active — not tied to
       * transcript events. Idle call UI uses a calm baseline + tiny mic bleed.
       */
      let speechAmp: number;
      if (isActive) {
        const shaped = 1 - Math.exp(-mic * 3.2);
        speechAmp = Math.min(
          0.98,
          Math.max(0.1, 0.12 + 0.86 * shaped + 0.04 * Math.sin(t))
        );
      } else {
        speechAmp = 0.1 + 0.035 * Math.sin(t);
      }

      const pulse = 0.82 + speechAmp * 0.2;
      const speedMult = isActive ? 0.48 + speechAmp * 0.62 : 0.32;
      const agentColor = "13, 183, 187";
      const accentColor = "245, 248, 250";
      const tt = time * 0.00085;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (let path = 0; path < 4; path++) {
        ctx.beginPath();
        for (let i = 0; i <= 220; i++) {
          const tPath = (i / 220) * Math.PI * 2;
          const wobbleR = 6 + speechAmp * 8;
          const rx =
            118 +
            path * 25 +
            Math.sin(turn * 0.4 + path) * wobbleR;
          const ry = 52 + path * 16;
          const x =
            centerX +
            Math.sin(
              tPath * (2 + path * 0.12) + turn + path * 0.35
            ) *
              rx;
          const y =
            centerY +
            Math.sin(
              tPath * 3 + turn * 0.72 + path * 1.4
            ) *
              ry;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${agentColor}, ${0.04 + path * 0.02})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      particles.forEach((particle, index) => {
        particle.angle += particle.speed * speedMult;

        const abstractT = particle.angle + tt * 0.35 + particle.phase;
        const lineX =
          centerX +
          Math.sin(abstractT * 2.1 + particle.drift) *
            particle.radius *
            1.04 *
            pulse;
        const lineY =
          centerY +
          Math.cos(abstractT * 3.2 + particle.phase) *
            particle.radius *
            0.46 *
            pulse;

        const orbitX =
          centerX +
          Math.cos(
            particle.angle + Math.sin(tt * 0.2 + particle.phase) * 0.65
          ) *
            particle.radius *
            pulse;
        const orbitY =
          centerY +
          Math.sin(particle.angle * 1.38 + particle.phase) *
            particle.radius *
            0.58 *
            pulse;

        const linePull =
          0.2 +
          Math.sin(tt * 0.2 + particle.phase) * 0.08 +
          speechAmp * 0.12;
        particle.x = orbitX * (1 - linePull) + lineX * linePull;
        particle.y = orbitY * (1 - linePull) + lineY * linePull;

        const glow = index % 7 === 0 ? accentColor : agentColor;
        const dotAlpha = 0.16 + speechAmp * 0.38;
        const dotRadius = particle.size * (0.65 + speechAmp * 0.75);
        ctx.beginPath();
        ctx.fillStyle = `rgba(${glow}, ${dotAlpha})`;
        ctx.arc(particle.x, particle.y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j += 3) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 58) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${agentColor}, ${
              (1 - distance / 58) * 0.08 * (0.4 + speechAmp * 0.4)
            })`;
            ctx.lineWidth = 0.65;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      const coreGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        165 + speechAmp * 32
      );
      coreGradient.addColorStop(0, `rgba(${agentColor}, ${0.05 + speechAmp * 0.16})`);
      coreGradient.addColorStop(0.5, `rgba(${agentColor}, ${0.02 + speechAmp * 0.08})`);
      coreGradient.addColorStop(1, "rgba(13, 183, 187, 0)");
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 170 + speechAmp * 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      time += 0.78;
      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, [micLevelRef]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-[200px] sm:h-[240px] md:h-[280px]"
      style={{
        imageRendering: "auto",
        maskImage: PARTICLE_EDGE_MASK,
        WebkitMaskImage: PARTICLE_EDGE_MASK,
      }}
      aria-label="Reactive particle cloud showing conversation voice energy"
    />
  );
}

export default function AIAgentSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  /** Smoothed Vapi volume 0..1, read every frame in the canvas */
  const micLevelRef = useRef(0);
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? "";
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ?? "";
  const vapi = useMemo(() => {
    if (!publicKey) return null;
    return new Vapi(publicKey);
  }, [publicKey]);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [intakeMode, setIntakeMode] = useState<"call" | "form">("call");
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [callTime, setCallTime] = useState(0);
  const [visibleLines, setVisibleLines] = useState<TranscriptLine[]>([]);
  const [formData, setFormData] = useState<IntakeFormData>({
    edSymptoms: "no",
    usesNitratesOrPoppers: "no",
    recentCardioEvent: "no",
    chestPainOrShortnessOfBreath: "no",
    highBpOrAlphaBlockers: "no",
    recentNormalBp: "yes",
    severeConditions: "no",
    penileConditions: "no",
    bloodConditions: "no",
    hasOtherAllergiesOrMedications: "no",
    allergies: "",
    otherMedications: "",
  });
  const transcriptRef = useRef<HTMLDivElement>(null);
  const callActive =
    callStatus === "connecting" ||
    callStatus === "in-call" ||
    callStatus === "ending";
  const canCall = Boolean(vapi && assistantId);

  useEffect(() => {
    if (!callActive) {
      micLevelRef.current = 0;
    }
  }, [callActive]);

  // Call timer
  useEffect(() => {
    if (!callActive) {
      return;
    }

    const interval = setInterval(() => {
      setCallTime((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callActive]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [visibleLines]);

  // GSAP entrance
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(cardRef.current, {
        y: 80,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
        },
      });
    });

    return () => ctx.revert();
  }, []);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const secs = (s % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const resetCallState = useCallback(() => {
    setCallTime(0);
    setVisibleLines([]);
  }, []);

  useEffect(() => {
    if (!vapi) return;

    const onCallStart = () => {
      setLastError(null);
      setCallStatus("in-call");
    };
    const onCallEnd = () => {
      setCallStatus("idle");
      resetCallState();
      micLevelRef.current = 0;
    };
    const onError = (error: unknown) => {
      setLastError(toErrorMessage(error));
      setCallStatus("error");
      micLevelRef.current = 0;
    };
    const onVolumeLevel = (volume: number) => {
      micLevelRef.current = Math.min(1, Math.max(0, volume));
    };
    const onMessage = (message: unknown) => {
      const transcript = normalizeTranscriptMessage(message);
      if (!transcript?.text) return;

      setVisibleLines((prev) => {
        const next = [...prev];
        const lastIndex = next.length - 1;
        const lastLine = next[lastIndex];

        if (lastLine?.speaker === transcript.speaker && !lastLine.complete) {
          next[lastIndex] = {
            speaker: transcript.speaker,
            text: transcript.text,
            displayText: transcript.text,
            complete: transcript.complete,
          };
        } else {
          next.push({
            speaker: transcript.speaker,
            text: transcript.text,
            displayText: transcript.text,
            complete: transcript.complete,
          });
        }

        return next.slice(-10);
      });
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("error", onError);
    vapi.on("volume-level", onVolumeLevel);
    vapi.on("message", onMessage);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("error", onError);
      vapi.off("volume-level", onVolumeLevel);
      vapi.off("message", onMessage);
    };
  }, [resetCallState, vapi]);

  const toggleCall = useCallback(async () => {
    if (callActive && vapi) {
      setCallStatus("ending");
      setLastError(null);
      try {
        vapi.stop();
      } catch (error) {
        setLastError(toErrorMessage(error));
        setCallStatus("error");
      }
      return;
    }

    if (!canCall || !vapi) {
      setLastError(
        "Set NEXT_PUBLIC_VAPI_PUBLIC_KEY and NEXT_PUBLIC_VAPI_ASSISTANT_ID to enable voice."
      );
      setCallStatus("error");
      return;
    }

    resetCallState();
    setLastError(null);
    setCallStatus("connecting");
    try {
      await vapi.start(assistantId);
    } catch (error) {
      setLastError(toErrorMessage(error));
      setCallStatus("error");
      micLevelRef.current = 0;
    }
  }, [assistantId, callActive, canCall, resetCallState, vapi]);

  const statusLabel =
    callStatus === "connecting"
      ? "Connecting..."
      : callStatus === "in-call"
        ? `Connected · ${formatTime(callTime)}`
        : callStatus === "ending"
          ? "Ending..."
          : callStatus === "error"
            ? "Connection error"
            : "Waiting for connection";

  return (
    <section
      ref={sectionRef}
      id="ai-agent"
      className="grid-surface relative py-10 md:py-16 overflow-hidden"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(13,183,187,0.08)_0%,transparent_60%)] blur-[80px] pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[rgba(13,183,187,0.35)] to-transparent" />

      <div className="max-w-[1400px] mx-auto px-4 md:px-16">
        <div className="text-center mb-8 md:mb-10">
          <p className="grid-marker justify-center font-ibm text-[11px] md:text-[12px] text-text-secondary uppercase tracking-[0.2em] mb-4">
            Get Started
          </p>
          <h2 className="font-dm text-[32px] md:text-[48px] lg:text-[56px] font-semibold text-text-primary leading-tight">
            {intakeMode === "call"
              ? "Start Your Consultation."
              : "Complete Your Intake Form."}
          </h2>
          {intakeMode === "call" && (
            <button
              type="button"
              onClick={() => {
                if (callActive && vapi) {
                  vapi.stop();
                }
                setIntakeMode("form");
                setFormMessage(null);
              }}
              className="mt-4 font-ibm text-[12px] text-text-secondary underline decoration-teal/50 underline-offset-2 transition-colors hover:text-text-primary"
            >
              Or fill a form instead
            </button>
          )}
        </div>

        <div
          ref={cardRef}
          className="relative mx-auto max-w-[980px]"
        >
          <div className="relative min-h-[min(400px,72vh)] md:min-h-[min(420px,65vh)] overflow-visible">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(13,183,187,0.1),transparent_50%)] blur-[20px] pointer-events-none" />
            <div className="absolute left-1/2 top-1/2 h-[64%] w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-[rgba(13,183,187,0.1)] to-transparent" />
            <div className="absolute left-1/2 top-1/2 h-px w-[72%] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-[rgba(13,183,187,0.1)] to-transparent" />

            <div className="relative z-10">
              {intakeMode === "call" ? (
                <ParticleCloudCanvas active={callActive} micLevelRef={micLevelRef} />
              ) : (
                <div className="mx-auto flex min-h-[320px] w-full max-w-[780px] items-center justify-center px-2 py-5 sm:px-4">
                  <form
                    className="w-full rounded-[0.8rem] border border-[rgba(13,183,187,0.22)] bg-[rgba(6,8,16,0.7)] p-4 sm:p-6"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      setFormMessage(null);
                      setIsSubmittingForm(true);

                      try {
                        const response = await fetch("/api/intake-form", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(formData),
                        });

                        if (!response.ok) {
                          throw new Error("Failed to submit intake form");
                        }

                        setFormMessage({
                          type: "success",
                          text: "Intake submitted successfully. We will follow up shortly.",
                        });
                      } catch (error) {
                        setFormMessage({
                          type: "error",
                          text:
                            error instanceof Error
                              ? error.message
                              : "Could not submit intake form",
                        });
                      } finally {
                        setIsSubmittingForm(false);
                      }
                    }}
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {[
                        { key: "edSymptoms", label: "Are you experiencing ED symptoms?" },
                        { key: "usesNitratesOrPoppers", label: "Do you use nitrates/poppers?" },
                        { key: "recentCardioEvent", label: "Any recent cardiac event?" },
                        { key: "chestPainOrShortnessOfBreath", label: "Chest pain or shortness of breath?" },
                        { key: "highBpOrAlphaBlockers", label: "High BP or alpha blockers?" },
                        { key: "recentNormalBp", label: "Recent normal blood pressure reading?" },
                        { key: "severeConditions", label: "Any severe medical conditions?" },
                        { key: "penileConditions", label: "Any penile conditions?" },
                        { key: "bloodConditions", label: "Any blood conditions?" },
                      ].map((item) => (
                        <label key={item.key} className="block">
                          <span className="mb-1 block font-ibm text-[11px] uppercase tracking-[0.08em] text-text-secondary">
                            {item.label}
                          </span>
                          <div className="flex items-center gap-2">
                            {(["yes", "no"] as const).map((choice) => (
                              <button
                                key={choice}
                                type="button"
                                onClick={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    [item.key]: choice,
                                  }))
                                }
                                className={`rounded-full border px-4 py-1.5 font-ibm text-[12px] uppercase tracking-[0.08em] transition-all ${
                                  formData[item.key as keyof IntakeFormData] === choice
                                    ? "border-teal/70 bg-teal text-void"
                                    : "border-[rgba(13,183,187,0.26)] bg-[rgba(10,14,24,0.86)] text-text-secondary hover:text-text-primary"
                                }`}
                              >
                                {choice}
                              </button>
                            ))}
                          </div>
                        </label>
                      ))}

                      <label className="block sm:col-span-2">
                        <span className="mb-1 block font-ibm text-[11px] uppercase tracking-[0.08em] text-text-secondary">
                          Do you have other allergies or medications to share?
                        </span>
                        <div className="flex items-center gap-2">
                          {(["yes", "no"] as const).map((choice) => (
                            <button
                              key={`hasOther-${choice}`}
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  hasOtherAllergiesOrMedications: choice,
                                  ...(choice === "no"
                                    ? { allergies: "", otherMedications: "" }
                                    : {}),
                                }))
                              }
                              className={`rounded-full border px-4 py-1.5 font-ibm text-[12px] uppercase tracking-[0.08em] transition-all ${
                                formData.hasOtherAllergiesOrMedications === choice
                                  ? "border-teal/70 bg-teal text-void"
                                  : "border-[rgba(13,183,187,0.26)] bg-[rgba(10,14,24,0.86)] text-text-secondary hover:text-text-primary"
                              }`}
                            >
                              {choice}
                            </button>
                          ))}
                        </div>
                      </label>

                      {formData.hasOtherAllergiesOrMedications === "yes" && (
                        <>
                          <label className="block sm:col-span-2">
                            <span className="mb-1 block font-ibm text-[11px] uppercase tracking-[0.08em] text-text-secondary">
                              Allergies (comma separated)
                            </span>
                            <input
                              type="text"
                              value={formData.allergies}
                              onChange={(e) =>
                                setFormData((prev) => ({ ...prev, allergies: e.target.value }))
                              }
                              className="w-full rounded-[0.5rem] border border-[rgba(13,183,187,0.26)] bg-[rgba(10,14,24,0.86)] px-3 py-2 font-ibm text-[13px] text-text-primary outline-none transition-colors focus:border-teal"
                              placeholder="e.g. Penicillin, Ibuprofen"
                            />
                          </label>

                          <label className="block sm:col-span-2">
                            <span className="mb-1 block font-ibm text-[11px] uppercase tracking-[0.08em] text-text-secondary">
                              Other Medications (comma separated)
                            </span>
                            <input
                              type="text"
                              value={formData.otherMedications}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  otherMedications: e.target.value,
                                }))
                              }
                              className="w-full rounded-[0.5rem] border border-[rgba(13,183,187,0.26)] bg-[rgba(10,14,24,0.86)] px-3 py-2 font-ibm text-[13px] text-text-primary outline-none transition-colors focus:border-teal"
                              placeholder="e.g. Metformin, Atorvastatin"
                            />
                          </label>
                        </>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIntakeMode("call");
                          setFormMessage(null);
                        }}
                        className="font-ibm text-[12px] text-text-secondary transition-colors hover:text-text-primary"
                      >
                        Back to voice call
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingForm}
                        className="rounded-[0.45rem] border border-teal/50 bg-teal px-4 py-2 font-dm text-[14px] font-medium text-void shadow-sm transition-all duration-300 hover:brightness-105 disabled:cursor-wait disabled:opacity-80"
                      >
                        {isSubmittingForm ? "Submitting..." : "Submit Intake"}
                      </button>
                    </div>

                    {formMessage && (
                      <p
                        className={`mt-3 font-ibm text-[11px] ${
                          formMessage.type === "success"
                            ? "text-clinical-green"
                            : "text-warning-amber"
                        }`}
                      >
                        {formMessage.text}
                      </p>
                    )}
                  </form>
                </div>
              )}
            </div>

            {intakeMode === "call" && (
              <div className="absolute bottom-2 left-1/2 z-20 flex w-full max-w-[520px] -translate-x-1/2 flex-col items-center gap-2 px-4 sm:bottom-3">
                <button
                  type="button"
                  onClick={toggleCall}
                  disabled={callStatus === "ending"}
                  className={`flex items-center gap-2 border font-dm text-[14px] sm:text-[15px] font-medium transition-all duration-300 cursor-pointer rounded-[0.45rem] px-6 py-2.5 sm:px-8 sm:py-3 ${
                    callActive
                      ? "border-red-400/40 bg-red-500/90 text-white shadow-sm hover:bg-red-500"
                      : "border border-teal/50 bg-teal text-void shadow-sm hover:scale-[1.02] hover:brightness-105"
                  } disabled:cursor-wait disabled:opacity-80`}
                >
                  {callActive ? (
                    <>
                      <PhoneOff size={18} />
                      {callStatus === "ending" ? "Ending..." : "End Call"}
                    </>
                  ) : (
                    <>
                      <PhoneCall size={18} />
                      Initiate Call
                    </>
                  )}
                </button>

                <p className="font-ibm text-[12px] text-text-secondary">
                  Or dial{" "}
                  <a
                    href={`tel:${CALL_OUT_NUMBER}`}
                    className="text-teal tracking-wider"
                  >
                    {CALL_OUT_LABEL}
                  </a>
                </p>

                <p className="font-ibm text-[12px] text-text-secondary">
                  Call Status:{" "}
                  <span
                    className={
                      callStatus === "error"
                        ? "text-warning-amber"
                        : callActive
                          ? "text-clinical-green"
                          : "text-text-secondary"
                    }
                  >
                    {statusLabel}
                  </span>
                </p>
                {lastError && (
                  <p className="font-ibm text-[10px] text-warning-amber/90 text-center max-w-sm">
                    {lastError}
                  </p>
                )}
              </div>
            )}
          </div>

          {intakeMode === "call" && callActive && (
            <div
              ref={transcriptRef}
              className="relative z-20 mx-auto -mt-4 h-[min(150px,28vh)] max-w-[760px] overflow-y-auto px-4 py-4 [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]"
            >
              <div className="mb-5 flex items-center justify-center gap-4">
                <p className="font-ibm text-[10px] uppercase tracking-[0.22em] text-text-secondary">
                  Live Transcript
                </p>
              </div>

              {visibleLines.length === 0 && (
                <p className="font-ibm text-[12px] text-text-secondary italic">
                  Connecting transcript stream...
                </p>
              )}

              <div className="space-y-3">
                {visibleLines.map((line, i) => (
                  <div
                    key={i}
                    className="font-ibm text-center text-[12px] leading-relaxed"
                  >
                    <span
                      className={
                        line.speaker === "ALEX"
                          ? "text-teal"
                          : "text-text-secondary"
                      }
                    >
                      {line.speaker}:
                    </span>{" "}
                    <span className="text-text-primary">
                      &ldquo;{line.displayText}
                      {i === visibleLines.length - 1 && !line.complete && (
                          <span className="animate-blink-cursor text-teal">
                            |
                          </span>
                        )}
                      &rdquo;
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
