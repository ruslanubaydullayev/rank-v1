import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../database/schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

let _db: Database | null = null;
let _client: ReturnType<typeof postgres> | null = null;

/**
 * Lazily-initialised singleton Drizzle client.
 * Throws a clear error if DATABASE_URL is not configured so misconfiguration
 * surfaces early instead of as an opaque connection error.
 */
export function useDb(): Database {
  if (_db) return _db;

  // Prefer runtimeConfig (set from env at build/dev), but fall back to the raw
  // process env so an unprefixed DATABASE_URL set only at runtime still works
  // (e.g. serverless hosts where the value isn't present at build time).
  const url = useRuntimeConfig().databaseUrl || process.env.DATABASE_URL;
  if (!url) {
    throw createError({
      statusCode: 500,
      statusMessage: "DATABASE_URL is not configured",
    });
  }

  _client = postgres(url, { max: 10 });
  _db = drizzle(_client, { schema });
  return _db;
}

export { schema };
