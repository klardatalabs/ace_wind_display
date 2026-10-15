// "How tall am I?" for the students screen: Ace, Big Ben and a stack of London buses drawn
// to the same scale, and built up in front of you: Big Ben rises, Ace's tower grows and its
// blades start turning at the live rotor speed, the buses drop on one by one while a counter
// climbs to 150 m, and the dashed line at the blade tip draws itself across.

import { useEffect, useRef, useState } from "react";
import { gsap } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";

const TIP_M = 150; // ground to blade tip
const HUB_M = 92;
const ROTOR_R_M = 115.7 / 2;
const BIG_BEN_M = 96; // the Elizabeth Tower
const BUS_M = 4.38; // a London double-decker
const BUSES = Math.round(TIP_M / BUS_M); // 34

const GROUND = 318;
const PX = 280 / TIP_M; // pixels per metre
const y = (m) => GROUND - m * PX;
const HUB_Y = y(HUB_M);

const BUS_START_S = 1.2;
const BUS_EVERY_S = 0.07;
const STACKED_S = BUS_START_S + BUSES * BUS_EVERY_S; // the last bus lands

/** Metres climbing 0 → 150 in step with the buses. */
function useClimbingMetres() {
  const [m, setM] = useState(prefersReducedMotion() ? TIP_M : 0);
  const proxy = useRef({ m: 0 });
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const tween = gsap.to(proxy.current, { m: TIP_M, duration: STACKED_S - BUS_START_S, delay: BUS_START_S, ease: "none", onUpdate: () => setM(Math.round(proxy.current.m)) });
    return () => tween.kill();
  }, []);
  return m;
}

// SVG text pops in from its own centre, not the chart's corner.
const popAt = (s) => ({ animationDelay: `${s}s`, transformBox: "fill-box", transformOrigin: "center" });

const blade = (angleDeg) => {
  const a = (angleDeg * Math.PI) / 180;
  return `M250,${HUB_Y} L${250 + ROTOR_R_M * PX * Math.sin(a)},${HUB_Y - ROTOR_R_M * PX * Math.cos(a)}`;
};

export default function HeightPanel({ skin, rpm = 0 }) {
  const metres = useClimbingMetres();
  const turning = rpm >= 0.5;
  return (
    <figure className={`flex flex-col gap-[1vmin] rounded-[2.4vmin] p-[2vmin] ${skin.card}`}>
      <div className="flex items-baseline justify-between gap-[2vmin]">
        <p className={`text-[clamp(12px,1.8vmin,34px)] font-semibold tracking-[0.12em] uppercase ${skin.accent}`}>How tall am I?</p>
        <p className={`font-display text-[clamp(20px,3.8vmin,76px)] leading-none font-semibold tabular-nums ${skin.text}`}>
          {metres}
          <span className={`ml-[0.4vmin] text-[0.5em] ${skin.muted}`}>m</span>
        </p>
      </div>
      <svg viewBox="0 0 370 350" className="block h-[34vmin] w-auto" aria-hidden="true">
        {/* Big Ben rises out of the ground */}
        <g className="grow-up" fill="var(--color-moss-800)" opacity="0.85" style={{ transformBox: "fill-box", animationDelay: "0.2s" }}>
          <rect x="85" y={y(BIG_BEN_M * 0.72)} width="30" height={BIG_BEN_M * 0.72 * PX} />
          <rect x="81" y={y(BIG_BEN_M * 0.8)} width="38" height={BIG_BEN_M * 0.08 * PX} />
          <circle cx="100" cy={y(BIG_BEN_M * 0.76)} r="9" fill="#fef3c7" />
          <path d={`M83,${y(BIG_BEN_M * 0.8)} L100,${y(BIG_BEN_M)} L117,${y(BIG_BEN_M * 0.8)} Z`} />
        </g>
        {/* Ace: the tower grows, then the rotor appears and turns at the live speed */}
        <path className="grow-up" style={{ transformBox: "fill-box", animationDelay: "0.5s" }} d={`M244,${GROUND} L248,${HUB_Y} L252,${HUB_Y} L256,${GROUND} Z`} fill="#fff" stroke="var(--color-moss-950)" strokeWidth="2" strokeLinejoin="round" />
        <g className="art-pop" style={{ transformBox: "fill-box", transformOrigin: "center", animationDelay: "1s" }}>
          <g className={turning ? "chart-rotor" : ""} style={{ transformOrigin: `250px ${HUB_Y}px`, animationDuration: turning ? `${60 / rpm}s` : undefined }} stroke="var(--color-moss-950)" strokeWidth="5" strokeLinecap="round">
            {[0, 120, 240].map((a) => (
              <path key={a} d={blade(a)} />
            ))}
          </g>
          <circle cx="250" cy={HUB_Y} r="5" fill="#fff" stroke="var(--color-moss-950)" strokeWidth="2" />
        </g>
        {/* The buses, dropping on one by one */}
        {Array.from({ length: BUSES }, (_, i) => (
          <g key={i} className="bus-drop" style={{ animationDelay: `${BUS_START_S + i * BUS_EVERY_S}s` }}>
            <rect x="12" y={y((i + 1) * BUS_M)} width="44" height={BUS_M * PX - 0.8} rx="1.4" fill="#dc2626" />
            <rect x="16" y={y((i + 1) * BUS_M) + 1.4} width="36" height={BUS_M * PX * 0.3} fill="#fde2e2" opacity="0.85" />
          </g>
        ))}
        {/* The blade-tip line draws itself across once the buses reach it */}
        <path className="chart-draw" style={{ animationDelay: `${STACKED_S}s` }} d={`M8,${y(TIP_M)} L362,${y(TIP_M)}`} stroke="var(--color-moss-400)" strokeWidth="1.5" strokeDasharray="5 5" fill="none" />
        <text className="milestone-in" style={popAt(STACKED_S + 0.6)} x="300" y={y(TIP_M) - 6} fontSize="12" fontWeight="700" fill="var(--color-moss-600)" textAnchor="middle">
          {TIP_M} m tip
        </text>
        <line x1="0" y1={GROUND} x2="370" y2={GROUND} stroke="var(--color-moss-700)" strokeWidth="3" />
        <g fontSize="13" fontWeight="600" fill="var(--color-moss-900)" textAnchor="middle">
          <text className="milestone-in" style={popAt(STACKED_S)} x="34" y="338">
            {BUSES} buses
          </text>
          <text className="milestone-in" style={popAt(0.5)} x="100" y="338">
            Big Ben
          </text>
          <text className="milestone-in" style={popAt(0.9)} x="250" y="338">
            Me
          </text>
        </g>
      </svg>
      <figcaption className={`max-w-[34vmin] text-[clamp(12px,1.6vmin,30px)] leading-snug ${skin.muted}`}>
        {TIP_M} m to my blade tip: {BUSES} double-decker buses stacked up. Big Ben is {BIG_BEN_M} m.
      </figcaption>
    </figure>
  );
}
