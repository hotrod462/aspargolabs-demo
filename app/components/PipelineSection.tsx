"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const pipelineItems = [
  {
    title: "HEZKUE® / BANDOL®",
    badge: "Available Now",
    badgeColor: "bg-teal text-void",
    description: "Sildenafil oral suspension — the world's first spray-delivered ED treatment.",
    markets: "US · UK · EU · Spain",
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="20"
          cy="20"
          r="8"
          stroke="#0DB7BB"
          strokeWidth="1.5"
          fill="none"
        />
        <circle
          cx="20"
          cy="20"
          r="3"
          fill="#0DB7BB"
          opacity="0.6"
        />
        <line
          x1="20"
          y1="8"
          x2="20"
          y2="4"
          stroke="#0DB7BB"
          strokeWidth="1.5"
        />
        <line
          x1="28"
          y1="20"
          x2="32"
          y2="20"
          stroke="#0DB7BB"
          strokeWidth="1.5"
        />
        <line
          x1="20"
          y1="32"
          x2="20"
          y2="36"
          stroke="#0DB7BB"
          strokeWidth="1.5"
        />
        <line
          x1="12"
          y1="20"
          x2="8"
          y2="20"
          stroke="#0DB7BB"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    title: "Rx Pipeline",
    badge: "In Development",
    badgeColor: "bg-warning-amber text-void",
    description:
      "Multiple prescription compounds converting to oral suspension format. Expanding the platform beyond urology.",
    markets: "Multiple therapeutic areas",
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M16 8h8v4l4 6v14a2 2 0 01-2 2H14a2 2 0 01-2-2V18l4-6V8z"
          stroke="#0DB7BB"
          strokeWidth="1.5"
          fill="none"
        />
        <line
          x1="14"
          y1="24"
          x2="26"
          y2="24"
          stroke="#0DB7BB"
          strokeWidth="1"
          opacity="0.5"
        />
        <circle cx="18" cy="28" r="1.5" fill="#0DB7BB" opacity="0.4" />
        <circle cx="22" cy="27" r="1" fill="#0DB7BB" opacity="0.3" />
      </svg>
    ),
  },
  {
    title: "OTC Pipeline",
    badge: "Coming Soon",
    badgeColor: "bg-[rgba(138,155,168,0.3)] text-text-secondary",
    description:
      "Over-the-counter products targeting broader accessibility. Making precision delivery available without a prescription.",
    markets: "Consumer health",
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="10"
          y="12"
          width="20"
          height="18"
          rx="3"
          stroke="#0DB7BB"
          strokeWidth="1.5"
          fill="none"
        />
        <line
          x1="10"
          y1="18"
          x2="30"
          y2="18"
          stroke="#0DB7BB"
          strokeWidth="1"
          opacity="0.5"
        />
        <path
          d="M16 8h8v4H16z"
          stroke="#0DB7BB"
          strokeWidth="1.5"
          fill="none"
        />
        <line
          x1="20"
          y1="22"
          x2="20"
          y2="26"
          stroke="#0DB7BB"
          strokeWidth="1.5"
        />
        <line
          x1="18"
          y1="24"
          x2="22"
          y2="24"
          stroke="#0DB7BB"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
];

export default function PipelineSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = cardsRef.current?.querySelectorAll(".pipeline-card");
      if (cards) {
        gsap.from(cards, {
          y: 60,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.14,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
          },
        });
      }
    });

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="pipeline"
      className="relative bg-mist py-16 md:py-24 min-h-0 overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none [background-image:linear-gradient(rgba(17,24,32,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(17,24,32,0.04)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_80%_75%_at_50%_50%,#000_0%,#000_28%,hsla(0,0%,0%,0.2)_60%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_80%_75%_at_50%_50%,#000_0%,#000_28%,hsla(0,0%,0%,0.2)_60%,transparent_100%)]"
      />
      <div className="max-w-[1400px] mx-auto px-4 md:px-16 relative z-10">
        {/* Header */}
        <div className="relative z-10 mb-12 md:mb-16">
          <p className="grid-marker font-ibm text-[11px] uppercase tracking-[0.2em] text-[rgba(17,24,32,0.48)] mb-4">
            What&apos;s Coming
          </p>
          <h2 className="font-dm text-[28px] md:text-[40px] font-semibold text-text-dark">
            The Pipeline
          </h2>
          <p className="font-lora text-[16px] md:text-[18px] text-[rgba(17,24,32,0.6)] mt-3 max-w-[600px] leading-[1.7]">
            HEZKUE® is the first. The platform extends to every medication that
            deserves better delivery.
          </p>
        </div>

        {/* Cards grid */}
        <div
          ref={cardsRef}
          className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {pipelineItems.map((item) => (
            <div
              key={item.title}
              className="pipeline-card grid-panel-light p-8 border-t-2 border-t-teal card-glow transition-shadow duration-300"
            >
              <div className="mb-6">{item.icon}</div>

              <div className="flex items-center gap-3 mb-4">
                <h3 className="font-dm text-[20px] font-semibold text-text-dark">
                  {item.title}
                </h3>
                <span
                  className={`font-ibm text-[10px] uppercase tracking-wider px-3 py-1 rounded-[3rem] ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              </div>

              <p className="font-lora text-[15px] text-[rgba(17,24,32,0.6)] leading-[1.7] mb-4">
                {item.description}
              </p>

              <p className="font-ibm text-[11px] text-text-secondary uppercase tracking-wider">
                {item.markets}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
