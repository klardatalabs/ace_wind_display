// Scattered, tilted question cards — each one opens Ask Ace with that question ready.

import { useRef } from "react";
import { useNavigate } from "react-router";
import { gsap, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";
import SectionHeading from "../../../components/ui/SectionHeading.jsx";
import { QUESTION_WALL } from "../../../content/landing.js";

// Deterministic "random" tilt/offset so the layout is stable between renders.
const tilt = (i) => [-9, 6, 2, -4, 8, -2, 5, -7, 3, -5, 9, -3][i % 12];

export default function QuestionWall() {
  const root = useRef(null);
  const navigate = useNavigate();

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(".q-card", {
        y: 80,
        opacity: 0,
        rotation: 0,
        stagger: { each: 0.05, from: "random" },
        duration: 0.9,
        ease: "back.out(1.4)",
        scrollTrigger: { trigger: root.current, start: "top 75%" },
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} className="overflow-hidden px-4 pt-16 pb-12 md:pt-24">
      <SectionHeading align="center" eyebrow="Ask Ace" title="Ask it anything.">
        Some questions to start with. Tap one to ask it yourself.
      </SectionHeading>
      <div className="mx-auto mt-12 flex max-w-[1200px] flex-wrap justify-center gap-x-2 gap-y-4 md:gap-y-0">
        {QUESTION_WALL.map((item, i) => {
          const question = `${item.q} ${item.hl}${item.end}`;
          return (
            <button
              key={question}
              type="button"
              onClick={() => navigate(`/ask/community?q=${encodeURIComponent(question)}`)}
              style={{ "--r": `${tilt(i)}deg`, marginTop: i % 2 ? "2.5rem" : 0 }}
              className="q-card w-64 rotate-[var(--r)] cursor-pointer rounded-xl border border-moss-100 bg-moss-25 p-4 text-center font-display text-xl leading-snug font-medium tracking-tight text-moss-950 shadow-[0_10px_30px_-8px_rgb(6_33_26/0.18)] transition-[transform,box-shadow] duration-200 ease-out select-none hover:z-10 hover:scale-105 hover:rotate-0 hover:shadow-[0_20px_40px_-5px_rgb(6_33_26/0.3)] sm:text-2xl"
            >
              {item.q} <span className="brushstroke">{item.hl}</span>
              {item.end}
            </button>
          );
        })}
      </div>
    </section>
  );
}
