// A small animated scene for each moment of the build story (content/buildTimeline.js),
// drawn in plain SVG and animated with CSS (effects.css, "art-" classes), so it costs the
// GPU next to nothing. Each scene plays once in about three seconds, then idles gently.

const INK = "var(--color-moss-950)";
const GREEN = "var(--color-moss-400)";
const box = { transformBox: "fill-box", transformOrigin: "center" };
const at = (s) => ({ animationDelay: `${s}s` });

function Person({ x, colour }) {
  return (
    <g>
      <circle cx={x} cy="88" r="11" fill="#f2c9a0" stroke={INK} strokeWidth="2.5" />
      <path d={`M${x - 16},140 Q${x - 16},104 ${x},104 Q${x + 16},104 ${x + 16},140 Z`} fill={colour} stroke={INK} strokeWidth="2.5" />
    </g>
  );
}

const SCENES = {
  idea: () => (
    <>
      <Person x={64} colour="#60a5fa" />
      <Person x={136} colour="#f472b6" />
      <g className="art-pop" style={{ ...box, ...at(0.4) }}>
        <circle className="art-glow" cx="100" cy="40" r="26" fill="#fde68a" opacity="0.6" style={box} />
        <path d="M100,18 a17,17 0 0 1 10,31 v7 h-20 v-7 a17,17 0 0 1 10,-31 Z" fill="#fde047" stroke={INK} strokeWidth="2.5" />
        <rect x="91" y="57" width="18" height="6" rx="2" fill="#94a3b8" stroke={INK} strokeWidth="2" />
      </g>
    </>
  ),
  grid: () => (
    <>
      <rect x="128" y="62" width="44" height="56" rx="8" fill="#fff" stroke={INK} strokeWidth="3" />
      <rect x="140" y="80" width="6" height="16" rx="2" fill={INK} />
      <rect x="154" y="80" width="6" height="16" rx="2" fill={INK} />
      <g className="art-plug" style={box}>
        <path d="M10,90 H78" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <rect x="78" y="74" width="34" height="32" rx="6" fill={GREEN} stroke={INK} strokeWidth="3" />
        <rect x="112" y="80" width="12" height="5" fill={INK} />
        <rect x="112" y="95" width="12" height="5" fill={INK} />
      </g>
      {[0, 1, 2].map((i) => (
        <path key={i} className="art-spark" style={at(1.3 + i * 0.12)} d={["M150,52 L158,36", "M176,70 L192,62", "M176,110 L192,118"][i]} stroke="#facc15" strokeWidth="5" strokeLinecap="round" />
      ))}
    </>
  ),
  planning: () => (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} className="art-hand" style={{ ...box, ...at(0.3 + i * 0.22) }}>
          <rect x={18 + i * 29} y="70" width="16" height="70" rx="8" fill={["#f2c9a0", "#c68642", "#f2c9a0", "#8d5524", "#e0ac69", "#f2c9a0"][i]} stroke={INK} strokeWidth="2.5" />
        </g>
      ))}
      <g className="art-stamp" style={{ ...box, ...at(1.9) }}>
        <rect x="52" y="20" width="96" height="40" rx="8" fill="none" stroke="#16a34a" strokeWidth="5" transform="rotate(-8 100 40)" />
        <text x="100" y="50" textAnchor="middle" fontSize="28" fontWeight="800" fill="#16a34a" transform="rotate(-8 100 40)">YES!</text>
      </g>
    </>
  ),
  money: () => (
    <>
      <path d="M60,60 h80 v70 a10,10 0 0 1 -10,10 h-60 a10,10 0 0 1 -10,-10 Z" fill="#e0f2fe" stroke={INK} strokeWidth="3" />
      <rect className="art-fill" x="63" y="70" width="74" height="67" fill="#fde68a" style={{ transformBox: "fill-box", transformOrigin: "bottom" }} />
      <rect x="54" y="52" width="92" height="12" rx="4" fill="#94a3b8" stroke={INK} strokeWidth="3" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} className="art-coin" style={at(0.2 + i * 0.45)}>
          <ellipse cx={86 + (i % 2) * 28} cy="20" rx="12" ry="12" fill="#facc15" stroke={INK} strokeWidth="2.5" />
          <text x={86 + (i % 2) * 28} y="25" textAnchor="middle" fontSize="13" fontWeight="800" fill={INK}>£</text>
        </g>
      ))}
    </>
  ),
  piles: () => (
    <>
      <rect x="0" y="70" width="200" height="80" fill="#a16207" opacity="0.55" />
      <path d="M0,70 H200" stroke="#65a30d" strokeWidth="6" />
      {[0, 1, 2].map((i) => (
        <rect key={i} className="art-pile" x={48 + i * 44} y="40" width="16" height="100" fill="#cbd5e1" stroke={INK} strokeWidth="2.5" style={{ ...at(0.3 + i * 0.5), transformBox: "fill-box" }} />
      ))}
      <g className="art-hammer" style={box}>
        <rect x="40" y="6" width="32" height="18" rx="3" fill="#475569" stroke={INK} strokeWidth="2.5" />
      </g>
    </>
  ),
  blades: () => (
    <>
      <path d="M0,124 H200" stroke="#94a3b8" strokeWidth="4" strokeDasharray="14 10" />
      <g className="art-drive">
        <g>
          <rect x="-118" y="96" width="40" height="22" rx="4" fill="#e2e8f0" stroke={INK} strokeWidth="2.5" />
          <rect x="-110" y="100" width="14" height="10" fill="#1e3a8a" />
          <rect className="art-siren" x="-104" y="88" width="16" height="7" rx="2" fill="#3b82f6" />
          <circle cx="-108" cy="120" r="5" fill={INK} />
          <circle cx="-86" cy="120" r="5" fill={INK} />
        </g>
        <g transform="translate(40 0)">
          <rect x="-60" y="92" width="34" height="26" rx="4" fill="#ef4444" stroke={INK} strokeWidth="2.5" />
          <rect x="-26" y="106" width="120" height="8" fill="#475569" />
          <path d="M-24,104 C10,92 60,92 108,100 L108,104 Z" fill="#fff" stroke={INK} strokeWidth="2.5" />
          {[-50, -10, 30, 70].map((x) => (
            <circle key={x} cx={x} cy="120" r="5" fill={INK} />
          ))}
        </g>
      </g>
    </>
  ),
  assembly: () => (
    <>
      <path d="M150,140 V20 H70" stroke="#f59e0b" strokeWidth="6" fill="none" />
      <path d="M150,24 L120,60" stroke="#f59e0b" strokeWidth="3" />
      <line className="art-cable" x1="84" y1="20" x2="84" y2="44" stroke={INK} strokeWidth="2" style={{ transformBox: "fill-box", transformOrigin: "top" }} />
      {[0, 1, 2].map((i) => (
        <rect key={i} className="art-section" x={70 - i * 2} y={110 - i * 30} width={28 + i * 4 - i * 6} height="30" rx="3" fill="#fff" stroke={INK} strokeWidth="2.5" style={{ ...at(0.3 + i * 0.7), transformBox: "fill-box" }} />
      ))}
      <rect className="art-section" x="66" y="20" width="36" height="16" rx="6" fill="#f1f5f9" stroke={INK} strokeWidth="2.5" style={{ ...at(2.4), transformBox: "fill-box" }} />
    </>
  ),
  testing: () => (
    <>
      <rect x="36" y="14" width="128" height="128" rx="10" fill="#fff" stroke={INK} strokeWidth="3" />
      {["Blades", "Generator", "Grid"].map((label, i) => (
        <g key={label}>
          <rect x="52" y={34 + i * 34} width="20" height="20" rx="4" fill="none" stroke={INK} strokeWidth="2.5" />
          <path className="art-tick" d={`M55,${45 + i * 34} l6,6 l12,-14`} stroke="#16a34a" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" style={at(0.4 + i * 0.6)} />
          <text x="82" y={50 + i * 34} fontSize="15" fontWeight="600" fill={INK}>{label}</text>
        </g>
      ))}
    </>
  ),
  running: () => (
    <>
      <rect x="70" y="40" width="60" height="90" rx="12" fill="#fff" stroke={INK} strokeWidth="3" />
      <g className="art-switch" style={{ transformBox: "fill-box", transformOrigin: "center bottom" }}>
        <rect x="90" y="56" width="20" height="34" rx="6" fill={GREEN} stroke={INK} strokeWidth="2.5" />
      </g>
      <text x="100" y="116" textAnchor="middle" fontSize="16" fontWeight="800" fill="#16a34a">ON</text>
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} className="art-confetti" x={12 + i * 13} y="-10" width="6" height="10" rx="1" fill={["#f43f5e", "#facc15", "#22c55e", "#3b82f6", "#a855f7"][i % 5]} style={at(1 + (i % 5) * 0.15)} />
      ))}
    </>
  ),
};

export default function MilestoneArt({ id, className = "" }) {
  const Scene = SCENES[id];
  if (!Scene) return null;
  return (
    <svg viewBox="0 0 200 150" className={`overflow-hidden ${className}`} aria-hidden="true">
      <Scene />
    </svg>
  );
}
