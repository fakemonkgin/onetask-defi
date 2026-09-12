import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";

import { environment } from "./config.js";
import { databasePool } from "./database.js";
import { TaskPreviewRepository } from "./repositories/task-preview-repository.js";

const taskPreviewInputSchema = z.object({
  intent: z
    .string()
    .trim()
    .min(12, "Intent must contain at least 12 characters.")
    .max(500, "Intent must not exceed 500 characters."),
});

const TASK_PREVIEW_PIPELINE = [
  "discover-agents",
  "request-x402-quotes",
  "collect-evidence",
  "await-user-authorization",
] as const;

const PREVIEW_TTL_MS = 10 * 60 * 1000;

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  const taskPreviewRepository =
    new TaskPreviewRepository(databasePool);

  await app.register(cors, {
    origin: environment.WEB_ORIGIN,
    methods: ["GET", "POST"],
  });

  app.get("/health", async () => {
    const databaseResult =
      await databasePool.query<{ database: string }>(
        "SELECT current_database() AS database",
      );

    return {
      status: "ok",
      service: "onetask-orchestrator",
      database:
        databaseResult.rows[0]?.database ?? "unknown",
    };
  });

  app.post("/v1/tasks/preview", async (request, reply) => {
    const parsedInput =
      taskPreviewInputSchema.safeParse(request.body);

    if (!parsedInput.success) {
      return reply.code(400).send({
        code: "INVALID_TASK_INTENT",
        message: "The submitted DeFi intent is invalid.",
        fields:
          parsedInput.error.flatten().fieldErrors,
      });
    }

    const expiresAt = new Date(
      Date.now() + PREVIEW_TTL_MS,
    );

    const preview =
      await taskPreviewRepository.create({
        intent: parsedInput.data.intent,
        pipeline: TASK_PREVIEW_PIPELINE,
        expiresAt,
      });

    return reply.code(201).send({
      preview: {
        id: preview.id,
        intent: preview.intent,
        network: preview.network,
        mode: preview.mode,
        createdAt: preview.createdAt.toISOString(),
        expiresAt: preview.expiresAt.toISOString(),
      },
      pipeline: preview.pipeline,
    });
  });

  app.addHook("onClose", async () => {
    await databasePool.end();
  });

  return app;
}