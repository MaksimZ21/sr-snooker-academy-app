"use client";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// The one entrance each page gets: its top-level blocks (header, tiles,
// panels…) rise into place in a short stagger, like graphics coming on air.
// Runs again on every navigation; does nothing for reduced motion.
export function PageEnter({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const page = ref.current?.firstElementChild;
        if (!page) return;
        // The page's own sections; a page that is one wrapper deep uses its children.
        let blocks = Array.from(page.children) as HTMLElement[];
        if (blocks.length === 1 && blocks[0].children.length > 1) blocks = Array.from(blocks[0].children) as HTMLElement[];
        gsap.from(blocks.slice(0, 10), {
          y: 18,
          autoAlpha: 0,
          duration: 0.55,
          ease: "power3.out",
          stagger: 0.07,
          clearProps: "transform,opacity,visibility",
        });
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [pathname], revertOnUpdate: true },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
