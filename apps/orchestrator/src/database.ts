import { Pool } from "pg";

import { environment } from "./config.js";

export const databasePool = new Pool({
  connectionString: environment.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

databasePool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});