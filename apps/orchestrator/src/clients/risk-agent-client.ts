import { z } from "zod";

import { environment } from "../config.js";

const bytes32Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/);

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

export type RiskEvidence = z.infer<
  typeof riskEvidenceSchema
>;

export type RiskAgentClientErrorCode =
  | "RISK_AGENT_UNAVAILABLE"
  | "RISK_AGENT_HTTP_ERROR"
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

export async function evaluateMigrationRisk(
  migrationPlan: unknown,
): Promise<RiskEvidence> {
  const abortController =
    new AbortController();

  const timeout = setTimeout(() => {
    abortController.abort();
  }, environment.RISK_AGENT_TIMEOUT_MS);

  try {
    let response: Response;

    try {
      response = await fetch(
        createRiskEvaluationUrl(),
        {
          method: "POST",

          headers: {
            accept: "application/json",
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

      throw new RiskAgentClientError(
        "RISK_AGENT_UNAVAILABLE",
        requestTimedOut
          ? "The risk agent request timed out."
          : "The risk agent could not be reached.",
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

    return parsedResponse.data.evidence;
  } finally {
    clearTimeout(timeout);
  }
}