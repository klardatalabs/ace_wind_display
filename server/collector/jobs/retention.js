// Data minimisation, daily: chats older than CHAT_RETENTION_DAYS are deleted (raw 1-second
// samples expire through TimescaleDB's own policy).

import { config } from "../../config/index.js";
import { purgeSessionsOlderThan } from "../../db/repositories/chats.js";
import { startRun } from "../../db/repositories/jobs.js";

export async function applyRetention() {
  const finish = await startRun("chat-retention");
  try {
    const sessions = await purgeSessionsOlderThan(config.chat.retentionDays);
    await finish({ ok: true, written: sessions });
  } catch (err) {
    await finish({ ok: false, error: err.message }).catch(() => {});
    throw err;
  }
}
