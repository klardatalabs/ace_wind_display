// "How tall is Ace?" for the students screen: Ace, Big Ben and a stack of London buses drawn
// to the same scale, the buses dropping on one by one until they reach Ace's blade tip.

const TIP_M = 150; // ground to blade tip
const HUB_M = 92;
const ROTOR_R_M = 115.7 / 2;
const BIG_BEN_M = 96; // the Elizabeth Tower
const BUS_M = 4.38; // a London double-decker
const BUSES = Math.round(TIP_M / BUS_M); // 34

const GROUND = 318;
const PX = 280 / TIP_M; // pixels per metre
const y = (m) => GROUND - m * PX;

export default function HeightPanel({ skin }) {
  return (
    <figure className={`flex flex-col gap-[1vmin] rounded-[2.4vmin] p-[2vmin] ${skin.card}`}>
      <p className={`text-[clamp(12px,1.8vmin,34px)] font-semibold tracking-[0.12em] uppercase ${skin.accent}`}>How tall am I?</p>
      <svg viewBox="0 0 370 350" className="block h-[34vmin] w-auto" aria-hidden="true">
        {/* Buses, stacked */}
        {Array.from({ length: BUSES }, (_, i) => (
          <g key={i} className="grow-up" style={{ animationDelay: `${0.4 + i * 0.07}s`, transformBox: "fill-box" }}>
            <rect x="12" y={y((i + 1) * BUS_M)} width="44" height={BUS_M * PX - 0.8} rx="1.4" fill="#dc2626" />
            <rect x="16" y={y((i + 1) * BUS_M) + 1.4} width="36" height={BUS_M * PX * 0.3} fill="#fde2e2" opacity="0.85" />
          </g>
        ))}
        {/* Big Ben */}
        <g fill="var(--color-moss-800)" opacity="0.85">
          <rect x="85" y={y(BIG_BEN_M * 0.72)} width="30" height={BIG_BEN_M * 0.72 * PX} />
          <rect x="81" y={y(BIG_BEN_M * 0.8)} width="38" height={BIG_BEN_M * 0.08 * PX} />
          <circle cx="100" cy={y(BIG_BEN_M * 0.76)} r="9" fill="#fef3c7" />
          <path d={`M83,${y(BIG_BEN_M * 0.8)} L100,${y(BIG_BEN_M)} L117,${y(BIG_BEN_M * 0.8)} Z`} />
        </g>
        {/* Ace */}
        <g stroke="var(--color-moss-950)" strokeLinecap="round" strokeLinejoin="round">
          <path d={`M244,${GROUND} L248,${y(HUB_M)} L252,${y(HUB_M)} L256,${GROUND} Z`} fill="#fff" strokeWidth="2" />
          <path d={`M250,${y(HUB_M)} L250,${y(TIP_M)}`} strokeWidth="5" />
          <path d={`M250,${y(HUB_M)} L${250 + ROTOR_R_M * PX * 0.866},${y(HUB_M - ROTOR_R_M * 0.5)}`} strokeWidth="5" />
          <path d={`M250,${y(HUB_M)} L${250 - ROTOR_R_M * PX * 0.866},${y(HUB_M - ROTOR_R_M * 0.5)}`} strokeWidth="5" />
          <circle cx="250" cy={y(HUB_M)} r="5" fill="#fff" strokeWidth="2" />
        </g>
        <path d={`M8,${y(TIP_M)} L362,${y(TIP_M)}`} stroke="var(--color-moss-400)" strokeWidth="1.5" strokeDasharray="5 5" />
        <line x1="0" y1={GROUND} x2="370" y2={GROUND} stroke="var(--color-moss-700)" strokeWidth="3" />
        <g fontSize="13" fontWeight="600" fill="var(--color-moss-900)" textAnchor="middle">
          <text x="34" y="338">{BUSES} buses</text>
          <text x="100" y="338">Big Ben</text>
          <text x="250" y="338">Me</text>
        </g>
      </svg>
      <figcaption className={`max-w-[34vmin] text-[clamp(12px,1.6vmin,30px)] leading-snug ${skin.muted}`}>
        {TIP_M} m to my blade tip: {BUSES} double-decker buses stacked up. Big Ben is {BIG_BEN_M} m.
      </figcaption>
    </figure>
  );
}
