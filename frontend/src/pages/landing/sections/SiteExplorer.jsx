import { lazy, Suspense, useState } from "react";
import Button from "../../../components/ui/Button.jsx";
import SectionHeading from "../../../components/ui/SectionHeading.jsx";
import DuotoneImage from "../../../components/ui/DuotoneImage.jsx";
import { IMAGES } from "../../../content/images.js";
import { SITE_COORDS } from "../../../cesium/siteConfig.js";

const SiteCesiumViewer = lazy(() => import("../../../components/cesium/SiteCesiumViewer.jsx"));

export default function SiteExplorer() {
  const [opened, setOpened] = useState(false);
  return (
    <section id="site" className="bg-moss-50 px-6 py-16 md:px-12 md:py-24 xl:px-36">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-8 flex flex-col gap-6 md:mb-10 md:flex-row md:items-end md:justify-between">
          <SectionHeading eyebrow="Explore the real place" title="See where Ace meets the sky.">
            Move around the turbine at Lawrence Weston and explore the surrounding buildings and landscape in 3D.
          </SectionHeading>
          <Button to="/site" variant="secondary" icon="arrowRight" className="shrink-0">
            Open full view
          </Button>
        </div>
        <div className="relative h-[460px] overflow-hidden rounded-4xl bg-moss-950 md:h-[min(70vh,720px)]">
          {opened ? (
            <Suspense fallback={<div className="flex size-full items-center justify-center text-white/70">Loading 3D view…</div>}>
              <SiteCesiumViewer className="size-full" />
            </Suspense>
          ) : (
            <>
              <DuotoneImage src={IMAGES.drone.src} alt="" className="absolute inset-0" />
              <div className="absolute inset-0 bg-moss-950/45" />
              <div className="relative flex size-full flex-col items-center justify-center px-6 text-center text-white">
                <p className="font-display text-3xl font-medium sm:text-4xl">The turbine, in its real surroundings.</p>
                <p className="mt-3 font-mono text-sm text-white/70">
                  {SITE_COORDS.lat.toFixed(4)}° N · {Math.abs(SITE_COORDS.lon).toFixed(4)}° W
                </p>
                <Button variant="secondary" size="lg" icon="arrowRight" className="mt-8" onClick={() => setOpened(true)}>
                  Load 3D view
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
