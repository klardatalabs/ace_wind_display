// The Drizzle query builder over the shared connection pool. Repositories import `db` and
// the table definitions; TimescaleDB functions (time_bucket, first/last) go through `sql`.

import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "../infra/postgres.js";
import * as core from "./schema/core.js";
import * as ts from "./schema/ts.js";
import * as app from "./schema/app.js";
import * as kb from "./schema/kb.js";

export const schema = { ...core, ...ts, ...app, ...kb };
export const db = drizzle(pool, { schema });
