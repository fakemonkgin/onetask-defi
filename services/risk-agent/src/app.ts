import Fastify from "fastify";

import { environment } from "./config.js";
import {
  type VerifiedRiskAgentIdentity,
  verifyRegisteredRiskAgentIdentity,
} from "./erc8004/identity-service.js";
import {
  RISK_EVIDENCE_SIGNATURE_DOMAIN,
  riskAgentSignerAddress,
} from "./evidence-signer.js";
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

  let verifiedIdentity:
    | VerifiedRiskAgentIdentity
    | undefined;

  function getVerifiedIdentity() {
    if (!verifiedIdentity) {
      throw new Error(
        "The ERC-8004 Agent identity has not been verified.",
      );
    }

    return verifiedIdentity;
  }

  /*
   * This must run before the protected
   * Fastify route is registered.
   */
  applyX402Protection(app);

  /*
   * Fail closed during startup if the
   * configured ERC-8004 identity cannot
   * be verified against Base Sepolia.
   */
  app.addHook(
    "onReady",
    async () => {
      verifiedIdentity =
        await verifyRegisteredRiskAgentIdentity();

      app.log.info(
        {
          erc8004: {
            verified:
              verifiedIdentity
                .verified,

            chainId:
              verifiedIdentity
                .chainId,

            registry:
              verifiedIdentity
                .registry,

            agentId:
              verifiedIdentity
                .agentId,

            owner:
              verifiedIdentity
                .owner,

            agentWallet:
              verifiedIdentity
                .agentWallet,

            agentUriHash:
              verifiedIdentity
                .agentUri
                .hash,
          },
        },
        "Verified ERC-8004 Agent identity.",
      );
    },
  );

  app.get("/health", async () => {
    const identity =
      getVerifiedIdentity();

    return {
      status: "ok",

      service:
        "onetask-risk-agent",

      version:
        AGENT_VERSION,

      mode:
        "deterministic-policy",

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

      evidenceSigning: {
        enabled: true,

        scheme: "eip712",

        signer:
          riskAgentSignerAddress,

        domain: {
          name:
            RISK_EVIDENCE_SIGNATURE_DOMAIN
              .name,

          version:
            RISK_EVIDENCE_SIGNATURE_DOMAIN
              .version,

          chainId:
            RISK_EVIDENCE_SIGNATURE_DOMAIN
              .chainId,
        },
      },

      erc8004Identity: {
        verified:
          identity.verified,

        chainId:
          identity.chainId,

        registry:
          identity.registry,

        agentId:
          identity.agentId,

        agentRegistry:
          identity.agentRegistry,

        owner:
          identity.owner,

        agentWallet:
          identity.agentWallet,

        agentUri:
          identity.agentUri,
      },
    };
  });

  app.get(
    "/.well-known/agent-registration.json",
    async () => {
      const identity =
        getVerifiedIdentity();

      return identity.registration;
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
        await evaluateRisk(
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