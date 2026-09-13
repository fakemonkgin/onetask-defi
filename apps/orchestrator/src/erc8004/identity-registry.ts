import {
  getAddress,
  type Address,
} from "viem";

export const ERC8004_BASE_SEPOLIA_CHAIN_ID =
  84_532;

export const ERC8004_BASE_SEPOLIA_IDENTITY_REGISTRY_ADDRESS =
  getAddress(
    "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  );

export function createErc8004AgentRegistryIdentifier(
  chainId: number,
  registryAddress: Address,
) {
  return [
    "eip155",
    chainId.toString(),
    getAddress(registryAddress),
  ].join(":");
}

export const erc8004IdentityRegistryReadAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [
      {
        name: "agentId",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [
      {
        name: "agentId",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "string",
      },
    ],
  },
  {
    type: "function",
    name: "getAgentWallet",
    stateMutability: "view",
    inputs: [
      {
        name: "agentId",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
  },
] as const;