import {
  getAddress,
  type Address,
} from "viem";

export const ERC8004_BASE_SEPOLIA_CHAIN_ID =
  84_532;

export const ERC8004_IDENTITY_REGISTRY_ADDRESS =
  getAddress(
    "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  );

export function createAgentRegistryIdentifier(
  chainId: number,
  registryAddress: Address,
) {
  return [
    "eip155",
    chainId.toString(),
    getAddress(registryAddress),
  ].join(":");
}

export const ERC8004_BASE_SEPOLIA_AGENT_REGISTRY =
  createAgentRegistryIdentifier(
    ERC8004_BASE_SEPOLIA_CHAIN_ID,
    ERC8004_IDENTITY_REGISTRY_ADDRESS,
  );

export const erc8004IdentityRegistryAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "string",
      },
    ],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "string",
      },
    ],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      {
        name: "owner",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },
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
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [
      {
        name: "agentId",
        type: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "setAgentURI",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "agentId",
        type: "uint256",
      },
      {
        name: "newURI",
        type: "string",
      },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "Registered",
    anonymous: false,
    inputs: [
      {
        name: "agentId",
        type: "uint256",
        indexed: true,
      },
      {
        name: "agentURI",
        type: "string",
        indexed: false,
      },
      {
        name: "owner",
        type: "address",
        indexed: true,
      },
    ],
  },
  {
    type: "event",
    name: "URIUpdated",
    anonymous: false,
    inputs: [
      {
        name: "agentId",
        type: "uint256",
        indexed: true,
      },
      {
        name: "newURI",
        type: "string",
        indexed: false,
      },
      {
        name: "updatedBy",
        type: "address",
        indexed: true,
      },
    ],
  },
] as const;