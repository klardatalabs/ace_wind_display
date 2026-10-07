// The Weston Wind mark: a three-blade rotor that turns at the real turbine's speed
// (scaled up so slow rpm still reads as motion) and spins up on hover.

import { useEffect, useRef } from "react";
import { useLive } from "../../store/useLiveStore.js";
import { useReducedMotion } from "../../hooks/useReducedMotion.js";

const BLADE = "M20 20 C 18.6 14 18.4 8 20 2.6 C 21.6 8 21.4 14 20 20 Z";

export default function TurbineMark({ className = "size-9", spinWithLive = true, hoverBoost = true }) {
  const rotor = useRef(null);
  const angle = useRef(0);
  const boost = useRef(0);
  const { rotorRpm } = useLive();
  const rpmRef = useRef(rotorRpm);
  rpmRef.current = rotorRpm;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return undefined;
    let raf;
    let last = performance.now();
    const loop = (t) => {
      const dt = (t - last) / 1000;
      last = t;
      const base = spinWithLive ? Math.max(rpmRef.current, 2) * 6 * 2.2 : 40; // deg/s
      angle.current = (angle.current + (base + boost.current) * dt) % 360;
      boost.current *= 0.96;
      if (rotor.current) rotor.current.setAttribute("transform", `rotate(${angle.current} 20 20)`);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced, spinWithLive]);

  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      onMouseEnter={hoverBoost ? () => (boost.current = 720) : undefined}
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="18.5" className="fill-moss-50 stroke-moss-200" strokeWidth="1" />
      <path d="M19.2 21 L18.4 37 H21.6 L20.8 21 Z" className="fill-moss-300" />
      <g ref={rotor}>
        {[0, 120, 240].map((r) => (
          <path key={r} d={BLADE} transform={`rotate(${r} 20 20)`} className="fill-moss-700" />
        ))}
      </g>
      <circle cx="20" cy="20" r="1.9" className="fill-moss-900" />
    </svg>
  );
}
