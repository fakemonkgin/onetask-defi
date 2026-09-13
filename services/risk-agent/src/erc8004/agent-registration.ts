import { Buffer } from "node:buffer";
import { URL } from "node:url";

import {
  ERC8004_BASE_SEPOLIA_AGENT_REGISTRY,
} from "./identity-registry.js";

const ERC8004_REGISTRATION_TYPE =
  "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";

const AGENT_NAME =
  "OneTask Risk Agent";

const AGENT_VERSION =
  "0.1.0";

const MAX_SAFE_AGENT_ID =
  BigInt(Number.MAX_SAFE_INTEGER);

function normalizePublicBaseUrl(
  publicBaseUrl: string,
) {
  const parsedUrl =
    new URL(publicBaseUrl);

  if (
    parsedUrl.protocol !== "http:" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new Error(
      "The Agent public base URL must use HTTP or HTTPS.",
    );
  }

  if (
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error(
      "The Agent public base URL must not contain a query or fragment.",
    );
  }

  return publicBaseUrl.replace(
    /\/+$/,
    "",
  );
}

function convertAgentIdToJsonNumber(
  agentId: bigint,
) {
  if (
    agentId < BigInt(0) ||
    agentId > MAX_SAFE_AGENT_ID
  ) {
    throw new Error(
      "The ERC-8004 agent ID cannot be represented safely in JSON.",
    );
  }

  return Number(agentId);
}

export function createRiskAgentRegistration(
  agentId: bigint,
  publicBaseUrl: string,
) {
  const normalizedBaseUrl =
    normalizePublicBaseUrl(
      publicBaseUrl,
    );

  return {
    type:
      ERC8004_REGISTRATION_TYPE,

    name:
      AGENT_NAME,

    description:
      "An x402-paid OneTask Agent that independently evaluates constrained DeFi vault migration plans and returns EIP-712 signed risk evidence.",

    image:
      `${normalizedBaseUrl}/agent.svg`,

    services: [
      {
        name:
          "risk-evaluation",

        endpoint:
          `${normalizedBaseUrl}/v1/risk/evaluate`,

        version:
          AGENT_VERSION,
      },
    ],

    x402Support: true,
    active: true,

    registrations: [
      {
        agentId:
          convertAgentIdToJsonNumber(
            agentId,
          ),

        agentRegistry:
          ERC8004_BASE_SEPOLIA_AGENT_REGISTRY,
      },
    ],
  };
}

export function createRiskAgentRegistrationJson(
  agentId: bigint,
  publicBaseUrl: string,
) {
  return JSON.stringify(
    createRiskAgentRegistration(
      agentId,
      publicBaseUrl,
    ),
  );
}

export function createRiskAgentRegistrationDataUri(
  agentId: bigint,
  publicBaseUrl: string,
) {
  const registrationJson =
    createRiskAgentRegistrationJson(
      agentId,
      publicBaseUrl,
    );

  const encodedRegistration =
    Buffer.from(
      registrationJson,
      "utf8",
    ).toString("base64");

  return [
    "data:application/json;base64,",
    encodedRegistration,
  ].join("");
}

export type RiskAgentRegistration =
  ReturnType<
    typeof createRiskAgentRegistration
  >;