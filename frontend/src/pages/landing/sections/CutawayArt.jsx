// Side-on nacelle + upper tower drawing for LookInside. Animation hooks:
// .cut-shell (outer casing), .cut-front (front half that peels), .cut-plane,
// .cut-internal (parts), .cut-label (callouts).

const LABELS = [
  { x: 118, y: 150, text: "Hub & blade roots" },
  { x: 220, y: 92, text: "Ring generator (no gearbox)" },
  { x: 372, y: 118, text: "Converter cabinets" },
  { x: 318, y: 262, text: "Yaw drives" },
  { x: 300, y: 372, text: "Ladder & service lift" },
];

export default function CutawayArt() {
  return (
    <div className="relative aspect-[600/480] w-full overflow-hidden rounded-[40px] bg-moss-950 ring-1 ring-moss-800">
      <svg viewBox="0 0 600 480" className="absolute inset-0 size-full" aria-label="Cutaway drawing of the turbine nacelle">
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" fill="none" stroke="var(--color-moss-800)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="600" height="480" fill="url(#grid)" />

        {/* internals */}
        <g className="cut-internal">
          <rect x="250" y="270" width="36" height="210" fill="none" stroke="var(--color-moss-500)" strokeWidth="2" />
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1="256" x2="280" y1={290 + i * 21} y2={290 + i * 21} stroke="var(--color-moss-400)" strokeWidth="2" />
          ))}
          <rect x="292" y="330" width="22" height="34" rx="3" fill="var(--color-moss-600)" />
        </g>
        <g className="cut-internal">
          <ellipse cx="268" cy="250" rx="70" ry="10" fill="none" stroke="var(--color-moss-300)" strokeWidth="4" />
          {[218, 318].map((x) => (
            <rect key={x} x={x - 8} y="226" width="16" height="22" rx="3" fill="var(--color-moss-400)" />
          ))}
        </g>
        <g className="cut-internal">
          <circle cx="210" cy="180" r="58" fill="none" stroke="var(--color-moss-300)" strokeWidth="10" />
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            return <circle key={i} cx={210 + Math.cos(a) * 58} cy={180 + Math.sin(a) * 58} r="4" fill="var(--color-moss-200)" />;
          })}
          <circle cx="210" cy="180" r="22" fill="var(--color-moss-600)" />
        </g>
        <g className="cut-internal">
          <rect x="300" y="150" width="34" height="62" rx="4" fill="var(--color-moss-700)" stroke="var(--color-moss-400)" strokeWidth="2" />
          <rect x="342" y="150" width="34" height="62" rx="4" fill="var(--color-moss-700)" stroke="var(--color-moss-400)" strokeWidth="2" />
          <rect x="384" y="160" width="40" height="52" rx="4" fill="var(--color-moss-800)" stroke="var(--color-moss-400)" strokeWidth="2" />
        </g>
        <g className="cut-internal">
          <path d="M150 180 C 120 150, 92 160, 80 180 C 92 200, 120 210, 150 180 Z" fill="var(--color-moss-500)" />
          <path d="M96 172 L 30 40 M96 188 L 34 330" stroke="var(--color-moss-300)" strokeWidth="10" strokeLinecap="round" />
        </g>

        {/* shell: back half stays, front half peels */}
        <g className="cut-shell">
          <path d="M140 120 Q 150 100 200 98 L 440 98 Q 470 100 470 130 L 470 228 Q 466 246 440 246 L 200 246 Q 150 244 140 220 Z" fill="var(--color-moss-100)" opacity="0.9" />
          <path d="M240 246 L 296 246 L 300 480 L 236 480 Z" fill="var(--color-moss-100)" opacity="0.9" />
        </g>
        <g className="cut-shell cut-front">
          <path d="M140 120 Q 150 100 200 98 L 440 98 Q 470 100 470 130 L 470 172 L 140 172 Z" fill="white" />
          <path d="M268 246 L 296 246 L 300 480 L 268 480 Z" fill="white" />
        </g>

        {/* cutting plane */}
        <rect className="cut-plane" x="0" y="70" width="3" height="410" fill="var(--color-moss-200)" opacity="0" />

        {LABELS.map((l) => (
          <g key={l.text} className="cut-label" opacity="0" transform="translate(0 8)">
            <circle cx={l.x} cy={l.y} r="5" fill="white" />
            <line x1={l.x} y1={l.y} x2={l.x + 26} y2={l.y - 22} stroke="white" strokeWidth="1.5" />
            <text x={l.x + 30} y={l.y - 26} fill="white" fontSize="15" fontFamily="var(--font-sans)" fontWeight="500">
              {l.text}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
