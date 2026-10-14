// Column helpers shared by the table definitions.

import { customType, timestamp, doublePrecision } from "drizzle-orm/pg-core";

/** bytea as a Node Buffer (Drizzle has no built-in bytea column). */
export const bytea = customType({ dataType: () => "bytea" });

/** timestamptz, read as a JavaScript Date. */
export const timestamptz = (name) => timestamp(name, { withTimezone: true, mode: "date" });

/** double precision, read as a JavaScript number. */
export const float = (name) => doublePrecision(name);
