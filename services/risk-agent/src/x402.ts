import {
  HTTPFacilitatorClient,
} from "@x402/core/server";
import {
  ExactEvmScheme,
} from "@x402/evm/exact/server";
import {
  paymentMiddleware,
  x402ResourceServer,
} from "@x402/fastify";
import type {
  FastifyInstance,
} from "fastify";

import { environment } from "./config.js";

const RISK_EVALUATION_ROUTE =
  "POST /v1/risk/evaluate";

export function applyX402Protection(
  app: FastifyInstance,
) {
  const facilitatorClient =
    new HTTPFacilitatorClient({
      url:
        environment
          .X402_FACILITATOR_URL,
    });

  const resourceServer =
    new x402ResourceServer(
      facilitatorClient,
    ).register(
      environment.X402_NETWORK,
      new ExactEvmScheme(),
    );

  paymentMiddleware(
    app,
    {
      [RISK_EVALUATION_ROUTE]: {
        accepts: [
          {
            scheme: "exact",
            price:
              environment.X402_PRICE,
            network:
              environment
                .X402_NETWORK,
            payTo:
              environment
                .X402_PAY_TO_ADDRESS,
          },
        ],

        description:
          "Independent risk assessment for a constrained OneTask DeFi vault migration plan.",

        mimeType:
          "application/json",
      },
    },
    resourceServer,
  );
}