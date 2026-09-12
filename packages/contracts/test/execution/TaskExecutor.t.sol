// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

import {TaskExecutor} from "../../src/execution/TaskExecutor.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {MockYieldVault} from "../../src/mocks/MockYieldVault.sol";

contract TaskExecutorTest is Test {
    MockUSDC internal token;
    MockYieldVault internal sourceVault;
    MockYieldVault internal destinationVault;
    TaskExecutor internal executor;

    address internal alice;
    address internal attacker;

    uint256 internal sourceShares;

    uint256 internal constant ONE_TOKEN = 1e6;
    uint256 internal constant DEPOSIT_AMOUNT = 100 * ONE_TOKEN;
    uint256 internal constant MIN_ASSETS_RECEIVED = 99 * ONE_TOKEN;
    uint256 internal constant MIN_DESTINATION_SHARES = 99 * ONE_TOKEN;
    uint256 internal constant DEFAULT_NONCE = 1;

    bytes32 internal constant EVIDENCE_HASH = keccak256("risk-route-simulation-evidence");

    event VaultMigrationExecuted(
        bytes32 indexed planHash,
        bytes32 indexed evidenceHash,
        address indexed user,
        address sourceVault,
        address destinationVault,
        uint256 sourceShares,
        uint256 assetsReceived,
        uint256 destinationShares,
        uint256 nonce
    );

    function setUp() public {
        vm.warp(1_700_000_000);

        token = new MockUSDC();

        sourceVault = new MockYieldVault(token, "Mock Vault A", "mvA");

        destinationVault = new MockYieldVault(token, "Mock Vault B", "mvB");

        executor = new TaskExecutor();

        alice = makeAddr("alice");
        attacker = makeAddr("attacker");

        token.mint(alice, DEPOSIT_AMOUNT);

        vm.startPrank(alice);

        token.approve(address(sourceVault), DEPOSIT_AMOUNT);

        sourceShares = sourceVault.deposit(DEPOSIT_AMOUNT, alice);

        sourceVault.approve(address(executor), sourceShares);

        vm.stopPrank();
    }

    function test_ExecutesVaultMigrationAtomically() public {
        TaskExecutor.VaultMigrationPlan memory plan = _defaultPlan();

        uint256 expectedAssets = sourceVault.previewRedeem(sourceShares);

        uint256 expectedDestinationShares = destinationVault.previewDeposit(expectedAssets);

        bytes32 planHash = executor.hashVaultMigrationPlan(plan);

        vm.expectEmit(true, true, true, true, address(executor));

        emit VaultMigrationExecuted(
            planHash,
            EVIDENCE_HASH,
            alice,
            address(sourceVault),
            address(destinationVault),
            sourceShares,
            expectedAssets,
            expectedDestinationShares,
            DEFAULT_NONCE
        );

        vm.prank(alice);
        (uint256 assetsReceived, uint256 destinationShares) = executor.executeVaultMigration(plan);

        assertEq(assetsReceived, expectedAssets);
        assertEq(destinationShares, expectedDestinationShares);

        assertEq(sourceVault.balanceOf(alice), 0);
        assertEq(destinationVault.balanceOf(alice), expectedDestinationShares);

        assertEq(token.balanceOf(address(executor)), 0);
        assertEq(sourceVault.balanceOf(address(executor)), 0);

        assertEq(token.allowance(address(executor), address(destinationVault)), 0);

        assertTrue(executor.usedNonces(alice, DEFAULT_NONCE));
    }

    function test_HashChangesWhenEvidenceChanges() public view {
        TaskExecutor.VaultMigrationPlan memory plan = _defaultPlan();

        bytes32 firstHash = executor.hashVaultMigrationPlan(plan);

        plan.evidenceHash = keccak256("different-evidence");

        bytes32 secondHash = executor.hashVaultMigrationPlan(plan);

        assertNotEq(firstHash, secondHash);
    }

    function test_RevertWhenCallerIsNotUser() public {
        TaskExecutor.VaultMigrationPlan memory plan = _defaultPlan();

        vm.expectRevert(abi.encodeWithSelector(TaskExecutor.TaskExecutor__UnauthorizedCaller.selector, attacker, alice));

        vm.prank(attacker);
        executor.executeVaultMigration(plan);

        assertFalse(executor.usedNonces(alice, DEFAULT_NONCE));
    }

    function test_RevertWhenPlanIsExpired() public {
        TaskExecutor.VaultMigrationPlan memory plan = _defaultPlan();

        plan.deadline = block.timestamp - 1;

        vm.expectRevert(
            abi.encodeWithSelector(TaskExecutor.TaskExecutor__PlanExpired.selector, plan.deadline, block.timestamp)
        );

        vm.prank(alice);
        executor.executeVaultMigration(plan);
    }

    function test_RevertWhenNonceIsReused() public {
        TaskExecutor.VaultMigrationPlan memory plan = _defaultPlan();

        vm.prank(alice);
        executor.executeVaultMigration(plan);

        vm.expectRevert(
            abi.encodeWithSelector(TaskExecutor.TaskExecutor__NonceAlreadyUsed.selector, alice, DEFAULT_NONCE)
        );

        vm.prank(alice);
        executor.executeVaultMigration(plan);
    }

    function test_RevertWhenSourceAndDestinationMatch() public {
        TaskExecutor.VaultMigrationPlan memory plan = _defaultPlan();

        plan.destinationVault = IERC4626(address(sourceVault));

        vm.expectRevert(TaskExecutor.TaskExecutor__SameVault.selector);

        vm.prank(alice);
        executor.executeVaultMigration(plan);
    }

    function test_RevertWhenVaultAssetsDiffer() public {
        MockUSDC differentToken = new MockUSDC();

        MockYieldVault differentVault = new MockYieldVault(differentToken, "Different Asset Vault", "dav");

        TaskExecutor.VaultMigrationPlan memory plan = _defaultPlan();

        plan.destinationVault = IERC4626(address(differentVault));

        vm.expectRevert(
            abi.encodeWithSelector(
                TaskExecutor.TaskExecutor__AssetMismatch.selector, address(token), address(differentToken)
            )
        );

        vm.prank(alice);
        executor.executeVaultMigration(plan);
    }

    function test_RevertAndRollbackWhenAssetsBelowMinimum() public {
        TaskExecutor.VaultMigrationPlan memory plan = _defaultPlan();

        uint256 expectedAssets = sourceVault.previewRedeem(sourceShares);

        plan.minAssetsReceived = expectedAssets + 1;

        vm.expectRevert(
            abi.encodeWithSelector(
                TaskExecutor.TaskExecutor__InsufficientAssets.selector, expectedAssets, expectedAssets + 1
            )
        );

        vm.prank(alice);
        executor.executeVaultMigration(plan);

        _assertMigrationWasRolledBack();
    }

    function test_RevertAndRollbackWhenSharesBelowMinimum() public {
        TaskExecutor.VaultMigrationPlan memory plan = _defaultPlan();

        uint256 expectedAssets = sourceVault.previewRedeem(sourceShares);

        uint256 expectedShares = destinationVault.previewDeposit(expectedAssets);

        plan.minAssetsReceived = expectedAssets;
        plan.minDestinationShares = expectedShares + 1;

        vm.expectRevert(
            abi.encodeWithSelector(
                TaskExecutor.TaskExecutor__InsufficientDestinationShares.selector, expectedShares, expectedShares + 1
            )
        );

        vm.prank(alice);
        executor.executeVaultMigration(plan);

        _assertMigrationWasRolledBack();
    }

    function test_RevertWhenEvidenceHashIsEmpty() public {
        TaskExecutor.VaultMigrationPlan memory plan = _defaultPlan();

        plan.evidenceHash = bytes32(0);

        vm.expectRevert(TaskExecutor.TaskExecutor__EmptyEvidenceHash.selector);

        vm.prank(alice);
        executor.executeVaultMigration(plan);
    }

    function _defaultPlan() internal view returns (TaskExecutor.VaultMigrationPlan memory plan) {
        plan = TaskExecutor.VaultMigrationPlan({
            user: alice,
            sourceVault: IERC4626(address(sourceVault)),
            destinationVault: IERC4626(address(destinationVault)),
            sourceShares: sourceShares,
            minAssetsReceived: MIN_ASSETS_RECEIVED,
            minDestinationShares: MIN_DESTINATION_SHARES,
            deadline: block.timestamp + 10 minutes,
            nonce: DEFAULT_NONCE,
            evidenceHash: EVIDENCE_HASH
        });
    }

    function _assertMigrationWasRolledBack() internal view {
        assertEq(sourceVault.balanceOf(alice), sourceShares);
        assertEq(destinationVault.balanceOf(alice), 0);
        assertEq(token.balanceOf(address(executor)), 0);
        assertFalse(executor.usedNonces(alice, DEFAULT_NONCE));
    }
}
