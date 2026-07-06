import { migrate } from "drizzle-orm/postgres-js/migrator";

import { useDb } from "~~/server/utils/db";

/**
 * Run pending Drizzle migrations. Invoke with:
 *   npx nuxt dev  (then trigger via devtools) — or in prod on deploy:
 *   node .output/server/index.mjs + a runTask call, or just `pnpm db:migrate`.
 */
export default defineTask({
  meta: {
    name: "db:migrate",
    description: "Apply pending database migrations",
  },
  async run() {
    await migrate(useDb(), {
      migrationsFolder: "./server/database/migrations",
    });
    return { result: "migrated" };
  },
});
