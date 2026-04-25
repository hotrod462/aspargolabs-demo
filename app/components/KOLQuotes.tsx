"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const quotes = [
  {
    text: "The rapid absorption profile of HEZKUE® represents a meaningful clinical advance. We're seeing plasma concentrations within five minutes that simply aren't possible with oral tablets.",
    name: "Jesse Ory, MD",
    title: "Urology · University of Miami Miller School of Medicine",
  },
  {
    text: "For patients who struggle with the rigidity of pill-based timing, the spray format fundamentally changes the therapeutic conversation. It restores spontaneity to treatment.",
    name: "Hossein Mirheydar, MD",
    title: "Urology · Kaiser Permanente",
  },
  {
    text: "The pharmacokinetic data is compelling. Bioequivalence with a five-minute onset window opens treatment pathways that we've been unable to offer before now.",
    name: "Dr. Laurence A. Levine, MD",
    title: "Urology · Rush University Medical Center",
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
            Voices from the Field
          </p>
          <h2 className="font-dm text-[28px] md:text-[40px] font-semibold text-text-primary">
            What physicians are saying
          </h2>
        </div>

        {/* Desktop grid / mobile horizontal scroll */}
        <div
          ref={cardsRef}
          className="flex gap-6 overflow-x-auto md:overflow-visible md:grid md:grid-cols-3 pb-4 md:pb-0 snap-x snap-mandatory md:snap-none scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {quotes.map((quote, i) => (
            <div
              key={i}
              className="quote-card relative min-w-[300px] md:min-w-0 overflow-hidden rounded-[1.5rem] border border-[rgba(13,183,187,0.12)] bg-[rgba(6,8,16,0.5)] p-8 card-glow snap-start"
            >
              {/* Big quotation mark */}
              <span className="absolute top-4 left-6 font-instrument text-[100px] md:text-[120px] text-teal opacity-20 leading-none select-none">
                &ldquo;
              </span>

              <div className="relative z-10 pt-12">
                <p className="font-lora text-[16px] md:text-[18px] text-text-primary leading-[1.7] mb-8">
                  {quote.text}
                </p>
                <div>
                  <p className="font-ibm text-[12px] text-text-primary">
                    {quote.name}
                  </p>
                  <p className="font-ibm text-[11px] text-text-secondary mt-1">
                    {quote.title}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
