export const vaultShareTokenAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      {
        name: "owner",
        type: "address",
      },
      {
        name: "spender",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "remaining",
        type: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "spender",
        type: "address",
      },
      {
        name: "amount",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "success",
        type: "bool",
      },
    ],
  },
] as const;

export const taskExecutorAbi = [
  {
    type: "function",
    name: "usedNonces",
    stateMutability: "view",
    inputs: [
      {
        name: "user",
        type: "address",
      },
      {
        name: "nonce",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "used",
        type: "bool",
      },
    ],
  },
  {
    type: "function",
    name: "executeVaultMigration",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "plan",
        type: "tuple",
        components: [
          {
            name: "user",
            type: "address",
          },
          {
            name: "sourceVault",
            type: "address",
          },
          {
            name: "destinationVault",
            type: "address",
          },
          {
            name: "sourceShares",
            type: "uint256",
          },
          {
            name: "minAssetsReceived",
            type: "uint256",
          },
          {
            name: "minDestinationShares",
            type: "uint256",
          },
          {
            name: "deadline",
            type: "uint256",
          },
          {
            name: "nonce",
            type: "uint256",
          },
          {
            name: "evidenceHash",
            type: "bytes32",
          },
        ],
      },
    ],
    outputs: [
      {
        name: "assetsReceived",
        type: "uint256",
      },
      {
        name: "destinationShares",
        type: "uint256",
      },
    ],
  },
  {
    type: "event",
    name: "VaultMigrationExecuted",
    inputs: [
      {
        name: "planHash",
        type: "bytes32",
        indexed: true,
      },
      {
        name: "evidenceHash",
        type: "bytes32",
        indexed: true,
      },
      {
        name: "user",
        type: "address",
        indexed: true,
      },
      {
        name: "sourceVault",
        type: "address",
        indexed: false,
      },
      {
        name: "destinationVault",
        type: "address",
        indexed: false,
      },
      {
        name: "sourceShares",
        type: "uint256",
        indexed: false,
      },
      {
        name: "assetsReceived",
        type: "uint256",
        indexed: false,
      },
      {
        name: "destinationShares",
        type: "uint256",
        indexed: false,
      },
      {
        name: "nonce",
        type: "uint256",
        indexed: false,
      },
    ],
  },
] as const;