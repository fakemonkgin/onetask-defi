import "dotenv/config";

import { z } from "zod";

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
});

export const environment =
  environmentSchema.parse(process.env);