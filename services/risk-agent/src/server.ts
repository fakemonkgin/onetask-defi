import { buildApp } from "./app.js";
import { environment } from "./config.js";

const app = buildApp();

try {
  await app.listen({
    host: environment.HOST,
    port: environment.PORT,
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}