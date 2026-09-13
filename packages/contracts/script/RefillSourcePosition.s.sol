// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @title RefillSourcePosition
/// @notice Recreates the local Anvil user's Vault A
/// position after a completed migration.
/// @dev This script is only for local development with
/// mock contracts and valueless assets.
contract RefillSourcePosition is Script {
    error RefillSourcePosition__AssetMismatch(address expectedAsset, address actualAsset);

    error RefillSourcePosition__PositionAlreadyExists(uint256 existingShares);

    uint256 internal constant SOURCE_ASSETS = 100e6;

    function run() external returns (uint256 mintedShares) {
        uint256 userPrivateKey = vm.envUint("ONETASK_ANVIL_PRIVATE_KEY");

        address user = vm.addr(userPrivateKey);

        MockUSDC token = MockUSDC(vm.envAddress("ONETASK_TOKEN_ADDRESS"));

        MockYieldVault vaultA = MockYieldVault(vm.envAddress("ONETASK_VAULT_A_ADDRESS"));

        address vaultAsset = vaultA.asset();

        if (vaultAsset != address(token)) {
            revert RefillSourcePosition__AssetMismatch(address(token), vaultAsset);
        }

        uint256 existingShares = vaultA.balanceOf(user);

        if (existingShares != 0) {
            revert RefillSourcePosition__PositionAlreadyExists(existingShares);
        }

        vm.startBroadcast(userPrivateKey);

        token.mint(user, SOURCE_ASSETS);

        token.approve(address(vaultA), SOURCE_ASSETS);

        mintedShares = vaultA.deposit(SOURCE_ASSETS, user);

        vm.stopBroadcast();

        console2.log("Refill user:", user);

        console2.log("Deposited assets:", SOURCE_ASSETS);

        console2.log("Minted Vault A shares:", mintedShares);

        console2.log("Current Vault A shares:", vaultA.balanceOf(user));
    }
}
