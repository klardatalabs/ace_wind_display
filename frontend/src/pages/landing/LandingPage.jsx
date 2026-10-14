import Hero from "./sections/Hero.jsx";
import LiveStrip from "./sections/LiveStrip.jsx";
import HowItWorks from "./sections/HowItWorks.jsx";
import ScreensScroller from "./sections/ScreensScroller.jsx";
import SiteExplorer from "./sections/SiteExplorer.jsx";
import DayInLife from "./sections/DayInLife.jsx";
import QuestionWall from "./sections/QuestionWall.jsx";
import ScanCta from "./sections/ScanCta.jsx";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <LiveStrip />
      <HowItWorks />
      <ScreensScroller />
      <SiteExplorer />
      <DayInLife />
      <QuestionWall />
      <ScanCta />
    </>
  );
}
