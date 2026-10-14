// app schema: screens, visitor chats (with each answer's agent steps, photos and screen
// actions), dataset requests and background job runs.

import { pgSchema, text, integer, smallint, bigint, boolean, uuid, date, primaryKey, foreignKey } from "drizzle-orm/pg-core";
import { bytea, timestamptz } from "./columns.js";

export const app = pgSchema("app");

export const screen = app.table("screen", {
  screenId: text("screen_id").primaryKey(),
  title: text("title").notNull(),
});

export const screenAction = app.table("screen_action", {
  actionId: text("action_id").primaryKey(),
  description: text("description").notNull(),
});

export const chatRole = app.table("chat_role", {
  roleId: text("role_id").primaryKey(),
});

export const chatSession = app.table("chat_session", {
  sessionId: uuid("session_id").primaryKey(),
  screenId: text("screen_id").notNull().references(() => screen.screenId),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const chatMessage = app.table(
  "chat_message",
  {
    sessionId: uuid("session_id").notNull().references(() => chatSession.sessionId, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    roleId: text("role_id").notNull().references(() => chatRole.roleId),
    content: text("content").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.seq] })]
);

// Rows that belong to one chat message, keyed by (message, position).
const messageChild = (name, columns) =>
  app.table(
    name,
    {
      sessionId: uuid("session_id").notNull(),
      seq: integer("seq").notNull(),
      position: smallint("position").notNull(),
      ...columns,
    },
    (t) => [
      primaryKey({ columns: [t.sessionId, t.seq, t.position] }),
      foreignKey({ columns: [t.sessionId, t.seq], foreignColumns: [chatMessage.sessionId, chatMessage.seq] }).onDelete("cascade"),
    ]
  );

export const agentStepKind = app.table("agent_step_kind", {
  kindId: text("kind_id").primaryKey(),
  label: text("label").notNull(),
});

export const chatMessageStep = messageChild("chat_message_step", {
  round: smallint("round").notNull(),
  kindId: text("kind_id").notNull().references(() => agentStepKind.kindId),
  startedAt: timestamptz("started_at").notNull(),
  finishedAt: timestamptz("finished_at").notNull(),
  succeeded: boolean("succeeded").notNull(),
});

export const photographer = app.table("photographer", {
  profileUrl: text("profile_url").primaryKey(),
  name: text("name").notNull(),
});

export const photo = app.table("photo", {
  photoId: text("photo_id").primaryKey(),
  photographerUrl: text("photographer_url").notNull().references(() => photographer.profileUrl),
  altText: text("alt_text").notNull(),
  color: text("color").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  thumbUrl: text("thumb_url").notNull(),
  regularUrl: text("regular_url").notNull(),
  pageUrl: text("page_url").notNull(),
});

export const chatMessagePhoto = messageChild("chat_message_photo", {
  photoId: text("photo_id").notNull().references(() => photo.photoId),
});

export const chatMessageScreenAction = messageChild("chat_message_screen_action", {
  actionId: text("action_id").notNull().references(() => screenAction.actionId),
});

export const dataset = app.table("dataset", {
  datasetId: text("dataset_id").primaryKey(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  maxRangeDays: integer("max_range_days").notNull(),
});

export const requester = app.table("requester", {
  requesterId: bigint("requester_id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull(),
});

export const datasetRequest = app.table("dataset_request", {
  requestId: bigint("request_id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  requesterId: bigint("requester_id", { mode: "number" }).notNull().references(() => requester.requesterId, { onDelete: "cascade" }),
  datasetId: text("dataset_id").notNull().references(() => dataset.datasetId),
  fullName: text("full_name"),
  organisation: text("organisation"),
  purpose: text("purpose"),
  dateFrom: date("date_from").notNull(),
  dateTo: date("date_to").notNull(),
  tokenSha256: bytea("token_sha256").notNull(),
  requestedAt: timestamptz("requested_at").notNull().defaultNow(),
  expiresAt: timestamptz("expires_at").notNull(),
  emailedAt: timestamptz("emailed_at"),
});

export const datasetDownload = app.table(
  "dataset_download",
  {
    requestId: bigint("request_id", { mode: "number" }).notNull().references(() => datasetRequest.requestId, { onDelete: "cascade" }),
    downloadedAt: timestamptz("downloaded_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.requestId, t.downloadedAt] })]
);

export const job = app.table("job", {
  jobId: text("job_id").primaryKey(),
  description: text("description").notNull(),
});

export const jobRun = app.table("job_run", {
  runId: bigint("run_id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  jobId: text("job_id").notNull().references(() => job.jobId),
  startedAt: timestamptz("started_at").notNull().defaultNow(),
  finishedAt: timestamptz("finished_at"),
  outcome: text("outcome").notNull().default("running"),
  rowsFetched: integer("rows_fetched"),
  rowsWritten: integer("rows_written"),
  rowsRejected: integer("rows_rejected"),
  errorSummary: text("error_summary"),
});
