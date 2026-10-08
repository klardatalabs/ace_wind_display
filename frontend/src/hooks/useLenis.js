// Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger animations stay
// frame-perfect with the smoothed scroll position.

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "../lib/gsap.js";
import { prefersReducedMotion } from "./useReducedMotion.js";

let lenis = null;

export function getLenis() {
  return lenis;
}

export function useLenis() {
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenis = null;
    };
  }, []);
}

/** Smooth-scrolls to a selector or element (falls back to native scrolling). */
export function scrollToTarget(target) {
  if (lenis) lenis.scrollTo(target, { offset: -80, duration: 1.4 });
  else document.querySelector(target)?.scrollIntoView({ behavior: "smooth" });
}
