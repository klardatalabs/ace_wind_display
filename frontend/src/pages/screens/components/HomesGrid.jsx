// Homes powered right now, drawn as houses that light up one after another: one house = 500
// homes, out of the 12,000 the turbine can supply at full output.

import Icon from "../../../components/ui/Icon.jsx";

const TOTAL = 24;
const PER_HOUSE = 500;

export default function HomesGrid({ homes, skin }) {
  const lit = Math.min(TOTAL, Math.round(homes / PER_HOUSE));
  return (
    <div className={`rounded-[2.4vmin] p-[2vmin] ${skin.card}`}>
      <div className="grid grid-cols-6 gap-[1vmin]">
        {Array.from({ length: TOTAL }, (_, i) => (
          <Icon
            key={i}
            name="home"
            className={`size-[4.2vmin] transition-[color,opacity,transform] duration-700 ${i < lit ? "house-on scale-100 text-amber-300 opacity-100 drop-shadow-[0_0_8px_rgb(252_211_77/0.8)]" : `scale-90 opacity-30 ${skin.text}`}`}
            style={i < lit ? { animationDelay: `${0.4 + i * 0.12}s` } : undefined}
          />
        ))}
      </div>
      <p className={`mt-[1.2vmin] text-[clamp(11px,1.5vmin,28px)] ${skin.muted}`}>
        Each house is {PER_HOUSE} homes · {lit * PER_HOUSE > 0 ? `${lit} lit` : "none lit yet"} of {TOTAL}
      </p>
    </div>
  );
}
