// Single-hue illustration for HowItWorks. Class names are animation hooks:
// .art-gust (wind lines), .art-rotor (blades), .energy-path (drawn line), .art-home-glow.

const HOMES = [0, 1, 2, 3, 4];

export default function EnergyPathArt() {
  return (
    <div className="relative aspect-[560/520] w-full overflow-hidden rounded-[40px] bg-gradient-to-b from-moss-100 via-moss-50 to-white ring-1 ring-moss-100">
      <svg viewBox="0 0 560 520" className="absolute inset-0 size-full" aria-hidden="true">
        {/* wind gusts */}
        {[90, 130, 170].map((y, i) => (
          <path key={y} className="art-gust" d={`M20 ${y} q40 -18 80 0 t80 0`} fill="none" stroke="var(--color-moss-300)" strokeWidth="5" strokeLinecap="round" opacity={0.9 - i * 0.2} />
        ))}
        {/* ground */}
        <path d="M0 430 C140 400 300 410 560 395 V520 H0 Z" fill="var(--color-moss-200)" />
        <path d="M0 460 C180 440 360 450 560 440 V520 H0 Z" fill="var(--color-moss-300)" opacity="0.6" />
        {/* tower + nacelle */}
        <path d="M232 412 L238 160 H250 L256 412 Z" fill="white" stroke="var(--color-moss-200)" strokeWidth="2" />
        <rect x="236" y="146" width="44" height="20" rx="9" fill="white" stroke="var(--color-moss-200)" strokeWidth="2" />
        {/* rotor */}
        <g className="art-rotor" style={{ transformBox: "fill-box" }}>
          {[0, 120, 240].map((r) => (
            <path key={r} d="M244 156 C238 120 238 80 244 40 C250 80 252 120 244 156 Z" fill="white" stroke="var(--color-moss-300)" strokeWidth="2" transform={`rotate(${r} 244 156)`} />
          ))}
          <circle cx="244" cy="156" r="9" fill="var(--color-moss-700)" />
        </g>
        {/* generator glow */}
        <circle cx="266" cy="156" r="6" fill="var(--color-moss-500)" />
        {/* transformer */}
        <rect x="282" y="384" width="38" height="30" rx="5" fill="var(--color-moss-600)" />
        {/* grid pylon */}
        <path d="M392 412 L406 300 L420 412 M396 380 H416 M400 345 H412 M380 318 H432" stroke="var(--color-moss-700)" strokeWidth="4" fill="none" strokeLinejoin="round" />
        {/* homes */}
        {HOMES.map((i) => {
          const x = 440 + (i % 3) * 38;
          const y = 360 + Math.floor(i / 3) * 34 + (i % 2) * 6;
          return (
            <g key={i}>
              <path d={`M${x} ${y + 24} V${y + 10} L${x + 14} ${y} L${x + 28} ${y + 10} V${y + 24} Z`} fill="white" stroke="var(--color-moss-400)" strokeWidth="2" />
              <rect className="art-home-glow" x={x + 10} y={y + 12} width="8" height="8" rx="1.5" fill="var(--color-moss-400)" opacity="0.15" />
            </g>
          );
        })}
        {/* the energy line */}
        <path
          className="energy-path"
          d="M110 130 C170 130 210 150 244 156 C262 160 266 170 248 200 L246 398 C250 410 270 400 300 398 C340 396 370 330 406 318 C430 312 440 360 474 372"
          fill="none"
          stroke="var(--color-moss-600)"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
