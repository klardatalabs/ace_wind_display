import '../server/config/env.js';
import fs from 'node:fs/promises';
import {pool} from '../server/db/timescaleDb.js';

if (!process.env.GRAFANA_DB_PASSWORD) throw new Error('Set GRAFANA_DB_PASSWORD before migration');
const client=await pool.connect();
try {
  await client.query(await fs.readFile(new URL('./migrate_history.sql',import.meta.url),'utf8'));
  const {rows}=await client.query("SELECT format('CREATE ROLE grafana_reader LOGIN PASSWORD %L', $1::text) AS create_sql, format('ALTER ROLE grafana_reader PASSWORD %L', $1::text) AS alter_sql",[process.env.GRAFANA_DB_PASSWORD]);
  const role=await client.query("SELECT 1 FROM pg_roles WHERE rolname='grafana_reader'");
  await client.query(role.rowCount ? rows[0].alter_sql : rows[0].create_sql);
  await client.query('GRANT USAGE ON SCHEMA history TO grafana_reader; GRANT SELECT ON history.scada_10m,history.daily_base,history.daily_rollup TO grafana_reader;');
  console.log('Canonical history schema ready. Readers are not switched by this command.');
} finally {client.release();await pool.end();}
