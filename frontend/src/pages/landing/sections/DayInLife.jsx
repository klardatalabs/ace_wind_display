// "A day on the hill": auto-advancing photo slides, one per moment of the turbine's day.

import { useAutoplaySteps } from "../../../hooks/useAutoplaySteps.js";
import SectionHeading from "../../../components/ui/SectionHeading.jsx";
import StepPills from "../../../components/ui/StepPills.jsx";
import DuotoneImage from "../../../components/ui/DuotoneImage.jsx";
import { DAY_IN_LIFE } from "../../../content/landing.js";
import { IMAGES } from "../../../content/images.js";

export default function DayInLife() {
  const { ref, index, progress, goTo, hoverProps } = useAutoplaySteps(DAY_IN_LIFE.length, 7000);

  return (
    <section className="px-6 pt-16 pb-16 md:px-12 md:pt-24 xl:px-36">
      <div className="mx-auto max-w-[1280px]">
        <SectionHeading eyebrow="A day on the hill" title={<>Meet Ace.<br />Here's a day in its life.</>}>
          From first light to the evening peak, the turbine is working for the neighbourhood.
        </SectionHeading>
        <div ref={ref} {...hoverProps} className="relative mt-10 md:mt-14">
          <div className="relative h-[480px] overflow-hidden rounded-4xl bg-moss-950 md:h-[520px]">
            {DAY_IN_LIFE.map((s, i) => (
              <div
                key={s.when}
                aria-hidden={i !== index}
                inert={i !== index ? true : undefined}
                className={`absolute inset-0 transition-opacity duration-700 ${i === index ? "opacity-100" : "pointer-events-none opacity-0"}`}
              >
                {/* Phones: full-bleed photo. Desktop: photo fills the right 60%, text sits on the dark left panel. */}
                <DuotoneImage
                  src={IMAGES[s.image].src}
                  alt={IMAGES[s.image].alt}
                  className="absolute inset-0 md:left-[40%]"
                  imgClassName={`transition-transform duration-[1500ms] ${i === index ? "scale-100" : "scale-105"}`}
                  style={{ objectPosition: s.focus }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-moss-950/85 via-moss-950/35 to-transparent md:bg-gradient-to-r md:from-moss-950 md:from-40% md:via-moss-950/40 md:via-55% md:to-transparent md:to-75%" />
                <div className="relative flex h-full max-w-[520px] flex-col justify-end gap-4 p-8 text-white md:max-w-[46%] md:justify-center md:p-12 xl:p-16">
                  <p className="text-xs font-semibold tracking-[0.08em] text-white/75 uppercase">{s.when}</p>
                  <h3 className="font-display text-3xl leading-[1.1] font-medium tracking-tight md:text-4xl xl:text-[40px]">{s.title}</h3>
                  <p className="text-base leading-relaxed text-white/85 md:text-lg">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
          <StepPills steps={DAY_IN_LIFE.map((d) => d.when.split(" · ")[1])} index={index} progress={progress} onSelect={goTo} className="mt-8" />
        </div>
      </div>
    </section>
  );
}
