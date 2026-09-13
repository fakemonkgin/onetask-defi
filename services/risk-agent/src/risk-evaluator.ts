import {
  keccak256,
  stringToHex,
} from "viem";
import { z } from "zod";

import { environment } from "./config.js";

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/);

const bytes32Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/);

const unsignedIntegerStringSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/);

export const riskEvaluationInputSchema = z.object({
  chainId: z
    .number()
    .int()
    .positive(),

  taskExecutor: z.object({
    address: addressSchema,
  }),

  plan: z.object({
    user: addressSchema,
    sourceVault: addressSchema,
    destinationVault: addressSchema,
    sourceShares: unsignedIntegerStringSchema,
    minAssetsReceived: unsignedIntegerStringSchema,
    minDestinationShares: unsignedIntegerStringSchema,
    deadline: unsignedIntegerStringSchema,
    nonce: unsignedIntegerStringSchema,
    evidenceHash: bytes32Schema,
  }),

  quote: z.object({
    quotedAssetsReceived:
      unsignedIntegerStringSchema,

    quotedDestinationShares:
      unsignedIntegerStringSchema,

    observedBlockNumber:
      unsignedIntegerStringSchema,

    observedBlockTimestamp:
      unsignedIntegerStringSchema,
  }),

  constraints: z.object({
    maxLossBps: z
      .number()
      .int()
      .min(0)
      .max(10_000),

    basisPointsDenominator: z.literal(10_000),

    expiresInSeconds: z
      .number()
      .int()
      .positive(),
  }),
});

export type RiskEvaluationInput = z.infer<
  typeof riskEvaluationInputSchema
>;

type RiskCheck = {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  detail: string;
};

function addressesEqual(
  firstAddress: string,
  secondAddress: string,
) {
  return (
    firstAddress.toLowerCase() ===
    secondAddress.toLowerCase()
  );
}

function minimumAfterLoss(
  quotedAmount: bigint,
  maxLossBps: number,
) {
  const denominator = BigInt(10_000);
  const retainedBasisPoints =
    denominator - BigInt(maxLossBps);

  const numerator =
    quotedAmount * retainedBasisPoints;

  return (
    numerator +
    denominator -
    BigInt(1)
  ) / denominator;
}

function canonicalize(value: unknown): string {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    const serializedValue = JSON.stringify(value);

    if (serializedValue === undefined) {
      throw new Error(
        "Unable to canonicalize the supplied value.",
      );
    }

    return serializedValue;
  }

  if (Array.isArray(value)) {
    return `[${value
      .map((item) => canonicalize(item))
      .join(",")}]`;
  }

  const record =
    value as Record<string, unknown>;

  const serializedEntries = Object.keys(record)
    .sort()
    .map((key) => {
      return `${JSON.stringify(key)}:${canonicalize(
        record[key],
      )}`;
    });

  return `{${serializedEntries.join(",")}}`;
}

function hashCanonicalValue(value: unknown) {
  return keccak256(
    stringToHex(canonicalize(value)),
  );
}

export function evaluateRisk(
  input: RiskEvaluationInput,
) {
  const sourceShares =
    BigInt(input.plan.sourceShares);

  const quotedAssets =
    BigInt(input.quote.quotedAssetsReceived);

  const quotedDestinationShares =
    BigInt(
      input.quote.quotedDestinationShares,
    );

  const minAssetsReceived =
    BigInt(input.plan.minAssetsReceived);

  const minDestinationShares =
    BigInt(
      input.plan.minDestinationShares,
    );

  const deadline =
    BigInt(input.plan.deadline);

  const currentUnixTime = BigInt(
    Math.floor(Date.now() / 1_000),
  );

  const minimumExecutionWindow =
    BigInt(30);

  const expectedMinAssets =
    minimumAfterLoss(
      quotedAssets,
      input.constraints.maxLossBps,
    );

  const expectedMinDestinationShares =
    minimumAfterLoss(
      quotedDestinationShares,
      input.constraints.maxLossBps,
    );

  const chainAccepted =
    input.chainId === environment.CHAIN_ID;

  const executorAccepted = addressesEqual(
    input.taskExecutor.address,
    environment.TASK_EXECUTOR_ADDRESS,
  );

  const vaultsAreDifferent =
    !addressesEqual(
      input.plan.sourceVault,
      input.plan.destinationVault,
    );

  const positionIsNonzero =
    sourceShares > BigInt(0);

  const lossPolicyAccepted =
    input.constraints.maxLossBps <=
    environment.MAX_ALLOWED_LOSS_BPS;

  const assetFloorIsCorrect =
    minAssetsReceived === expectedMinAssets;

  const destinationFloorIsCorrect =
    minDestinationShares ===
    expectedMinDestinationShares;

  const assetQuoteSatisfiesFloor =
    quotedAssets >= minAssetsReceived;

  const destinationQuoteSatisfiesFloor =
    quotedDestinationShares >=
    minDestinationShares;

  const ttlAccepted =
    input.constraints.expiresInSeconds <=
    environment.MAX_PLAN_TTL_SECONDS;

  const deadlineIsFresh =
    deadline >=
    currentUnixTime +
      minimumExecutionWindow;

  const evidenceHashIsNonzero =
    !/^0x0{64}$/i.test(
      input.plan.evidenceHash,
    );

  const checks: RiskCheck[] = [
    {
      id: "allowed-chain",
      label: "Allowed execution chain",
      passed: chainAccepted,
      weight: 35,
      detail: chainAccepted
        ? `Chain ${input.chainId} is allowed.`
        : `Expected chain ${environment.CHAIN_ID}, received ${input.chainId}.`,
    },
    {
      id: "trusted-executor",
      label: "Trusted task executor",
      passed: executorAccepted,
      weight: 40,
      detail: executorAccepted
        ? "The plan targets the configured TaskExecutor."
        : "The plan targets an unexpected executor.",
    },
    {
      id: "distinct-vaults",
      label: "Distinct source and destination",
      passed: vaultsAreDifferent,
      weight: 25,
      detail: vaultsAreDifferent
        ? "The source and destination vaults are different."
        : "The source and destination vaults are identical.",
    },
    {
      id: "nonzero-position",
      label: "Nonzero source position",
      passed: positionIsNonzero,
      weight: 20,
      detail: positionIsNonzero
        ? "The migration contains source shares."
        : "The migration contains zero source shares.",
    },
    {
      id: "loss-policy",
      label: "Maximum-loss policy",
      passed: lossPolicyAccepted,
      weight: 35,
      detail: lossPolicyAccepted
        ? `Maximum loss is ${input.constraints.maxLossBps} basis points.`
        : `Maximum loss exceeds the agent limit of ${environment.MAX_ALLOWED_LOSS_BPS} basis points.`,
    },
    {
      id: "asset-floor-integrity",
      label: "Minimum asset floor",
      passed: assetFloorIsCorrect,
      weight: 45,
      detail: assetFloorIsCorrect
        ? "The minimum asset output matches the quoted loss constraint."
        : "The minimum asset output does not match the quoted loss constraint.",
    },
    {
      id: "share-floor-integrity",
      label: "Minimum destination-share floor",
      passed: destinationFloorIsCorrect,
      weight: 45,
      detail: destinationFloorIsCorrect
        ? "The minimum destination shares match the quoted loss constraint."
        : "The minimum destination shares do not match the quoted loss constraint.",
    },
    {
      id: "asset-quote",
      label: "Quoted assets satisfy floor",
      passed: assetQuoteSatisfiesFloor,
      weight: 50,
      detail: assetQuoteSatisfiesFloor
        ? "The quoted assets satisfy the minimum output."
        : "The quoted assets are below the minimum output.",
    },
    {
      id: "destination-quote",
      label: "Quoted shares satisfy floor",
      passed: destinationQuoteSatisfiesFloor,
      weight: 50,
      detail: destinationQuoteSatisfiesFloor
        ? "The quoted destination shares satisfy the minimum output."
        : "The quoted destination shares are below the minimum output.",
    },
    {
      id: "ttl-policy",
      label: "Bounded plan lifetime",
      passed: ttlAccepted,
      weight: 20,
      detail: ttlAccepted
        ? "The requested plan lifetime is within policy."
        : `The plan lifetime exceeds ${environment.MAX_PLAN_TTL_SECONDS} seconds.`,
    },
    {
      id: "fresh-deadline",
      label: "Fresh execution deadline",
      passed: deadlineIsFresh,
      weight: 40,
      detail: deadlineIsFresh
        ? "The plan has enough time remaining for execution."
        : "The plan is expired or too close to expiry.",
    },
    {
      id: "bound-evidence",
      label: "Bound plan evidence",
      passed: evidenceHashIsNonzero,
      weight: 30,
      detail: evidenceHashIsNonzero
        ? "The migration plan contains a nonzero evidence hash."
        : "The migration plan is not bound to evidence.",
    },
  ];

  const riskScore = Math.min(
    100,
    checks.reduce((score, check) => {
      return check.passed
        ? score
        : score + check.weight;
    }, 0),
  );

  const decision =
    checks.every((check) => check.passed)
      ? "approve"
      : "reject";

  const riskLevel =
    riskScore === 0
      ? "low"
      : riskScore <= 30
        ? "medium"
        : "high";

  const evaluatedAt =
    new Date().toISOString();

  const requestHash =
    hashCanonicalValue(input);

  const unsignedEvidence = {
    schema: "onetask.risk-evidence.v1",
    agent: {
      name: "OneTask Risk Agent",
      version: "0.1.0",
    },
    requestHash,
    planEvidenceHash:
      input.plan.evidenceHash,
    decision,
    riskScore,
    riskLevel,
    checks,
    evaluatedAt,
  };

  return {
    ...unsignedEvidence,
    evidenceHash:
      hashCanonicalValue(unsignedEvidence),

    signature: null,
  };
}