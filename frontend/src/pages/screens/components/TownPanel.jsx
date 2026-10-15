// "Our town" for the students screen: two of Ambition Community Energy's photos dropping in
// like polaroids, and the turbine's community facts. Every figure is ACE's own
// (ambitioncommunityenergy.org): the community plan, the yearly homes figure and the
// lifetime carbon estimate.

const PHOTOS = [
  { src: "/images/ace/community.webp", caption: "Neighbours celebrating", tilt: "-4deg" },
  { src: "/images/ace/opening-ribbon.webp", caption: "Opening day: “Brunel” cuts the ribbon", tilt: "3deg" },
];

const FACTS = [
  { value: "1,200+", text: "neighbours shared ideas for their area. A wind turbine was one." },
  { value: "3,000+", text: "homes' worth of electricity, every year" },
  { value: "87,600 t", text: "of carbon dioxide kept out of the air over my life (ACE's estimate)" },
];

export default function TownPanel({ skin }) {
  return (
    <figure className={`flex w-[min(32vw,680px)] flex-col gap-[1.6vmin] rounded-[2.4vmin] p-[2.2vmin] ${skin.card}`}>
      <div className="flex justify-center gap-[2vmin] pt-[1vmin]">
        {PHOTOS.map((p, i) => (
          <div key={p.src} className="polaroid-drop rounded-[0.8vmin] bg-white p-[0.8vmin] pb-[1vmin] shadow-[0_10px_30px_rgb(0_0_0/0.25)]" style={{ "--tilt": p.tilt, animationDelay: `${0.3 + i * 0.5}s` }}>
            <img src={p.src} alt={p.caption} className="block h-[11vmin] w-[17vmin] rounded-[0.4vmin] object-cover" />
            <p className="mt-[0.6vmin] text-center text-[clamp(10px,1.4vmin,26px)] font-medium text-moss-900">{p.caption}</p>
          </div>
        ))}
      </div>
      <dl className="flex flex-col gap-[1.2vmin]">
        {FACTS.map((f) => (
          <div key={f.value} className="flex items-baseline gap-[1.6vmin]">
            <dt className={`min-w-[14vmin] shrink-0 font-display text-[clamp(18px,3.2vmin,64px)] whitespace-nowrap leading-none font-semibold tabular-nums ${skin.accent}`}>{f.value}</dt>
            <dd className={`text-[clamp(12px,1.6vmin,30px)] leading-snug ${skin.text}`}>{f.text}</dd>
          </div>
        ))}
      </dl>
      <figcaption className={`text-[clamp(10px,1.3vmin,24px)] ${skin.muted}`}>Photos: Ambition Community Energy</figcaption>
    </figure>
  );
}
