import { z } from "zod";

const evmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/);

const unsignedIntegerSchema = z
  .string()
  .regex(/^\d+$/);

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
  totalAssets: unsignedIntegerSchema,
  totalSupply: unsignedIntegerSchema,
  userShares: unsignedIntegerSchema,
});

const vaultStateResponseSchema = z.object({
  state: z.object({
    chainId: z.number().int().positive(),
    user: evmAddressSchema,

    asset: z.object({
      address: evmAddressSchema,
      symbol: z.string(),
      decimals: z
        .number()
        .int()
        .min(0)
        .max(255),
      userBalance: unsignedIntegerSchema,
    }),

    vaultA: vaultSchema,
    vaultB: vaultSchema,

    migrationPreview: z.object({
      executable: z.boolean(),
      sourceShares: unsignedIntegerSchema,
      assetsReceived: unsignedIntegerSchema,
      destinationShares:
        unsignedIntegerSchema,
    }),

    taskExecutor: z.object({
      address: evmAddressSchema,
    }),
  }),
});

const apiErrorSchema = z.object({
  message: z.string(),
});

export type TaskPreviewResponse = z.infer<
  typeof taskPreviewResponseSchema
>;

export type VaultStateResponse = z.infer<
  typeof vaultStateResponseSchema
>;

const orchestratorUrl =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ??
  "http://127.0.0.1:3001";

export async function createTaskPreview(
  intent: string,
): Promise<TaskPreviewResponse> {
  const response = await fetch(
    `${orchestratorUrl}/v1/tasks/preview`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        intent,
      }),
    },
  );

  const responseBody: unknown =
    await response.json();

  if (!response.ok) {
    const parsedError =
      apiErrorSchema.safeParse(responseBody);

    throw new Error(
      parsedError.success
        ? parsedError.data.message
        : "The orchestrator rejected the task.",
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
      cache: "no-store",
    },
  );

  const responseBody: unknown =
    await response.json();

  if (!response.ok) {
    const parsedError =
      apiErrorSchema.safeParse(responseBody);

    throw new Error(
      parsedError.success
        ? parsedError.data.message
        : "The vault state could not be loaded.",
    );
  }

  const parsedResponse =
    vaultStateResponseSchema.safeParse(
      responseBody,
    );

  if (!parsedResponse.success) {
    throw new Error(
      "The orchestrator returned invalid vault data.",
    );
  }

  return parsedResponse.data;
}