import { lazy, Suspense, useState } from "react";
import Button from "../../../components/ui/Button.jsx";
import { SITE_COORDS } from "../../../cesium/siteConfig.js";

const SiteCesiumViewer = lazy(() => import("../../../components/cesium/SiteCesiumViewer.jsx"));

export default function SiteExplorer() {
  const [opened, setOpened] = useState(false);
  return (
    <section id="site" className="bg-moss-50 px-4 py-16 sm:px-6 md:py-24 xl:px-36">
      <div className="mx-auto max-w-[1520px]">
        <div className="mb-8 flex flex-col gap-6 md:mb-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-moss-600 uppercase">Explore the real place</p>
            <h2 className="mt-3 max-w-[750px] font-display text-4xl leading-tight font-medium tracking-display text-moss-950 sm:text-5xl">
              See where Ace meets the sky.
            </h2>
            <p className="mt-4 max-w-[680px] text-base leading-7 text-moss-900/70">
              Move around the turbine at Lawrence Weston. The surrounding land and buildings stream from real-world 3D map data; Ace is our own model in the scene.
            </p>
          </div>
          <Button to="/site" variant="secondary" icon="arrowRight">Open full view</Button>
        </div>
        <div className="relative h-[520px] overflow-hidden rounded-[2rem] bg-moss-950 shadow-[0_24px_80px_rgb(10_21_29/0.16)] md:h-[min(70vh,760px)]">
          {opened ? (
            <Suspense fallback={<div className="flex size-full items-center justify-center text-white">Loading 3D viewer…</div>}>
              <SiteCesiumViewer className="size-full" />
            </Suspense>
          ) : (
            <div className="flex size-full flex-col items-center justify-center px-6 text-center text-white">
              <span className="mb-6 font-serif text-8xl text-moss-300" aria-hidden="true">◎</span>
              <p className="font-display text-3xl font-medium sm:text-4xl">The turbine, in its real surroundings.</p>
              <p className="mt-4 font-mono text-sm text-white/60">{SITE_COORDS.lat.toFixed(7)}° N · {Math.abs(SITE_COORDS.lon).toFixed(7)}° W</p>
              <button type="button" onClick={() => setOpened(true)} className="mt-8 rounded-full bg-white px-7 py-3 text-sm font-semibold text-moss-950 transition hover:bg-moss-100">
                Start exploring
              </button>
            </div>
          )}
        </div>
        <p className="mt-4 text-sm text-moss-900/60">The view loads when you choose to explore.</p>
      </div>
    </section>
  );
}
