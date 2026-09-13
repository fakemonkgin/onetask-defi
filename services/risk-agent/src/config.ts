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

const x402PriceSchema = z
  .string()
  .regex(
    /^\$(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/,
    "X402_PRICE must be a dollar-denominated value such as $0.001.",
  )
  .refine(
    (value) =>
      Number(value.slice(1)) > 0,
    {
      message:
        "X402_PRICE must be greater than zero.",
    },
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
    .default(
      "http://127.0.0.1:3101",
    ),

  CHAIN_ID: z.coerce
    .number()
    .int()
    .positive()
    .default(31_337),

  TASK_EXECUTOR_ADDRESS:
    evmAddressSchema.default(
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

  X402_FACILITATOR_URL: z
    .string()
    .url()
    .default(
      "https://x402.org/facilitator",
    ),

  X402_NETWORK: z
    .literal("eip155:84532")
    .default("eip155:84532"),

  X402_PRICE:
    x402PriceSchema.default(
      "$0.001",
    ),

  X402_PAY_TO_ADDRESS:
    evmAddressSchema,
});

export const environment =
  environmentSchema.parse(
    process.env,
  );