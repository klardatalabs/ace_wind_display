// Scattered, tilted, slightly overlapping question cards that straighten and come to the front on hover — each one opens Ask Ace with
// that question ready. The scroll-in animation moves the outer wrapper only, so it never
// overwrites the card's CSS tilt.

import { useRef } from "react";
import { Link } from "react-router";
import { gsap, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";
import SectionHeading from "../../../components/ui/SectionHeading.jsx";
import { QUESTION_WALL } from "../../../content/landing.js";

// Deterministic "random" tilt so the layout is stable between renders.
const tilt = (i) => ((i * 7) % 13) - 6;

export default function QuestionWall() {
  const root = useRef(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(".q-wrap", {
        y: 60,
        opacity: 0,
        stagger: { each: 0.04, from: "random" },
        duration: 0.8,
        ease: "back.out(1.4)",
        scrollTrigger: { trigger: root.current, start: "top 75%", once: true },
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} className="overflow-hidden px-4 pt-16 pb-16 md:pt-24">
      <SectionHeading align="center" eyebrow="Ask Ace" title="Ask it anything.">
        Some questions to start with. Tap one to ask it yourself.
      </SectionHeading>
      <ul className="mx-auto mt-12 flex max-w-[1240px] flex-wrap justify-center px-2 pb-6">
        {QUESTION_WALL.map((item, i) => {
          // Phones show two cards a row and the first dozen questions, so the wall stays short.
          const question = `${item.q} ${item.hl}${item.end}`;
          return (
            <li key={question} className={`q-wrap relative -mx-1 -my-1 even:mt-5 hover:z-10 focus-within:z-10 sm:-mx-2 md:-my-2 md:even:mt-6 ${i >= 12 ? "hidden sm:block" : ""}`}>
              <Link
                to={`/ask/community?q=${encodeURIComponent(question)}`}
                style={{ "--r": `${tilt(i)}deg` }}
                className="flex min-h-full w-[calc(50vw-30px)] max-w-60 rotate-(--r) items-center justify-center rounded-xl border border-moss-100 bg-moss-25 px-3 py-6 text-center font-display text-base sm:w-60 sm:px-5 sm:py-7 sm:text-xl leading-snug font-medium tracking-tight text-moss-950 shadow-[0_10px_30px_-8px_rgb(10_21_29/0.18)] transition-[rotate,scale,box-shadow] duration-300 ease-out select-none hover:scale-105 hover:rotate-0 hover:shadow-[0_20px_40px_-5px_rgb(10_21_29/0.3)] focus-visible:rotate-0 lg:text-[22px]"
              >
                <span>
                  {item.q} <span className="brushstroke">{item.hl}</span>
                  {item.end}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
