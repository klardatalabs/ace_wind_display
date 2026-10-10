// A full-screen hoarding display (/screen/students | community | college).
// A live 3D place behind an auto-playing story: captions speak to visitors, live figures hang
// off the parts of the scene they describe, visitors can tap anything for a description, and
// a QR code opens a private chat on their phone (which can also drive this screen).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import TurbineCanvas from "../../components/three/TurbineCanvas.jsx";
import StepPills from "../../components/ui/StepPills.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { SCREENS, SCREEN_KEYS, TAGS } from "../../content/screens.js";
import { subscribeScreen } from "../../realtime/liveSocket.js";
import { useEnvironmentStore } from "../../store/useEnvironmentStore.js";
import { sunPosition } from "../../three/environment.js";
import { useScreenData } from "./useScreenData.js";
import { useStoryLoop } from "./useStoryLoop.js";
import { SKINS } from "./components/skins.js";
import ScreenTopBar from "./components/ScreenTopBar.jsx";
import CinematicCaption from "./components/CinematicCaption.jsx";
import DataTags from "./components/DataTags.jsx";
import WeatherChip from "./components/WeatherChip.jsx";
import HomesGrid from "./components/HomesGrid.jsx";
import WalkHud from "./components/WalkHud.jsx";
import HotspotCard from "./components/HotspotCard.jsx";
import QrCard from "./components/QrCard.jsx";
import RemoteToast from "./components/RemoteToast.jsx";
import PowerCurvePanel from "./components/PowerCurvePanel.jsx";
import DailyBarsPanel from "./components/DailyBarsPanel.jsx";
import SpecPanel from "./components/SpecPanel.jsx";

const IDLE_CLOSE_MS = 30_000;

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
  const tagRefs = useRef(new Map());
  const markerRef = useRef(null);
  const data = useScreenData();
  const story = useStoryLoop(screen.chapters, sceneRef, screen.rail);
  const weather = useEnvironmentStore((s) => s.environment?.weather);
  const [toast, setToast] = useState(null);
  const [walk, setWalk] = useState(null); // { s, height } while the camera is climbing the tower
  const [pick, setPick] = useState(null); // { id, at } for the tapped item
  const lastWalkPush = useRef(0);
  const { yieldTo } = story;

  useWakeLock();
  useEffect(() => {
    document.title = `Weston Wind · ${screen.name} screen`;
  }, [screen.name]);

  // The pick marker is positioned by the scene, like the data tags.
  useEffect(() => {
    tagRefs.current.set("__pick", markerRef.current);
    return () => tagRefs.current.delete("__pick");
  }, []);

  // Commands from visitors' phones (an action name, plus a 0-1 position for the walk slider).
  useEffect(
    () =>
      subscribeScreen(screen.key, (action, value) => {
        yieldTo(action, value);
        setToast({ action, at: Date.now() });
      }),
    [screen.key, yieldTo]
  );

  // An item description closes itself if nobody is looking at it.
  useEffect(() => {
    if (!pick) return undefined;
    const id = setTimeout(() => closePick(), IDLE_CLOSE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);

  const closePick = useCallback(() => {
    setPick(null);
    sceneRef.current?.clearPick();
  }, []);

  const onPick = useCallback(
    (p) => {
      if (!p) return setPick(null);
      yieldTo(null);
      setPick({ id: p.id, at: Date.now() });
    },
    [yieldTo]
  );

  // The scene reports every frame of a walk; React only needs about ten updates a second.
  const onWalk = useCallback((s, height) => {
    const t = performance.now();
    if (s != null && t - lastWalkPush.current < 100 && s < 1) return;
    lastWalkPush.current = t;
    setWalk(s == null ? null : { s, height });
  }, []);

  const onTouch = useCallback(() => yieldTo(null), [yieldTo]);
  // Step pills are sized for laptops; scale them up on big hoarding panels.
  const pillZoom = Math.min(2.4, Math.max(1, Math.min(window.innerWidth, window.innerHeight) / 900));
  const chapter = story.chapter;
  const captionChapter = story.railState?.final ? { ...chapter, id: "community-finale", eyebrow: "Avonmouth / Lawrence Weston, Bristol", line: () => "Powering more than homes. Powering a community.", sub: () => "Our turbine. Our power. Income from ACE supports Ambition Lawrence Weston's work on fuel poverty and the community." } : chapter;
  const panel = chapter.panel;
  const tagIds = useMemo(() => (chapter.tags ?? []).filter((id) => TAGS[id]), [chapter]);
  const tagDefs = useMemo(() => tagIds.map((id) => ({ id, anchor: TAGS[id].anchor })), [tagIds]);
  const walking = Boolean(walk);

  const ctx = useMemo(() => {
    const now = new Date();
    return {
      live: { rpm: data.rotorRpm, nacelleDeg: data.nacelleDeg, powerKw: data.powerKw, homes: data.homes, windMs: data.windSpeed, windDeg: data.windDir },
      weather,
      sun: (sunPosition(now).elevation * 180) / Math.PI,
      hour: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }),
    };
  }, [data, weather]);

  return (
    <div className={`relative h-dvh w-screen overflow-hidden select-none ${skin.dark ? "bg-moss-950" : "bg-moss-50"}`}>
      <div className="absolute inset-0" onPointerDown={onTouch} style={screen.rail ? { filter: `blur(${story.railState?.blur ?? 0}px)` } : undefined}>
        <TurbineCanvas theme={screen.theme} sceneRef={sceneRef} frameShift={0.1} storyRail={screen.rail} onWalk={onWalk} onPick={onPick} tags={tagDefs} tagRefs={tagRefs} className="size-full" />
      </div>
      {screen.rail && <div className="pointer-events-none absolute inset-0 bg-moss-950" style={{ opacity: story.fade }} />}
      {screen.rail && story.railState && new URLSearchParams(window.location.search).has("debug") && <output hidden data-story-state>{JSON.stringify(story.railState)}</output>}

      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-[46vh] ${skin.scrimBottom}`} />
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-[18vh] bg-gradient-to-b ${skin.dark ? "from-black/40" : "from-white/50"} to-transparent`} />

      {!walking && <DataTags ids={tagIds} data={data} tagRefs={tagRefs} skin={skin} />}
      <div
        ref={markerRef}
        data-on="0"
        className="pointer-events-none absolute top-0 left-0 z-10 opacity-100 will-change-transform data-[on=0]:opacity-0"
        aria-hidden="true"
      >
        <span className="absolute -top-[1.6vmin] -left-[1.6vmin] block size-[3.2vmin] animate-ping rounded-full border-2 border-white/90" />
        <span className="absolute -top-[0.6vmin] -left-[0.6vmin] block size-[1.2vmin] rounded-full bg-white shadow-[0_0_14px_rgb(255_255_255/0.9)]" />
      </div>

      <ScreenTopBar skin={skin} screenName={screen.name} mood={data.mood} screenKey={screen.key} />
      <div className="pointer-events-none absolute top-[11vmin] left-[2.2vmin] z-20">
        <WeatherChip windSpeed={data.windSpeed} windDir={data.windDir} skin={skin} />
      </div>
      <RemoteToast event={toast} skin={skin} />

      {walking ? (
        <WalkHud walk={walk} skin={skin} />
      ) : (
        <>
          <main className="pointer-events-none absolute z-10 flex flex-col landscape:bottom-[17vmin] landscape:left-[4vmin] portrait:inset-x-0 portrait:bottom-[34vmin] portrait:px-[4vmin]">
            <CinematicCaption key={captionChapter.id} chapter={captionChapter} data={data} skin={skin} instant={screen.rail && new URLSearchParams(window.location.search).has("storyTime")} />
          </main>

          {!pick && chapter.viz === "homes" && (
            <aside className="pointer-events-none absolute z-10 landscape:top-[16vmin] landscape:right-[3vmin] portrait:top-[16vmin] portrait:right-[3vmin]">
              <HomesGrid homes={data.homes} skin={skin} />
            </aside>
          )}
          {!pick && panel && (
            <aside key={panel} className="pointer-events-none absolute z-10 landscape:top-[16vmin] landscape:right-[3vmin] portrait:bottom-[34vmin] portrait:right-[3vmin]">
              {panel === "curve" && <PowerCurvePanel curve={data.curve} windSpeed={data.windSpeed} powerKw={data.powerKw} skin={skin} />}
              {panel === "daily" && <DailyBarsPanel daily={data.daily} skin={skin} />}
              {panel === "spec" && <SpecPanel skin={skin} />}
            </aside>
          )}
        </>
      )}

      <HotspotCard pick={pick} ctx={ctx} screenKey={screen.key} skin={skin} onClose={closePick} />

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
            {screen.rail ? "Follow the glow · tap a chapter to jump · drag to look around" : story.paused ? "You're in control. The story resumes shortly." : "Tap anything to find out what it is · drag to look around"}
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
