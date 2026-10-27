import { useEffect } from "react";
import { usePublicOrigin } from "../../hooks/usePublicOrigin.js";
import DevHero from "./sections/DevHero.jsx";
import EndpointExplorer from "./sections/EndpointExplorer.jsx";
import CodeSamples from "./sections/CodeSamples.jsx";
import DatasetsSection from "./sections/DatasetsSection.jsx";
import ScreensSection from "./sections/ScreensSection.jsx";

export default function DevelopersPage() {
  const origin = usePublicOrigin();
  useEffect(() => {
    document.title = "Developers · Lawrence Weston wind";
  }, []);
  return (
    <>
      <DevHero origin={origin} />
      <EndpointExplorer />
      <CodeSamples origin={origin} />
      <ScreensSection origin={origin} />
      <DatasetsSection />
    </>
  );
}
