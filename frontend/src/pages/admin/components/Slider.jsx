export default function Slider({ label, value, min, max, step = 0.1, unit, onChange, disabled, hint, format = (v) => v }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className={`block ${disabled ? "opacity-50" : ""}`}>
      <span className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-moss-900">{label}</span>
        <span className="font-mono text-moss-700 tabular-nums">
          {format(value)}
          {unit && <span className="ml-1 text-moss-500">{unit}</span>}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ww-range mt-2 w-full"
        style={{ "--fill": `${pct}%` }}
      />
      {hint && <span className="mt-1 block text-xs text-moss-900/55">{hint}</span>}
    </label>
  );
}
