import cors from "@fastify/cors";
import Fastify from "fastify";
import {
  getAddress,
  isAddress,
} from "viem";
import { z } from "zod";

import {
  evaluateMigrationRisk,
  RiskAgentClientError,
} from "./clients/risk-agent-client.js";
import { environment } from "./config.js";
import { databasePool } from "./database.js";
import { TaskPreviewRepository } from "./repositories/task-preview-repository.js";
import {
  createMigrationPlan,
  MigrationPlanError,
} from "./services/migration-plan-service.js";
import { getVaultState } from "./services/vault-state-service.js";

const taskPreviewInputSchema = z.object({
  intent: z
    .string()
    .trim()
    .min(
      12,
      "Intent must contain at least 12 characters.",
    )
    .max(
      500,
      "Intent must not exceed 500 characters.",
    ),
});

const userAddressSchema = z
  .string()
  .trim()
  .refine(
    (value) => isAddress(value),
    "A valid EVM user address is required.",
  )
  .transform((value) =>
    getAddress(value),
  );

const vaultStateQuerySchema = z.object({
  user: userAddressSchema,
});

const migrationPlanInputSchema = z
  .object({
    user: userAddressSchema,

    maxLossBps: z
      .number()
      .int(
        "maxLossBps must be an integer.",
      )
      .min(
        0,
        "maxLossBps must not be negative.",
      )
      .max(
        1_000,
        "maxLossBps must not exceed 1000.",
      )
      .default(50),
  })
  .strict();

const TASK_PREVIEW_PIPELINE = [
  "discover-agents",
  "request-x402-quotes",
  "collect-evidence",
  "await-user-authorization",
] as const;

const PREVIEW_TTL_MS =
  10 * 60 * 1_000;

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  const taskPreviewRepository =
    new TaskPreviewRepository(
      databasePool,
    );

  await app.register(cors, {
    origin:
      environment.WEB_ORIGIN,

    methods: [
      "GET",
      "POST",
    ],
  });

  app.get("/health", async () => {
    const databaseResult =
      await databasePool.query<{
        database: string;
      }>(
        "SELECT current_database() AS database",
      );

    return {
      status: "ok",
      service:
        "onetask-orchestrator",

      database:
        databaseResult.rows[0]
          ?.database ??
        "unknown",
    };
  });

  app.get(
    "/v1/vaults/state",
    async (request, reply) => {
      const parsedQuery =
        vaultStateQuerySchema.safeParse(
          request.query,
        );

      if (!parsedQuery.success) {
        return reply
          .code(400)
          .send({
            code:
              "INVALID_USER_ADDRESS",

            message:
              "A valid EVM user address is required.",

            fields:
              parsedQuery.error
                .flatten()
                .fieldErrors,
          });
      }

      try {
        const state =
          await getVaultState(
            parsedQuery.data.user,
          );

        return reply.send({
          state,
        });
      } catch (error) {
        request.log.error(
          {
            err: error,
          },
          "Unable to read vault state.",
        );

        return reply
          .code(503)
          .send({
            code:
              "CHAIN_UNAVAILABLE",

            message:
              "The local blockchain state could not be read.",
          });
      }
    },
  );

  app.post(
    "/v1/migrations/plan",
    async (request, reply) => {
      const parsedInput =
        migrationPlanInputSchema.safeParse(
          request.body,
        );

      if (!parsedInput.success) {
        return reply
          .code(400)
          .send({
            code:
              "INVALID_MIGRATION_PLAN_INPUT",

            message:
              "The migration plan request is invalid.",

            fields:
              parsedInput.error
                .flatten()
                .fieldErrors,
          });
      }

      try {
        const migrationPlan =
          await createMigrationPlan(
            parsedInput.data.user,
            parsedInput.data
              .maxLossBps,
          );

        const riskEvidence =
          await evaluateMigrationRisk(
            migrationPlan,
          );

        if (
          riskEvidence.decision !==
          "approve"
        ) {
          return reply
            .code(422)
            .send({
              code:
                "RISK_POLICY_REJECTED",

              message:
                "The migration plan was rejected by the risk agent.",

              migrationPlan,
              riskEvidence,
            });
        }

        return reply.send({
          migrationPlan,
          riskEvidence,
        });
      } catch (error) {
        if (
          error instanceof
          MigrationPlanError
        ) {
          const statusCode =
            error.code ===
            "INVALID_LOSS_LIMIT"
              ? 400
              : error.code ===
                  "NONCE_UNAVAILABLE"
                ? 503
                : 409;

          return reply
            .code(statusCode)
            .send({
              code: error.code,
              message:
                error.message,
            });
        }

        if (
          error instanceof
          RiskAgentClientError
        ) {
          const statusCode:
            | 502
            | 503 =
            error.code ===
            "RISK_AGENT_UNAVAILABLE"
              ? 503
              : 502;

          request.log.error(
            {
              err: error,
              riskAgentUrl:
                environment
                  .RISK_AGENT_URL,
            },
            "Unable to obtain valid risk evidence.",
          );

          return reply
            .code(statusCode)
            .send({
              code: error.code,
              message:
                error.message,
            });
        }

        request.log.error(
          {
            err: error,
          },
          "Unable to create migration plan.",
        );

        return reply
          .code(503)
          .send({
            code:
              "CHAIN_UNAVAILABLE",

            message:
              "The local blockchain state could not be read.",
          });
      }
    },
  );

  app.post(
    "/v1/tasks/preview",
    async (request, reply) => {
      const parsedInput =
        taskPreviewInputSchema.safeParse(
          request.body,
        );

      if (!parsedInput.success) {
        return reply
          .code(400)
          .send({
            code:
              "INVALID_TASK_INTENT",

            message:
              "The submitted DeFi intent is invalid.",

            fields:
              parsedInput.error
                .flatten()
                .fieldErrors,
          });
      }

      const expiresAt =
        new Date(
          Date.now() +
            PREVIEW_TTL_MS,
        );

      const preview =
        await taskPreviewRepository.create({
          intent:
            parsedInput.data.intent,

          pipeline:
            TASK_PREVIEW_PIPELINE,

          expiresAt,
        });

      return reply
        .code(201)
        .send({
          preview: {
            id: preview.id,
            intent:
              preview.intent,
            network:
              preview.network,
            mode: preview.mode,

            createdAt:
              preview.createdAt
                .toISOString(),

            expiresAt:
              preview.expiresAt
                .toISOString(),
          },

          pipeline:
            preview.pipeline,
        });
    },
  );

  app.addHook(
    "onClose",
    async () => {
      await databasePool.end();
    },
  );

  return app;
}