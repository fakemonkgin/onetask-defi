// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {TaskExecutor} from "../src/execution/TaskExecutor.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";

/// @title DeployLocal
/// @notice Deploys the OneTask contracts to a local Anvil chain.
contract DeployLocal is Script {
    uint256 internal constant ANVIL_CHAIN_ID = 31_337;

    error DeployLocal__WrongChain(uint256 chainId);

    function run()
        external
        returns (MockUSDC token, MockYieldVault vaultA, MockYieldVault vaultB, TaskExecutor executor)
    {
        if (block.chainid != ANVIL_CHAIN_ID) {
            revert DeployLocal__WrongChain(block.chainid);
        }

        vm.startBroadcast();

        token = new MockUSDC();

        vaultA = new MockYieldVault(token, "Mock Vault A", "mvA");

        vaultB = new MockYieldVault(token, "Mock Vault B", "mvB");

        executor = new TaskExecutor();

        vm.stopBroadcast();

        console2.log("Chain ID:", block.chainid);
        console2.log("MockUSDC:", address(token));
        console2.log("Mock Vault A:", address(vaultA));
        console2.log("Mock Vault B:", address(vaultB));
        console2.log("TaskExecutor:", address(executor));
    }
}
