import { z } from "zod";

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

const apiErrorSchema = z.object({
  message: z.string(),
});

export type TaskPreviewResponse = z.infer<
  typeof taskPreviewResponseSchema
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

  const responseBody: unknown = await response.json();

  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(responseBody);

    throw new Error(
      parsedError.success
        ? parsedError.data.message
        : "The orchestrator rejected the task.",
    );
  }

  const parsedResponse =
    taskPreviewResponseSchema.safeParse(responseBody);

  if (!parsedResponse.success) {
    throw new Error(
      "The orchestrator returned an invalid task preview.",
    );
  }

  return parsedResponse.data;
}