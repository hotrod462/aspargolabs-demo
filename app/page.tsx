"use client";

import { VapiCallButton } from "./components/VapiCallButton";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-full bg-white text-zinc-950 dark:bg-black dark:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.20),transparent_60%)] blur-2xl dark:bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18),transparent_60%)]" />
        <div className="absolute -bottom-40 right-[-180px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.16),transparent_62%)] blur-2xl dark:bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.14),transparent_62%)]" />
      </div>

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 shadow-sm" />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">HEZKUE</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">AI-guided product demo</p>
          </div>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-zinc-600 dark:text-zinc-400 sm:flex">
          <a className="hover:text-zinc-950 dark:hover:text-white" href="#benefits">
            Benefits
          </a>
          <a className="hover:text-zinc-950 dark:hover:text-white" href="#how">
            How it works
          </a>
          <a className="hover:text-zinc-950 dark:hover:text-white" href="#faq">
            FAQ
          </a>
        </nav>
      </header>

      <main className="relative mx-auto w-full max-w-6xl px-6 pb-20">
        <section className="grid items-center gap-12 py-10 sm:py-16 lg:grid-cols-2">
          <div className="flex flex-col gap-7">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1.5 text-xs text-zinc-700 backdrop-blur dark:border-white/10 dark:bg-black/40 dark:text-zinc-200"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Oral sildenafil suspension • Minty spray • Discreet bottle
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.05 }}
              className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl"
            >
              The oral spray experience—now with an AI voice guide.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
              className="max-w-xl text-pretty text-lg leading-8 text-zinc-600 dark:text-zinc-300"
            >
              HEZKUE is an oral sildenafil suspension (the same active ingredient used in Viagra).
              This demo showcases an AI voice agent that answers questions, explains the product
              experience, and helps users take the next step—without complexity.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
              className="flex flex-col gap-4"
            >
              <VapiCallButton />
              <p className="max-w-xl text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                Prescription medication. Not for recreational use. This page is a private demo.
              </p>
            </motion.div>

            <div className="grid grid-cols-2 gap-4 pt-2 sm:max-w-xl sm:grid-cols-3">
              {[
                { k: "5 min", v: "Designed for rapid onset" },
                { k: "25 mg", v: "Metered pumps per dose" },
                { k: "No pill", v: "Spray, swallow, go" },
              ].map((item) => (
                <div
                  key={item.k}
                  className="rounded-2xl border border-black/10 bg-white/70 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5"
                >
                  <p className="text-lg font-semibold tracking-tight">{item.k}</p>
                  <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{item.v}</p>
                </div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-3xl border border-black/10 bg-gradient-to-br from-white to-zinc-50 p-8 shadow-sm dark:border-white/10 dark:from-zinc-950 dark:to-black">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.18),transparent_35%),radial-gradient(circle_at_80%_40%,rgba(59,130,246,0.14),transparent_38%)]" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                    What the AI can help with
                  </p>
                  <span className="rounded-full border border-black/10 bg-white px-2 py-1 text-xs text-zinc-600 dark:border-white/10 dark:bg-black dark:text-zinc-300">
                    Live voice
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    "“How does the spray work and how fast does it act?”",
                    "“What’s the dosing experience—how many pumps?”",
                    "“Is it discreet and easy to use on the go?”",
                    "“Help me decide if this fits my lifestyle.”",
                  ].map((q) => (
                    <div
                      key={q}
                      className="rounded-2xl border border-black/10 bg-white/80 p-4 text-sm text-zinc-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
                    >
                      {q}
                    </div>
                  ))}
                </div>

                <div className="mt-8 grid grid-cols-3 gap-3 text-xs text-zinc-600 dark:text-zinc-300">
                  {[
                    { t: "Private", s: "No forms to start" },
                    { t: "Instant", s: "Voice-first flow" },
                    { t: "Guided", s: "Clear next steps" },
                  ].map((x) => (
                    <div
                      key={x.t}
                      className="rounded-2xl border border-black/10 bg-white/60 p-3 backdrop-blur dark:border-white/10 dark:bg-white/5"
                    >
                      <p className="font-semibold text-zinc-950 dark:text-white">{x.t}</p>
                      <p className="mt-1 leading-5">{x.s}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="benefits" className="py-14">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              Benefits
            </p>
            <h2 className="text-pretty text-3xl font-semibold tracking-tight sm:text-4xl">
              Simplicity you can feel—guided by voice.
            </h2>
            <p className="max-w-2xl text-pretty text-lg leading-8 text-zinc-600 dark:text-zinc-300">
              Oral suspension formulations are designed to improve patient experience with better
              taste, easier swallowing, and more flexible dosing. The AI agent turns those benefits
              into a calm, human-like walkthrough.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Rapid onset mindset",
                body: "A voice-first experience built around spontaneity—no overexplaining, just clarity.",
              },
              {
                title: "Discreet by design",
                body: "Compact, simple steps, and a guided conversation that respects privacy.",
              },
              {
                title: "Metered dosing",
                body: "A straightforward way to talk about pumps, dose options, and what to expect.",
              },
              {
                title: "Works with real life",
                body: "Built for users who don’t want rigid timing rules or complicated routines.",
              },
              {
                title: "Trust & education",
                body: "Grounded explanation: oral sildenafil suspension (same active ingredient as Viagra).",
              },
              {
                title: "Less friction",
                body: "The agent answers questions instantly, reducing drop-off and hesitation.",
              },
            ].map((card, idx) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, ease: "easeOut", delay: idx * 0.03 }}
                className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
              >
                <p className="text-base font-semibold tracking-tight">{card.title}</p>
                <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  {card.body}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        <section
          id="how"
          className="rounded-3xl border border-black/10 bg-gradient-to-br from-zinc-50 to-white p-8 shadow-sm dark:border-white/10 dark:from-zinc-950 dark:to-black sm:p-10"
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-sky-600 dark:text-sky-400">How it works</p>
            <h2 className="text-pretty text-3xl font-semibold tracking-tight sm:text-4xl">
              A simple flow—shake, unlock, spray, ready.
            </h2>
            <p className="max-w-2xl text-pretty text-lg leading-8 text-zinc-600 dark:text-zinc-300">
              The product experience is intentionally straightforward. The AI agent mirrors that: it
              answers what matters, and stays out of the way.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-4">
            {[
              { step: "01", title: "Shake", body: "A quick shake to prep the suspension." },
              { step: "02", title: "Twist to unlock", body: "Simple, tactile, and discreet." },
              { step: "03", title: "Spray", body: "Spray in mouth and swallow—like breath spray." },
              { step: "04", title: "Ready", body: "Designed for real-life timing, not planning." },
            ].map((s, idx) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, ease: "easeOut", delay: idx * 0.04 }}
                className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950"
              >
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{s.step}</p>
                <p className="mt-2 text-base font-semibold tracking-tight">{s.title}</p>
                <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">{s.body}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-6 rounded-3xl border border-black/10 bg-white/70 p-6 backdrop-blur dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center">
            <div>
              <p className="text-base font-semibold tracking-tight">Make the AI the front door.</p>
              <p className="mt-1 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                Put the voice agent at the center of the journey: discovery → trust → next step.
              </p>
            </div>
            <div className="w-full sm:w-auto">
              <VapiCallButton />
            </div>
          </div>
        </section>

        <section id="faq" className="py-14">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">FAQ</p>
            <h2 className="text-pretty text-3xl font-semibold tracking-tight sm:text-4xl">
              Questions users actually ask.
            </h2>
            <p className="max-w-2xl text-pretty text-lg leading-8 text-zinc-600 dark:text-zinc-300">
              The AI agent is designed to handle these in a calm, consistent voice—without
              overwhelming the user.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {[
              {
                q: "What is HEZKUE?",
                a: "An oral sildenafil suspension (same active ingredient used in Viagra), delivered as a minty spray experience.",
              },
              {
                q: "How fast does it work?",
                a: "The product is positioned around rapid onset. Ask the agent for the nuanced explanation and expectations.",
              },
              {
                q: "What’s the dosing experience?",
                a: "Metered pumps make dose options easy to discuss. The agent can explain common pump counts at a high level.",
              },
              {
                q: "Why add AI here?",
                a: "Voice reduces friction: it builds confidence, explains discreetly, and routes users to the right next step.",
              },
            ].map((item, idx) => (
              <motion.div
                key={item.q}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, ease: "easeOut", delay: idx * 0.03 }}
                className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
              >
                <p className="text-base font-semibold tracking-tight">{item.q}</p>
                <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">{item.a}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <footer className="border-t border-black/10 py-10 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-400">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <p>
              <span className="font-semibold text-zinc-950 dark:text-white">Aspargo Labs</span> •
              Private equity product demo
            </p>
            <div className="flex flex-wrap gap-4">
              <a className="hover:text-zinc-950 dark:hover:text-white" href="https://aspargolabs.com/">
                AspargoLabs.com
              </a>
              <a
                className="hover:text-zinc-950 dark:hover:text-white"
                href="https://www.hezkuedirect.com/"
              >
                HEZKUE site
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
