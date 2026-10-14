import SiteCesiumViewer from "../../components/cesium/SiteCesiumViewer.jsx";
import Button from "../../components/ui/Button.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { SITE_COORDS } from "../../cesium/siteConfig.js";

export default function SiteViewerPage() {
  return (
    <main className="min-h-dvh bg-moss-25">
      <section className="px-4 pt-5 pb-8 sm:px-6 md:px-8">
        <div className="mx-auto flex max-w-[1520px] flex-col gap-5">
          <div className="flex flex-col gap-4 rounded-[2rem] bg-white p-5 shadow-[0_20px_70px_rgb(10_21_29/0.08)] md:flex-row md:items-center md:justify-between md:p-6">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-moss-600 uppercase">
                <Icon name="globe" className="size-4" />
                Real-world 3D location
              </p>
              <h1 className="mt-2 font-display text-3xl leading-tight font-medium text-moss-950 md:text-4xl">ACE turbine site explorer</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-moss-900/65 md:text-base">
                Explore ACE in its real surroundings. Select the turbine to take a closer look and see its latest readings.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-moss-50 px-3 py-2 font-mono text-xs text-moss-800">
                {SITE_COORDS.lat.toFixed(7)}, {SITE_COORDS.lon.toFixed(7)}
              </span>
              <Button to="/" variant="secondary" iconLeft="arrowRight" className="[&_.inline-block]:rotate-180">
                Back home
              </Button>
            </div>
          </div>

          <SiteCesiumViewer className="h-[calc(100dvh-190px)] min-h-[620px] rounded-[2rem] shadow-[0_24px_80px_rgb(10_21_29/0.16)]" />
        </div>
      </section>
    </main>
  );
}
