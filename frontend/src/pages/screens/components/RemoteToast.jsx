// Announces that a visitor's phone just drove the screen. Never shows what they typed.

import { useEffect, useRef } from "react";
import { gsap } from "../../../lib/gsap.js";
import Icon from "../../../components/ui/Icon.jsx";

const TEXT = {
  look_inside: "A visitor opened up the turbine from their phone",
  tower_inside: "A visitor is looking up inside the tower",
  close_inside: "A visitor closed the turbine back up",
  fly_to_nacelle: "A visitor flew us up to the nacelle",
  fly_to_base: "A visitor took us down to the base",
  overview: "A visitor zoomed out to the whole site",
  spin_blades: "A visitor gave the blades a spin!",
};

export default function RemoteToast({ event, skin }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!event || !ref.current) return;
    const tl = gsap
      .timeline()
      .fromTo(ref.current, { y: -40, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.6)" })
      .to(ref.current, { y: -20, opacity: 0, duration: 0.5, ease: "power2.in" }, "+=4.2");
    return () => tl.kill();
  }, [event]);
  if (!event) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[11vmin] z-30 flex justify-center">
      <div ref={ref} className={`flex items-center gap-[1vmin] rounded-full px-[2vmin] py-[1vmin] opacity-0 ${skin.card}`}>
        <span className="flex size-[4vmin] items-center justify-center rounded-full bg-moss-400 text-white">
          <Icon name="qrcode" className="size-[2.4vmin]" />
        </span>
        <span className={`font-display text-[clamp(14px,2vmin,40px)] font-medium ${skin.text}`}>{TEXT[event.action] ?? "A visitor is exploring the turbine"}</span>
      </div>
    </div>
  );
}
