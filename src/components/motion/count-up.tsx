"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// A scoreboard number that counts up to its value when it appears (and
// from the old value when it changes). Renders the final number first, so
// it reads right without JavaScript and for reduced motion.
export function CountUp({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const text = (n: number) => `${Math.round(n).toLocaleString("he-IL")}${suffix}`;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const state = { n: shown.current };
        gsap.to(state, {
          n: value,
          duration: Math.min(1.2, 0.5 + Math.abs(value - shown.current) / 400),
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = text(state.n);
          },
          onComplete: () => {
            shown.current = value;
          },
        });
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        el.textContent = text(value);
        shown.current = value;
      });
      return () => mm.revert();
    },
    { dependencies: [value] },
  );

  return (
    <span ref={ref} className={className}>
      {text(value)}
    </span>
  );
}
