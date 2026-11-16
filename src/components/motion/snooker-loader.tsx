"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const BALLS = [
  "radial-gradient(circle at 35% 30%, #ff6a6f, #c4111a 60%, #6e0509)",
  "radial-gradient(circle at 35% 30%, #ffe680, #f2b705 60%, #8a6200)",
  "radial-gradient(circle at 35% 30%, #4fd27b, #0f8a3a 60%, #034719)",
  "radial-gradient(circle at 35% 30%, #6aa8ff, #1856d6 60%, #082a73)",
];

// Loading: four snooker balls hopping one after another, with their shadows.
export function SnookerLoader({ size = 18, label = "טוען..." }: { size?: number; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ repeat: -1 });
        tl.to(".sl-ball", { y: -size * 1.1, duration: 0.32, ease: "power2.out", stagger: 0.12 }, 0)
          .to(".sl-ball", { y: 0, duration: 0.32, ease: "bounce.out", stagger: 0.12 }, 0.32)
          .to(".sl-shadow", { scaleX: 0.55, opacity: 0.25, duration: 0.32, ease: "power2.out", stagger: 0.12 }, 0)
          .to(".sl-shadow", { scaleX: 1, opacity: 0.5, duration: 0.32, ease: "power2.in", stagger: 0.12 }, 0.32)
          .to({}, { duration: 0.25 });
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} role="status" aria-live="polite" className="flex flex-col items-center gap-3">
      <div className="flex items-end gap-2" style={{ height: size * 2.4 }}>
        {BALLS.map((bg, i) => (
          <div key={i} className="flex flex-col items-center">
            <span
              className="sl-ball block rounded-full"
              style={{
                width: size,
                height: size,
                background: bg,
                boxShadow: "inset -3px -4px 6px rgb(0 0 0 / 0.35), inset 2px 2px 4px rgb(255 255 255 / 0.3)",
              }}
            />
            <span className="sl-shadow block rounded-full bg-black/50 mt-1" style={{ width: size * 0.9, height: size * 0.18 }} />
          </div>
        ))}
      </div>
      {label && <span className="font-display text-sm font-bold opacity-80">{label}</span>}
    </div>
  );
}
