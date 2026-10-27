// Four layered slides (Wind → Turbine → Grid → Homes). Each pairs a photo with a glass card
// showing a real turbine figure, placed in an empty patch of that photo so it never sits on
// the blades. Step pills auto-advance.

import { useLive } from "../../../store/useLiveStore.js";
import { useAutoplaySteps } from "../../../hooks/useAutoplaySteps.js";
import StepPills from "../../../components/ui/StepPills.jsx";
import DuotoneImage from "../../../components/ui/DuotoneImage.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import { IMAGES } from "../../../content/images.js";
import { HERO } from "../../../content/landing.js";
import { homesPoweredNow, tipSpeedMs, msToMph, beaufortLabel } from "../../../lib/impact.js";
import { formatInt, formatPower } from "../../../lib/format.js";

function GlassCard({ icon, label, value, unit, caption, ready, position }) {
  return (
    <div className={`absolute w-[40%] max-w-[230px] rounded-2xl bg-moss-950/45 p-4 text-white ring-1 ring-white/15 backdrop-blur-md ${position}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-white/80 sm:text-sm">
        <Icon name={icon} className="size-4" />
        {label}
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 font-display">
        <span className="text-2xl font-bold tracking-tight tabular-nums sm:text-4xl">{ready ? value : "—"}</span>
        {ready && <span className="text-base text-white/80">{unit}</span>}
      </div>
      {ready && <p className="mt-0.5 text-xs text-white/70 sm:text-sm">{caption}</p>}
    </div>
  );
}

export default function HeroSlideshow({ className = "" }) {
  const live = useLive();
  const ready = live.real;
  const { ref, index, progress, goTo, hoverProps } = useAutoplaySteps(HERO.slides.length, 5000);
  const power = formatPower(live.powerKw);

  const slides = [
    { image: IMAGES.drone, position: "top-[50%] right-[5%]", card: { icon: "wind", label: "Wind right now", value: live.windSpeed.toFixed(1), unit: "m/s", caption: beaufortLabel(live.windSpeed) } },
    { image: IMAGES.tall, position: "top-[52%] left-[5%]", card: { icon: "fan", label: "Blade tips", value: formatInt(msToMph(tipSpeedMs(live.rotorRpm))), unit: "mph", caption: `${live.rotorRpm.toFixed(1)} turns a minute` } },
    { image: IMAGES.portrait, position: "top-[40%] right-[5%]", card: { icon: "bolt", label: "Making", value: power.value, unit: power.unit, caption: "of clean electricity" } },
    { image: IMAGES.hillside, position: "top-[6%] left-[5%]", card: { icon: "home", label: "Equivalent to", value: formatInt(homesPoweredNow(live.powerKw)), unit: "homes", caption: "assumes 0.35 kW per home" } },
  ];

  return (
    <div ref={ref} {...hoverProps} className={`relative mx-auto aspect-[1472/1672] w-full max-w-[600px] lg:mr-0 lg:ml-auto ${className}`}>
      {slides.map((s, i) => (
        <div
          key={HERO.slides[i]}
          aria-hidden={i !== index}
          className={`absolute inset-0 overflow-hidden rounded-[48px] transition-opacity duration-700 ${i === index ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <DuotoneImage
            src={s.image.src}
            alt={s.image.alt}
            className="size-full"
            imgClassName={`transition-transform duration-[1200ms] ${i === index ? "scale-100" : "scale-105"} ${i === 3 ? "object-[70%_50%]" : ""}`}
          />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-moss-950/40 to-transparent" />
          <GlassCard {...s.card} ready={ready} position={s.position} />
        </div>
      ))}
      <StepPills steps={HERO.slides} index={index} progress={progress} onSelect={goTo} tone="light" className="absolute bottom-[7%] left-1/2 -translate-x-1/2" />
    </div>
  );
}
