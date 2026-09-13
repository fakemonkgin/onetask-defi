import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import {
  wrapFetchWithPayment,
  x402HTTPClient,
} from "@x402/fetch";
import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { environment } from "../config.js";

const buyerAccount =
  privateKeyToAccount(
    environment.X402_BUYER_PRIVATE_KEY,
  );

const derivedBuyerAddress =
  getAddress(buyerAccount.address);

const configuredBuyerAddress =
  getAddress(
    environment.X402_BUYER_ADDRESS,
  );

if (
  derivedBuyerAddress !==
  configuredBuyerAddress
) {
  throw new Error(
    [
      "X402 buyer account mismatch.",
      "The address derived from X402_BUYER_PRIVATE_KEY",
      "does not match X402_BUYER_ADDRESS.",
    ].join(" "),
  );
}

const paymentClient =
  x402Client.fromConfig({
    schemes: [
      {
        network:
          environment.X402_NETWORK,
        client:
          new ExactEvmScheme(
            buyerAccount,
          ),
      },
    ],

    spendControls: {
      maxAmountPerPayment:
        environment
          .X402_MAX_AMOUNT_PER_PAYMENT,
    },
  });

export const fetchWithX402Payment =
  wrapFetchWithPayment(
    fetch,
    paymentClient,
  );

export const x402HttpClient =
  new x402HTTPClient(paymentClient);

export const x402BuyerAddress =
  derivedBuyerAddress;