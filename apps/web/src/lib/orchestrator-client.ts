import { z } from "zod";

const evmAddressSchema = z
  .string()
  .regex(
    /^0x[a-fA-F0-9]{40}$/,
    "Expected a valid EVM address.",
  );

const bytes32Schema = z
  .string()
  .regex(
    /^0x[a-fA-F0-9]{64}$/,
    "Expected a bytes32 hex value.",
  );

const hexSignatureSchema = z
  .string()
  .regex(
    /^0x(?:[a-fA-F0-9]{2})+$/,
    "Expected a hexadecimal signature.",
  );

const uintStringSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)$/,
    "Expected an unsigned integer string.",
  );

const taskPreviewResponseSchema = z.object({
  preview: z.object({
    id: z.string().uuid(),
    intent: z.string(),
    network: z.literal("anvil"),
    mode: z.literal("simulation"),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  }),

  pipeline: z.array(z.string()),
});

const vaultSchema = z.object({
  address: evmAddressSchema,
  totalAssets: uintStringSchema,
  totalSupply: uintStringSchema,
  userShares: uintStringSchema,
});

const vaultStateResponseSchema = z.object({
  state: z.object({
    chainId: z.number().int(),
    user: evmAddressSchema,

    asset: z.object({
      address: evmAddressSchema,
      symbol: z.string(),
      decimals: z
        .number()
        .int()
        .nonnegative(),
      userBalance: uintStringSchema,
    }),

    vaultA: vaultSchema,
    vaultB: vaultSchema,

    migrationPreview: z.object({
      executable: z.boolean(),
      sourceShares: uintStringSchema,
      assetsReceived: uintStringSchema,
      destinationShares:
        uintStringSchema,
    }),

    taskExecutor: z.object({
      address: evmAddressSchema,
    }),
  }),
});

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

  checks: z
    .array(riskCheckSchema)
    .min(1),

  evaluatedAt: z
    .string()
    .datetime(),

  evidenceHash: bytes32Schema,

  signature:
    hexSignatureSchema.nullable(),
});

const migrationPlanResponseSchema = z.object({
  migrationPlan: z.object({
    mode: z.literal("simulation"),
    chainId: z.number().int(),

    taskExecutor: z.object({
      address: evmAddressSchema,
    }),

    plan: z.object({
      user: evmAddressSchema,
      sourceVault: evmAddressSchema,
      destinationVault:
        evmAddressSchema,
      sourceShares: uintStringSchema,
      minAssetsReceived:
        uintStringSchema,
      minDestinationShares:
        uintStringSchema,
      deadline: uintStringSchema,
      nonce: uintStringSchema,
      evidenceHash: bytes32Schema,
    }),

    quote: z.object({
      quotedAssetsReceived:
        uintStringSchema,

      quotedDestinationShares:
        uintStringSchema,

      observedBlockNumber:
        uintStringSchema,

      observedBlockTimestamp:
        uintStringSchema,
    }),

    constraints: z.object({
      maxLossBps: z.number().int(),

      basisPointsDenominator: z
        .number()
        .int()
        .positive(),

      expiresInSeconds: z
        .number()
        .int()
        .positive(),
    }),

    approval: z.object({
      token: evmAddressSchema,
      spender: evmAddressSchema,
      amount: uintStringSchema,
    }),

    evidence: z.object({
      schema: z.string(),
      hash: bytes32Schema,
      signedByAgent: z.boolean(),
    }),
  }),

  riskEvidence: riskEvidenceSchema,
});

const apiErrorSchema = z.object({
  code: z.string().optional(),
  message: z.string(),
});

export type TaskPreviewResponse = z.infer<
  typeof taskPreviewResponseSchema
>;

export type VaultStateResponse = z.infer<
  typeof vaultStateResponseSchema
>;

export type MigrationPlanResponse = z.infer<
  typeof migrationPlanResponseSchema
>;

export type RiskEvidence = z.infer<
  typeof riskEvidenceSchema
>;

const orchestratorUrl =
  process.env
    .NEXT_PUBLIC_ORCHESTRATOR_URL ??
  "http://127.0.0.1:3001";

async function readResponseBody(
  response: Response,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getApiErrorMessage(
  responseBody: unknown,
  fallbackMessage: string,
) {
  const parsedError =
    apiErrorSchema.safeParse(
      responseBody,
    );

  return parsedError.success
    ? parsedError.data.message
    : fallbackMessage;
}

export async function createTaskPreview(
  intent: string,
): Promise<TaskPreviewResponse> {
  const response = await fetch(
    `${orchestratorUrl}/v1/tasks/preview`,
    {
      method: "POST",

      headers: {
        "content-type":
          "application/json",
      },

      body: JSON.stringify({
        intent,
      }),
    },
  );

  const responseBody =
    await readResponseBody(response);

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(
        responseBody,
        "The orchestrator rejected the task.",
      ),
    );
  }

  const parsedResponse =
    taskPreviewResponseSchema.safeParse(
      responseBody,
    );

  if (!parsedResponse.success) {
    throw new Error(
      "The orchestrator returned an invalid task preview.",
    );
  }

  return parsedResponse.data;
}

export async function getVaultState(
  userAddress: string,
): Promise<VaultStateResponse> {
  const query = new URLSearchParams({
    user: userAddress,
  });

  const response = await fetch(
    `${orchestratorUrl}/v1/vaults/state?${query.toString()}`,
    {
      method: "GET",

      headers: {
        accept: "application/json",
      },

      cache: "no-store",
    },
  );

  const responseBody =
    await readResponseBody(response);

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(
        responseBody,
        "The vault state could not be loaded.",
      ),
    );
  }

  const parsedResponse =
    vaultStateResponseSchema.safeParse(
      responseBody,
    );

  if (!parsedResponse.success) {
    throw new Error(
      "The orchestrator returned an invalid vault state.",
    );
  }

  return parsedResponse.data;
}

export async function createMigrationPlan(
  userAddress: string,
  maxLossBps: number,
): Promise<MigrationPlanResponse> {
  const response = await fetch(
    `${orchestratorUrl}/v1/migrations/plan`,
    {
      method: "POST",

      headers: {
        "content-type":
          "application/json",
      },

      body: JSON.stringify({
        user: userAddress,
        maxLossBps,
      }),
    },
  );

  const responseBody =
    await readResponseBody(response);

  const parsedResponse =
    migrationPlanResponseSchema.safeParse(
      responseBody,
    );

  /*
   * HTTP 422 means the Risk Agent rejected a
   * structurally valid plan. That is a valid
   * product result, not a network failure.
   *
   * We return the plan and evidence so the UI
   * can explain exactly why execution is blocked.
   */
  if (
    response.status === 422 &&
    parsedResponse.success
  ) {
    return parsedResponse.data;
  }

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(
        responseBody,
        "The migration plan could not be created.",
      ),
    );
  }

  if (!parsedResponse.success) {
    throw new Error(
      "The orchestrator returned an invalid migration plan.",
    );
  }

  return parsedResponse.data;
}