// Integration tests for the chat, dataset, knowledge, weather, job and daily repositories.
// Needs a migrated database (PG* env vars); skipped when none is reachable.

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { pool, postgresHealthy, closePostgres } from "../../infra/postgres.js";
import * as chats from "./chats.js";
import * as datasets from "./datasets.js";
import * as knowledge from "./knowledge.js";
import * as weather from "./weather.js";
import * as jobs from "./jobs.js";
import * as daily from "./daily.js";
import { SITE, ASSET } from "../../../shared/site.js";

const reachable = await postgresHealthy();
const skip = !reachable && "no database";
const sha = (text) => crypto.createHash("sha256").update(text).digest();

test("a chat exchange is stored with its steps, photos and actions, and purged by age", { skip }, async () => {
  const sessionId = crypto.randomUUID();
  await chats.createSession(sessionId, "students");
  const started = new Date(Date.now() - 900);
  const photo = { id: "test-photo-1", alt: "A blade", color: "#ccc", width: 800, height: 600, thumb: "https://img/t", regular: "https://img/r", page: "https://unsplash.com/p", author: "Sam", authorUrl: "https://unsplash.com/@sam" };
  await chats.appendExchange({
    sessionId, screenId: "students", question: "How big are your blades?",
    answer: {
      content: "Each blade is about 56 metres long.",
      steps: [
        { round: 1, kind: "knowledge_search", startedAt: started, finishedAt: new Date(), succeeded: true },
        { round: 1, kind: "photo_search", startedAt: started, finishedAt: new Date(), succeeded: true },
      ],
      photos: [photo],
      actions: ["fly_to_nacelle"],
    },
  });
  await chats.appendExchange({ sessionId, screenId: "students", question: "Thanks!", answer: { content: "You're welcome!" } });
  try {
    const messages = await chats.history(sessionId);
    assert.deepEqual(messages.map((m) => [m.seq, m.role]), [[1, "user"], [2, "assistant"], [3, "user"], [4, "assistant"]]);
    assert.equal(messages[1].steps.length, 2);
    assert.equal(messages[1].steps[0].kind, "knowledge_search");
    assert.equal(messages[1].photos[0].author, "Sam");
    assert.equal((await chats.history(sessionId, 2)).length, 2, "history can be limited to the latest messages");

    await pool.query("UPDATE app.chat_session SET created_at = now() - INTERVAL '40 days' WHERE session_id = $1", [sessionId]);
    assert.equal(await chats.purgeSessionsOlderThan(30), 1);
    assert.deepEqual(await chats.history(sessionId), [], "messages are removed with their session");
  } finally {
    await chats.deleteSession(sessionId);
    await pool.query("DELETE FROM app.photo WHERE photo_id = 'test-photo-1'; ").catch(() => {});
    await pool.query("DELETE FROM app.photographer WHERE profile_url = 'https://unsplash.com/@sam'").catch(() => {});
  }
});

test("dataset requests store only a token hash and expire", { skip }, async () => {
  const token = crypto.randomBytes(32).toString("base64url");
  const email = `researcher-${Date.now()}@example.org`;
  const requestId = await datasets.createRequest({
    email, datasetId: "daily", fullName: "R. Searcher", organisation: "Uni", purpose: "Study",
    dateFrom: "2026-08-01", dateTo: "2026-08-31",
    tokenSha256: sha(token), expiresAt: new Date(Date.now() + 3_600_000),
  });
  try {
    assert.equal(await datasets.recentRequestCount(email, 24), 1);
    const found = await datasets.findActiveRequest(sha(token));
    assert.equal(found.requestId, requestId);
    assert.equal(found.datasetId, "daily");
    assert.deepEqual([found.dateFrom, found.dateTo], ["2026-08-01", "2026-08-31"]);
    assert.equal(await datasets.findActiveRequest(sha("wrong token")), null);
    await datasets.recordDownload(requestId);
    await pool.query("UPDATE app.dataset_request SET requested_at = now() - INTERVAL '2 hours', expires_at = now() - INTERVAL '1 minute' WHERE request_id = $1", [requestId]);
    assert.equal(await datasets.findActiveRequest(sha(token)), null, "an expired link no longer works");
  } finally {
    await pool.query("DELETE FROM app.requester WHERE email = $1", [email]);
  }
});

test("knowledge passages are found by meaning and by keywords", { skip }, async () => {
  const modelId = await knowledge.registerModel("test-embedding-model", 3);
  const contentSha256 = sha(`doc-${Date.now()}`);
  const documentId = await knowledge.insertDocument({
    modelId,
    doc: { contentSha256, title: "Test Book", author: "A. Writer", fileName: "test.pdf", mediaType: "application/pdf", byteSize: 1234, pageCount: 3 },
    passages: [
      { position: 1, pageStart: 1, pageEnd: 1, content: "The rotor converts kinetic energy of the wind into rotation.", embedding: [1, 0, 0] },
      { position: 2, pageStart: 2, pageEnd: 2, content: "Gearless turbines use a ring generator with many poles.", embedding: [0, 1, 0] },
      { position: 3, pageStart: 3, pageEnd: 3, content: "Blade pitch control limits power in strong winds.", embedding: [0, 0, 1] },
    ],
  });
  try {
    assert.ok(await knowledge.findDocumentBySha256(contentSha256));
    const byVector = await knowledge.searchByVector({ modelId, dimensions: 3, embedding: [0.1, 0.9, 0], limit: 2 });
    assert.equal(byVector[0].position, 2, "closest vector first");
    const byWords = await knowledge.searchByKeywords({ text: "pitch control strong winds", limit: 5 });
    assert.ok(byWords.some((r) => r.position === 3 && r.document_id === documentId));
    const around = await knowledge.passagesAround(documentId, 2);
    assert.deepEqual(around.map((p) => p.position), [1, 2, 3]);
    const docs = await knowledge.listDocuments();
    assert.equal(docs.find((d) => d.id === documentId).passages, 3);
  } finally {
    await knowledge.deleteDocument(documentId);
    await pool.query("DELETE FROM kb.embedding_model WHERE name = 'test-embedding-model'");
  }
});

test("weather readings are stored with their condition and daylight", { skip }, async () => {
  const observedAt = new Date("2026-03-01T12:00:00Z");
  await weather.saveReading({
    condition: { conditionId: 802, main: "Clouds", description: "scattered clouds" },
    observation: { siteId: SITE.id, observedAt, conditionId: 802, temperatureC: 9.5, cloudCoverPct: 40, windSpeedMs: 5 },
    daylight: { siteId: SITE.id, localDate: "2026-03-01", sunriseAt: new Date("2026-03-01T06:55:00Z"), sunsetAt: new Date("2026-03-01T17:48:00Z") },
  });
  try {
    const latest = await weather.latestReading(SITE.id);
    assert.equal(latest.description, "scattered clouds");
    assert.equal(latest.observation.temperatureC, 9.5);
    assert.equal(+latest.sunsetAt, +new Date("2026-03-01T17:48:00Z"));
  } finally {
    await pool.query("DELETE FROM ts.weather_observation WHERE site_id = $1; ", [SITE.id]).catch(() => {});
    await pool.query("DELETE FROM core.site_daylight WHERE site_id = $1", [SITE.id]);
  }
});

test("job runs record their outcome; abandoned runs are closed", { skip }, async () => {
  const finish = await jobs.startRun("history-sync");
  await finish({ ok: true, fetched: 144, written: 3, rejected: 0 });
  await jobs.startRun("zenodo-import"); // never finished, as if the process died
  await jobs.failAbandonedRuns();
  try {
    const latest = Object.fromEntries((await jobs.latestRuns()).map((r) => [r.jobId, r]));
    assert.equal(latest["history-sync"].outcome, "succeeded");
    assert.equal(latest["history-sync"].rowsWritten, 3);
    assert.equal(latest["zenodo-import"].outcome, "failed");
  } finally {
    await pool.query("DELETE FROM app.job_run");
  }
});

test("recent days fill missing dates and month comparisons use real months", { skip }, async () => {
  const days = await daily.recentDays(ASSET.id, 5, "2026-03-03");
  assert.deepEqual(days.map((d) => d.localDate), ["2026-03-03", "2026-03-02", "2026-03-01", "2026-02-28", "2026-02-27"]);
  const months = await daily.monthComparison(ASSET.id, "2026-03-03");
  assert.equal(months.current.from, "2026-03-01");
  assert.equal(months.current.to, "2026-03-04");
  assert.equal(months.previous.from, "2026-02-01");
  assert.equal(months.previous.to, "2026-03-01");
});

test.after(closePostgres);
