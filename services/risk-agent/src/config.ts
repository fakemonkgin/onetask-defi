import "dotenv/config";

import { z } from "zod";

const evmAddressSchema = z
  .string()
  .regex(
    /^0x[a-fA-F0-9]{40}$/,
    "A valid EVM address is required.",
  );

const environmentSchema = z.object({
  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65_535)
    .default(3101),

  HOST: z
    .string()
    .default("127.0.0.1"),

  PUBLIC_BASE_URL: z
    .string()
    .url()
    .default("http://127.0.0.1:3101"),

  CHAIN_ID: z.coerce
    .number()
    .int()
    .positive()
    .default(31_337),

  TASK_EXECUTOR_ADDRESS: evmAddressSchema.default(
    "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  ),

  MAX_ALLOWED_LOSS_BPS: z.coerce
    .number()
    .int()
    .min(0)
    .max(10_000)
    .default(100),

  MAX_PLAN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(3_600)
    .default(900),
});

export const environment =
  environmentSchema.parse(process.env);