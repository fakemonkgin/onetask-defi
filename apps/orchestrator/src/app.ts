import cors from "@fastify/cors";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const taskPreviewInputSchema = z.object({
  intent: z
    .string()
    .trim()
    .min(12, "Intent must contain at least 12 characters.")
    .max(500, "Intent must not exceed 500 characters."),
});

const PREVIEW_TTL_MS = 10 * 60 * 1000;

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "onetask-orchestrator",
    };
  });

  app.post("/v1/tasks/preview", async (request, reply) => {
    const parsedInput = taskPreviewInputSchema.safeParse(request.body);

    if (!parsedInput.success) {
      return reply.code(400).send({
        code: "INVALID_TASK_INTENT",
        message: "The submitted DeFi intent is invalid.",
        fields: parsedInput.error.flatten().fieldErrors,
      });
    }

    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + PREVIEW_TTL_MS);

    return reply.code(200).send({
      preview: {
        id: randomUUID(),
        intent: parsedInput.data.intent,
        network: "anvil",
        mode: "simulation",
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
      pipeline: [
        "discover-agents",
        "request-x402-quotes",
        "collect-evidence",
        "await-user-authorization",
      ],
    });
  });

  return app;
}