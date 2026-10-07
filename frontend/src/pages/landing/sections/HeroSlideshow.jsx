// Four layered slides (Wind → Turbine → Grid → Homes). Each pairs a duotone image with a
// glass card showing a live figure. Inactive slides blur out; step pills auto-advance.

import { useLive } from "../../../store/useLiveStore.js";
import { useAutoplaySteps } from "../../../hooks/useAutoplaySteps.js";
import StepPills from "../../../components/ui/StepPills.jsx";
import DuotoneImage from "../../../components/ui/DuotoneImage.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import { IMAGES } from "../../../content/images.js";
import { HERO } from "../../../content/landing.js";
import { homesPoweredNow, tipSpeedMs, msToMph, beaufortLabel } from "../../../lib/impact.js";
import { formatInt, formatPower } from "../../../lib/format.js";

function GlassCard({ icon, label, value, unit, caption }) {
  return (
    <div className="glass-ring absolute top-[9%] left-1/2 w-[78%] max-w-[340px] -translate-x-1/2 rounded-3xl bg-white/20 p-5 text-white shadow-[0_20px_60px_rgb(6_33_26/0.25)] backdrop-blur-xl">
      <div className="flex items-center gap-2 text-sm font-medium text-white/85">
        <Icon name={icon} className="size-5" />
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2 font-display">
        <span className="text-5xl font-bold tracking-tight tabular-nums">{value}</span>
        <span className="text-xl text-white/80">{unit}</span>
      </div>
      <p className="mt-1 text-sm text-white/75">{caption}</p>
    </div>
  );
}

export default function HeroSlideshow({ className = "" }) {
  const live = useLive();
  const { ref, index, progress, goTo, hoverProps } = useAutoplaySteps(HERO.slides.length, 5000);
  const power = formatPower(live.powerKw);

  const slides = [
    { image: IMAGES.drone, card: { icon: "wind", label: "Wind right now", value: live.windSpeed.toFixed(1), unit: "m/s", caption: beaufortLabel(live.windSpeed) } },
    { image: IMAGES.tall, card: { icon: "fan", label: "Blade tips", value: formatInt(msToMph(tipSpeedMs(live.rotorRpm))), unit: "mph", caption: `${live.rotorRpm.toFixed(1)} turns a minute` } },
    { image: IMAGES.portrait, card: { icon: "bolt", label: "Making", value: power.value, unit: power.unit, caption: "of clean electricity" } },
    { image: IMAGES.hillside, card: { icon: "home", label: "Enough for", value: formatInt(homesPoweredNow(live.powerKw)), unit: "homes", caption: "at average UK demand" } },
  ];

  return (
    <div ref={ref} {...hoverProps} className={`relative mx-auto aspect-[1472/1672] w-full max-w-[600px] lg:mr-0 lg:ml-auto ${className}`}>
      {slides.map((s, i) => (
        <div
          key={HERO.slides[i]}
          aria-hidden={i !== index}
          className={`absolute inset-0 overflow-hidden rounded-[48px] transition-opacity duration-500 ${i === index ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <DuotoneImage
            src={s.image.src}
            alt={s.image.alt}
            className="size-full"
            imgClassName={`transition-[filter,transform] duration-700 ${i === index ? "scale-100 blur-0" : "scale-105 blur-[6px]"} ${i === 3 ? "object-[70%_50%]" : ""}`}
          />
          <GlassCard {...s.card} />
        </div>
      ))}
      <StepPills steps={HERO.slides} index={index} progress={progress} onSelect={goTo} tone="light" className="absolute bottom-[10%] left-1/2 -translate-x-1/2" />
    </div>
  );
}
