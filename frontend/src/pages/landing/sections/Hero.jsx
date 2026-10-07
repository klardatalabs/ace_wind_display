// Split hero: masked line-by-line headline + live layered slideshow on the right.

import { useRef } from "react";
import { gsap, SplitText, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";
import Button from "../../../components/ui/Button.jsx";
import LiveBadge from "../../../components/live/LiveBadge.jsx";
import HeroSlideshow from "./HeroSlideshow.jsx";
import { HERO } from "../../../content/landing.js";

export default function Hero() {
  const root = useRef(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const split = SplitText.create(".hero-title", { type: "lines", mask: "lines", linesClass: "hero-line" });
      gsap
        .timeline({ delay: 0.25 })
        .from(".hero-pill", { y: 16, opacity: 0, duration: 0.7 })
        .from(split.lines, { yPercent: 110, duration: 1.1, stagger: 0.09, ease: "expo.out" }, "-=0.4")
        .from(".hero-emphasis", { backgroundSize: "0% 58%", duration: 1.1, ease: "power2.inOut" }, "-=0.5")
        .from(".hero-fade", { y: 20, opacity: 0, stagger: 0.1, duration: 0.8 }, "-=0.8")
        .from(".hero-visual", { y: 40, opacity: 0, scale: 0.96, duration: 1.3, ease: "expo.out" }, 0.3);
      return () => split.revert();
    },
    { scope: root }
  );

  return (
    <section ref={root} className="relative pt-8 pb-12 md:pt-12 md:pb-20 lg:py-16">
      <div className="mx-auto grid max-w-[1665px] grid-cols-1 items-center gap-10 px-6 md:px-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-12 lg:px-16 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] hero:gap-20 hero:px-28">
        <div className="flex flex-col items-center gap-8 lg:items-start">
          <div className="flex flex-col items-center gap-5 lg:items-start">
            <div className="hero-pill inline-flex items-center gap-2 rounded-2xl bg-moss-50 py-1 pr-3 pl-1 text-xs font-medium text-moss-700">
              <LiveBadge className="bg-white! ring-0!" />
              <span>{HERO.eyebrow}</span>
            </div>
            <h1 className="hero-title max-w-[720px] text-center font-display text-[clamp(2.6rem,6.4vw,5.25rem)] leading-[1.02] font-medium tracking-display text-moss-950 lg:text-left lg:text-[clamp(3rem,4.9vw,5.25rem)]">
              {HERO.titleStart}{" "}
              <em className="hero-emphasis brushstroke font-serif font-normal not-italic">
                <i>{HERO.titleEmphasis}</i>
              </em>
              {HERO.titleEnd}
            </h1>
          </div>
          <p className="hero-fade max-w-[540px] text-center text-lg leading-snug text-moss-900/65 sm:text-xl lg:text-left">{HERO.body}</p>
          <div className="hero-fade flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row lg:items-start">
            <Button to="/ask/community" size="lg" icon="arrowRight">
              Ask the turbine
            </Button>
            <Button to="/#screens" variant="secondary" size="lg" iconLeft="eye">
              See the screens
            </Button>
          </div>
          <p className="hero-fade text-sm text-moss-900/55">{HERO.note}</p>
        </div>
        <HeroSlideshow className="hero-visual" />
      </div>
    </section>
  );
}
