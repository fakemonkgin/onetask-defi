import {
  getAddress,
  isAddress,
  type Address,
  type Hash,
  type Hex,
  zeroAddress,
} from "viem";
import { z } from "zod";

import { environment } from "../config.js";
import {
  discoverRiskAgent,
  type RiskAgentDiscovery,
  RiskAgentDiscoveryError,
} from "../erc8004/risk-agent-discovery.js";
import {
  fetchWithX402Payment,
  x402HttpClient,
} from "../payments/x402-buyer.js";
import {
  hashCanonicalValue,
  verifyRiskEvidence,
} from "../security/risk-evidence-verifier.js";

const bytes32Schema = z
  .string()
  .regex(
    /^0x[a-fA-F0-9]{64}$/,
  )
  .transform(
    (value) => value as Hash,
  );

const evmAddressSchema = z
  .string()
  .refine(
    (value) =>
      isAddress(value),
    "Expected a valid EVM address.",
  )
  .transform((value) =>
    getAddress(value),
  )
  .refine(
    (value) =>
      value !== zeroAddress,
    "The zero address is not allowed.",
  );

const signatureSchema = z
  .string()
  .regex(
    /^0x[a-fA-F0-9]{130}$/,
    "Expected a 65-byte EIP-712 signature.",
  )
  .transform(
    (value) => value as Hex,
  );

const unsignedIntegerStringSchema =
  z.string().regex(
    /^(0|[1-9][0-9]*)$/,
  );

const riskEvaluationRequestSchema =
  z.object({
    chainId: z
      .number()
      .int()
      .positive(),

    taskExecutor: z.object({
      address:
        evmAddressSchema,
    }),

    plan: z.object({
      user:
        evmAddressSchema,

      sourceVault:
        evmAddressSchema,

      destinationVault:
        evmAddressSchema,

      sourceShares:
        unsignedIntegerStringSchema,

      minAssetsReceived:
        unsignedIntegerStringSchema,

      minDestinationShares:
        unsignedIntegerStringSchema,

      deadline:
        unsignedIntegerStringSchema,

      nonce:
        unsignedIntegerStringSchema,

      evidenceHash:
        bytes32Schema,
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

      basisPointsDenominator:
        z.literal(10_000),

      expiresInSeconds: z
        .number()
        .int()
        .positive(),
    }),
  });

const riskCheckSchema = z.object({
  id:
    z.string().min(1),

  label:
    z.string().min(1),

  passed:
    z.boolean(),

  weight: z
    .number()
    .int()
    .nonnegative(),

  detail:
    z.string().min(1),
});

const riskEvidenceSchema = z.object({
  schema: z.literal(
    "onetask.risk-evidence.v1",
  ),

  agent: z.object({
    name:
      z.string().min(1),

    version:
      z.string().min(1),

    walletAddress:
      evmAddressSchema,
  }),

  requestHash:
    bytes32Schema,

  planEvidenceHash:
    bytes32Schema,

  decision: z.enum([
    "approve",
    "reject",
  ]),

  riskScore: z
    .number()
    .int()
    .min(0)
    .max(100),

  riskLevel: z.enum([
    "low",
    "medium",
    "high",
  ]),

  checks:
    z.array(riskCheckSchema),

  evaluatedAt: z
    .string()
    .datetime(),

  signatureScheme:
    z.literal("eip712"),

  evidenceHash:
    bytes32Schema,

  signature:
    signatureSchema,
});

const riskAgentResponseSchema =
  z.object({
    evidence:
      riskEvidenceSchema,
  });

const x402SettlementResponseSchema =
  z.object({
    success:
      z.literal(true),

    transaction:
      bytes32Schema,

    network: z.literal(
      "eip155:84532",
    ),

    payer:
      evmAddressSchema,
  });

export type RiskEvidence = z.infer<
  typeof riskEvidenceSchema
>;

export type X402PaymentReceipt = {
  status: "settled";
  success: true;
  transaction: Hash;
  network: "eip155:84532";
  payer: Address;
};

export type RiskEvaluationResult = {
  agentDiscovery:
    RiskAgentDiscovery;

  riskEvidence:
    RiskEvidence;

  x402Payment:
    X402PaymentReceipt;
};

export type RiskAgentClientErrorCode =
  | "RISK_AGENT_DISCOVERY_FAILED"
  | "RISK_AGENT_UNAVAILABLE"
  | "RISK_AGENT_HTTP_ERROR"
  | "X402_PAYMENT_FAILED"
  | "X402_SETTLEMENT_PENDING"
  | "INVALID_RISK_EVALUATION_REQUEST"
  | "INVALID_RISK_AGENT_RESPONSE"
  | "RISK_EVIDENCE_INTEGRITY_FAILED"
  | "INVALID_RISK_AGENT_SIGNATURE";

export class RiskAgentClientError
  extends Error {
  constructor(
    public readonly code:
      RiskAgentClientErrorCode,

    message: string,
  ) {
    super(message);

    this.name =
      "RiskAgentClientError";
  }
}

async function getVerifiedAgentDiscovery():
  Promise<RiskAgentDiscovery> {
  try {
    const discovery =
      await discoverRiskAgent();

    const discoveredNetwork =
      [
        "eip155",
        discovery.identity
          .chainId.toString(),
      ].join(":");

    if (
      discoveredNetwork !==
      environment.X402_NETWORK
    ) {
      throw new RiskAgentClientError(
        "RISK_AGENT_DISCOVERY_FAILED",

        "The ERC-8004 Agent identity and x402 payment network do not match.",
      );
    }

    return discovery;
  } catch (error) {
    if (
      error instanceof
      RiskAgentClientError
    ) {
      throw error;
    }

    if (
      error instanceof
      RiskAgentDiscoveryError
    ) {
      throw new RiskAgentClientError(
        "RISK_AGENT_DISCOVERY_FAILED",

        error.message,
      );
    }

    throw new RiskAgentClientError(
      "RISK_AGENT_DISCOVERY_FAILED",

      "The Risk Agent could not be discovered through ERC-8004.",
    );
  }
}

function isNetworkFailure(
  error: unknown,
) {
  return (
    error instanceof TypeError &&
    error.message
      .toLowerCase()
      .includes("fetch")
  );
}

function getErrorMessage(
  error: unknown,
) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown x402 payment error.";
}

function readStringProperty(
  value: unknown,
  propertyName: string,
) {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return undefined;
  }

  const propertyValue = (
    value as Record<string, unknown>
  )[propertyName];

  return typeof propertyValue ===
    "string"
    ? propertyValue
    : undefined;
}

async function processX402Response(
  response: Response,
) {
  try {
    return await x402HttpClient
      .processResponse(response);
  } catch {
    throw new RiskAgentClientError(
      "X402_PAYMENT_FAILED",

      "The x402 protocol response could not be decoded.",
    );
  }
}

function getX402FailureDetails(
  header: unknown,
) {
  return {
    errorReason:
      readStringProperty(
        header,
        "errorReason",
      ) ??
      readStringProperty(
        header,
        "error",
      ),

    errorMessage:
      readStringProperty(
        header,
        "errorMessage",
      ),

    transaction:
      readStringProperty(
        header,
        "transaction",
      ),

    network:
      readStringProperty(
        header,
        "network",
      ),
  };
}

function isSettlementPending(
  errorReason?: string,
  errorMessage?: string,
) {
  return [
    errorReason,
    errorMessage,
  ].some((value) =>
    value
      ?.toLowerCase()
      .includes(
        "settlement_pending",
      ),
  );
}

async function throwForX402Failure(
  response: Response,
): Promise<never> {
  const paymentResult =
    await processX402Response(
      response.clone(),
    );

  const failureDetails =
    getX402FailureDetails(
      paymentResult.header,
    );

  const reason =
    failureDetails.errorMessage ??
    failureDetails.errorReason ??
    "The server did not provide a settlement failure reason.";

  const transactionMessage =
    failureDetails.transaction
      ? `Broadcast transaction: ${failureDetails.transaction}.`
      : "";

  const networkMessage =
    failureDetails.network
      ? `Network: ${failureDetails.network}.`
      : "";

  if (
    isSettlementPending(
      failureDetails.errorReason,
      failureDetails.errorMessage,
    )
  ) {
    throw new RiskAgentClientError(
      "X402_SETTLEMENT_PENDING",

      [
        "The x402 payment transaction was broadcast, but settlement confirmation remained pending.",
        `Reason: ${reason}.`,
        transactionMessage,
        networkMessage,
        "Automatic retry was stopped to prevent a duplicate payment.",
      ]
        .filter(
          (part) =>
            part.length > 0,
        )
        .join(" "),
    );
  }

  throw new RiskAgentClientError(
    "X402_PAYMENT_FAILED",

    [
      "The paid Risk Agent request returned HTTP 402.",
      `Reason: ${reason}.`,
      transactionMessage,
      networkMessage,
      "Automatic retry was stopped.",
    ]
      .filter(
        (part) =>
          part.length > 0,
      )
      .join(" "),
  );
}

async function readX402PaymentReceipt(
  response: Response,
): Promise<X402PaymentReceipt> {
  const paymentResult =
    await processX402Response(
      response,
    );

  if (
    paymentResult.paymentStatus !==
    "settled"
  ) {
    throw new RiskAgentClientError(
      "X402_PAYMENT_FAILED",

      "The risk agent response did not contain a successful x402 settlement.",
    );
  }

  const parsedSettlement =
    x402SettlementResponseSchema.safeParse(
      paymentResult.header,
    );

  if (
    !parsedSettlement.success
  ) {
    throw new RiskAgentClientError(
      "X402_PAYMENT_FAILED",

      "The risk agent returned an invalid x402 settlement receipt.",
    );
  }

  if (
    parsedSettlement.data.payer !==
    environment.X402_BUYER_ADDRESS
  ) {
    throw new RiskAgentClientError(
      "X402_PAYMENT_FAILED",

      "The x402 settlement payer does not match the configured Buyer.",
    );
  }

  if (
    parsedSettlement.data.network !==
    environment.X402_NETWORK
  ) {
    throw new RiskAgentClientError(
      "X402_PAYMENT_FAILED",

      "The x402 settlement used an unexpected network.",
    );
  }

  return {
    status: "settled",
    success: true,

    transaction:
      parsedSettlement.data
        .transaction,

    network:
      parsedSettlement.data
        .network,

    payer:
      parsedSettlement.data
        .payer,
  };
}

function prepareRiskEvaluationRequest(
  migrationPlan: unknown,
) {
  const parsedRequest =
    riskEvaluationRequestSchema.safeParse(
      migrationPlan,
    );

  if (!parsedRequest.success) {
    throw new RiskAgentClientError(
      "INVALID_RISK_EVALUATION_REQUEST",

      "The Orchestrator produced an invalid Risk Agent request.",
    );
  }

  return parsedRequest.data;
}

export async function evaluateMigrationRisk(
  migrationPlan: unknown,
): Promise<RiskEvaluationResult> {
  /*
   * Validate and normalize the exact object
   * that will be sent and hashed before any
   * discovery or x402 payment is attempted.
   */
  const riskEvaluationRequest =
    prepareRiskEvaluationRequest(
      migrationPlan,
    );

  const expectedRequestHash =
    hashCanonicalValue(
      riskEvaluationRequest,
    );

  const expectedPlanEvidenceHash =
    riskEvaluationRequest
      .plan.evidenceHash;

  /*
   * Discover and verify the Agent before
   * allowing the x402 client to create a
   * payment authorization.
   */
  const agentDiscovery =
    await getVerifiedAgentDiscovery();

  const riskEvaluationUrl =
    new URL(
      agentDiscovery
        .service.endpoint,
    );

  const abortController =
    new AbortController();

  const timeout = setTimeout(
    () => {
      abortController.abort();
    },

    environment
      .RISK_AGENT_TIMEOUT_MS,
  );

  try {
    let response: Response;

    try {
      response =
        await fetchWithX402Payment(
          riskEvaluationUrl,
          {
            method: "POST",

            headers: {
              accept:
                "application/json",

              "content-type":
                "application/json",
            },

            body: JSON.stringify(
              riskEvaluationRequest,
            ),

            signal:
              abortController.signal,
          },
        );
    } catch (error) {
      const requestTimedOut =
        error instanceof Error &&
        error.name ===
          "AbortError";

      if (
        requestTimedOut ||
        isNetworkFailure(error)
      ) {
        throw new RiskAgentClientError(
          "RISK_AGENT_UNAVAILABLE",

          requestTimedOut
            ? "The paid risk agent request timed out."
            : "The risk agent could not be reached.",
        );
      }

      throw new RiskAgentClientError(
        "X402_PAYMENT_FAILED",

        [
          "The x402 payment could not be completed.",
          getErrorMessage(error),
        ].join(" "),
      );
    }

    /*
     * Keep a clone because the response body
     * is consumed separately from the x402
     * settlement header.
     */
    const paymentResponse =
      response.clone();

    /*
     * A second HTTP 402 may contain a failed
     * or pending settlement receipt. Decode it
     * before throwing so the transaction is
     * never hidden and no blind retry occurs.
     */
    if (
      response.status === 402
    ) {
      await throwForX402Failure(
        paymentResponse,
      );
    }

    if (!response.ok) {
      throw new RiskAgentClientError(
        "RISK_AGENT_HTTP_ERROR",

        `The risk agent returned HTTP ${response.status}.`,
      );
    }

    let responseBody: unknown;

    try {
      responseBody =
        await response.json();
    } catch {
      throw new RiskAgentClientError(
        "INVALID_RISK_AGENT_RESPONSE",

        "The risk agent returned invalid JSON.",
      );
    }

    const parsedResponse =
      riskAgentResponseSchema.safeParse(
        responseBody,
      );

    if (!parsedResponse.success) {
      throw new RiskAgentClientError(
        "INVALID_RISK_AGENT_RESPONSE",

        "The risk agent returned an unexpected signed evidence structure.",
      );
    }

    const x402Payment =
      await readX402PaymentReceipt(
        paymentResponse,
      );

    const riskEvidence =
      parsedResponse.data
        .evidence;

    /*
     * The expected signer comes from the
     * verified ERC-8004 agentWallet rather
     * than directly from a static endpoint.
     */
    const verificationResult =
      await verifyRiskEvidence({
        evidence:
          riskEvidence,

        expectedRequestHash,

        expectedPlanEvidenceHash,

        expectedSigner:
          agentDiscovery
            .identity
            .agentWallet,
      });

    if (
      !verificationResult.valid
    ) {
      const errorCode =
        verificationResult.code ===
          "INVALID_SIGNATURE" ||
        verificationResult.code ===
          "SIGNER_MISMATCH"
          ? "INVALID_RISK_AGENT_SIGNATURE"
          : "RISK_EVIDENCE_INTEGRITY_FAILED";

      throw new RiskAgentClientError(
        errorCode,

        verificationResult.message,
      );
    }

    return {
      agentDiscovery,
      riskEvidence,
      x402Payment,
    };
  } finally {
    clearTimeout(timeout);
  }
}