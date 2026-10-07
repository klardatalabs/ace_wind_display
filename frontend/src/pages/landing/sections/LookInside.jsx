// Scroll-scrubbed 2D preview of the screens' "Look inside" effect (no WebGL on the
// landing page): the shell ghosts out, its front half peels away, a cut line sweeps
// across, then labels pop onto the parts inside.

import { useRef } from "react";
import { gsap, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";
import SectionHeading from "../../../components/ui/SectionHeading.jsx";
import Button from "../../../components/ui/Button.jsx";
import CutawayArt from "./CutawayArt.jsx";

const EFFECTS = [
  { name: "Ghost / X-ray", body: "The steel shell fades to a translucent glass outline." },
  { name: "Exploded view", body: "The front half of the nacelle and tower slides away." },
  { name: "Section cutaway", body: "A cutting plane sweeps through without breaking the model." },
  { name: "Camera fly-in", body: "On the big screens, the camera docks inside the machine room." },
];

export default function LookInside() {
  const root = useRef(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) {
        gsap.set(".cut-shell", { opacity: 0.12 });
        gsap.set(".cut-label", { opacity: 1 });
        return;
      }
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root.current.querySelector(".cut-stage"), start: "top 70%", end: "bottom 35%", scrub: 0.8 },
      });
      tl.to(".cut-shell", { opacity: 0.12, duration: 1 }, 0)
        .to(".cut-front", { x: 70, y: -26, duration: 1 }, 0.25)
        .fromTo(".cut-plane", { x: -40, opacity: 0 }, { x: 520, opacity: 1, duration: 1.1, ease: "none" }, 0.1)
        .to(".cut-plane", { opacity: 0, duration: 0.2 }, 1.2)
        .from(".cut-internal", { opacity: 0, scale: 0.92, transformOrigin: "50% 50%", stagger: 0.08, duration: 0.6 }, 0.35)
        .to(".cut-label", { opacity: 1, y: 0, stagger: 0.1, duration: 0.4 }, 0.9)
        .from(".effect-item", { opacity: 0.25, stagger: 0.25, duration: 0.3 }, 0);
    },
    { scope: root }
  );

  return (
    <section id="inside" ref={root} className="px-6 pt-16 pb-20 md:px-12 xl:px-36">
      <div className="mx-auto max-w-[1280px]">
        <SectionHeading eyebrow="Look inside" title={<>Open it up. <i className="font-serif font-normal">Without</i> a hard hat.</>}>
          On every screen, the turbine can open itself up — four effects running together, triggered by the story or by a visitor's phone.
        </SectionHeading>
        <div className="cut-stage mt-12 grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <CutawayArt />
          <div className="flex flex-col gap-6">
            <ul className="flex flex-col gap-4">
              {EFFECTS.map((e, i) => (
                <li key={e.name} className="effect-item flex gap-4">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-moss-900 font-mono text-sm text-white">{i + 1}</span>
                  <div>
                    <p className="font-display text-lg font-medium text-moss-950">{e.name}</p>
                    <p className="text-moss-900/70">{e.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <Button to="/screen/college" icon="arrowRight">
                Try it in 3D
              </Button>
              <Button to="/ask/college" variant="secondary" iconLeft="commentDots">
                Ask what's inside
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
