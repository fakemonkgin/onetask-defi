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
    (value) => isAddress(value),
    "A valid EVM address is required.",
  )
  .transform((value) => getAddress(value))
  .refine(
    (value) => value !== zeroAddress,
    "The zero address is not allowed.",
  );

const privateKeySchema = z
  .string()
  .regex(
    /^0x[0-9a-fA-F]{64}$/,
    "X402_BUYER_PRIVATE_KEY must be a 32-byte hex private key.",
  )
  .transform(
    (value) => value as `0x${string}`,
  );

const x402PaymentLimitSchema = z
  .string()
  .regex(
    /^\$(?:0|[1-9]\d*)(?:\.\d{1,6})?$/,
    'X402_MAX_AMOUNT_PER_PAYMENT must use a USD value such as "$0.001".',
  )
  .refine(
    (value) => {
      const amount = Number(value.slice(1));

      return (
        Number.isFinite(amount) &&
        amount > 0 &&
        amount <= 0.001
      );
    },
    "The x402 payment limit must be greater than $0 and no more than $0.001.",
  );

const environmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required."),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(3001),

  HOST: z
    .string()
    .default("127.0.0.1"),

  WEB_ORIGIN: z
    .string()
    .url()
    .default("http://localhost:3000"),

  CHAIN_RPC_URL: z
    .string()
    .url()
    .default("http://127.0.0.1:8545"),

  CHAIN_ID: z.coerce
    .number()
    .int()
    .positive()
    .default(31337),

  MOCK_USDC_ADDRESS: evmAddressSchema,

  VAULT_A_ADDRESS: evmAddressSchema,

  VAULT_B_ADDRESS: evmAddressSchema,

  TASK_EXECUTOR_ADDRESS:
    evmAddressSchema,

  RISK_AGENT_URL: z
    .string()
    .url()
    .default("http://127.0.0.1:3101"),

  RISK_AGENT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(30_000)
    .default(5_000),

  X402_BUYER_PRIVATE_KEY:
    privateKeySchema,

  X402_BUYER_ADDRESS:
    evmAddressSchema,

  X402_NETWORK: z
    .literal("eip155:84532")
    .default("eip155:84532"),

  X402_MAX_AMOUNT_PER_PAYMENT:
    x402PaymentLimitSchema.default(
      "$0.001",
    ),
});

export const environment =
  environmentSchema.parse(process.env);