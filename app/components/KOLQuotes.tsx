"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const proofPoints = [
  {
    eyebrow: "Fast acting",
    headline: "Starts working within 5 minutes",
    body: "Clinically studied for rapid absorption—so you don’t need to plan intimacy around a long wait.",
  },
  {
    eyebrow: "Food flexibility",
    headline: "Works even after a large meal",
    body: "Liquid formulation supports buccal and esophageal absorption and isn’t slowed the way traditional pills can be.",
  },
  {
    eyebrow: "Flexible dosing",
    headline: "One bottle, multiple dose options",
    body: "Each pump equals 25 mg, making it easy to find your dose without splitting tablets.",
  },
];

export default function KOLQuotes() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = cardsRef.current?.querySelectorAll(".quote-card");
      if (cards) {
        gsap.from(cards, {
          rotateZ: -2,
          y: 40,
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
      id="partners"
      className="grid-surface relative py-16 md:py-24 overflow-hidden"
    >
      {/* Teal gradient top border */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[rgba(13,183,187,0.3)] to-transparent" />

      <div className="max-w-[1400px] mx-auto px-4 md:px-16">
        <div className="text-center mb-12">
          <p className="font-ibm text-[11px] text-text-secondary uppercase tracking-[0.2em] mb-4">
            Clinically backed
          </p>
          <h2 className="font-dm text-[28px] md:text-[40px] font-semibold text-text-primary">
            Scientifically proven
          </h2>
        </div>

        {/* Desktop grid / mobile horizontal scroll */}
        <div
          ref={cardsRef}
          className="flex gap-6 overflow-x-auto md:overflow-visible md:grid md:grid-cols-3 pb-4 md:pb-0 snap-x snap-mandatory md:snap-none scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {proofPoints.map((point, i) => (
            <div
              key={i}
              className="quote-card relative min-w-[300px] md:min-w-0 overflow-hidden rounded-[1.5rem] border border-[rgba(13,183,187,0.12)] bg-[rgba(6,8,16,0.5)] p-8 card-glow snap-start"
            >
              <div className="relative z-10">
                <p className="font-ibm text-[11px] text-text-secondary uppercase tracking-[0.2em] mb-4">
                  {point.eyebrow}
                </p>
                <h3 className="font-dm text-[20px] md:text-[22px] font-semibold text-text-primary leading-snug mb-4">
                  {point.headline}
                </h3>
                <p className="font-lora text-[15px] md:text-[16px] text-text-secondary leading-[1.7]">
                  {point.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
