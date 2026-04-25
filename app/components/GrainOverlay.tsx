"use client";

export default function GrainOverlay() {
  return (
    <div className="grain-overlay">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id="grain">
          <feTurbulence
            baseFrequency="0.65"
            numOctaves={3}
            stitchTiles="stitch"
            type="fractalNoise"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}
