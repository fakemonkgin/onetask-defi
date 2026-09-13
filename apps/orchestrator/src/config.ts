import "dotenv/config";

import {
  getAddress,
  isAddress,
  zeroAddress,
} from "viem";
import { z } from "zod";

const evmAddressSchema = z
  .string()
  .refine(
    (value) =>
      isAddress(value) &&
      getAddress(value) !== zeroAddress,
    {
      message:
        "A valid non-zero EVM address is required.",
    },
  )
  .transform((value) =>
    getAddress(value),
  );

const environmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(
      1,
      "DATABASE_URL is required.",
    ),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65_535)
    .default(3001),

  HOST: z
    .string()
    .default("127.0.0.1"),

  WEB_ORIGIN: z
    .string()
    .url()
    .default(
      "http://localhost:3000",
    ),

  CHAIN_RPC_URL: z
    .string()
    .url(),

  CHAIN_ID: z.coerce
    .number()
    .int()
    .positive()
    .default(31_337),

  MOCK_USDC_ADDRESS:
    evmAddressSchema,

  VAULT_A_ADDRESS:
    evmAddressSchema,

  VAULT_B_ADDRESS:
    evmAddressSchema,

  TASK_EXECUTOR_ADDRESS:
    evmAddressSchema,

  RISK_AGENT_URL: z
    .string()
    .url()
    .default(
      "http://127.0.0.1:3101",
    ),

  RISK_AGENT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(30_000)
    .default(5_000),
});

export const environment =
  environmentSchema.parse(
    process.env,
  );