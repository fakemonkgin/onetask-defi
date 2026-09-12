import type { Address } from "viem";

import {
  erc20ReadAbi,
  erc4626ReadAbi,
} from "../blockchain/abis.js";
import { blockchainClient } from "../blockchain/client.js";
import { environment } from "../config.js";

async function readVault(
  address: Address,
  user: Address,
) {
  const [
    asset,
    totalAssets,
    totalSupply,
    userShares,
  ] = await Promise.all([
    blockchainClient.readContract({
      address,
      abi: erc4626ReadAbi,
      functionName: "asset",
    }),

    blockchainClient.readContract({
      address,
      abi: erc4626ReadAbi,
      functionName: "totalAssets",
    }),

    blockchainClient.readContract({
      address,
      abi: erc4626ReadAbi,
      functionName: "totalSupply",
    }),

    blockchainClient.readContract({
      address,
      abi: erc4626ReadAbi,
      functionName: "balanceOf",
      args: [user],
    }),
  ]);

  return {
    address,
    asset,
    totalAssets,
    totalSupply,
    userShares,
  };
}

export async function getVaultState(
  user: Address,
) {
  const [
    chainId,
    symbol,
    decimals,
    userAssetBalance,
    vaultA,
    vaultB,
  ] = await Promise.all([
    blockchainClient.getChainId(),

    blockchainClient.readContract({
      address:
        environment.MOCK_USDC_ADDRESS,
      abi: erc20ReadAbi,
      functionName: "symbol",
    }),

    blockchainClient.readContract({
      address:
        environment.MOCK_USDC_ADDRESS,
      abi: erc20ReadAbi,
      functionName: "decimals",
    }),

    blockchainClient.readContract({
      address:
        environment.MOCK_USDC_ADDRESS,
      abi: erc20ReadAbi,
      functionName: "balanceOf",
      args: [user],
    }),

    readVault(
      environment.VAULT_A_ADDRESS,
      user,
    ),

    readVault(
      environment.VAULT_B_ADDRESS,
      user,
    ),
  ]);

  if (chainId !== environment.CHAIN_ID) {
    throw new Error(
      `Connected to chain ${chainId}, expected ${environment.CHAIN_ID}.`,
    );
  }

  const expectedAsset =
    environment.MOCK_USDC_ADDRESS.toLowerCase();

  if (
    vaultA.asset.toLowerCase() !==
      expectedAsset ||
    vaultB.asset.toLowerCase() !==
      expectedAsset
  ) {
    throw new Error(
      "Configured vaults do not use the configured asset.",
    );
  }

  let assetsReceived = 0n;
  let destinationShares = 0n;

  if (vaultA.userShares > 0n) {
    assetsReceived =
      await blockchainClient.readContract({
        address:
          environment.VAULT_A_ADDRESS,
        abi: erc4626ReadAbi,
        functionName: "previewRedeem",
        args: [vaultA.userShares],
      });

    destinationShares =
      await blockchainClient.readContract({
        address:
          environment.VAULT_B_ADDRESS,
        abi: erc4626ReadAbi,
        functionName: "previewDeposit",
        args: [assetsReceived],
      });
  }

  return {
    chainId,
    user,

    asset: {
      address:
        environment.MOCK_USDC_ADDRESS,
      symbol,
      decimals,
      userBalance:
        userAssetBalance.toString(),
    },

    vaultA: {
      address: vaultA.address,
      totalAssets:
        vaultA.totalAssets.toString(),
      totalSupply:
        vaultA.totalSupply.toString(),
      userShares:
        vaultA.userShares.toString(),
    },

    vaultB: {
      address: vaultB.address,
      totalAssets:
        vaultB.totalAssets.toString(),
      totalSupply:
        vaultB.totalSupply.toString(),
      userShares:
        vaultB.userShares.toString(),
    },

    migrationPreview: {
      executable: vaultA.userShares > 0n,
      sourceShares:
        vaultA.userShares.toString(),
      assetsReceived:
        assetsReceived.toString(),
      destinationShares:
        destinationShares.toString(),
    },

    taskExecutor: {
      address:
        environment.TASK_EXECUTOR_ADDRESS,
    },
  };
}