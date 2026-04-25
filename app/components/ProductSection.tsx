"use client";

import { useEffect, useRef, useState } from "react";
import { Zap, Target, Droplets } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: Zap,
    title: "5-Minute Absorption",
    description:
      "Initial plasma concentration detected at T+5:00. Viagra® tablets showed zero absorption at the same interval.",
  },
  {
    icon: Target,
    title: "Precision Dosing",
    description:
      "Each pump delivers a calibrated sildenafil dose. Titrate without breaking pills. Designed for your pharmacology, not a population average.",
  },
  {
    icon: Droplets,
    title: "No Pill. No Water. No Planning.",
    description:
      "Discreet. Pocket-sized. Mint-suspension formula. HEZKUE® removes every barrier between prescription and possibility.",
  },
];

function BottleVisualization() {
  return (
    <div className="relative flex h-[400px] md:h-[500px] w-full max-w-[200px] md:max-w-[220px] mx-auto items-center justify-center">
      {/* Teal glow behind bottle */}
      <div className="absolute w-[300px] h-[300px] bg-[radial-gradient(circle,rgba(13,183,187,0.12)_0%,transparent_70%)] blur-[60px]" />

      {/* Ambient suspension: slow rise + drift, not circular “orbit” (outside bottle tilt) */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-visible"
        aria-hidden
      >
        <div
          className="absolute h-1.5 w-1.5 rounded-full bg-teal/35 blur-[1.5px]"
          style={{
            left: "8%",
            top: "52%",
            animation: "susp-drift-1 14s ease-in-out infinite",
          }}
        />
        <div
          className="absolute h-1 w-1 rounded-full bg-teal/25 blur-[1px]"
          style={{
            right: "4%",
            top: "38%",
            animation: "susp-drift-2 18s ease-in-out infinite 2s",
          }}
        />
        <div
          className="absolute h-[5px] w-[5px] rounded-full bg-teal/20 blur-sm"
          style={{
            left: "22%",
            top: "68%",
            animation: "susp-drift-3 20s ease-in-out infinite 4s",
          }}
        />
        <div
          className="absolute h-1.5 w-1.5 rounded-full bg-white/20 blur-[1.5px]"
          style={{
            right: "18%",
            top: "62%",
            animation: "susp-drift-2 16s ease-in-out infinite 1.5s",
          }}
        />
        <div
          className="absolute h-1 w-1 rounded-full bg-teal/30"
          style={{
            left: "50%",
            top: "75%",
            transform: "translateX(-50%)",
            animation: "susp-drift-1 19s ease-in-out infinite 6s",
          }}
        />
        {/* Faint field lines — vertical, very slow parallax feel */}
        <div
          className="absolute left-[18%] top-[22%] h-[42%] w-px bg-gradient-to-b from-transparent via-teal/20 to-transparent opacity-40"
          style={{ animation: "field-line 22s ease-in-out infinite" }}
        />
        <div
          className="absolute right-[16%] top-[30%] h-[38%] w-px bg-gradient-to-b from-transparent via-teal/15 to-transparent opacity-30"
          style={{ animation: "field-line 26s ease-in-out infinite 3s" }}
        />
      </div>

      {/* Bottle only — gentle Y tilt (no full spin that fights particle motion) */}
      <div
        className="relative z-10"
        style={{
          perspective: "800px",
        }}
      >
        <div
          style={{
            animation: "bottle-rotate 7s ease-in-out infinite",
            transformStyle: "preserve-3d",
          }}
        >
        <svg
          width="120"
          height="320"
          viewBox="0 0 120 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_0_40px_rgba(13,183,187,0.2)]"
        >
          {/* Bottle body - dark glass */}
          <defs>
            <linearGradient id="bottleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0a0f15" />
              <stop offset="30%" stopColor="#1a2030" />
              <stop offset="50%" stopColor="#252d3d" />
              <stop offset="70%" stopColor="#1a2030" />
              <stop offset="100%" stopColor="#0a0f15" />
            </linearGradient>
            <linearGradient id="capGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#089a9e" />
              <stop offset="50%" stopColor="#0DB7BB" />
              <stop offset="100%" stopColor="#089a9e" />
            </linearGradient>
            <linearGradient
              id="liquidGrad"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="rgba(13,183,187,0.3)" />
              <stop offset="100%" stopColor="rgba(13,183,187,0.05)" />
            </linearGradient>
          </defs>

          {/* Cap / pump head */}
          <rect
            x="35"
            y="10"
            width="50"
            height="25"
            rx="6"
            fill="url(#capGrad)"
          />
          <rect x="45" y="0" width="30" height="14" rx="4" fill="#0DB7BB" />

          {/* Neck */}
          <rect x="42" y="35" width="36" height="20" rx="3" fill="#1a2030" />

          {/* Body */}
          <rect
            x="20"
            y="55"
            width="80"
            height="240"
            rx="12"
            fill="url(#bottleGrad)"
            stroke="rgba(13,183,187,0.15)"
            strokeWidth="1"
          />

          {/* Liquid fill */}
          <rect
            x="24"
            y="140"
            width="72"
            height="151"
            rx="10"
            fill="url(#liquidGrad)"
          />

          {/* Label area */}
          <rect
            x="30"
            y="100"
            width="60"
            height="80"
            rx="4"
            fill="rgba(13,183,187,0.04)"
            stroke="rgba(13,183,187,0.1)"
            strokeWidth="0.5"
          />
          <text
            x="60"
            y="130"
            textAnchor="middle"
            fill="rgba(13,183,187,0.5)"
            fontSize="8"
            fontFamily="monospace"
          >
            HEZKUE®
          </text>
          <text
            x="60"
            y="145"
            textAnchor="middle"
            fill="rgba(13,183,187,0.3)"
            fontSize="6"
            fontFamily="monospace"
          >
            sildenafil
          </text>
          <text
            x="60"
            y="155"
            textAnchor="middle"
            fill="rgba(13,183,187,0.3)"
            fontSize="6"
            fontFamily="monospace"
          >
            oral suspension
          </text>

          {/* Glass reflection */}
          <rect
            x="28"
            y="60"
            width="8"
            height="180"
            rx="4"
            fill="rgba(255,255,255,0.04)"
          />

          {/* Bottom */}
          <rect
            x="20"
            y="289"
            width="80"
            height="6"
            rx="3"
            fill="#0a0f15"
          />
        </svg>
        </div>
      </div>

      <style jsx>{`
        @keyframes bottle-rotate {
          0%,
          100% {
            transform: rotateY(-5deg);
          }
          50% {
            transform: rotateY(5deg);
          }
        }
        @keyframes susp-drift-1 {
          0%,
          100% {
            transform: translate(0, 0) scale(0.9);
            opacity: 0.2;
          }
          25% {
            transform: translate(3px, -32px) scale(1.05);
            opacity: 0.45;
          }
          55% {
            transform: translate(-2px, -64px) scale(1);
            opacity: 0.35;
          }
          80% {
            transform: translate(4px, -28px) scale(0.95);
            opacity: 0.25;
          }
        }
        @keyframes susp-drift-2 {
          0%,
          100% {
            transform: translate(0, 0);
            opacity: 0.15;
          }
          40% {
            transform: translate(-6px, -48px);
            opacity: 0.4;
          }
          70% {
            transform: translate(2px, -20px);
            opacity: 0.28;
          }
        }
        @keyframes susp-drift-3 {
          0%,
          100% {
            transform: translate(0, 0) scale(0.85);
            opacity: 0.1;
          }
          30% {
            transform: translate(2px, -18px) scale(1.1);
            opacity: 0.25;
          }
          60% {
            transform: translate(-3px, -40px) scale(1);
            opacity: 0.2;
          }
        }
        @keyframes field-line {
          0%,
          100% {
            transform: scaleY(1) translateY(0);
            opacity: 0.2;
          }
          50% {
            transform: scaleY(1.06) translateY(-4px);
            opacity: 0.35;
          }
        }
      `}</style>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="grid-panel relative py-6 px-5 cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex gap-4 items-start">
        <div className="shrink-0 mt-1">
          <Icon size={22} className="text-teal" />
        </div>
        <div>
          <h3 className="font-dm text-[18px] md:text-[20px] font-semibold text-text-primary mb-2">
            {title}
          </h3>
          <p className="font-lora text-[15px] md:text-[16px] text-text-secondary leading-[1.7]">
            {description}
          </p>
        </div>
      </div>
      {/* Hover rule */}
      <div
        className="absolute bottom-0 left-0 h-[1px] bg-teal transition-transform duration-500 ease-out origin-left"
        style={{
          width: "100%",
          transform: hovered ? "scaleX(1)" : "scaleX(0)",
        }}
      />
    </div>
  );
}

export default function ProductSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(contentRef.current, {
        y: 60,
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

  return (
    <section ref={sectionRef} id="product" className="grid-surface relative py-12 md:py-24 overflow-hidden">
      {/* Background Image - pharma_suspension_particles.png */}
      <div className="absolute inset-0 opacity-[0.1] pointer-events-none">
        <Image
          src="/images/pharma_suspension_particles.png"
          alt="Microscopic suspension particles"
          fill
          className="object-cover"
        />
        {/* Grain Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.3] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-void via-transparent to-void" />
      </div>

      {/* Teal glow */}
      <div className="teal-glow top-[10%] -left-[300px] opacity-[0.06]" />

      <div
        ref={contentRef}
        className="max-w-[1400px] mx-auto px-4 md:px-16"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left - Bottle */}
          <BottleVisualization />

          {/* Right - Features */}
          <div className="space-y-3">
            {features.map((feature) => (
              <FeatureRow key={feature.title} {...feature} />
            ))}
          </div>
        </div>

        {/* Clinically Proven Band */}
        <div className="grid-panel mt-16 md:mt-24 px-6 md:px-12 py-6 md:py-8 text-center">
          <p className="font-ibm text-[11px] md:text-[13px] text-text-secondary leading-relaxed">
            <span className="text-text-primary">
              Pharmacokinetic Study
            </span>{" "}
            · 56 Healthy Male Volunteers · Open-Label Crossover · 2024
            <span className="text-teal mx-3">|</span>
            HEZKUE® is bioequivalent to sildenafil tablets (AUC
            <sub>last</sub>, AUC<sub>∞</sub>)
          </p>
        </div>
      </div>
    </section>
  );
}
