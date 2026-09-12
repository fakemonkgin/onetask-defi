import { buildApp } from "./app.js";
import { environment } from "./config.js";

const app = await buildApp();

try {
  await app.listen({
    port: environment.PORT,
    host: environment.HOST,
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}