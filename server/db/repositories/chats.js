// Visitor chats. An exchange (the visitor's question and Ace's answer, with the answer's
// agent steps, photos and screen actions) is written in one transaction.

import { and, asc, eq, lt, max, sql, inArray } from "drizzle-orm";
import { db } from "../client.js";
import { chatSession, chatMessage, chatMessageStep, chatMessagePhoto, chatMessageScreenAction, photo, photographer } from "../schema/app.js";

export async function createSession(sessionId, screenId) {
  await db.insert(chatSession).values({ sessionId, screenId }).onConflictDoNothing();
}

/**
 * Appends a question and its answer.
 * @param {{ sessionId: string, screenId: string, question: string, answer: { content: string,
 *   steps?: object[], photos?: object[], actions?: string[] } }} exchange
 */
export async function appendExchange({ sessionId, screenId, question, answer }) {
  await db.transaction(async (tx) => {
    // The session may have been removed by retention while the visitor's tab stayed open.
    await tx.insert(chatSession).values({ sessionId, screenId }).onConflictDoNothing();
    await tx.execute(sql`SELECT 1 FROM ${chatSession} WHERE ${chatSession.sessionId} = ${sessionId} FOR UPDATE`);
    const [{ last }] = await tx.select({ last: max(chatMessage.seq) }).from(chatMessage).where(eq(chatMessage.sessionId, sessionId));
    const userSeq = (last ?? 0) + 1;
    const seq = userSeq + 1;
    await tx.insert(chatMessage).values([
      { sessionId, seq: userSeq, roleId: "user", content: question },
      { sessionId, seq, roleId: "assistant", content: answer.content },
    ]);

    const steps = answer.steps ?? [];
    if (steps.length) {
      await tx.insert(chatMessageStep).values(
        steps.map((s, i) => ({ sessionId, seq, position: i + 1, round: s.round, kindId: s.kind, startedAt: s.startedAt, finishedAt: s.finishedAt, succeeded: s.succeeded }))
      );
    }

    const photos = answer.photos ?? [];
    if (photos.length) {
      await tx.insert(photographer).values(photos.map((p) => ({ profileUrl: p.authorUrl, name: p.author }))).onConflictDoNothing();
      await tx
        .insert(photo)
        .values(photos.map((p) => ({
          photoId: p.id, photographerUrl: p.authorUrl, altText: p.alt, color: p.color, width: p.width, height: p.height,
          thumbUrl: p.thumb, regularUrl: p.regular, pageUrl: p.page,
        })))
        .onConflictDoNothing();
      await tx.insert(chatMessagePhoto).values(photos.map((p, i) => ({ sessionId, seq, position: i + 1, photoId: p.id })));
    }

    const actions = answer.actions ?? [];
    if (actions.length) {
      await tx.insert(chatMessageScreenAction).values(actions.map((actionId, i) => ({ sessionId, seq, position: i + 1, actionId })));
    }
  });
}

/** The session's messages in order, each answer with its steps and photos. */
export async function history(sessionId, limit = 50) {
  const messages = await db
    .select({ seq: chatMessage.seq, role: chatMessage.roleId, content: chatMessage.content })
    .from(chatMessage)
    .where(eq(chatMessage.sessionId, sessionId))
    .orderBy(asc(chatMessage.seq));
  const recent = messages.slice(-limit);
  if (!recent.length) return [];
  const seqs = recent.map((m) => m.seq);
  const [steps, photos] = await Promise.all([
    db.select().from(chatMessageStep)
      .where(and(eq(chatMessageStep.sessionId, sessionId), inArray(chatMessageStep.seq, seqs)))
      .orderBy(asc(chatMessageStep.seq), asc(chatMessageStep.position)),
    db.select({ seq: chatMessagePhoto.seq, photo, author: photographer.name })
      .from(chatMessagePhoto)
      .innerJoin(photo, eq(photo.photoId, chatMessagePhoto.photoId))
      .innerJoin(photographer, eq(photographer.profileUrl, photo.photographerUrl))
      .where(and(eq(chatMessagePhoto.sessionId, sessionId), inArray(chatMessagePhoto.seq, seqs)))
      .orderBy(asc(chatMessagePhoto.seq), asc(chatMessagePhoto.position)),
  ]);
  return recent.map((m) => ({
    ...m,
    steps: steps.filter((s) => s.seq === m.seq).map(({ round, kindId, startedAt, finishedAt, succeeded }) => ({ round, kind: kindId, startedAt, finishedAt, succeeded })),
    photos: photos.filter((p) => p.seq === m.seq).map(({ photo: p, author }) => ({
      id: p.photoId, alt: p.altText, color: p.color, width: p.width, height: p.height,
      thumb: p.thumbUrl, regular: p.regularUrl, page: p.pageUrl, author, authorUrl: p.photographerUrl,
    })),
  }));
}

export async function deleteSession(sessionId) {
  await db.delete(chatSession).where(eq(chatSession.sessionId, sessionId));
}

/** Deletes sessions (and, by cascade, their messages) older than `days`. Returns how many. */
export async function purgeSessionsOlderThan(days) {
  const result = await db.delete(chatSession).where(lt(chatSession.createdAt, sql`now() - ${days} * INTERVAL '1 day'`));
  return result.rowCount;
}
