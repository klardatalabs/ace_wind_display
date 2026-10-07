// A full-screen hoarding display (/screen/students | community | college).
// Native Three.js turbine behind an auto-playing story; a QR code opens a private chat on
// visitors' phones, and their phone can drive this screen's camera (never its text).

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import TurbineCanvas from "../../components/three/TurbineCanvas.jsx";
import StepPills from "../../components/ui/StepPills.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { SCREENS, SCREEN_KEYS } from "../../content/screens.js";
import { subscribeScreen } from "../../realtime/liveSocket.js";
import { useScreenData } from "./useScreenData.js";
import { useStoryLoop } from "./useStoryLoop.js";
import { SKINS } from "./components/skins.js";
import ScreenTopBar from "./components/ScreenTopBar.jsx";
import StoryPanel from "./components/StoryPanel.jsx";
import QrCard from "./components/QrCard.jsx";
import RemoteToast from "./components/RemoteToast.jsx";
import PowerCurvePanel from "./components/PowerCurvePanel.jsx";
import DailyBarsPanel from "./components/DailyBarsPanel.jsx";
import SpecPanel from "./components/SpecPanel.jsx";

/** Keeps a kiosk display from sleeping (where the browser allows it). */
function useWakeLock() {
  useEffect(() => {
    let lock;
    const request = () => navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release?.().catch(() => {});
    };
  }, []);
}

function Hoarding({ screen }) {
  const skin = SKINS[screen.theme];
  const sceneRef = useRef(null);
  const data = useScreenData();
  const story = useStoryLoop(screen.chapters, sceneRef);
  const [toast, setToast] = useState(null);
  const { yieldTo } = story;

  useWakeLock();
  useEffect(() => {
    document.title = `Weston Wind · ${screen.name} screen`;
  }, [screen.name]);

  // Commands from visitors' phones (sent over the socket as a fixed action name only).
  useEffect(
    () =>
      subscribeScreen(screen.key, (action) => {
        yieldTo(action);
        setToast({ action, at: Date.now() });
      }),
    [screen.key, yieldTo]
  );

  const onTouch = useCallback(() => yieldTo(null), [yieldTo]);
  // Step pills are sized for laptops; scale them up on big hoarding panels.
  const pillZoom = Math.min(2.4, Math.max(1, Math.min(window.innerWidth, window.innerHeight) / 900));
  const panel = story.chapter.panel;

  return (
    <div className={`relative h-dvh w-screen overflow-hidden select-none ${skin.dark ? "bg-moss-950" : "bg-moss-50"}`}>
      <div className="absolute inset-0" onPointerDown={onTouch}>
        <TurbineCanvas theme={screen.theme} sceneRef={sceneRef} frameShift={0.13} className="size-full" />
      </div>

      <div className={`pointer-events-none absolute inset-y-0 left-0 w-[64vw] portrait:hidden ${skin.scrim}`} />
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-[34vh] ${skin.scrimBottom}`} />
      <div className={`pointer-events-none absolute inset-x-0 top-0 hidden h-[55vh] portrait:block ${skin.scrimBottom} rotate-180`} />

      <ScreenTopBar skin={skin} screenName={screen.name} mood={data.mood} screenKey={screen.key} />
      <RemoteToast event={toast} skin={skin} />

      <main className="pointer-events-none absolute z-10 flex flex-col landscape:inset-y-0 landscape:left-0 landscape:justify-center landscape:pt-[9vmin] landscape:pb-[16vmin] landscape:pl-[5vmin] portrait:inset-x-0 portrait:top-[12vmin] portrait:px-[5vmin]">
        <StoryPanel key={story.chapter.id} chapter={story.chapter} data={data} skin={skin} />
      </main>

      {panel && (
        <aside key={panel} className="pointer-events-none absolute right-[3vmin] z-10 landscape:top-[12vmin] portrait:bottom-[30vmin]">
          {panel === "curve" && <PowerCurvePanel curve={data.curve} windSpeed={data.windSpeed} powerKw={data.powerKw} skin={skin} />}
          {panel === "daily" && <DailyBarsPanel daily={data.daily} skin={skin} />}
          {panel === "spec" && <SpecPanel skin={skin} />}
        </aside>
      )}

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-[3vmin] p-[3vmin] portrait:flex-col portrait:items-center">
        <div className="pointer-events-auto flex flex-col gap-[1.4vmin] portrait:items-center">
          <StepPills
            steps={screen.chapters.map((c) => c.label)}
            index={story.index}
            progress={story.progress}
            onSelect={story.goTo}
            tone={skin.pillTone}
            className="origin-bottom-left justify-start!"
            style={{ zoom: pillZoom }}
          />
          <p className={`flex items-center gap-[0.8vmin] text-[clamp(11px,1.4vmin,26px)] ${skin.muted}`}>
            <Icon name="handPointer" className="size-[1.3em]" />
            {story.paused ? "You're in control — the story resumes shortly" : "Drag to look around · pinch to zoom · double-tap to look inside"}
          </p>
        </div>
        <QrCard screenKey={screen.key} label={screen.askLabel} hint={screen.askHint} skin={skin} className="pointer-events-auto" />
      </footer>
    </div>
  );
}

export default function ScreenPage() {
  const { screen: key } = useParams();
  const screen = SCREENS[key];
  if (!screen) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-moss-25 p-8 text-center">
        <h1 className="font-display text-4xl font-medium text-moss-950">Which screen is this?</h1>
        <div className="flex flex-wrap justify-center gap-3">
          {SCREEN_KEYS.map((k) => (
            <Link key={k} to={`/screen/${k}`} className="rounded-full bg-moss-900 px-5 py-2.5 font-medium text-white hover:bg-moss-700">
              {SCREENS[k].name}
            </Link>
          ))}
        </div>
      </div>
    );
  }
  // Keyed so switching screens rebuilds the 3D scene and story from scratch.
  return <Hoarding key={screen.key} screen={screen} />;
}
