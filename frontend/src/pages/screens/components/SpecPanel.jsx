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
      {SPECS.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className={skin.muted}>{k}</dt>
          <dd className={`font-mono font-medium ${skin.text}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
