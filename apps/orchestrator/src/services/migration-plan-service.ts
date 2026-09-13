import { randomBytes } from "node:crypto";

import {
  type Address,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
} from "viem";

import { taskExecutorReadAbi } from "../blockchain/abis.js";
import { blockchainClient } from "../blockchain/client.js";
import { environment } from "../config.js";
import { getVaultState } from "./vault-state-service.js";

const BASIS_POINTS_DENOMINATOR = 10_000n;
const MAX_ALLOWED_LOSS_BPS = 1_000;
const PLAN_TTL_SECONDS = 10n * 60n;
const EVIDENCE_VERSION = 1n;
const NONCE_GENERATION_ATTEMPTS = 5;

const evidenceAbiParameters = parseAbiParameters(
  "uint256 evidenceVersion, uint256 chainId, address executor, address user, address sourceVault, address destinationVault, uint256 sourceShares, uint256 quotedAssetsReceived, uint256 quotedDestinationShares, uint256 minAssetsReceived, uint256 minDestinationShares, uint256 deadline, uint256 nonce, uint256 maxLossBps, uint256 observedBlockNumber",
);

type MigrationPlanErrorCode =
  | "INVALID_LOSS_LIMIT"
  | "NO_SOURCE_POSITION"
  | "EMPTY_MIGRATION_QUOTE"
  | "NONCE_UNAVAILABLE";

export class MigrationPlanError extends Error {
  constructor(
    public readonly code: MigrationPlanErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MigrationPlanError";
  }
}

function calculateMinimumAfterLoss(
  quotedAmount: bigint,
  maxLossBps: number,
) {
  const retainedBasisPoints =
    BASIS_POINTS_DENOMINATOR -
    BigInt(maxLossBps);

  const numerator =
    quotedAmount * retainedBasisPoints;

  return (
    numerator +
    BASIS_POINTS_DENOMINATOR -
    1n
  ) / BASIS_POINTS_DENOMINATOR;
}

async function createUnusedNonce(
  user: Address,
) {
  for (
    let attempt = 0;
    attempt < NONCE_GENERATION_ATTEMPTS;
    attempt += 1
  ) {
    const nonce = BigInt(
      `0x${randomBytes(16).toString("hex")}`,
    );

    const isUsed =
      await blockchainClient.readContract({
        address:
          environment.TASK_EXECUTOR_ADDRESS,
        abi: taskExecutorReadAbi,
        functionName: "usedNonces",
        args: [user, nonce],
      });

    if (!isUsed) {
      return nonce;
    }
  }

  throw new MigrationPlanError(
    "NONCE_UNAVAILABLE",
    "Unable to generate an unused execution nonce.",
  );
}

export async function createMigrationPlan(
  user: Address,
  maxLossBps: number,
) {
  if (
    !Number.isInteger(maxLossBps) ||
    maxLossBps < 0 ||
    maxLossBps > MAX_ALLOWED_LOSS_BPS
  ) {
    throw new MigrationPlanError(
      "INVALID_LOSS_LIMIT",
      `maxLossBps must be an integer between 0 and ${MAX_ALLOWED_LOSS_BPS}.`,
    );
  }

  const [vaultState, latestBlock] =
    await Promise.all([
      getVaultState(user),
      blockchainClient.getBlock({
        blockTag: "latest",
      }),
    ]);

  if (!vaultState.migrationPreview.executable) {
    throw new MigrationPlanError(
      "NO_SOURCE_POSITION",
      "The user does not have source-vault shares to migrate.",
    );
  }

  const sourceShares = BigInt(
    vaultState.migrationPreview.sourceShares,
  );

  const quotedAssetsReceived = BigInt(
    vaultState.migrationPreview.assetsReceived,
  );

  const quotedDestinationShares = BigInt(
    vaultState.migrationPreview
      .destinationShares,
  );

  if (
    quotedAssetsReceived === 0n ||
    quotedDestinationShares === 0n
  ) {
    throw new MigrationPlanError(
      "EMPTY_MIGRATION_QUOTE",
      "The current vault state produced an empty migration quote.",
    );
  }

  const minAssetsReceived =
    calculateMinimumAfterLoss(
      quotedAssetsReceived,
      maxLossBps,
    );

  const minDestinationShares =
    calculateMinimumAfterLoss(
      quotedDestinationShares,
      maxLossBps,
    );

  const nonce =
    await createUnusedNonce(user);

  const deadline =
    latestBlock.timestamp +
    PLAN_TTL_SECONDS;

  const evidenceHash = keccak256(
    encodeAbiParameters(
      evidenceAbiParameters,
      [
        EVIDENCE_VERSION,
        BigInt(vaultState.chainId),
        environment.TASK_EXECUTOR_ADDRESS,
        user,
        vaultState.vaultA.address,
        vaultState.vaultB.address,
        sourceShares,
        quotedAssetsReceived,
        quotedDestinationShares,
        minAssetsReceived,
        minDestinationShares,
        deadline,
        nonce,
        BigInt(maxLossBps),
        latestBlock.number,
      ],
    ),
  );

  return {
    mode: "simulation" as const,
    chainId: vaultState.chainId,

    taskExecutor: {
      address:
        environment.TASK_EXECUTOR_ADDRESS,
    },

    plan: {
      user,
      sourceVault:
        vaultState.vaultA.address,
      destinationVault:
        vaultState.vaultB.address,
      sourceShares:
        sourceShares.toString(),
      minAssetsReceived:
        minAssetsReceived.toString(),
      minDestinationShares:
        minDestinationShares.toString(),
      deadline:
        deadline.toString(),
      nonce:
        nonce.toString(),
      evidenceHash,
    },

    quote: {
      quotedAssetsReceived:
        quotedAssetsReceived.toString(),
      quotedDestinationShares:
        quotedDestinationShares.toString(),
      observedBlockNumber:
        latestBlock.number.toString(),
      observedBlockTimestamp:
        latestBlock.timestamp.toString(),
    },

    constraints: {
      maxLossBps,
      basisPointsDenominator:
        Number(BASIS_POINTS_DENOMINATOR),
      expiresInSeconds:
        Number(PLAN_TTL_SECONDS),
    },

    approval: {
      token:
        vaultState.vaultA.address,
      spender:
        environment.TASK_EXECUTOR_ADDRESS,
      amount:
        sourceShares.toString(),
    },

    evidence: {
      schema:
        "onetask.local-vault-migration-evidence.v1",
      hash: evidenceHash,
      signedByAgent: false,
    },
  };
}