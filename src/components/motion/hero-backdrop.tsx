"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const BALLS = [
  { bg: "radial-gradient(circle at 35% 30%, #ff6a6f, #c4111a 60%, #6e0509)", size: 46 },
  { bg: "radial-gradient(circle at 35% 30%, #ffe680, #f2b705 60%, #8a6200)", size: 38 },
  { bg: "radial-gradient(circle at 35% 30%, #6aa8ff, #1856d6 60%, #082a73)", size: 42 },
  { bg: "radial-gradient(circle at 35% 30%, #ff9ccb, #e2408a 60%, #7a1043)", size: 34 },
  { bg: "radial-gradient(circle at 35% 30%, #ffffff, #e9e4d6 60%, #b9b19c)", size: 40 },
];

// Behind the green page headers: the stripes drift, a light sweeps across
// like a TV studio light, and snooker balls roll slowly over the felt and
// bounce off its edges. Sits under the header's text (z-0); still and
// mostly hidden for reduced motion.
export function HeroBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Stripes slide sideways forever.
        gsap.to(".hb-stripes", { backgroundPosition: "160px 0", duration: 9, ease: "none", repeat: -1 });
        // A soft light sweeps across now and then.
        gsap.fromTo(
          ".hb-light",
          { xPercent: -120 },
          { xPercent: 220, duration: 4.5, ease: "power1.inOut", repeat: -1, repeatDelay: 3.5 },
        );
        // Each ball rolls to a new point on the felt, spinning as it goes.
        const balls = gsap.utils.toArray<HTMLElement>(".hb-ball", root);
        balls.forEach((ball, i) => {
          const roll = () => {
            const w = root.clientWidth;
            const h = root.clientHeight;
            const size = ball.offsetWidth;
            const x = gsap.utils.random(0, Math.max(0, w - size));
            const y = gsap.utils.random(0, Math.max(0, h - size));
            const dx = x - (gsap.getProperty(ball, "x") as number);
            gsap.to(ball, {
              x,
              y,
              rotation: `+=${dx * 1.2}`,
              duration: gsap.utils.random(5, 9),
              ease: "power1.inOut",
              onComplete: roll,
            });
          };
          gsap.set(ball, {
            x: gsap.utils.random(0, Math.max(0, root.clientWidth - ball.offsetWidth)),
            y: gsap.utils.random(0, Math.max(0, root.clientHeight - ball.offsetHeight)),
            autoAlpha: 0,
          });
          gsap.to(ball, { autoAlpha: 1, duration: 1.2, delay: 0.3 + i * 0.15 });
          roll();
        });
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(".hb-ball", { autoAlpha: 0 });
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="hb-stripes absolute inset-0"
        style={{ backgroundImage: "repeating-linear-gradient(115deg, rgb(255 255 255 / 0.07) 0 14px, transparent 14px 40px)" }}
      />
      <div
        className="hb-light absolute inset-y-0 w-1/2"
        style={{ background: "linear-gradient(100deg, transparent, rgb(255 255 255 / 0.14), transparent)" }}
      />
      {BALLS.map((b, i) => (
        <span
          key={i}
          className="hb-ball absolute top-0 left-0 rounded-full opacity-0"
          style={{
            width: b.size,
            height: b.size,
            background: b.bg,
            boxShadow: "inset -6px -8px 12px rgb(0 0 0 / 0.4), inset 4px 4px 8px rgb(255 255 255 / 0.3), 0 10px 14px -6px rgb(0 0 0 / 0.45)",
          }}
        />
      ))}
      {/* Keep the text readable over the moving balls */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(7_90_43/0.55),transparent_70%)]" />
    </div>
  );
}
