import Fastify from "fastify";

import { environment } from "./config.js";
import {
  evaluateRisk,
  riskEvaluationInputSchema,
} from "./risk-evaluator.js";
import {
  applyX402Protection,
} from "./x402.js";

const AGENT_VERSION = "0.1.0";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  const publicBaseUrl =
    environment.PUBLIC_BASE_URL.replace(
      /\/$/,
      "",
    );

  /*
   * This must run before the protected
   * Fastify route is registered.
   */
  applyX402Protection(app);

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "onetask-risk-agent",
      version: AGENT_VERSION,
      mode: "deterministic-policy",

      x402Protection: true,

      x402: {
        network:
          environment.X402_NETWORK,

        scheme: "exact",

        price:
          environment.X402_PRICE,

        payTo:
          environment
            .X402_PAY_TO_ADDRESS,

        facilitator:
          environment
            .X402_FACILITATOR_URL,
      },
    };
  });

  app.get(
    "/.well-known/agent-registration.json",
    async () => {
      return {
        type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",

        name:
          "OneTask Risk Agent",

        description:
          "Independently verifies OneTask DeFi vault migration constraints and produces hash-bound risk evidence. Access is protected by x402.",

        image:
          `${publicBaseUrl}/agent.svg`,

        services: [
          {
            name:
              "risk-evaluation",

            endpoint:
              `${publicBaseUrl}/v1/risk/evaluate`,

            version:
              AGENT_VERSION,
          },
        ],

        x402Support: true,
        active: true,
        registrations: [],
      };
    },
  );

  app.get(
    "/agent.svg",
    async (_request, reply) => {
      const svg = `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 256 256"
          role="img"
          aria-label="OneTask Risk Agent"
        >
          <rect
            width="256"
            height="256"
            rx="56"
            fill="#052e2b"
          />
          <path
            d="M128 38L205 70V119C205 169 174 207 128 222C82 207 51 169 51 119V70L128 38Z"
            fill="#10b981"
          />
          <path
            d="M91 128L116 153L169 99"
            fill="none"
            stroke="#ffffff"
            stroke-width="18"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      `;

      return reply
        .type("image/svg+xml")
        .send(svg);
    },
  );

  app.post(
    "/v1/risk/evaluate",
    async (request, reply) => {
      const parsedInput =
        riskEvaluationInputSchema.safeParse(
          request.body,
        );

      if (!parsedInput.success) {
        return reply
          .code(400)
          .send({
            code:
              "INVALID_RISK_EVALUATION_INPUT",

            message:
              "The submitted migration plan cannot be evaluated.",

            fields:
              parsedInput.error
                .flatten()
                .fieldErrors,
          });
      }

      const evidence =
        evaluateRisk(
          parsedInput.data,
        );

      return reply
        .code(200)
        .send({
          evidence,
        });
    },
  );

  return app;
}