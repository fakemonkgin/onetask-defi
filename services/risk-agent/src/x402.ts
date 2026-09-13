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

function readStringProperty(
  value: unknown,
  propertyName: string,
) {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return undefined;
  }

  const propertyValue = (
    value as Record<string, unknown>
  )[propertyName];

  return typeof propertyValue === "string"
    ? propertyValue
    : undefined;
}

function describeSettlementError(
  error: unknown,
) {
  return {
    name:
      error instanceof Error
        ? error.name
        : "UnknownSettlementError",

    message:
      error instanceof Error
        ? error.message
        : "An unknown x402 settlement error occurred.",

    errorReason:
      readStringProperty(
        error,
        "errorReason",
      ),

    errorMessage:
      readStringProperty(
        error,
        "errorMessage",
      ),

    transaction:
      readStringProperty(
        error,
        "transaction",
      ),

    network:
      readStringProperty(
        error,
        "network",
      ),

    payer:
      readStringProperty(
        error,
        "payer",
      ),
  };
}

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
    );

  resourceServer.register(
    environment.X402_NETWORK,
    new ExactEvmScheme(),
  );

  /*
   * Only safe payment metadata is logged.
   * The complete payment payload and its
   * authorization signature are never logged.
   */
  resourceServer.onAfterVerify(
    async (context) => {
      app.log.info(
        {
          x402: {
            event:
              "payment-verified",

            network:
              context.requirements
                .network,

            amount:
              context.requirements
                .amount,

            payTo:
              context.requirements
                .payTo,
          },
        },
        "x402 payment verification succeeded.",
      );
    },
  );

  resourceServer.onAfterSettle(
    async (context) => {
      app.log.info(
        {
          x402: {
            event:
              "settlement-succeeded",

            phase:
              context.phase,

            network:
              context.requirements
                .network,

            amount:
              context.requirements
                .amount,

            payer:
              context.result.payer,

            transaction:
              context.result
                .transaction,
          },
        },
        "x402 settlement succeeded.",
      );
    },
  );

  resourceServer.onSettleFailure(
    async (context) => {
      app.log.error(
        {
          x402: {
            event:
              "settlement-failed",

            phase:
              context.phase,

            network:
              context.requirements
                .network,

            amount:
              context.requirements
                .amount,

            failure:
              describeSettlementError(
                context.error,
              ),
          },
        },
        "x402 settlement failed.",
      );
    },
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