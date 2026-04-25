"use client";

export default function ScienceStrip() {
  const content =
    "FAST ABSORPTION · T+5min · 0.615 ng/mL · BIOEQUIVALENT TO VIAGRA® · 56-PATIENT PK CROSSOVER STUDY · NO WATER REQUIRED · PERSONALIZED DOSING · DISCREET PUMP FORMAT · MINT SUSPENSION · CLINICALLY PROVEN SAFETY PROFILE · ";

  // Repeat 6x for seamless loop
  const repeatedContent = content.repeat(6);

  return (
    <section
      id="science"
      className="grid-panel w-full !rounded-none border-x-0 py-4 overflow-hidden"
    >
      <div className="flex whitespace-nowrap animate-marquee">
        <span className="font-ibm text-[12px] text-text-secondary tracking-wider">
          {repeatedContent}
        </span>
      </div>
    </section>
  );
}
