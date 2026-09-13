import { Buffer } from "node:buffer";

import {
  BaseError,
  createPublicClient,
  createWalletClient,
  formatEther,
  getAddress,
  http,
  keccak256,
  parseEventLogs,
  stringToHex,
} from "viem";
import {
  privateKeyToAccount,
} from "viem/accounts";
import {
  baseSepolia,
} from "viem/chains";

import { environment } from "../config.js";
import {
  createRiskAgentRegistrationDataUri,
} from "../erc8004/agent-registration.js";
import {
  ERC8004_BASE_SEPOLIA_CHAIN_ID,
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  erc8004IdentityRegistryAbi,
} from "../erc8004/identity-registry.js";

const CONFIRMATION_ARGUMENT =
  "--confirm-base-sepolia";

function requireExplicitConfirmation() {
  if (
    !process.argv.includes(
      CONFIRMATION_ARGUMENT,
    )
  ) {
    throw new Error(
      [
        "Registration was not sent.",
        "This script creates two Base Sepolia transactions.",
        `Run it again with ${CONFIRMATION_ARGUMENT} after reviewing the configuration.`,
      ].join(" "),
    );
  }
}

function describeError(
  error: unknown,
) {
  if (error instanceof BaseError) {
    return (
      error.shortMessage ||
      error.message
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown registration error occurred.";
}

async function main() {
  requireExplicitConfirmation();

  if (
    environment
      .ERC8004_AGENT_ID !==
    undefined
  ) {
    throw new Error(
      [
        "ERC8004_AGENT_ID is already configured.",
        "Refusing to create a duplicate Agent identity.",
      ].join(" "),
    );
  }

  if (
    environment
      .ERC8004_IDENTITY_REGISTRY_ADDRESS !==
    ERC8004_IDENTITY_REGISTRY_ADDRESS
  ) {
    throw new Error(
      [
        "The configured Identity Registry",
        "does not match the approved Base Sepolia Registry.",
      ].join(" "),
    );
  }

  const sellerAccount =
    privateKeyToAccount(
      environment
        .AGENT_SIGNER_PRIVATE_KEY,
    );

  if (
    getAddress(
      sellerAccount.address,
    ) !==
    environment
      .AGENT_SIGNER_ADDRESS
  ) {
    throw new Error(
      [
        "The configured signer private key",
        "does not belong to AGENT_SIGNER_ADDRESS.",
      ].join(" "),
    );
  }

  const publicClient =
    createPublicClient({
      chain: baseSepolia,

      transport: http(
        environment
          .BASE_SEPOLIA_RPC_URL,
      ),
    });

  const walletClient =
    createWalletClient({
      account:
        sellerAccount,

      chain:
        baseSepolia,

      transport: http(
        environment
          .BASE_SEPOLIA_RPC_URL,
      ),
    });

  const [
    connectedChainId,
    registryCode,
    sellerBalance,
    existingAgentCount,
  ] = await Promise.all([
    publicClient.getChainId(),

    publicClient.getCode({
      address:
        environment
          .ERC8004_IDENTITY_REGISTRY_ADDRESS,
    }),

    publicClient.getBalance({
      address:
        sellerAccount.address,
    }),

    publicClient.readContract({
      address:
        environment
          .ERC8004_IDENTITY_REGISTRY_ADDRESS,

      abi:
        erc8004IdentityRegistryAbi,

      functionName:
        "balanceOf",

      args: [
        sellerAccount.address,
      ],
    }),
  ]);

  if (
    connectedChainId !==
    ERC8004_BASE_SEPOLIA_CHAIN_ID
  ) {
    throw new Error(
      `Expected Base Sepolia chain ${ERC8004_BASE_SEPOLIA_CHAIN_ID}, received ${connectedChainId}.`,
    );
  }

  if (
    !registryCode ||
    registryCode === "0x"
  ) {
    throw new Error(
      "No Identity Registry contract was found at the configured address.",
    );
  }

  if (
    sellerBalance <= BigInt(0)
  ) {
    throw new Error(
      "The Seller account has no Base Sepolia test ETH for gas.",
    );
  }

  if (
    existingAgentCount >
    BigInt(0)
  ) {
    throw new Error(
      [
        "The Seller account already owns",
        `${existingAgentCount.toString()} ERC-8004 Agent identity token(s).`,
        "Refusing to create a duplicate identity.",
      ].join(" "),
    );
  }

  console.log(
    JSON.stringify(
      {
        mode:
          "base-sepolia-test-only",

        chainId:
          connectedChainId,

        registry:
          environment
            .ERC8004_IDENTITY_REGISTRY_ADDRESS,

        owner:
          sellerAccount.address,

        testEthBalance:
          formatEther(
            sellerBalance,
          ),

        publicBaseUrl:
          environment
            .PUBLIC_BASE_URL,
      },
      null,
      2,
    ),
  );

  const registerSimulation =
    await publicClient.simulateContract({
      account:
        sellerAccount,

      address:
        environment
          .ERC8004_IDENTITY_REGISTRY_ADDRESS,

      abi:
        erc8004IdentityRegistryAbi,

      functionName:
        "register",
    });

  const registerTransactionHash =
    await walletClient.writeContract(
      registerSimulation.request,
    );

  console.log(
    "ERC-8004 register transaction:",
    registerTransactionHash,
  );

  const registerReceipt =
    await publicClient
      .waitForTransactionReceipt({
        hash:
          registerTransactionHash,

        confirmations: 1,
      });

  if (
    registerReceipt.status !==
    "success"
  ) {
    throw new Error(
      "The ERC-8004 registration transaction reverted.",
    );
  }

  const registeredEvents =
    parseEventLogs({
      abi:
        erc8004IdentityRegistryAbi,

      eventName:
        "Registered",

      logs:
        registerReceipt.logs,

      strict: true,
    });

  const registeredEvent =
    registeredEvents.find(
      (event) =>
        getAddress(
          event.args.owner,
        ) ===
        sellerAccount.address,
    );

  if (!registeredEvent) {
    throw new Error(
      "The registration transaction did not emit the expected Registered event.",
    );
  }

  const agentId =
    registeredEvent.args.agentId;

  const registrationDataUri =
    createRiskAgentRegistrationDataUri(
      agentId,
      environment.PUBLIC_BASE_URL,
    );

  const updateUriSimulation =
    await publicClient.simulateContract({
      account:
        sellerAccount,

      address:
        environment
          .ERC8004_IDENTITY_REGISTRY_ADDRESS,

      abi:
        erc8004IdentityRegistryAbi,

      functionName:
        "setAgentURI",

      args: [
        agentId,
        registrationDataUri,
      ],
    });

  const updateUriTransactionHash =
    await walletClient.writeContract(
      updateUriSimulation.request,
    );

  console.log(
    "ERC-8004 metadata transaction:",
    updateUriTransactionHash,
  );

  const updateUriReceipt =
    await publicClient
      .waitForTransactionReceipt({
        hash:
          updateUriTransactionHash,

        confirmations: 1,
      });

  if (
    updateUriReceipt.status !==
    "success"
  ) {
    throw new Error(
      "The ERC-8004 metadata transaction reverted.",
    );
  }

  const [
    registeredOwner,
    registeredAgentWallet,
    storedAgentUri,
  ] = await Promise.all([
    publicClient.readContract({
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

    publicClient.readContract({
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

    publicClient.readContract({
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
    sellerAccount.address
  ) {
    throw new Error(
      "The registered ERC-8004 owner does not match the Seller account.",
    );
  }

  if (
    getAddress(
      registeredAgentWallet,
    ) !==
    sellerAccount.address
  ) {
    throw new Error(
      "The registered agentWallet does not match the Seller account.",
    );
  }

  if (
    storedAgentUri !==
    registrationDataUri
  ) {
    throw new Error(
      "The stored Agent URI does not match the generated registration metadata.",
    );
  }

  console.log(
    JSON.stringify(
      {
        status:
          "registered",

        chainId:
          connectedChainId,

        agentId:
          agentId.toString(),

        agentRegistry:
          [
            "eip155",
            connectedChainId.toString(),
            environment
              .ERC8004_IDENTITY_REGISTRY_ADDRESS,
          ].join(":"),

        owner:
          registeredOwner,

        agentWallet:
          registeredAgentWallet,

        registerTransaction:
          registerTransactionHash,

        metadataTransaction:
          updateUriTransactionHash,

        metadata: {
          scheme:
            "data:application/json;base64",

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
      },
      null,
      2,
    ),
  );

  console.log(
    [
      "Next:",
      `add ERC8004_AGENT_ID=${agentId.toString()}`,
      "to services/risk-agent/.env.",
    ].join(" "),
  );
}

main().catch((error: unknown) => {
  console.error(
    "ERC-8004 registration failed:",
  );

  console.error(
    describeError(error),
  );

  process.exitCode = 1;
});