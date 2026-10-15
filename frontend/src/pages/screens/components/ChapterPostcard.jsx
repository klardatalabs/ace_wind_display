// Between chapters on the community screen: a postcard from Lawrence Weston. A white card
// with one of ACE's photos and the next chapter's name slides up from the bottom corner,
// tilts straight, holds for a beat and slides away, while a warm wash crosses the scene.
// Not on the first chapter after loading, and not at all when the viewer prefers reduced motion.

import { useRef } from "react";
import { gsap, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";

const PHOTOS = ["/images/ace/community.webp", "/images/ace/ribbon-brunel.webp", "/images/ace/in-operation.webp", "/images/ace/opening-crowd.webp", "/images/ace/climate-relay.webp", "/images/ace/ace-team.webp"];

export default function ChapterPostcard({ index, label, total }) {
  const root = useRef(null);
  const first = useRef(true);

  useGSAP(
    () => {
      if (first.current) {
        first.current = false;
        return;
      }
      if (prefersReducedMotion()) return;
      gsap
        .timeline()
        .set(root.current, { autoAlpha: 1 })
        .fromTo(".card-wash", { opacity: 0 }, { opacity: 0.35, duration: 0.35, ease: "power1.out" }, 0)
        .to(".card-wash", { opacity: 0, duration: 0.9, ease: "power1.in" }, 0.45)
        .fromTo(".postcard", { y: "70vh", x: "-8vw", rotation: -14 }, { y: 0, x: 0, rotation: -3, duration: 0.75, ease: "back.out(1.4)" }, 0)
        .to(".postcard", { x: "70vw", y: "-12vh", rotation: 8, duration: 0.6, ease: "power2.in" }, 2)
        .set(root.current, { autoAlpha: 0 });
    },
    { scope: root, dependencies: [index] }
  );

  return (
    <div ref={root} className="pointer-events-none invisible absolute inset-0 z-30 opacity-0" aria-hidden="true">
      <div className="card-wash absolute inset-0 bg-amber-100" />
      <div className="postcard absolute bottom-[14vmin] left-[6vmin] flex items-center gap-[2.4vmin] rounded-[1.4vmin] bg-white p-[1.4vmin] pr-[3.4vmin] shadow-[0_24px_70px_rgb(10_21_29/0.35)]">
        <img src={PHOTOS[index % PHOTOS.length]} alt="" className="h-[16vmin] w-[24vmin] rounded-[0.8vmin] object-cover" />
        <div className="flex flex-col gap-[0.8vmin] text-moss-950">
          <p className="text-[clamp(11px,1.6vmin,30px)] font-semibold tracking-[0.16em] text-moss-600 uppercase">
            Lawrence Weston · {index + 1} of {total}
          </p>
          <p className="font-display text-[clamp(26px,6vmin,120px)] leading-none font-semibold">{label}</p>
        </div>
      </div>
    </div>
  );
}
