// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";

/// @title SeedLocal
/// @notice Creates a local-only ERC-4626 migration scenario.
contract SeedLocal is Script {
    uint256 internal constant ANVIL_CHAIN_ID = 31_337;
    uint256 internal constant ONE_TOKEN = 1e6;

    uint256 internal constant USER_VAULT_A_DEPOSIT = 100 * ONE_TOKEN;

    uint256 internal constant VAULT_B_INITIAL_DEPOSIT = 1_000 * ONE_TOKEN;

    uint256 internal constant VAULT_B_YIELD = 50 * ONE_TOKEN;

    address internal constant FIXTURE_LIQUIDITY_PROVIDER = address(0xBEEF);

    error SeedLocal__WrongChain(uint256 chainId);
    error SeedLocal__AlreadySeeded();
    error SeedLocal__AssetMismatch();

    function run() external {
        if (block.chainid != ANVIL_CHAIN_ID) {
            revert SeedLocal__WrongChain(block.chainid);
        }

        uint256 privateKey = vm.envUint("ONETASK_ANVIL_PRIVATE_KEY");

        address user = vm.addr(privateKey);

        MockUSDC token = MockUSDC(vm.envAddress("ONETASK_TOKEN_ADDRESS"));

        MockYieldVault vaultA = MockYieldVault(vm.envAddress("ONETASK_VAULT_A_ADDRESS"));

        MockYieldVault vaultB = MockYieldVault(vm.envAddress("ONETASK_VAULT_B_ADDRESS"));

        if (vaultA.asset() != address(token) || vaultB.asset() != address(token)) {
            revert SeedLocal__AssetMismatch();
        }

        if (vaultA.totalAssets() != 0 || vaultB.totalAssets() != 0) {
            revert SeedLocal__AlreadySeeded();
        }

        uint256 totalMintAmount = USER_VAULT_A_DEPOSIT + VAULT_B_INITIAL_DEPOSIT + VAULT_B_YIELD;

        vm.startBroadcast(privateKey);

        token.mint(user, totalMintAmount);

        token.approve(address(vaultA), USER_VAULT_A_DEPOSIT);

        vaultA.deposit(USER_VAULT_A_DEPOSIT, user);

        token.approve(address(vaultB), VAULT_B_INITIAL_DEPOSIT + VAULT_B_YIELD);

        vaultB.deposit(VAULT_B_INITIAL_DEPOSIT, FIXTURE_LIQUIDITY_PROVIDER);

        vaultB.addYield(VAULT_B_YIELD);

        vm.stopBroadcast();

        console2.log("Seed user:", user);

        console2.log("User Vault A shares:", vaultA.balanceOf(user));

        console2.log("User Vault B shares:", vaultB.balanceOf(user));

        console2.log("Vault A total assets:", vaultA.totalAssets());

        console2.log("Vault B total assets:", vaultB.totalAssets());

        console2.log("Vault B total shares:", vaultB.totalSupply());

        console2.log("Vault B shares for 100 mUSDC:", vaultB.previewDeposit(USER_VAULT_A_DEPOSIT));
    }
}
