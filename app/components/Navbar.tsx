"use client";

import { useState, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import gsap from "gsap";

const navLinks = [
  { label: "Pipeline", href: "#pipeline" },
  { label: "HEZKUE®", href: "#product" },
  { label: "AI Intake", href: "#ai-agent" },
  { label: "For Partners", href: "#partners" },
];

function navIntersectsLightPipeline(
  nav: DOMRectReadOnly,
  pipeline: Element | null
): boolean {
  if (!pipeline) return false;
  const pr = pipeline.getBoundingClientRect();
  return (
    nav.bottom > pr.top &&
    nav.top < pr.bottom &&
    nav.right > pr.left &&
    nav.left < pr.right
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [overLightPipeline, setOverLightPipeline] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const lightSurface = scrolled && overLightPipeline;

  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > 80);
      const nav = navRef.current;
      const pipeline = document.getElementById("pipeline");
      if (!nav) {
        setOverLightPipeline(false);
        return;
      }
      setOverLightPipeline(navIntersectsLightPipeline(nav.getBoundingClientRect(), pipeline));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (mobileOpen && drawerRef.current) {
      gsap.fromTo(
        drawerRef.current,
        { x: "100%" },
        { x: "0%", duration: 0.4, ease: "power3.out" }
      );
    }
  }, [mobileOpen]);

  const closeDrawer = () => {
    if (drawerRef.current) {
      gsap.to(drawerRef.current, {
        x: "100%",
        duration: 0.3,
        ease: "power2.inOut",
        onComplete: () => setMobileOpen(false),
      });
    }
  };

  return (
    <>
      <nav
        ref={navRef}
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-[900] px-1.5 py-1.5 sm:px-2 sm:py-1.5 transition-all duration-500 ${
          lightSurface
            ? "grid-overlay bg-[rgba(248,250,251,0.92)] backdrop-blur-[20px] border border-[rgba(17,24,32,0.12)] rounded-[0.75rem] shadow-[0_8px_32px_rgba(17,24,32,0.08)]"
            : scrolled
              ? "grid-overlay bg-[rgba(6,8,16,0.78)] backdrop-blur-[20px] border border-[rgba(13,183,187,0.22)] rounded-[0.75rem] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
              : "bg-transparent border border-transparent rounded-[0.75rem]"
        }`}
      >
        <div className="flex items-center gap-6 md:gap-8 lg:gap-12 px-3 py-0.5 sm:px-4 md:px-6">
          {/* Logo */}
          <a href="#" className="flex items-center gap-1 shrink-0">
            <span
              className={`font-dm text-[15px] font-light tracking-wide ${
                lightSurface ? "text-text-dark" : "text-text-primary"
              }`}
            >
              ASPARGO
            </span>
            <span className="text-teal mx-1">·</span>
            <span
              className={`font-ibm text-[12px] font-light tracking-wider ${
                lightSurface
                  ? "text-[rgba(17,24,32,0.48)]"
                  : "text-text-secondary"
              }`}
            >
              LABS
            </span>
          </a>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-5 lg:gap-7">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`font-dm text-[14px] font-normal link-hover ${
                  lightSurface ? "text-text-dark" : "text-text-primary"
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA */}
          <a
            href="#partners"
            className="btn-primary nav-cta hidden md:inline-flex shrink-0"
          >
            <span className="btn-fill" />
            <span className="relative z-10">Request Access</span>
          </a>

          {/* Mobile Hamburger */}
          <button
            className={`md:hidden p-1 ${lightSurface ? "text-text-dark" : "text-text-primary"}`}
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-[950] backdrop-blur-sm"
            onClick={closeDrawer}
          />
          <div
            ref={drawerRef}
            className="grid-overlay fixed top-0 right-0 h-full w-[280px] bg-[rgba(6,8,16,0.95)] backdrop-blur-[30px] border-l border-[rgba(13,183,187,0.2)] z-[960] p-8 flex flex-col"
            style={{ transform: "translateX(100%)" }}
          >
            <button
              onClick={closeDrawer}
              className="self-end text-text-secondary mb-8"
              aria-label="Close menu"
            >
              <X size={24} />
            </button>
            <div className="flex flex-col gap-6">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="font-dm text-[18px] font-normal text-text-primary link-hover"
                  onClick={closeDrawer}
                >
                  {link.label}
                </a>
              ))}
              <a
                href="#partners"
                className="btn-primary text-[14px] py-3 px-6 mt-4 text-center"
                onClick={closeDrawer}
              >
                <span className="btn-fill" />
                <span className="relative z-10">Request Access</span>
              </a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
