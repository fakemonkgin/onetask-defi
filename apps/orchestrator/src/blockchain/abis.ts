import { parseAbi } from "viem";

export const erc20ReadAbi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
]);

export const erc4626ReadAbi = parseAbi([
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
]);

export const taskExecutorReadAbi = parseAbi([
  "function usedNonces(address user, uint256 nonce) view returns (bool)",
]);