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

type EdFrequencyAnswer = "" | "almost_never" | "sometimes" | "often" | "almost_every_time";
type RiskAnswer = "" | "yes" | "no";
type ChestSymptomsAnswer = "" | "no" | "mild_on_exertion" | "frequent_or_severe";
type HighBpAnswer = "" | "no" | "yes_controlled_or_alpha_blocker" | "yes_uncontrolled";
type RecentNormalBpAnswer = "" | "normal" | "low" | "high";
type OtherDetailsAnswer = "" | "yes" | "no";

type IntakeFormData = {
  edSymptoms: EdFrequencyAnswer;
  usesNitratesOrPoppers: RiskAnswer;
  recentCardioEvent: RiskAnswer;
  chestPainOrShortnessOfBreath: ChestSymptomsAnswer;
  highBpOrAlphaBlockers: HighBpAnswer;
  recentNormalBp: RecentNormalBpAnswer;
  severeConditions: RiskAnswer;
  penileConditions: RiskAnswer;
  bloodConditions: RiskAnswer;
  hasOtherAllergiesOrMedications: OtherDetailsAnswer;
  allergies: string[];
  otherMedications: string[];
};

type QuestionKind = "binary" | "multi" | "multi_select";
type FormQuestion = {
  id: keyof IntakeFormData;
  section: "Safety" | "Cardiovascular" | "Medical History" | "Allergies & Medications";
  label: string;
  helperText: string;
  required: boolean;
  kind: QuestionKind;
  options?: Array<{ value: string; label: string }>;
  showWhen?: (data: IntakeFormData) => boolean;
};

const CALL_OUT_NUMBER = "+14435589279";
const CALL_OUT_LABEL = "+1 (443) 558-9279";
const SHOW_LIVE_TRANSCRIPT = false;
const INITIAL_FORM_DATA: IntakeFormData = {
  edSymptoms: "",
  usesNitratesOrPoppers: "",
  recentCardioEvent: "",
  chestPainOrShortnessOfBreath: "",
  highBpOrAlphaBlockers: "",
  recentNormalBp: "",
  severeConditions: "",
  penileConditions: "",
  bloodConditions: "",
  hasOtherAllergiesOrMedications: "",
  allergies: [],
  otherMedications: [],
};

const FORM_QUESTIONS: FormQuestion[] = [
  {
    id: "edSymptoms",
    section: "Safety",
    kind: "multi",
    required: true,
    label: "How often do you experience difficulty getting or maintaining an erection?",
    helperText: "Select the option that best matches your recent experience.",
    options: [
      { value: "almost_never", label: "Almost never - it's occasional" },
      { value: "sometimes", label: "Sometimes - it happens more than I'd like" },
      { value: "often", label: "Often - it's becoming a real issue" },
      { value: "almost_every_time", label: "Almost every time" },
    ],
  },
  {
    id: "usesNitratesOrPoppers",
    section: "Safety",
    kind: "binary",
    required: true,
    label:
      "Are you currently taking nitrates (such as nitroglycerin for chest pain) or using recreational poppers?",
    helperText: "Mixing nitrates with sildenafil can cause a dangerous blood pressure drop.",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "recentCardioEvent",
    section: "Cardiovascular",
    kind: "multi",
    required: true,
    label: "In the past 6 months, have you had a heart attack, stroke, or heart surgery?",
    helperText: "Recent cardiovascular events require additional clinical review.",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "chestPainOrShortnessOfBreath",
    section: "Cardiovascular",
    kind: "multi",
    required: true,
    label:
      "Do you get chest pain or severe shortness of breath with light activity (for example, climbing two flights of stairs)?",
    helperText: "This checks for exertional symptoms that can impact treatment safety.",
    options: [
      { value: "no", label: "No symptoms with light activity" },
      { value: "mild_on_exertion", label: "Mild symptoms only with exertion" },
      { value: "frequent_or_severe", label: "Frequent or severe symptoms" },
    ],
  },
  {
    id: "highBpOrAlphaBlockers",
    section: "Cardiovascular",
    kind: "multi",
    required: true,
    label:
      "Do you have uncontrolled high blood pressure, or do you take alpha-blockers such as Flomax (tamsulosin)?",
    helperText: "Some blood pressure and prostate medications can interact with treatment.",
    options: [
      { value: "no", label: "No" },
      { value: "yes_controlled_or_alpha_blocker", label: "Yes, controlled BP or on alpha-blocker" },
      { value: "yes_uncontrolled", label: "Yes, uncontrolled high blood pressure" },
    ],
  },
  {
    id: "recentNormalBp",
    section: "Cardiovascular",
    kind: "multi",
    required: true,
    label: "What best describes your most recent blood pressure check?",
    helperText: "Choose the option that best matches your latest BP reading status.",
    options: [
      { value: "normal", label: "Normal" },
      { value: "low", label: "Low" },
      { value: "high", label: "High" },
    ],
  },
  {
    id: "severeConditions",
    section: "Medical History",
    kind: "binary",
    required: true,
    label:
      "Have you been diagnosed with severe liver or kidney disease, a bleeding disorder, active stomach ulcers, or NAION?",
    helperText: "These conditions can change medication suitability and dosing decisions.",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "penileConditions",
    section: "Medical History",
    kind: "binary",
    required: true,
    label:
      "Have you ever had an erection lasting over 4 hours, or a condition affecting penile shape such as Peyronie's disease?",
    helperText: "This helps the clinician assess treatment risk.",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "bloodConditions",
    section: "Medical History",
    kind: "binary",
    required: true,
    label: "Do you have a blood condition such as sickle cell anemia, multiple myeloma, or leukemia?",
    helperText: "These conditions may require a different treatment approach.",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "hasOtherAllergiesOrMedications",
    section: "Allergies & Medications",
    kind: "binary",
    required: true,
    label: "Do you have any allergies or daily medications/supplements we should add for doctor review?",
    helperText: "Include prescription meds, OTC medicines, and supplements when possible.",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "allergies",
    section: "Allergies & Medications",
    kind: "multi_select",
    required: true,
    label: "Which applies to allergies?",
    helperText: "Select one or more options.",
    options: [
      { value: "none", label: "No known drug allergies" },
      { value: "sildenafil", label: "Allergy to sildenafil" },
      { value: "other_medication_allergies", label: "Other medication allergies" },
      { value: "prefer_discuss", label: "Prefer to discuss with clinician" },
    ],
    showWhen: (data) => data.hasOtherAllergiesOrMedications === "yes",
  },
  {
    id: "otherMedications",
    section: "Allergies & Medications",
    kind: "multi_select",
    required: true,
    label: "Which do you currently take?",
    helperText: "Select all that apply.",
    options: [
      { value: "none", label: "None" },
      { value: "blood_pressure_medications", label: "Blood pressure medications" },
      { value: "alpha_blockers", label: "Alpha-blockers" },
      { value: "nitrates", label: "Nitrates" },
      { value: "diabetes_medications", label: "Diabetes medications" },
      { value: "antidepressants", label: "Antidepressants" },
      { value: "daily_supplements", label: "Daily supplements" },
      { value: "other_prescription_medications", label: "Other prescription medications" },
    ],
    showWhen: (data) => data.hasOtherAllergiesOrMedications === "yes",
  },
];

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
  const [formData, setFormData] = useState<IntakeFormData>(INITIAL_FORM_DATA);
  const [formStep, setFormStep] = useState(0);
  const [formTouched, setFormTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const callActive =
    callStatus === "connecting" ||
    callStatus === "in-call" ||
    callStatus === "ending";
  const canCall = Boolean(vapi && assistantId);
  const visibleQuestions = useMemo(
    () => FORM_QUESTIONS.filter((question) => !question.showWhen || question.showWhen(formData)),
    [formData],
  );
  const safeFormStep = Math.min(formStep, Math.max(visibleQuestions.length - 1, 0));
  const progressPct = Math.round(((safeFormStep + 1) / Math.max(visibleQuestions.length, 1)) * 100);
  const currentQuestion = visibleQuestions[safeFormStep];

  const getQuestionError = useCallback(
    (question: FormQuestion) => {
      const value = formData[question.id];
      if (!question.required) return null;
      if (question.kind === "multi_select") {
        return Array.isArray(value) && value.length > 0
          ? null
          : "Please select at least one option before continuing.";
      }
      return typeof value === "string" && value ? null : "Please choose one option to continue.";
    },
    [formData],
  );

  const isCurrentQuestionInvalid = currentQuestion ? Boolean(getQuestionError(currentQuestion)) : false;
  const isQuestionVisibleError = (question: FormQuestion) =>
    Boolean(getQuestionError(question)) && (submitAttempted || formTouched[question.id]);

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
                setFormStep(0);
                setFormTouched({});
                setSubmitAttempted(false);
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
                <div className="mx-auto flex min-h-[320px] w-full max-w-[860px] items-center justify-center px-2 py-5 sm:px-4">
                  <form
                    className="w-full rounded-[0.8rem] border border-[rgba(13,183,187,0.22)] bg-[rgba(6,8,16,0.78)] p-4 sm:p-6"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      setSubmitAttempted(true);
                      setFormMessage(null);

                      const firstInvalidIndex = visibleQuestions.findIndex((question) =>
                        Boolean(getQuestionError(question)),
                      );
                      if (firstInvalidIndex !== -1) {
                        setFormStep(firstInvalidIndex);
                        return;
                      }

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
                        setFormData(INITIAL_FORM_DATA);
                        setFormStep(0);
                        setFormTouched({});
                        setSubmitAttempted(false);
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
                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between font-ibm text-[11px] uppercase tracking-[0.08em] text-text-secondary">
                        <span>
                          Step {Math.min(safeFormStep + 1, visibleQuestions.length)} of {visibleQuestions.length}
                        </span>
                        <span>{progressPct}% complete</span>
                      </div>
                      <div className="h-2 rounded-full bg-[rgba(13,183,187,0.12)]">
                        <div
                          className="h-full rounded-full bg-teal transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {currentQuestion && (
                      <div className="rounded-[0.7rem] border border-[rgba(13,183,187,0.2)] bg-[rgba(8,12,22,0.76)] p-4 sm:p-5">
                        <p className="font-ibm text-[10px] uppercase tracking-[0.14em] text-teal/90">
                          {currentQuestion.section}
                        </p>
                        <h3 className="mt-2 font-dm text-[20px] leading-tight text-text-primary">
                          {currentQuestion.label}
                        </h3>
                        <p className="mt-2 font-ibm text-[12px] text-text-secondary">
                          {currentQuestion.helperText}
                        </p>

                        {(currentQuestion.kind === "binary" || currentQuestion.kind === "multi") && (
                          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {currentQuestion.options?.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setFormTouched((prev) => ({ ...prev, [currentQuestion.id]: true }));
                                  setFormData((prev) => {
                                    const next = {
                                      ...prev,
                                      [currentQuestion.id]: option.value,
                                    } as IntakeFormData;
                                    if (
                                      currentQuestion.id === "hasOtherAllergiesOrMedications" &&
                                      option.value === "no"
                                    ) {
                                      next.allergies = [];
                                      next.otherMedications = [];
                                    }
                                    return next;
                                  });
                                }}
                                className={`rounded-[0.5rem] border px-3 py-3 text-left font-ibm text-[12px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/70 ${
                                  formData[currentQuestion.id] === option.value
                                    ? "border-teal/70 bg-[rgba(13,183,187,0.22)] text-text-primary"
                                    : "border-[rgba(13,183,187,0.26)] bg-[rgba(10,14,24,0.86)] text-text-secondary hover:border-teal/55 hover:text-text-primary"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {currentQuestion.kind === "multi_select" && (
                          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {currentQuestion.options?.map((option) => {
                              const selected = (formData[currentQuestion.id] as string[]).includes(option.value);
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    setFormTouched((prev) => ({ ...prev, [currentQuestion.id]: true }));
                                    setFormData((prev) => {
                                      const current = [...(prev[currentQuestion.id] as string[])];
                                      let nextValues: string[];
                                      if (option.value === "none") {
                                        nextValues = selected ? [] : ["none"];
                                      } else {
                                        const withoutNone = current.filter((v) => v !== "none");
                                        nextValues = selected
                                          ? withoutNone.filter((v) => v !== option.value)
                                          : [...withoutNone, option.value];
                                      }
                                      return {
                                        ...prev,
                                        [currentQuestion.id]: nextValues,
                                      };
                                    });
                                  }}
                                  className={`rounded-[0.5rem] border px-3 py-3 text-left font-ibm text-[12px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/70 ${
                                    selected
                                      ? "border-teal/70 bg-[rgba(13,183,187,0.22)] text-text-primary"
                                      : "border-[rgba(13,183,187,0.26)] bg-[rgba(10,14,24,0.86)] text-text-secondary hover:border-teal/55 hover:text-text-primary"
                                  }`}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {isQuestionVisibleError(currentQuestion) && (
                          <p className="mt-3 font-ibm text-[11px] text-warning-amber">
                            {getQuestionError(currentQuestion)}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-3 rounded-[0.6rem] border border-[rgba(13,183,187,0.16)] bg-[rgba(10,14,22,0.6)] px-3 py-2">
                      <p className="font-ibm text-[11px] text-text-secondary">
                        This secure intake is reviewed by a licensed clinician. Please answer as accurately as possible.
                      </p>
                    </div>

                    <div className="sticky bottom-0 mt-4 flex items-center justify-between gap-3 rounded-[0.6rem] border border-[rgba(13,183,187,0.2)] bg-[rgba(6,8,16,0.92)] px-3 py-3 backdrop-blur">
                      <button
                        type="button"
                        onClick={() => {
                          if (safeFormStep === 0) {
                            setIntakeMode("call");
                            setFormMessage(null);
                            return;
                          }
                          setFormStep((prev) => Math.max(0, Math.min(prev, Math.max(visibleQuestions.length - 1, 0)) - 1));
                        }}
                        className="font-ibm text-[12px] text-text-secondary transition-colors hover:text-text-primary"
                      >
                        {safeFormStep === 0 ? "Back to voice call" : "Back"}
                      </button>

                      <div className="flex items-center gap-2">
                        {safeFormStep < visibleQuestions.length - 1 ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (!currentQuestion) return;
                              setFormTouched((prev) => ({ ...prev, [currentQuestion.id]: true }));
                              if (isCurrentQuestionInvalid) return;
                              setFormStep((prev) => Math.min(visibleQuestions.length - 1, prev + 1));
                            }}
                            className="rounded-[0.45rem] border border-teal/50 bg-teal px-4 py-2 font-dm text-[14px] font-medium text-void shadow-sm transition-all duration-300 hover:brightness-105"
                          >
                            Continue
                          </button>
                        ) : (
                          <button
                            type="submit"
                            disabled={isSubmittingForm}
                            className="rounded-[0.45rem] border border-teal/50 bg-teal px-4 py-2 font-dm text-[14px] font-medium text-void shadow-sm transition-all duration-300 hover:brightness-105 disabled:cursor-wait disabled:opacity-80"
                          >
                            {isSubmittingForm ? "Submitting..." : "Submit Intake"}
                          </button>
                        )}
                      </div>
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

          {SHOW_LIVE_TRANSCRIPT && intakeMode === "call" && callActive && (
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
