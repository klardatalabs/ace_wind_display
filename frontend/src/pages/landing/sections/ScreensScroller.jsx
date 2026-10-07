// Horizontal snap-scrolling cards for the three screens + Ask Ace + Developers.
// Hover: the card lifts and its duotone image cross-fades to a lighter duotone.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import SectionHeading from "../../../components/ui/SectionHeading.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import { SCREEN_CARDS } from "../../../content/landing.js";
import { IMAGES } from "../../../content/images.js";

function Card({ card }) {
  const img = IMAGES[card.image];
  return (
    <li className="w-[280px] shrink-0 snap-start sm:w-[340px] md:w-[400px]">
      <Link
        to={card.to}
        className="group relative flex aspect-[1600/2048] flex-col justify-end overflow-hidden rounded-4xl border border-moss-100 p-8 transition-transform duration-300 ease-out hover:-translate-y-1"
      >
        <div className="duotone absolute inset-0">
          <img src={img.src} alt="" loading="lazy" className="size-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105" />
        </div>
        <div className="duotone duotone-soft absolute inset-0 opacity-0 transition-opacity duration-[900ms] ease-out group-hover:opacity-100" aria-hidden="true">
          <img src={img.src} alt="" loading="lazy" className="size-full scale-105 object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-moss-950/85 via-moss-950/25 to-transparent" />
        <span className="glass-ring absolute top-6 left-6 flex size-12 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-md">
          <Icon name={card.icon} className="size-6" />
        </span>
        <div className="relative">
          <h3 className="font-display text-[28px] leading-none font-medium tracking-tight text-white md:text-[32px]">{card.title}</h3>
          <p className="mt-3 text-white/80">{card.blurb}</p>
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-white">
            Open <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </li>
  );
}

export default function ScreensScroller() {
  const scroller = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = scroller.current;
    const update = () => setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft >= el.scrollWidth - el.clientWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const step = (dir) => {
    const card = scroller.current.querySelector("li");
    scroller.current.scrollBy({ left: dir * ((card?.getBoundingClientRect().width ?? 400) + 20), behavior: "smooth" });
  };

  const arrow = "pointer-events-auto flex size-10 items-center justify-center rounded-full border border-moss-900/5 bg-white/90 text-moss-950 shadow-[0_4px_20px_rgb(10_21_29/0.08)] backdrop-blur transition-all hover:scale-105 hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:size-12";

  return (
    <section id="screens" className="pt-16 pb-10 md:pt-24 md:pb-14 xl:pt-28">
      <div className="px-6 md:px-12 xl:px-36">
        <SectionHeading eyebrow="Three screens, one turbine" title="A story for every audience." />
      </div>
      <div className="relative mt-10 md:mt-16">
        <div ref={scroller} data-lenis-prevent className="no-scrollbar snap-x snap-mandatory scroll-pl-6 overflow-x-auto md:scroll-pl-12 xl:scroll-pl-36">
          <ul className="m-0 flex list-none gap-5 px-6 py-2 md:px-12 xl:px-36">
            {SCREEN_CARDS.map((c) => (
              <Card key={c.key} card={c} />
            ))}
          </ul>
        </div>
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-2 md:px-4 xl:px-8">
          <button type="button" aria-label="Previous" disabled={edges.start} onClick={() => step(-1)} className={arrow}>
            <Icon name="arrowRight" className="size-5 rotate-180" />
          </button>
          <button type="button" aria-label="Next" disabled={edges.end} onClick={() => step(1)} className={arrow}>
            <Icon name="arrowRight" className="animate-nudge size-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
