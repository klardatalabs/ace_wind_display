// Ask Ace: anonymous phone chat opened from a hoarding's QR code.
//   POST   /api/chat/session   mint a private session token for this browser tab
//   GET    /api/chat/history   this session's transcript (restores the chat after a reload)
//   DELETE /api/chat/session   forget this session's conversation
//   POST   /api/chat/stream    send a message; the answer, its activity-graph steps, photos
//                              and screen actions arrive as Server-Sent Events

import { Router } from "express";
import { createSession, requireChatSession } from "../../chat/session.js";
import { cleanMessage } from "../../chat/guard.js";
import { answer } from "../../chat/service.js";
import { history, deleteSession } from "../../db/repositories/chats.js";
import { enforce, rateLimit } from "../middleware/rateLimit.js";
import { LIMITS } from "../rateLimits.js";
import { HttpError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { currentState } from "../liveFeed.js";
import { powerCurve } from "../services/history.js";
import { REFERENCE, parseScenario, evaluateScenario, validateChanges } from "../../../shared/scenarios.js";

const log = logger("api.chat");
export const chatRoutes = Router();

chatRoutes.post("/scenario", requireChatSession, async (req, res) => {
  await enforce(res, `scenario:${req.chatSession.sessionId}`, LIMITS.scenarioPerSession);
  const state = currentState();
  const live = state?.connected && Date.now() - Date.parse(state.liveAt) <= 30_000 && Number.isFinite(state.now?.windSpeed) && state.now.windSpeed >= 0 && state.now.windSpeed <= 34;
  const baseline = live ? {
    windMs: state.now.windSpeed,
    windDeg: Number.isFinite(state.now.aggregateWindDir) ? state.now.aggregateWindDir : REFERENCE.windDeg,
    durationHours: 1,
    gridLimitKw: Number.isFinite(state.now.availablePowerAfterSetpoints) ? Math.min(REFERENCE.gridLimitKw, Math.max(0, state.now.availablePowerAfterSetpoints)) : REFERENCE.gridLimitKw,
      airDensityKgM3: REFERENCE.airDensityKgM3,
      operatingPct: REFERENCE.operatingPct,
  } : REFERENCE;
  let parsed;
  let heldBaseline = null;
  try {
    if (req.body?.baseline != null) {
      heldBaseline = validateChanges(req.body.baseline);
      if (Object.keys(heldBaseline).length !== Object.keys(REFERENCE).length) throw new Error("The saved baseline is incomplete.");
    }
    parsed = req.body?.prompt != null ? parseScenario(req.body.prompt, heldBaseline ?? baseline) : { baselineChanges: {}, changes: {}, unsupported: [] };
    if (req.body?.prompt && !Object.keys(parsed.changes).length && !parsed.unsupported.length) throw new Error("Add a number, such as ‘wind speed 9 m/s for 2 hours’, or edit the supported values below.");
  } catch (err) { throw new HttpError(400, err.message, { code: "bad_scenario" }); }
  const changes = req.body?.changes ?? parsed.changes;
  const comparisonBaseline = { ...(heldBaseline ?? baseline), ...parsed.baselineChanges };
  let empirical = [];
  let curveTimer;
  try {
    empirical = (await Promise.race([powerCurve(), new Promise((_, reject) => { curveTimer = setTimeout(() => reject(new Error("curve timeout")), 1500); })])).empirical;
  } catch (err) { log.debug("scenario curve unavailable", { err }); }
  finally { clearTimeout(curveTimer); }
  let result;
  try {
    result = evaluateScenario({ baseline: comparisonBaseline, changes, empirical, unsupported: parsed.unsupported, source: parsed.baselineChanges.windMs != null ? "your stated starting value" : heldBaseline ? "saved experiment baseline" : live ? "ACE live snapshot" : "reference example", liveAt: live && !heldBaseline && parsed.baselineChanges.windMs == null ? state.liveAt : null });
    if (live && !heldBaseline && parsed.baselineChanges.windMs == null) {
      result.baseline.observedPowerKw = state.now.activePowerKw;
      result.measurements = {
        rotorRpm: state.now.rotorRpm,
        nacelleDeg: state.now.nacelleDeg,
        lifetimeEnergyKwh: state.now.lifetimeEnergyKwh,
        operatingHours: state.now.operatingHours,
        status: state.statusEvent?.main_status ?? null,
      };
    }
  } catch (err) {
    if (err instanceof Error) throw new HttpError(400, err.message, { code: "bad_scenario" });
    throw err;
  }
  res.set("Cache-Control", "no-store").json(result);
});

chatRoutes.post(
  "/session",
  rateLimit("chat-session", LIMITS.chatSessionCreate, (req) => req.ip, "Too many new chats from here. Please wait a moment."),
  async (req, res) => {
    res.set("Cache-Control", "no-store").json(await createSession(req.body?.screen));
  }
);

chatRoutes.get("/history", requireChatSession, async (req, res) => {
  const messages = await history(req.chatSession.sessionId);
  res.set("Cache-Control", "no-store").json({
    screen: req.chatSession.screen,
    messages: messages.map(({ role, content, steps, photos }) => ({ role, content, steps, photos })),
  });
});

chatRoutes.delete("/session", requireChatSession, async (req, res) => {
  await deleteSession(req.chatSession.sessionId);
  res.json({ ok: true });
});

chatRoutes.post("/stream", requireChatSession, async (req, res) => {
  const { sessionId, screen } = req.chatSession;
  const question = cleanMessage(req.body?.message);
  const breather = "Whoa, my blades need a breather! Please try again in a moment.";
  await enforce(res, `chat:session:${sessionId}`, LIMITS.chatMessagePerSession, breather);
  await enforce(res, `chat:ip:${req.ip}`, LIMITS.chatMessagePerIp, breather);

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const emit = (event, data) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const abort = new AbortController();
  res.on("close", () => !res.writableEnded && abort.abort());
  const keepAlive = setInterval(() => !res.writableEnded && res.write(": keep-alive\n\n"), 15_000);

  try {
    await answer({ sessionId, screen, question, signal: abort.signal, emit });
    emit("done", {});
  } catch (err) {
    if (!(err instanceof HttpError)) log.warn("reply failed", { err });
    emit("error", { error: err instanceof HttpError ? err.publicMessage : "Something went wrong on my side. Please try again." });
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
});
