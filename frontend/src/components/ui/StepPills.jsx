// Numbered step pills: the active one grows a label (springy) and shows a progress ring
// that fills until the next step auto-advances.

export default function StepPills({ steps, index, progress, onSelect, tone = "dark", className = "", style }) {
  const onDark = tone === "light";
  return (
    <div className={`flex flex-nowrap items-center justify-center gap-1.5 sm:gap-2 ${className}`} style={style}>
      {steps.map((label, i) => {
        const active = i === index;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={`${i + 1}. ${label}`}
            aria-current={active ? "step" : undefined}
            className={`flex items-center rounded-full p-1 transition-[padding,background-color] duration-[400ms] ease-[var(--ease-spring)] ${
              onDark ? "bg-moss-950/30 hover:bg-moss-950/40" : "bg-moss-900/5 hover:bg-moss-900/10"
            } ${active ? "pr-3 sm:pr-4" : ""}`}
          >
            <span
              className={`relative flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors duration-200 sm:size-8 ${
                active
                  ? onDark
                    ? "bg-white/40 text-white"
                    : "bg-moss-900 text-white"
                  : onDark
                    ? "bg-white/20 text-white"
                    : "bg-white text-moss-900"
              }`}
            >
              {active && (
                <svg className="progress-ring pointer-events-none absolute -inset-1 size-[calc(100%+8px)]" viewBox="0 0 44 44" style={{ "--p": progress * 100 }}>
                  <circle cx="22" cy="22" r="19" fill="none" stroke={onDark ? "white" : "var(--color-moss-900)"} strokeWidth="2.5" strokeLinecap="round" pathLength="100" transform="rotate(-90 22 22)" />
                </svg>
              )}
              <span className="relative">{i + 1}</span>
            </span>
            <span
              className={`overflow-hidden whitespace-nowrap text-sm font-medium transition-[max-width,opacity,padding] duration-[400ms] ease-[var(--ease-spring)] ${
                onDark ? "text-white" : "text-moss-900"
              } ${active ? "max-w-[200px] pl-2 opacity-100" : "max-w-0 pl-0 opacity-0"}`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
