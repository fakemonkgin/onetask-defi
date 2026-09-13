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

import { environment } from "../config.js";
import {
  riskAgentSignerAddress,
} from "../evidence-signer.js";
import {
  createRiskAgentRegistration,
  createRiskAgentRegistrationDataUri,
} from "./agent-registration.js";
import {
  ERC8004_BASE_SEPOLIA_AGENT_REGISTRY,
  ERC8004_BASE_SEPOLIA_CHAIN_ID,
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  erc8004IdentityRegistryAbi,
} from "./identity-registry.js";

const identityPublicClient =
  createPublicClient({
    chain:
      baseSepolia,

    transport: http(
      environment
        .BASE_SEPOLIA_RPC_URL,
    ),
  });

function getConfiguredAgentId() {
  if (
    environment
      .ERC8004_AGENT_ID ===
    undefined
  ) {
    throw new Error(
      "ERC8004_AGENT_ID is required after the Agent has been registered.",
    );
  }

  return BigInt(
    environment
      .ERC8004_AGENT_ID,
  );
}

export async function verifyRegisteredRiskAgentIdentity() {
  if (
    environment
      .ERC8004_IDENTITY_REGISTRY_ADDRESS !==
    ERC8004_IDENTITY_REGISTRY_ADDRESS
  ) {
    throw new Error(
      [
        "The configured ERC-8004 Identity Registry",
        "does not match the approved Base Sepolia Registry.",
      ].join(" "),
    );
  }

  const agentId =
    getConfiguredAgentId();

  const connectedChainId =
    await identityPublicClient
      .getChainId();

  if (
    connectedChainId !==
    ERC8004_BASE_SEPOLIA_CHAIN_ID
  ) {
    throw new Error(
      `Expected Base Sepolia chain ${ERC8004_BASE_SEPOLIA_CHAIN_ID}, received ${connectedChainId}.`,
    );
  }

  const registryCode =
    await identityPublicClient
      .getCode({
        address:
          environment
            .ERC8004_IDENTITY_REGISTRY_ADDRESS,
      });

  if (
    !registryCode ||
    registryCode === "0x"
  ) {
    throw new Error(
      "No ERC-8004 Identity Registry contract was found at the configured address.",
    );
  }

  const [
    registeredOwner,
    registeredAgentWallet,
    storedAgentUri,
  ] = await Promise.all([
    identityPublicClient.readContract({
      address:
        environment
          .ERC8004_IDENTITY_REGISTRY_ADDRESS,

      abi:
        erc8004IdentityRegistryAbi,

      functionName:
        "ownerOf",

      args: [
        agentId,
      ],
    }),

    identityPublicClient.readContract({
      address:
        environment
          .ERC8004_IDENTITY_REGISTRY_ADDRESS,

      abi:
        erc8004IdentityRegistryAbi,

      functionName:
        "getAgentWallet",

      args: [
        agentId,
      ],
    }),

    identityPublicClient.readContract({
      address:
        environment
          .ERC8004_IDENTITY_REGISTRY_ADDRESS,

      abi:
        erc8004IdentityRegistryAbi,

      functionName:
        "tokenURI",

      args: [
        agentId,
      ],
    }),
  ]);

  if (
    getAddress(
      registeredOwner,
    ) !==
    riskAgentSignerAddress
  ) {
    throw new Error(
      [
        "The ERC-8004 Agent owner",
        "does not match the configured evidence signer.",
      ].join(" "),
    );
  }

  if (
    getAddress(
      registeredAgentWallet,
    ) !==
    riskAgentSignerAddress
  ) {
    throw new Error(
      [
        "The ERC-8004 agentWallet",
        "does not match the configured evidence signer.",
      ].join(" "),
    );
  }

  const expectedAgentUri =
    createRiskAgentRegistrationDataUri(
      agentId,
      environment.PUBLIC_BASE_URL,
    );

  if (
    storedAgentUri !==
    expectedAgentUri
  ) {
    throw new Error(
      [
        "The onchain ERC-8004 Agent URI",
        "does not match this Risk Agent configuration.",
      ].join(" "),
    );
  }

  const registration =
    createRiskAgentRegistration(
      agentId,
      environment.PUBLIC_BASE_URL,
    );

  return {
    verified: true as const,

    chainId:
      connectedChainId,

    registry:
      environment
        .ERC8004_IDENTITY_REGISTRY_ADDRESS,

    agentId:
      agentId.toString(),

    agentRegistry:
      ERC8004_BASE_SEPOLIA_AGENT_REGISTRY,

    owner:
      getAddress(
        registeredOwner,
      ),

    agentWallet:
      getAddress(
        registeredAgentWallet,
      ),

    agentUri: {
      scheme:
        "data:application/json;base64" as const,

      byteLength:
        Buffer.byteLength(
          storedAgentUri,
          "utf8",
        ),

      hash:
        keccak256(
          stringToHex(
            storedAgentUri,
          ),
        ),
    },

    registration,
  };
}

export type VerifiedRiskAgentIdentity =
  Awaited<
    ReturnType<
      typeof verifyRegisteredRiskAgentIdentity
    >
  >;