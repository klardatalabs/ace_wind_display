// Full-width rounded image banner with a slow scroll-scrubbed zoom.

import { useRef } from "react";
import { gsap, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";
import Button from "../../../components/ui/Button.jsx";
import DuotoneImage from "../../../components/ui/DuotoneImage.jsx";
import { IMAGES } from "../../../content/images.js";

export default function WindBanner() {
  const root = useRef(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.fromTo(".banner-img", { scale: 1.18 }, { scale: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: true } });
      gsap.from(".banner-title", { y: 60, opacity: 0, scrollTrigger: { trigger: root.current, start: "top 70%" } });
    },
    { scope: root }
  );

  return (
    <div className="bg-gradient-to-b from-white to-moss-50">
      <div ref={root} className="mx-auto max-w-[1600px] px-4 pt-10 pb-12 md:px-6 md:pt-14 md:pb-16">
        <div className="relative flex flex-col items-center justify-center gap-10 overflow-hidden rounded-4xl py-20 md:py-28">
          <DuotoneImage src={IMAGES.drone.src} alt="" className="absolute inset-0" imgClassName="banner-img" />
          <div className="absolute inset-0 bg-moss-950/35" />
          <h2 className="banner-title relative max-w-[720px] px-6 text-center font-display text-4xl leading-[1.05] font-medium tracking-display text-white sm:text-5xl md:text-6xl lg:text-[72px]">
            Where the wind becomes <i className="font-serif font-normal">ours</i>.
          </h2>
          <Button to="/#how" variant="glass" size="lg" icon="arrowRight" className="rounded-full!">
            See how it works
          </Button>
        </div>
      </div>
    </div>
  );
}
