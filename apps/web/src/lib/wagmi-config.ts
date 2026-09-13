import { defineChain } from "viem";
import {
  createConfig,
  http,
} from "wagmi";
import { injected } from "wagmi/connectors";

const localRpcUrl =
  process.env.NEXT_PUBLIC_CHAIN_RPC_URL ??
  "http://127.0.0.1:8545";

export const anvilChain = defineChain({
  id: 31_337,
  name: "OneTask Local Anvil",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [localRpcUrl],
    },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [anvilChain],
  connectors: [injected()],
  transports: {
    [anvilChain.id]: http(localRpcUrl),
  },
  multiInjectedProviderDiscovery: false,
  ssr: true,
});