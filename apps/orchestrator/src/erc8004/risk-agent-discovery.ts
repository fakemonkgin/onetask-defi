import { Buffer } from "node:buffer";

import {
  createPublicClient,
  getAddress,
  http,
  keccak256,
  stringToHex,
} from "viem";
import {
  baseSepolia,
} from "viem/chains";
import { z } from "zod";

import { environment } from "../config.js";
import {
  createErc8004AgentRegistryIdentifier,
  ERC8004_BASE_SEPOLIA_CHAIN_ID,
  ERC8004_BASE_SEPOLIA_IDENTITY_REGISTRY_ADDRESS,
  erc8004IdentityRegistryReadAbi,
} from "./identity-registry.js";

const REGISTRATION_DATA_URI_PREFIX =
  "data:application/json;base64,";

const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const ERC8004_REGISTRATION_TYPE =
  "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";

const riskAgentRegistrationSchema =
  z.object({
    type: z.literal(
      ERC8004_REGISTRATION_TYPE,
    ),

    name: z.literal(
      "OneTask Risk Agent",
    ),

    description:
      z.string().min(1),

    image:
      z.string().url(),

    services: z
      .array(
        z.object({
          name:
            z.string().min(1),

          endpoint:
            z.string().url(),

          version:
            z.string()
              .min(1)
              .optional(),
        }),
      )
      .min(1),

    x402Support:
      z.literal(true),

    active:
      z.literal(true),

    registrations: z
      .array(
        z.object({
          agentId: z
            .number()
            .int()
            .nonnegative(),

          agentRegistry:
            z.string().min(1),
        }),
      )
      .min(1),
  });

export type RiskAgentDiscoveryErrorCode =
  | "ERC8004_CONFIGURATION_ERROR"
  | "ERC8004_CHAIN_UNAVAILABLE"
  | "ERC8004_IDENTITY_MISMATCH"
  | "ERC8004_INVALID_REGISTRATION";

export class RiskAgentDiscoveryError
  extends Error {
  constructor(
    public readonly code:
      RiskAgentDiscoveryErrorCode,

    message: string,
  ) {
    super(message);

    this.name =
      "RiskAgentDiscoveryError";
  }
}

const identityPublicClient =
  createPublicClient({
    chain:
      baseSepolia,

    transport: http(
      environment
        .ERC8004_RPC_URL,
    ),
  });

function getConfiguredAgentId() {
  const agentId =
    BigInt(
      environment
        .ERC8004_AGENT_ID,
    );

  if (
    agentId >
    BigInt(
      Number.MAX_SAFE_INTEGER,
    )
  ) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_CONFIGURATION_ERROR",

      "ERC8004_AGENT_ID cannot be represented safely in the registration JSON.",
    );
  }

  return agentId;
}

function decodeRegistrationDataUri(
  agentUri: string,
) {
  if (
    !agentUri.startsWith(
      REGISTRATION_DATA_URI_PREFIX,
    )
  ) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_INVALID_REGISTRATION",

      "The ERC-8004 Agent URI is not a supported Base64 JSON data URI.",
    );
  }

  const encodedRegistration =
    agentUri.slice(
      REGISTRATION_DATA_URI_PREFIX
        .length,
    );

  if (
    encodedRegistration.length === 0 ||
    !BASE64_PATTERN.test(
      encodedRegistration,
    )
  ) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_INVALID_REGISTRATION",

      "The ERC-8004 Agent URI contains invalid Base64 data.",
    );
  }

  const registrationBuffer =
    Buffer.from(
      encodedRegistration,
      "base64",
    );

  if (
    registrationBuffer
      .toString("base64") !==
    encodedRegistration
  ) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_INVALID_REGISTRATION",

      "The ERC-8004 Agent URI failed Base64 integrity validation.",
    );
  }

  try {
    return JSON.parse(
      registrationBuffer.toString(
        "utf8",
      ),
    ) as unknown;
  } catch {
    throw new RiskAgentDiscoveryError(
      "ERC8004_INVALID_REGISTRATION",

      "The ERC-8004 Agent URI does not contain valid JSON.",
    );
  }
}

function createPinnedRiskEvaluationUrl() {
  const baseUrl =
    environment
      .RISK_AGENT_URL
      .endsWith("/")
      ? environment
          .RISK_AGENT_URL
      : `${environment.RISK_AGENT_URL}/`;

  const expectedUrl =
    new URL(
      "v1/risk/evaluate",
      baseUrl,
    );

  if (
    expectedUrl.username ||
    expectedUrl.password
  ) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_CONFIGURATION_ERROR",

      "RISK_AGENT_URL must not contain URL credentials.",
    );
  }

  return expectedUrl;
}

async function performRiskAgentDiscovery() {
  if (
    environment
      .ERC8004_CHAIN_ID !==
    ERC8004_BASE_SEPOLIA_CHAIN_ID
  ) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_CONFIGURATION_ERROR",

      "The configured ERC-8004 chain is not Base Sepolia.",
    );
  }

  if (
    environment
      .ERC8004_IDENTITY_REGISTRY_ADDRESS !==
    ERC8004_BASE_SEPOLIA_IDENTITY_REGISTRY_ADDRESS
  ) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_CONFIGURATION_ERROR",

      "The configured ERC-8004 Registry is not the approved Base Sepolia Registry.",
    );
  }

  const agentId =
    getConfiguredAgentId();

  const [
    connectedChainId,
    observedBlockNumber,
  ] = await Promise.all([
    identityPublicClient
      .getChainId(),

    identityPublicClient
      .getBlockNumber(),
  ]);

  if (
    connectedChainId !==
    ERC8004_BASE_SEPOLIA_CHAIN_ID
  ) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_IDENTITY_MISMATCH",

      `Expected Base Sepolia chain ${ERC8004_BASE_SEPOLIA_CHAIN_ID}, received ${connectedChainId}.`,
    );
  }

  const [
    registryCode,
    registeredOwner,
    registeredAgentWallet,
    agentUri,
  ] = await Promise.all([
    identityPublicClient.getCode({
      address:
        environment
          .ERC8004_IDENTITY_REGISTRY_ADDRESS,

      blockNumber:
        observedBlockNumber,
    }),

    identityPublicClient.readContract({
      address:
        environment
          .ERC8004_IDENTITY_REGISTRY_ADDRESS,

      abi:
        erc8004IdentityRegistryReadAbi,

      functionName:
        "ownerOf",

      args: [
        agentId,
      ],

      blockNumber:
        observedBlockNumber,
    }),

    identityPublicClient.readContract({
      address:
        environment
          .ERC8004_IDENTITY_REGISTRY_ADDRESS,

      abi:
        erc8004IdentityRegistryReadAbi,

      functionName:
        "getAgentWallet",

      args: [
        agentId,
      ],

      blockNumber:
        observedBlockNumber,
    }),

    identityPublicClient.readContract({
      address:
        environment
          .ERC8004_IDENTITY_REGISTRY_ADDRESS,

      abi:
        erc8004IdentityRegistryReadAbi,

      functionName:
        "tokenURI",

      args: [
        agentId,
      ],

      blockNumber:
        observedBlockNumber,
    }),
  ]);

  if (
    !registryCode ||
    registryCode === "0x"
  ) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_IDENTITY_MISMATCH",

      "No ERC-8004 Registry contract exists at the configured address.",
    );
  }

  if (
    getAddress(
      registeredOwner,
    ) !==
    environment
      .RISK_AGENT_SIGNER_ADDRESS
  ) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_IDENTITY_MISMATCH",

      "The ERC-8004 Agent owner does not match the trusted Risk Agent signer.",
    );
  }

  if (
    getAddress(
      registeredAgentWallet,
    ) !==
    environment
      .RISK_AGENT_SIGNER_ADDRESS
  ) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_IDENTITY_MISMATCH",

      "The ERC-8004 agentWallet does not match the trusted Risk Agent signer.",
    );
  }

  const registrationInput =
    decodeRegistrationDataUri(
      agentUri,
    );

  const parsedRegistration =
    riskAgentRegistrationSchema
      .safeParse(
        registrationInput,
      );

  if (!parsedRegistration.success) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_INVALID_REGISTRATION",

      "The ERC-8004 registration file has an unexpected structure.",
    );
  }

  const registration =
    parsedRegistration.data;

  const expectedAgentRegistry =
    createErc8004AgentRegistryIdentifier(
      connectedChainId,

      environment
        .ERC8004_IDENTITY_REGISTRY_ADDRESS,
    );

  const matchingRegistrations =
    registration.registrations.filter(
      (item) =>
        item.agentId ===
          Number(agentId) &&
        item.agentRegistry ===
          expectedAgentRegistry,
    );

  if (
    matchingRegistrations.length !==
    1
  ) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_INVALID_REGISTRATION",

      "The registration file does not contain exactly one matching onchain identity.",
    );
  }

  const riskEvaluationServices =
    registration.services.filter(
      (service) =>
        service.name ===
        "risk-evaluation",
    );

  if (
    riskEvaluationServices.length !==
    1
  ) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_INVALID_REGISTRATION",

      "The registration file must contain exactly one risk-evaluation service.",
    );
  }

  const riskEvaluationService =
    riskEvaluationServices[0];

  if (!riskEvaluationService) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_INVALID_REGISTRATION",

      "The risk-evaluation service could not be resolved.",
    );
  }

  const discoveredEndpoint =
    new URL(
      riskEvaluationService.endpoint,
    );

  const pinnedEndpoint =
    createPinnedRiskEvaluationUrl();

  if (
    discoveredEndpoint.href !==
    pinnedEndpoint.href
  ) {
    throw new RiskAgentDiscoveryError(
      "ERC8004_IDENTITY_MISMATCH",

      [
        "The ERC-8004 service endpoint",
        "does not match the allowlisted Risk Agent endpoint.",
      ].join(" "),
    );
  }

  return {
    source:
      "erc8004-onchain" as const,

    identity: {
      verified: true as const,

      chainId:
        connectedChainId,

      registry:
        environment
          .ERC8004_IDENTITY_REGISTRY_ADDRESS,

      agentId:
        agentId.toString(),

      agentRegistry:
        expectedAgentRegistry,

      owner:
        getAddress(
          registeredOwner,
        ),

      agentWallet:
        getAddress(
          registeredAgentWallet,
        ),

      observedBlockNumber:
        observedBlockNumber
          .toString(),
    },

    registration: {
      type:
        registration.type,

      name:
        registration.name,

      active:
        registration.active,

      x402Support:
        registration.x402Support,

      uriHash:
        keccak256(
          stringToHex(
            agentUri,
          ),
        ),
    },

    service: {
      name:
        riskEvaluationService.name,

      endpoint:
        discoveredEndpoint.href,

      version:
        riskEvaluationService
          .version ??
        "unknown",
    },
  };
}

export async function discoverRiskAgent() {
  try {
    return await performRiskAgentDiscovery();
  } catch (error) {
    if (
      error instanceof
      RiskAgentDiscoveryError
    ) {
      throw error;
    }

    throw new RiskAgentDiscoveryError(
      "ERC8004_CHAIN_UNAVAILABLE",

      "The ERC-8004 Risk Agent identity could not be read from Base Sepolia.",
    );
  }
}

export type RiskAgentDiscovery =
  Awaited<
    ReturnType<
      typeof discoverRiskAgent
    >
  >;