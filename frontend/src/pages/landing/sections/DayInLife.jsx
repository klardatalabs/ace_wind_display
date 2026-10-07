// "A day on the hill": auto-advancing story slides, each with a phone-style chat card.

import { useAutoplaySteps } from "../../../hooks/useAutoplaySteps.js";
import SectionHeading from "../../../components/ui/SectionHeading.jsx";
import StepPills from "../../../components/ui/StepPills.jsx";
import TurbineMark from "../../../components/brand/TurbineMark.jsx";
import DuotoneImage from "../../../components/ui/DuotoneImage.jsx";
import { DAY_IN_LIFE } from "../../../content/landing.js";
import { IMAGES } from "../../../content/images.js";

// Each slide gets its own shade of the single brand hue — dawn light to night dark.
// Slides with a photo show it behind the chat card, fading out toward the text.
const BACKDROPS = [
  "from-moss-200 via-moss-100 to-moss-50",
  "from-moss-300 via-moss-200 to-moss-100",
  "from-moss-400 via-moss-300 to-moss-200",
  "from-moss-700 via-moss-600 to-moss-400",
  "from-moss-950 via-moss-900 to-moss-800",
];

function ChatCard({ lines, dark }) {
  return (
    <div className="w-full max-w-[380px] rounded-2xl border border-moss-900/5 bg-white p-5 shadow-[0_10px_40px_rgb(10_21_29/0.12)]">
      <ul className="space-y-4">
        {lines.map((l, i) => (
          <li key={i} className="flex items-start gap-3">
            {l.who === "Ace" ? (
              <TurbineMark className="size-8 shrink-0" />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-moss-100 text-xs font-bold text-moss-700">You</span>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-moss-950">{l.who === "Ace" ? "Ace" : "Visitor"}</p>
              <p className="mt-0.5 text-sm leading-snug text-moss-900/75">{l.text}</p>
            </div>
          </li>
        ))}
      </ul>
      {dark && <p className="mt-4 text-right text-[11px] text-moss-900/40">Illustrative conversation</p>}
    </div>
  );
}

export default function DayInLife() {
  const { ref, index, progress, goTo, hoverProps } = useAutoplaySteps(DAY_IN_LIFE.length, 9000);

  return (
    <section className="px-6 pt-16 pb-16 md:px-12 md:pt-24 xl:px-36">
      <div className="mx-auto max-w-[1280px]">
        <SectionHeading eyebrow="A day on the hill" title={<>Meet Ace.<br />Here's a day in its life.</>}>
          From first light to the evening peak, the turbine is working — and talking to whoever scans a screen.
        </SectionHeading>
        <div ref={ref} {...hoverProps} className="relative mt-10 md:mt-14">
          <div className="relative min-h-[640px] md:min-h-[440px]">
            {DAY_IN_LIFE.map((s, i) => {
              const dark = i >= 3;
              return (
                <div
                  key={s.when}
                  aria-hidden={i !== index}
                  inert={i !== index ? true : undefined}
                  className={`absolute inset-0 transition-opacity duration-500 ${i === index ? "opacity-100" : "pointer-events-none opacity-0"}`}
                >
                  <div className={`relative grid h-full grid-cols-1 items-center gap-8 overflow-hidden rounded-4xl bg-gradient-to-br p-8 md:grid-cols-2 md:gap-12 md:p-12 xl:p-16 ${BACKDROPS[i]}`}>
                    {s.image && (
                      <DuotoneImage
                        src={IMAGES[s.image].src}
                        alt=""
                        soft={!dark}
                        className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent_35%,black_75%)] md:[mask-image:linear-gradient(to_right,transparent_30%,black_70%)]"
                      />
                    )}
                    <div className={`relative flex max-w-[460px] flex-col gap-4 ${dark ? "text-white" : "text-moss-950"}`}>
                      <p className={`text-xs font-semibold tracking-[0.08em] uppercase ${dark ? "text-white/70" : "text-moss-700"}`}>{s.when}</p>
                      <h3 className="font-display text-3xl leading-[1.1] font-medium tracking-tight md:text-4xl xl:text-[40px]">{s.title}</h3>
                      <p className={`text-base leading-relaxed md:text-lg ${dark ? "text-white/85" : "text-moss-900/75"}`}>{s.body}</p>
                    </div>
                    <div className="relative flex items-center justify-center md:justify-end">
                      <ChatCard lines={s.chat} dark />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <StepPills steps={DAY_IN_LIFE.map((d) => d.when.split(" · ")[1])} index={index} progress={progress} onSelect={goTo} className="mt-8" />
        </div>
      </div>
    </section>
  );
}
