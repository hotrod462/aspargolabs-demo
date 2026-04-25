"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";

gsap.registerPlugin(ScrollTrigger);

export default function ManifestoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const wordsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Parallax image
      const bg = sectionRef.current?.querySelector(".manifesto-bg");
      if (bg) {
        gsap.to(bg, {
          y: -80,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      // Word reveal
      const words = wordsRef.current?.querySelectorAll(".word-reveal");
      if (words) {
        gsap.from(words, {
          y: 30,
          opacity: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.07,
          scrollTrigger: {
            trigger: wordsRef.current,
            start: "top 80%",
          },
        });
      }

      // Small text fade
      const smallText = sectionRef.current?.querySelector(".small-text");
      if (smallText) {
        gsap.from(smallText, {
          y: 20,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: smallText,
            start: "top 85%",
          },
        });
      }
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="bg-mist">
    <section
      ref={sectionRef}
      className="relative z-10 bg-void py-24 md:py-40 overflow-hidden rounded-b-[2rem] md:rounded-b-[4rem]"
    >
      {/* Parallax background image */}
      <div className="manifesto-bg absolute inset-0 opacity-[0.1] pointer-events-none overflow-hidden rounded-b-[2rem] md:rounded-b-[4rem]">
        <Image
          src="/images/clean_room.png"
          alt="Pharmaceutical clean room corridor"
          fill
          className="object-cover"
          priority={false}
        />
        {/* Grain Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.2] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 overflow-hidden rounded-b-[2rem] md:rounded-b-[4rem] bg-gradient-to-b from-void via-transparent to-void" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-4 md:px-16 text-center">
        {/* Small text */}
        <div className="small-text mb-8 md:mb-12">
          <p className="font-dm text-[16px] md:text-[20px] font-light text-text-secondary leading-relaxed">
            Most ED treatment focuses on:
          </p>
          <p className="font-dm text-[16px] md:text-[20px] font-light text-text-secondary mt-1">
            A pill. A plan. A schedule.
          </p>
        </div>

        {/* Large manifesto text */}
        <div ref={wordsRef}>
          <div className="flex flex-wrap justify-center items-baseline gap-x-4 md:gap-x-6">
            {"We focus on the".split(" ").map((word, i) => (
              <span
                key={i}
                className="word-reveal font-instrument text-[48px] md:text-[80px] lg:text-[110px] italic text-text-primary leading-[1.1]"
              >
                {word}
              </span>
            ))}
          </div>
          <div className="mt-2">
            <span className="word-reveal inline-block font-instrument text-[56px] md:text-[96px] lg:text-[120px] italic text-teal leading-[1.1]">
              moment.
            </span>
          </div>
        </div>
      </div>
    </section>
    </div>
  );
}
