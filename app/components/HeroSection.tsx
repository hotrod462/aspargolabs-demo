"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import Image from "next/image";

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const eyebrowRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<HTMLHeadingElement>(null);
  const line2Ref = useRef<HTMLHeadingElement>(null);
  const subtextRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  // GSAP entrance animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.2 });

      // Animate background image slowly scaling up
      tl.fromTo(
        bgRef.current,
        { scale: 1.05, opacity: 0 },
        { scale: 1, opacity: 1, duration: 2, ease: "power2.out" }
      );

      // Text animations
      tl.from(
        eyebrowRef.current,
        { y: 30, opacity: 0, duration: 0.8, ease: "power3.out" },
        "-=1.5"
      )
        .from(
          line1Ref.current,
          { y: 50, opacity: 0, duration: 0.9, ease: "power3.out" },
          "-=1.2"
        )
        .from(
          line2Ref.current,
          { y: 50, opacity: 0, duration: 0.9, ease: "power3.out" },
          "-=0.7"
        )
        .from(
          subtextRef.current,
          { y: 30, opacity: 0, duration: 0.8, ease: "power3.out" },
          "-=0.6"
        )
        .from(
          ctaRef.current,
          { y: 30, opacity: 0, duration: 0.7, ease: "power3.out" },
          "-=0.5"
        );
    });

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full min-h-[100dvh] flex items-center justify-center bg-void overflow-hidden"
      id="hero"
    >
      {/* Background Image Container */}
      <div ref={bgRef} className="absolute inset-0 w-full h-full">
        <Image
          src="/images/hero-bg.png"
          alt="Abstract dark teal texture"
          fill
          priority
          className="object-cover"
        />
        {/* Grain Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.4] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      {/* Gradients for depth and readability */}
        <div className="absolute inset-0 opacity-55 pointer-events-none grid-overlay" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,8,16,0.6)_0%,rgba(6,8,16,0.9)_60%,rgba(6,8,16,1)_100%)] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-[1200px] mx-auto px-4 md:px-16 flex flex-col items-center text-center mt-16">
        <div ref={eyebrowRef}>
          <p className="font-ibm text-[11px] md:text-[12px] text-text-secondary uppercase tracking-[0.2em] mb-6 drop-shadow-md">
            Spray Suspension Technology · Clinically Proven
          </p>
        </div>

        <h1
          ref={line1Ref}
          className="font-dm whitespace-nowrap text-[44px] md:text-[64px] lg:text-[80px] font-semibold leading-[1.05] tracking-tight text-text-primary drop-shadow-xl"
        >
          Everything you need for better sex
        </h1>

        <h2
          ref={line2Ref}
          className="font-instrument text-[56px] md:text-[88px] lg:text-[112px] italic leading-[1] text-teal mt-1 drop-shadow-lg"
        >
          now in a minty spray.
        </h2>

        <p
          ref={subtextRef}
          className="font-lora text-[16px] md:text-[20px] text-text-secondary leading-[1.7] max-w-[540px] mt-8 drop-shadow-md"
        >
          HEZKUE® is the world&apos;s first oral sildenafil spray — absorbed
          within 5 minutes, precisely dosed, and designed for the life you
          actually live.
        </p>

        <div ref={ctaRef} className="flex flex-wrap justify-center gap-4 mt-10">
          <a href="#product" className="btn-primary shadow-xl">
            <span className="btn-fill" />
            <span className="relative z-10">Explore HEZKUE®</span>
          </a>
          <a href="#ai-agent" className="btn-ghost shadow-xl bg-[rgba(13,17,23,0.3)]">
            <span className="btn-fill" />
            <span className="relative z-10">Speak with a Specialist</span>
          </a>
        </div>


      </div>
    </section>
  );
}
