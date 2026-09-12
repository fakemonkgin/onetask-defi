import {
  createPublicClient,
  defineChain,
  http,
} from "viem";

import { environment } from "../config.js";

export const configuredChain = defineChain({
  id: environment.CHAIN_ID,
  name: "OneTask Local Anvil",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [environment.CHAIN_RPC_URL],
    },
  },
  testnet: true,
});

export const blockchainClient =
  createPublicClient({
    chain: configuredChain,
    transport: http(
      environment.CHAIN_RPC_URL,
    ),
  });