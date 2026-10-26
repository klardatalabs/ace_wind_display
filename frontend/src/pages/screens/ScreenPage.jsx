// A full-screen hoarding display (/screen/students | community | college).
// A live 3D place behind an auto-playing story: captions speak to visitors, live figures hang
// off the parts of the scene they describe, visitors can tap anything for a description, and
// a QR code opens a private chat on their phone (which can also drive this screen).

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import TurbineCanvas from "../../components/three/TurbineCanvas.jsx";
import StepPills from "../../components/ui/StepPills.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { SCREENS, SCREEN_KEYS, TAGS, TOUR_BEATS, TOUR_ENDINGS, XRAY_COPY } from "../../content/screens.js";
import { XRAY_STOPS } from "../../three/xrayStops.js";
import { lapseHour } from "../../content/dayStory.js";
import { subscribeScreen } from "../../realtime/liveSocket.js";
import { useEnvironmentStore } from "../../store/useEnvironmentStore.js";
import { sunPosition } from "../../three/environment.js";
import { useScreenData } from "./useScreenData.js";
import { useStoryLoop } from "./useStoryLoop.js";
import { useGeneratedStories } from "./useGeneratedStories.js";
import { resolveChapter, tourChapter } from "../../content/storyCopy.js";
import { SKINS, cardSkinOf } from "./components/skins.js";
import ScreenTopBar from "./components/ScreenTopBar.jsx";
import CommunityNews from "./components/CommunityNews.jsx";
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
import DayStory from "./components/DayStory.jsx";
import AceMascot from "./components/AceMascot.jsx";
import HeightPanel from "./components/HeightPanel.jsx";
import SpeedPanel from "./components/SpeedPanel.jsx";
import TownPanel from "./components/TownPanel.jsx";
import AskDemo from "./components/AskDemo.jsx";
import ChapterGust from "./components/ChapterGust.jsx";
import ChapterPostcard from "./components/ChapterPostcard.jsx";
import EveningAtHome from "./components/EveningAtHome.jsx";
import GridEnding from "./components/GridEnding.jsx";
import XrayRoute from "./components/XrayRoute.jsx";
import DayTracePanel from "./components/DayTracePanel.jsx";

// The real-world view (Cesium + Google 3D tiles) is big, so it loads after the 3D scene.
const SiteCesiumViewer = lazy(() => import("../../components/cesium/SiteCesiumViewer.jsx"));

const IDLE_CLOSE_MS = 30_000;
// How each hoarding screen moves between chapters: a gust of wind for the students and
// college, a postcard from Lawrence Weston for the community.
const TRANSITIONS = { students: ChapterGust, community: ChapterPostcard, college: ChapterGust };
// A hoarding's story moves slowly, so the 3D scene draws at most this often: on a laptop's
// 120 Hz screen that's a quarter of the GPU work, and the motion still looks smooth.
const SCREEN_MAX_FPS = 30;
// Hoarding panels are viewed from a few metres away, so extra pixel density buys nothing.
const SCREEN_MAX_PIXEL_RATIO = 1.25;

/**
 * While a tour chapter plays: which stop of the energy journey it's at, how faded the view
 * is, and whether it has reached the screen's own ending (see StoryRail.start's endAt).
 */
function useTourState(sceneRef, on) {
  const [state, setState] = useState({ index: 0, fade: 0 });
  useEffect(() => {
    if (!on) return undefined;
    setState({ index: 0, fade: 1, ended: false }); // each time round, start from the first stop
    const id = setInterval(() => {
      const tour = sceneRef.current?.tour;
      if (!tour?.active) return;
      const { index, fade, ended } = tour.getState();
      setState((s) => (s.index === index && s.ended === ended && Math.abs(s.fade - fade) < 0.02 ? s : { index, fade, ended }));
    }, 120);
    return () => clearInterval(id);
  }, [sceneRef, on]);
  return on ? state : null;
}

/** While the X-ray climb plays, which of its stops the camera is at (TurbineScene.xrayClimbState). */
function useXrayStop(sceneRef, on) {
  const [stop, setStop] = useState(0);
  useEffect(() => {
    if (!on) return undefined;
    setStop(0);
    const id = setInterval(() => {
      const state = sceneRef.current?.xrayClimbState;
      if (state) setStop(state.stop);
    }, 150);
    return () => clearInterval(id);
  }, [sceneRef, on]);
  return on ? stop : null;
}

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
  const skin = SKINS[screen.skin ?? screen.theme];
  const sceneRef = useRef(null);
  const tagRefs = useRef(new Map());
  const markerRef = useRef(null);
  const gustLayer = useRef(null);
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
  const generated = useGeneratedStories(screen.key);
  const tour = useTourState(sceneRef, Boolean(story.chapter.tour));
  const tourBeat = tour && (tour.ended && TOUR_ENDINGS[screen.key] ? { beat: TOUR_ENDINGS[screen.key], i: "end" } : { beat: TOUR_BEATS[screen.key][tour.index], i: tour.index });
  const xrayStop = useXrayStop(sceneRef, Boolean(story.chapter.xray));
  const xrayId = xrayStop == null ? null : XRAY_STOPS[xrayStop].id;
  // Cards (panels, tags, the QR, the caption on college) carry their own ink.
  const cardSkin = cardSkinOf(skin);
  const chapter = tourBeat
    ? { ...story.chapter, ...tourChapter(tourBeat.beat, tourBeat.i) }
    : xrayId
      ? { ...story.chapter, ...tourChapter(XRAY_COPY[screen.key][xrayId], `xray-${xrayId}`) }
      : resolveChapter(story.chapter, story.chapter.cycle ? story.loop * 3 + Math.min(2, Math.floor(story.progress * 3)) : story.loop, data, generated);
  const showQr = screen.rail || story.index === screen.chapters.length - 1;
  const captionChapter = story.railState?.final ? { ...chapter, id: "community-finale", eyebrow: "Avonmouth / Lawrence Weston, Bristol", line: () => "Powering more than homes. Powering a community.", sub: () => "Our turbine. Our power. Income from ACE supports Ambition Lawrence Weston's work on fuel poverty and the community." } : chapter;
  const panel = chapter.panel;
  const tagIds = useMemo(() => ((xrayId ? XRAY_COPY[screen.key][xrayId].tags : story.chapter.tags) ?? []).filter((id) => TAGS[id]), [story.chapter, xrayId, screen.key]);
  const tagDefs = useMemo(() => tagIds.map((id) => ({ id, anchor: TAGS[id].anchor })), [tagIds]);
  const walking = Boolean(walk);
  const showAce = Boolean(screen.mascot) && story.chapter.id === "hello" && !walking;
  const Transition = TRANSITIONS[screen.key];
  // Chapters told over the real-world view ("Right now", and college's "A day here").
  const liveChapters = useMemo(() => screen.chapters.flatMap((c, i) => (c.live ? [i] : [])), [screen.chapters]);
  // Load the large real-world view when the story reaches the preceding chapter.
  // It can warm its tiles there without slowing the first screen render.
  const [liveMounted, setLiveMounted] = useState(false);
  const [liveReady, setLiveReady] = useState(false);
  const n = screen.chapters.length;
  const liveActive = liveChapters.some((i) => story.index === i || story.index === (i - 1 + n) % n);
  useEffect(() => {
    if (liveActive) setLiveMounted(true);
  }, [liveActive]);
  const showLive = chapter.live && liveReady && !walking;
  // A day told over the real place: its clock follows the time-lapse.
  const elapsedS = story.progress * chapter.seconds;
  const liveHour = chapter.day && chapter.live ? Math.round(lapseHour(elapsedS) * 20) / 20 : null;
  // The example chat sits on the left on every screen.
  const askSide = "left";
  // With the chat on the left and the QR on the right, the QR card says it all: no caption,
  // so the turbine stays clear in the middle.
  const noCaption = chapter.ask && askSide === "left" && !screen.mascot;
  const onLiveReady = useCallback(() => setLiveReady(true), []);
  // A chapter told over photos softens the 3D view behind them.
  const soft = chapter.backdrop === "soft" && !walking;
  // Once the live view has faded in over it, the 3D scene can stop drawing until it's
  // needed again. (A softened view keeps moving: frozen, it read as the story stopping.)
  const resting = showLive;
  useEffect(() => {
    if (!resting) return sceneRef.current?.setPaused?.(false);
    const id = setTimeout(() => sceneRef.current?.setPaused?.(true), soft ? 2600 : 1200);
    return () => clearTimeout(id);
  }, [resting, soft]);

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
    <div className={`relative h-dvh w-screen overflow-hidden select-none ${skin.dark ? "bg-moss-950" : "bg-moss-50"} ${screen.mascot ? "kids-type" : ""}`}>
      <div
        className="absolute inset-0 transition-[filter,scale] duration-1000"
        onPointerDown={onTouch}
        style={screen.rail ? { filter: `blur(${story.railState?.blur ?? 0}px)` } : soft ? { filter: "blur(4px) saturate(1.1)", scale: "1.02" } : undefined}
      >
        {/* The chapter gust softens this layer for a moment (ChapterGust). */}
        <div ref={gustLayer} className="size-full">
        <TurbineCanvas poster={screen.rail ? undefined : `/images/renders/screen-start-${screen.key}.jpg`} theme={screen.theme} scan={Boolean(screen.scan)} storyTour={Boolean(screen.tour)} maxFps={SCREEN_MAX_FPS} maxPixelRatio={SCREEN_MAX_PIXEL_RATIO} sceneRef={sceneRef} frameShift={screen.mascot ? 0 : 0.1} storyRail={screen.rail} onWalk={onWalk} onPick={screen.rail ? onPick : undefined} tags={tagDefs} tagRefs={tagRefs} className="size-full" />
        </div>
      </div>
      {liveMounted && (
        <div className={`absolute inset-0 transition-opacity duration-1000 ${showLive ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!showLive}>
          <Suspense fallback={null}>
            <SiteCesiumViewer hoarding active={liveActive} onReady={onLiveReady} hour={liveHour} className="size-full" />
          </Suspense>
        </div>
      )}
      {screen.rail && <div className="pointer-events-none absolute inset-0 bg-moss-950" style={{ opacity: story.fade }} />}
      {tour && <div className="pointer-events-none absolute inset-0 bg-moss-950" style={{ opacity: tour.fade }} />}
      {screen.rail && story.railState && new URLSearchParams(window.location.search).has("debug") && <output hidden data-story-state>{JSON.stringify(story.railState)}</output>}

      {/* Ace's words sit on their own card, so the students screen keeps its scene clear of haze. */}
      {!screen.mascot && <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-[46vh] ${skin.scrimBottom}`} />}
      <div className={`pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b to-transparent ${screen.mascot ? "h-[12vh] from-white/30" : `h-[18vh] ${skin.dark ? "from-black/40" : "from-white/50"}`}`} />

      {!walking && !showLive && <DataTags ids={tagIds} data={data} tagRefs={tagRefs} skin={cardSkin} />}
      <div
        ref={markerRef}
        data-on="0"
        className="pointer-events-none absolute top-0 left-0 z-10 opacity-100 will-change-transform data-[on=0]:opacity-0"
        aria-hidden="true"
      >
        <span className="absolute -top-[1.6vmin] -left-[1.6vmin] block size-[3.2vmin] animate-ping rounded-full border-2 border-white/90" />
        <span className="absolute -top-[0.6vmin] -left-[0.6vmin] block size-[1.2vmin] rounded-full bg-white shadow-[0_0_14px_rgb(255_255_255/0.9)]" />
      </div>

      <ScreenTopBar skin={skin} screenName={screen.name} screenKey={screen.key} />
      {screen.key !== "students" && <CommunityNews />}
      <div data-keepout className="pointer-events-none absolute top-[11vmin] left-[2.2vmin] z-20 portrait:top-[118px]">
        <WeatherChip windSpeed={data.windSpeed} windDir={data.windDir} skin={cardSkin} />
      </div>
      <RemoteToast event={toast} skin={cardSkin} />

      {/* Ace introduces itself in the opening chapter, from the bottom-left corner; after
          that the story is told in the bubble alone. */}
      {showAce && (
        <div data-keepout className="pointer-events-none absolute bottom-[1vmin] left-0 z-10 h-[46vmin] portrait:h-[30vmin]">
          <AceMascot mood={data.mood} windMs={data.windSpeed} rpm={data.rotorRpm} wave className="h-full" />
        </div>
      )}

      {walking ? (
        <WalkHud walk={walk} skin={cardSkin} timeline={Boolean(screen.walkTimeline)} />
      ) : (
        <>
          {screen.mascot ? (
            // Ace's words, in a speech bubble in the bottom-right corner, never on the busy scene.
            // (On "Ask me", an example chat on a phone shows what the QR code leads to.)
            <main data-keepout className={`pointer-events-none absolute right-[3vmin] bottom-[3vmin] z-10 rounded-[3vmin] px-[3.4vmin] py-[2.8vmin] portrait:inset-x-[4vmin] portrait:bottom-[34vmin] ${showAce ? "ace-bubble" : ""} ${skin.card}`}>
              <CinematicCaption key={captionChapter.id} chapter={captionChapter} data={data} skin={cardSkin} bubble />
            </main>
          ) : noCaption ? null : (
            // In a card, the card fades in with its words, so it never shows empty.
            <main key={screen.captionCard ? captionChapter.id : undefined} data-keepout className={`${screen.captionCard ? "caption-card-in" : ""} pointer-events-none absolute z-10 flex flex-col portrait:inset-x-0 portrait:bottom-[34vmin] portrait:px-[4vmin] landscape:left-[4vmin] ${xrayId ? "landscape:bottom-[15vmin]" : "landscape:bottom-[23vmin]"} ${screen.captionCard ? `rounded-[3vmin] px-[3.4vmin] py-[2.8vmin] ${cardSkin.card}` : ""}`}>
              {chapter.day ? (
                <DayStory audience={screen.key} elapsedS={elapsedS} skin={screen.captionCard ? cardSkin : skin} compact={Boolean(screen.captionCard)} />
              ) : (
                <CinematicCaption key={captionChapter.id} chapter={captionChapter} data={data} skin={screen.captionCard ? cardSkin : skin} bubble={Boolean(screen.captionCard)} instant={screen.rail && new URLSearchParams(window.location.search).has("storyTime")} />
              )}
            </main>
          )}

          {!screen.rail && chapter.ask && <AskDemo key={story.loop} data={data} audience={screen.key} skin={cardSkin} side={askSide} startAt={story.loop} />}
          {tour?.ended && story.chapter.ending === "home" && <EveningAtHome data={data} skin={cardSkin} />}
          {tour?.ended && story.chapter.ending === "data" && <GridEnding data={data} skin={cardSkin} />}
          {xrayStop != null && <XrayRoute stop={xrayStop} skin={cardSkin} place={screen.cardsBottom ? "bottom-[13vmin]" : "top-[16vmin]"} />}
          {!pick && chapter.viz === "homes" && (
            <aside data-keepout className="pointer-events-none absolute z-10 landscape:top-[16vmin] landscape:right-[3vmin] portrait:top-[16vmin] portrait:right-[3vmin]">
              <HomesGrid homes={data.homes} skin={cardSkin} />
            </aside>
          )}
          {!pick && panel && (
            <aside data-keepout key={panel} className={`pointer-events-none absolute z-10 landscape:right-[3vmin] portrait:bottom-[34vmin] portrait:right-[3vmin] ${screen.cardsBottom ? "landscape:bottom-[13vmin]" : "landscape:top-[16vmin]"}`}>
              {panel === "curve" && <PowerCurvePanel curve={data.curve} stale={data.curveStale} windSpeed={data.windSpeed} powerKw={data.powerKw} skin={cardSkin} />}
              {panel === "daily" && <DailyBarsPanel daily={data.daily} stale={data.historyStale} skin={cardSkin} />}
              {panel === "spec" && <SpecPanel skin={cardSkin} />}
              {panel === "height" && <HeightPanel skin={cardSkin} rpm={data.rotorRpm} />}
              {panel === "race" && <SpeedPanel tipMph={data.tipMph} skin={cardSkin} />}
              {panel === "town" && <TownPanel skin={cardSkin} />}
              {panel === "daytrace" && <DayTracePanel elapsedS={elapsedS} skin={cardSkin} />}
            </aside>
          )}
        </>
      )}

      {/* Tap cards only on the story rail; the hoarding screens just tell their story. */}
      {screen.rail && <HotspotCard pick={pick} ctx={ctx} screenKey={screen.key} skin={cardSkin} onClose={closePick} />}

      <footer className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-[3vmin] p-[3vmin] portrait:flex-col portrait:items-center ${showAce ? "landscape:pl-[31vmin]" : ""}`}>
        <div data-keepout className="pointer-events-auto flex flex-col gap-[1.4vmin] portrait:items-center">
          <StepPills
            steps={screen.chapters.map((c) => c.label)}
            index={story.index}
            progress={story.progress}
            onSelect={story.goTo}
            // Inside the dark tower, light pills even on the light students look.
            tone={walking && !skin.dark ? "light" : skin.pillTone}
            className="origin-bottom-left justify-start!"
            style={{ zoom: pillZoom }}
          />
          <p className={`flex items-center gap-[0.8vmin] text-[clamp(11px,1.4vmin,26px)] ${skin.muted}`}>
            <Icon name="handPointer" className="size-[1.3em]" />
            {screen.rail ? "Follow the glow · tap a chapter to jump · drag to look around" : story.paused ? "You're in control. The story resumes shortly." : "Drag to look around"}
          </p>
        </div>
        {/* The QR waits for the story's last chapter, so the opening shows the turbine alone.
            On the students screen it goes top-right, clear of Ace's speech bubble. */}
        {!screen.mascot && <QrCard
          keepout={showQr}
          large={chapter.ask}
          screenKey={screen.key}
          label={screen.askLabel}
          hint={screen.askHint}
          skin={cardSkin}
          className={`transition-[opacity,translate,scale] duration-700 ease-out ${showQr ? "pointer-events-auto opacity-100" : "pointer-events-none translate-y-[2vmin] opacity-0"}`}
        />}
      </footer>
      {Transition && <Transition index={story.index} label={story.chapter.label} total={screen.chapters.length} layerRef={gustLayer} />}
      {screen.mascot && (
        <div className="absolute top-[24vmin] right-[3vmin] z-20">
          <QrCard
            keepout={showQr}
            large
            screenKey={screen.key}
            label={screen.askLabel}
            hint={screen.askHint}
            skin={cardSkin}
            className={`transition-[opacity,translate,scale] duration-700 ease-out ${showQr ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"}`}
          />
        </div>
      )}
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
