import {
  getAddress,
  isAddress,
  type Address,
} from "viem";
import { z } from "zod";

import { environment } from "../config.js";
import {
  fetchWithX402Payment,
  x402HttpClient,
} from "../payments/x402-buyer.js";

const bytes32Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/);

const evmAddressSchema = z
  .string()
  .refine(
    (value) => isAddress(value),
    "Expected a valid EVM address.",
  )
  .transform((value) =>
    getAddress(value),
  );

const signatureSchema = z
  .string()
  .regex(/^0x(?:[a-fA-F0-9]{2})+$/)
  .nullable();

const riskCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  passed: z.boolean(),

  weight: z
    .number()
    .int()
    .nonnegative(),

  detail: z.string().min(1),
});

const riskEvidenceSchema = z.object({
  schema: z.literal(
    "onetask.risk-evidence.v1",
  ),

  agent: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
  }),

  requestHash: bytes32Schema,
  planEvidenceHash: bytes32Schema,

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

  checks: z.array(riskCheckSchema),

  evaluatedAt: z
    .string()
    .datetime(),

  evidenceHash: bytes32Schema,

  signature: signatureSchema,
});

const riskAgentResponseSchema = z.object({
  evidence: riskEvidenceSchema,
});

const x402SettlementResponseSchema =
  z.object({
    success: z.literal(true),

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
  transaction: string;
  network: "eip155:84532";
  payer: Address;
};

export type RiskEvaluationResult = {
  riskEvidence: RiskEvidence;
  x402Payment: X402PaymentReceipt;
};

export type RiskAgentClientErrorCode =
  | "RISK_AGENT_UNAVAILABLE"
  | "RISK_AGENT_HTTP_ERROR"
  | "X402_PAYMENT_FAILED"
  | "INVALID_RISK_AGENT_RESPONSE";

export class RiskAgentClientError extends Error {
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

function createRiskEvaluationUrl() {
  const baseUrl =
    environment.RISK_AGENT_URL.endsWith("/")
      ? environment.RISK_AGENT_URL
      : `${environment.RISK_AGENT_URL}/`;

  return new URL(
    "v1/risk/evaluate",
    baseUrl,
  );
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

async function processX402Response(
  response: Response,
) {
  try {
    return await x402HttpClient
      .processResponse(response);
  } catch {
    throw new RiskAgentClientError(
      "X402_PAYMENT_FAILED",
      "The x402 settlement response could not be decoded.",
    );
  }
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

  if (!parsedSettlement.success) {
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
      parsedSettlement.data.network,

    payer:
      parsedSettlement.data.payer,
  };
}

export async function evaluateMigrationRisk(
  migrationPlan: unknown,
): Promise<RiskEvaluationResult> {
  const abortController =
    new AbortController();

  const timeout = setTimeout(() => {
    abortController.abort();
  }, environment.RISK_AGENT_TIMEOUT_MS);

  try {
    let response: Response;

    try {
      response =
        await fetchWithX402Payment(
          createRiskEvaluationUrl(),
          {
            method: "POST",

            headers: {
              accept:
                "application/json",

              "content-type":
                "application/json",
            },

            body: JSON.stringify(
              migrationPlan,
            ),

            signal:
              abortController.signal,
          },
        );
    } catch (error) {
      const requestTimedOut =
        error instanceof Error &&
        error.name === "AbortError";

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

    const paymentResponse =
      response.clone();

    if (response.status === 402) {
      throw new RiskAgentClientError(
        "X402_PAYMENT_FAILED",
        "The risk agent still requires payment after the x402 retry.",
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
        "The risk agent returned an unexpected evidence structure.",
      );
    }

    const x402Payment =
      await readX402PaymentReceipt(
        paymentResponse,
      );

    return {
      riskEvidence:
        parsedResponse.data.evidence,

      x402Payment,
    };
  } finally {
    clearTimeout(timeout);
  }
}