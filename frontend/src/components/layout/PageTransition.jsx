// Route change: a green curtain wipes up off the screen while the new page rises in.

import { useRef } from "react";
import { useLocation } from "react-router";
import { gsap, useGSAP, ScrollTrigger } from "../../lib/gsap.js";
import { getLenis } from "../../hooks/useLenis.js";
import { prefersReducedMotion } from "../../hooks/useReducedMotion.js";

export default function PageTransition({ children }) {
  const { pathname, hash } = useLocation();
  const curtain = useRef(null);
  const content = useRef(null);

  useGSAP(
    () => {
      if (!hash) {
        const lenis = getLenis();
        if (lenis) lenis.scrollTo(0, { immediate: true });
        else window.scrollTo(0, 0);
      }
      if (prefersReducedMotion()) return;
      gsap
        .timeline({ onComplete: () => ScrollTrigger.refresh() })
        .set(curtain.current, { display: "block", scaleY: 1, transformOrigin: "50% 0%" })
        .to(curtain.current, { scaleY: 0, duration: 0.8, ease: "expo.inOut" })
        .from(content.current, { y: 40, opacity: 0, duration: 0.9, ease: "power3.out" }, "-=0.45")
        .set(curtain.current, { display: "none" });
    },
    { dependencies: [pathname] }
  );

  return (
    <>
      <div
        ref={curtain}
        className="pointer-events-none fixed inset-0 z-[60] hidden bg-gradient-to-b from-moss-800 to-moss-950"
        aria-hidden="true"
      />
      <div ref={content} key={pathname}>
        {children}
      </div>
    </>
  );
}
