// Checks the Drizzle table definitions against the migrated database, so the SQL
// migrations and the code can't drift apart. Needs a migrated database (PG* env vars);
// skipped when none is reachable.

import test from "node:test";
import assert from "node:assert/strict";
import { getTableConfig, getViewConfig, PgTable, PgView } from "drizzle-orm/pg-core";
import { schema } from "../client.js";
import { pool, postgresHealthy, closePostgres } from "../../infra/postgres.js";

const reachable = await postgresHealthy();

// information_schema data_type -> the type Drizzle reports (first word).
const SAME_TYPE = {
  "timestamp with time zone": "timestamp",
  "double precision": "double",
  "USER-DEFINED": "vector",
};

test("every Drizzle table and view matches the database", { skip: !reachable && "no database" }, async () => {
  const objects = Object.values(schema).filter((o) => o instanceof PgTable || o instanceof PgView);
  assert.ok(objects.length > 20);
  for (const object of objects) {
    const isView = object instanceof PgView;
    const config = isView ? getViewConfig(object) : getTableConfig(object);
    const columns = isView ? Object.values(config.selectedFields) : config.columns;
    const { rows } = await pool.query(
      `SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
      [config.schema, config.name]
    );
    const where = `${config.schema}.${config.name}`;
    assert.ok(rows.length, `${where} does not exist in the database`);
    const inDb = new Map(rows.map((r) => [r.column_name, r]));
    assert.deepEqual(
      columns.map((c) => c.name).sort(),
      [...inDb.keys()].sort(),
      `${where}: columns differ between code and database`
    );
    for (const column of columns) {
      const db = inDb.get(column.name);
      const dbType = SAME_TYPE[db.data_type] ?? db.data_type;
      assert.equal(column.getSQLType().split(/[\s(]/)[0], dbType.split(" ")[0], `${where}.${column.name}: type differs`);
      if (!isView) assert.equal(column.notNull, db.is_nullable === "NO", `${where}.${column.name}: nullability differs`);
    }
  }
});

test.after(closePostgres);
