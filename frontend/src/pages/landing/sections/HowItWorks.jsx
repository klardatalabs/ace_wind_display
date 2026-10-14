// Pinned, scroll-scrubbed explainer: as you scroll, an energy line draws from the wind
// through the blades, generator and grid to a row of homes, and each step lights up.

import { useRef, useState } from "react";
import { gsap, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";
import SectionHeading from "../../../components/ui/SectionHeading.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import EnergyPathArt from "./EnergyPathArt.jsx";
import { LOOP_STEPS } from "../../../content/landing.js";

export default function HowItWorks() {
  const root = useRef(null);
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      const path = root.current.querySelector(".energy-path");
      const length = path.getTotalLength();
      gsap.set(path, { strokeDasharray: length, strokeDashoffset: prefersReducedMotion() ? 0 : length });
      if (prefersReducedMotion()) return;

      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root.current.querySelector(".how-stage"),
            start: "top top+=96",
            end: "+=1600",
            scrub: 0.6,
            pin: true,
            onUpdate: (self) => setActive(Math.min(LOOP_STEPS.length - 1, Math.floor(self.progress * LOOP_STEPS.length))),
          },
        });
        tl.to(path, { strokeDashoffset: 0, ease: "none", duration: 1 }, 0)
          .to(".art-gust", { x: 40, opacity: 0, stagger: 0.05, duration: 0.25 }, 0)
          .to(".art-rotor", { rotation: 360, svgOrigin: "244 156", ease: "none", duration: 1 }, 0)
          .to(".art-home-glow", { opacity: 1, stagger: 0.04, duration: 0.2 }, 0.75);
      });
      mm.add("(max-width: 1023px)", () => {
        gsap.to(path, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: path, start: "top 80%", end: "bottom 30%", scrub: true } });
        gsap.to(".art-home-glow", { opacity: 1, stagger: 0.05, scrollTrigger: { trigger: path, start: "center 60%" } });
      });
    },
    { scope: root }
  );

  return (
    <section id="how" ref={root} className="bg-gradient-to-b from-moss-50 to-white px-6 pt-20 pb-16 md:px-12 xl:px-36">
      <div className="mx-auto max-w-[1280px]">
        <SectionHeading eyebrow="How it works" title={<>From a gust on the estuary<br className="hidden md:block" /> to the lights in your kitchen.</>} />
        <div className="how-stage mt-12 grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_minmax(0,560px)]">
          <ol className="flex flex-col gap-2">
            {LOOP_STEPS.map((step, i) => (
              <li
                key={step.key}
                className={`flex gap-4 rounded-3xl p-5 transition-all duration-500 ${
                  i === active ? "bg-white shadow-[0_10px_40px_rgb(10_21_29/0.08)] ring-1 ring-moss-100" : "opacity-70 lg:opacity-55"
                }`}
              >
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors ${i === active ? "bg-moss-900 text-white" : "bg-moss-50 text-moss-700"}`}>
                  <Icon name={step.icon} className="size-6" />
                </span>
                <div>
                  <h3 className="font-display text-xl font-medium tracking-tight text-moss-950">{step.title}</h3>
                  <p className="mt-1 text-moss-900/70">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <EnergyPathArt />
        </div>
      </div>
    </section>
  );
}
