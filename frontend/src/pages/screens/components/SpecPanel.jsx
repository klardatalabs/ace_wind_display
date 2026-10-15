// The machine's spec sheet, its rows printing in one by one like a terminal.
const SPECS = [
  ["Model", "Enercon E-115 EP3"],
  ["Rated power", "4,245 kW"],
  ["Rotor diameter", "115.7 m"],
  ["Hub height", "≈ 92 m"],
  ["Tip height", "150 m"],
  ["Drive train", "Gearless, annular generator"],
  ["Commissioned", "March 2023"],
];

export default function SpecPanel({ skin, className = "" }) {
  return (
    <dl className={`grid grid-cols-[auto_auto] gap-x-[3vmin] gap-y-[0.9vmin] rounded-[2.4vmin] p-[2.2vmin] text-[clamp(12px,1.7vmin,32px)] ${skin.card} ${className}`}>
      {SPECS.map(([k, v], i) => (
        <div key={k} className="contents">
          <dt className={`spec-row ${skin.muted}`} style={{ animationDelay: `${0.3 + i * 0.22}s` }}>{k}</dt>
          <dd className={`spec-row font-mono font-medium ${skin.text}`} style={{ animationDelay: `${0.4 + i * 0.22}s` }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
