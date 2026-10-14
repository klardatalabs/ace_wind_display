// The four screens. Phones swipe through them in a snap row; wider screens show a grid.
// Hover: the card lifts and its photo brightens.

import { Link } from "react-router";
import SectionHeading from "../../../components/ui/SectionHeading.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import { SCREEN_CARDS } from "../../../content/landing.js";
import { IMAGES } from "../../../content/images.js";

function Card({ card }) {
  const img = IMAGES[card.image];
  return (
    <li className="w-[78vw] max-w-[340px] shrink-0 snap-start sm:w-auto sm:max-w-none">
      <Link
        to={card.to}
        className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-4xl p-7 transition-transform duration-300 ease-out hover:-translate-y-1"
      >
        <img
          src={img.src}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-[transform,filter] duration-700 ease-out group-hover:scale-105 group-hover:brightness-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-moss-950/85 via-moss-950/25 to-transparent" />
        {img.credit && <span className="absolute top-7 right-6 text-[10px] text-white/70">{img.credit}</span>}
        <span className="absolute top-6 left-6 flex size-11 items-center justify-center rounded-2xl bg-white/20 text-white ring-1 ring-white/30 backdrop-blur-md">
          <Icon name={card.icon} className="size-6" />
        </span>
        <div className="relative">
          <h3 className="font-display text-[26px] leading-tight font-medium tracking-tight text-white">{card.title}</h3>
          <p className="mt-2 text-[15px] text-white/80">{card.blurb}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-white">
            Open <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </li>
  );
}

export default function ScreensScroller() {
  return (
    <section id="screens" className="px-6 pt-16 pb-10 md:px-12 md:pt-24 md:pb-14 xl:px-36">
      <div className="mx-auto max-w-[1280px]">
        <SectionHeading eyebrow="The screens" title="A story for every audience." />
        <ul
          data-lenis-prevent-touch
          className="no-scrollbar -mx-6 mt-10 flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto px-6 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:mt-14 lg:grid-cols-4"
        >
          {SCREEN_CARDS.map((c) => (
            <Card key={c.key} card={c} />
          ))}
        </ul>
      </div>
    </section>
  );
}
