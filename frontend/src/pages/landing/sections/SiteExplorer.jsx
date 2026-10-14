import Button from "../../../components/ui/Button.jsx";
import SectionHeading from "../../../components/ui/SectionHeading.jsx";
import DuotoneImage from "../../../components/ui/DuotoneImage.jsx";
import { IMAGES } from "../../../content/images.js";

export default function SiteExplorer() {
  return (
    <section id="site" className="bg-moss-50 px-6 py-16 md:px-12 md:py-24 xl:px-36">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-8 flex flex-col gap-6 md:mb-10 md:flex-row md:items-end md:justify-between">
          <SectionHeading eyebrow="Explore ACE in 3D" title="A closer look. All the way inside.">
            Select a blade, explore the tower, or step into the machine room. Open the full-screen explorer and move at your own pace.
          </SectionHeading>
          <Button to="/screen/live" variant="secondary" icon="arrowRight" className="shrink-0">
            Open full view
          </Button>
        </div>
        <div className="relative h-[640px] overflow-hidden rounded-4xl bg-moss-950 md:h-[min(70vh,720px)] md:min-h-[560px]">
              <DuotoneImage src={IMAGES.drone.src} alt="" className="absolute inset-0" />
              <div className="absolute inset-0 bg-moss-950/45" />
              <div className="relative flex size-full flex-col items-center justify-center px-6 text-center text-white">
                <p className="font-display text-3xl font-medium sm:text-4xl">Outside. Inside. Yours to explore.</p>
                <p className="mt-3 text-sm text-white/70">ACE in its real surroundings, with an explorable turbine interior.</p>
                <Button to="/screen/live" variant="secondary" size="lg" icon="arrowRight" className="mt-8">
                  Open 3D explorer
                </Button>
              </div>
        </div>
      </div>
    </section>
  );
}
