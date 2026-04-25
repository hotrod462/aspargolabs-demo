import Image from "next/image";

// Social icons as inline SVGs (lucide-react doesn't include brand icons)

const navLinks = [
  { label: "Products", href: "#product" },
  { label: "Pipeline", href: "#pipeline" },
  { label: "About", href: "#hero" },
  { label: "Investors", href: "#partners" },
  { label: "Careers", href: "#" },
  { label: "Contact", href: "#" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Use", href: "#" },
];

export default function Footer() {
  return (
    <div className="bg-mist">
      <footer className="relative bg-obsidian rounded-t-[2rem] md:rounded-t-[4rem] pt-12 md:pt-20 pb-0 mt-0 overflow-hidden">
        <div className="grid-overlay absolute inset-0 opacity-45 pointer-events-none" />
        {/* Background image - footer.png */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <Image
            src="/images/footer.png"
            alt="Dark water drop"
            fill
            className="object-cover"
          />
          {/* Gradient to blend with content */}
          <div className="absolute inset-0 bg-gradient-to-b from-obsidian via-transparent to-obsidian" />
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16 pb-12 md:pb-16">
          {/* Column 1 - Brand */}
          <div>
            <div className="flex items-center gap-1 mb-4">
              <span className="font-dm text-[16px] font-light tracking-wide text-text-primary">
                ASPARGO
              </span>
              <span className="text-teal mx-1">·</span>
              <span className="font-ibm text-[13px] font-light tracking-wider text-text-secondary">
                LABS
              </span>
            </div>
            <p className="font-lora text-[15px] italic text-text-secondary leading-[1.7] mb-6">
              Precision delivery. Human outcomes.
            </p>
            <div className="flex gap-3">
              <a
                href="#"
                className="grid-overlay w-9 h-9 rounded-[0.35rem] border border-[rgba(13,183,187,0.2)] flex items-center justify-center text-text-secondary hover:text-teal hover:border-teal transition-colors duration-300"
                aria-label="LinkedIn"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
              <a
                href="#"
                className="grid-overlay w-9 h-9 rounded-[0.35rem] border border-[rgba(13,183,187,0.2)] flex items-center justify-center text-text-secondary hover:text-teal hover:border-teal transition-colors duration-300"
                aria-label="Twitter/X"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
            </div>
          </div>

          {/* Column 2 - Navigation */}
          <div>
            <h4 className="font-dm text-[13px] font-medium text-text-primary uppercase tracking-wider mb-4">
              Navigation
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="font-dm text-[14px] text-text-secondary link-hover py-1"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Column 3 - Legal */}
          <div>
            <h4 className="font-dm text-[13px] font-medium text-text-primary uppercase tracking-wider mb-4">
              Legal
            </h4>
            <div className="flex flex-col gap-2">
              {legalLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="font-dm text-[14px] text-text-secondary link-hover py-1"
                >
                  {link.label}
                </a>
              ))}
              <p className="font-ibm text-[12px] text-text-secondary mt-4">
                ©2025 Aspargo Laboratories Inc.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[rgba(13,183,187,0.1)] py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Removed System Operational */}
          </div>
          <p className="font-ibm text-[11px] text-text-secondary">
            17 State Street, Suite 3220, New York, NY 10004
          </p>
        </div>
      </div>
    </footer>
  </div>
  );
}
