// Live figures that hang off real parts of the scene (the blade tip, the nacelle, the homes).
// The 3D scene moves each element every frame (TurbineScene.#updateTags) and sets data-on
// when its anchor is on screen, so the numbers feel attached to the thing they describe.

import { useEffect, useRef } from "react";
import { gsap } from "../../../lib/gsap.js";
import { TAGS } from "../../../content/screens.js";

export default function DataTags({ ids, data, tagRefs, skin }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
      {ids.map((id) => (
        <Tag key={id} id={id} tag={TAGS[id]} data={data} tagRefs={tagRefs} skin={skin} />
      ))}
    </div>
  );
}

function Tag({ id, tag, data, tagRefs, skin }) {
  const el = useRef(null);
  const inner = useRef(null);
  useEffect(() => {
    const node = el.current;
    tagRefs.current.set(id, node);
    // the scene flips data-on; fade the card in and out to match
    const obs = new MutationObserver(() => gsap.to(inner.current, { opacity: node.dataset.on === "1" ? 1 : 0, y: node.dataset.on === "1" ? 0 : 8, duration: 0.5 }));
    obs.observe(node, { attributes: true, attributeFilter: ["data-on"] });
    return () => {
      obs.disconnect();
      tagRefs.current.delete(id);
    };
  }, [id, tagRefs]);
  return (
    <div ref={el} data-on="0" className="absolute top-0 left-0 will-change-transform">
      <div ref={inner} className="opacity-0">
        <div className="-translate-x-1/2 -translate-y-full pb-[1.4vmin]">
          <div className={`rounded-[1.6vmin] px-[1.8vmin] py-[1vmin] ${skin.card}`}>
            <p className={`text-[clamp(10px,1.3vmin,24px)] font-semibold tracking-[0.1em] uppercase ${skin.accent}`}>{tag.label}</p>
            <p className={`font-display text-[clamp(18px,3vmin,60px)] leading-none font-bold whitespace-nowrap tabular-nums ${skin.text}`}>{tag.value(data)}</p>
            <p className={`mt-[0.4vmin] text-[clamp(10px,1.4vmin,26px)] whitespace-nowrap ${skin.muted}`}>{tag.sub(data)}</p>
          </div>
          <span className={`mx-auto mt-[0.6vmin] block h-[3vmin] w-px ${skin.dark ? "bg-white/70" : "bg-moss-900/60"}`} />
          <span className="mx-auto block size-[1.2vmin] rounded-full bg-moss-300 ring-[0.5vmin] ring-moss-300/30" />
        </div>
      </div>
    </div>
  );
}
