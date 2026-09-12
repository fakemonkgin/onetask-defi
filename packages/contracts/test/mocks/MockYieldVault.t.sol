// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";

import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {MockYieldVault} from "../../src/mocks/MockYieldVault.sol";

contract MockYieldVaultTest is Test {
    MockUSDC internal token;
    MockYieldVault internal vault;

    address internal alice;
    address internal yieldProvider;

    uint256 internal constant ONE_TOKEN = 1e6;
    uint256 internal constant DEPOSIT_AMOUNT = 100 * ONE_TOKEN;
    uint256 internal constant YIELD_AMOUNT = 20 * ONE_TOKEN;

    event YieldAdded(address indexed provider, uint256 assets);

    function setUp() public {
        token = new MockUSDC();

        vault = new MockYieldVault(token, "Mock Yield Vault A", "myvA");

        alice = makeAddr("alice");
        yieldProvider = makeAddr("yieldProvider");

        token.mint(alice, DEPOSIT_AMOUNT);
        token.mint(yieldProvider, YIELD_AMOUNT);
    }

    function test_UsesConfiguredAssetAndMetadata() public view {
        assertEq(vault.asset(), address(token));
        assertEq(vault.name(), "Mock Yield Vault A");
        assertEq(vault.symbol(), "myvA");
        assertEq(vault.decimals(), 6);
    }

    function test_DepositTransfersAssetsAndMintsShares() public {
        uint256 expectedShares = vault.previewDeposit(DEPOSIT_AMOUNT);

        uint256 receivedShares = _depositAsAlice(DEPOSIT_AMOUNT);

        assertEq(receivedShares, expectedShares);
        assertEq(vault.balanceOf(alice), receivedShares);
        assertEq(token.balanceOf(address(vault)), DEPOSIT_AMOUNT);
        assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
        assertEq(token.balanceOf(alice), 0);
    }

    function test_AddYieldIncreasesAssetsWithoutMintingShares() public {
        uint256 aliceShares = _depositAsAlice(DEPOSIT_AMOUNT);

        uint256 supplyBefore = vault.totalSupply();

        vm.startPrank(yieldProvider);
        token.approve(address(vault), YIELD_AMOUNT);

        vm.expectEmit(true, false, false, true, address(vault));
        emit YieldAdded(yieldProvider, YIELD_AMOUNT);

        vault.addYield(YIELD_AMOUNT);
        vm.stopPrank();

        assertEq(vault.totalAssets(), DEPOSIT_AMOUNT + YIELD_AMOUNT);
        assertEq(vault.totalSupply(), supplyBefore);
        assertEq(vault.balanceOf(alice), aliceShares);
    }

    function test_YieldIncreasesRedeemableAssets() public {
        uint256 aliceShares = _depositAsAlice(DEPOSIT_AMOUNT);

        uint256 assetsBefore = vault.previewRedeem(aliceShares);

        _addYield(YIELD_AMOUNT);

        uint256 assetsAfter = vault.previewRedeem(aliceShares);

        assertEq(assetsBefore, DEPOSIT_AMOUNT);
        assertGt(assetsAfter, assetsBefore);

        assertApproxEqAbs(assetsAfter, DEPOSIT_AMOUNT + YIELD_AMOUNT, 1);
    }

    function test_RedeemReturnsPreviewedAssets() public {
        uint256 aliceShares = _depositAsAlice(DEPOSIT_AMOUNT);

        _addYield(YIELD_AMOUNT);

        uint256 expectedAssets = vault.previewRedeem(aliceShares);

        vm.prank(alice);
        uint256 receivedAssets = vault.redeem(aliceShares, alice, alice);

        assertEq(receivedAssets, expectedAssets);
        assertEq(token.balanceOf(alice), expectedAssets);
        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.totalSupply(), 0);

        // OpenZeppelin virtual-asset rounding may leave
        // one smallest token unit inside the vault.
        assertLe(vault.totalAssets(), 1);
    }

    function test_WithdrawBurnsSharesAndReturnsAssets() public {
        uint256 aliceShares = _depositAsAlice(DEPOSIT_AMOUNT);

        uint256 withdrawAmount = 40 * ONE_TOKEN;
        uint256 expectedShares = vault.previewWithdraw(withdrawAmount);

        vm.prank(alice);
        uint256 burnedShares = vault.withdraw(withdrawAmount, alice, alice);

        assertEq(burnedShares, expectedShares);
        assertEq(token.balanceOf(alice), withdrawAmount);
        assertEq(vault.balanceOf(alice), aliceShares - burnedShares);
        assertEq(vault.totalAssets(), DEPOSIT_AMOUNT - withdrawAmount);
    }

    function test_RevertWhenAddingZeroYield() public {
        vm.expectRevert(MockYieldVault.MockYieldVault__ZeroYield.selector);

        vault.addYield(0);
    }

    function _depositAsAlice(uint256 assets) internal returns (uint256 shares) {
        vm.startPrank(alice);

        token.approve(address(vault), assets);
        shares = vault.deposit(assets, alice);

        vm.stopPrank();
    }

    function _addYield(uint256 assets) internal {
        vm.startPrank(yieldProvider);

        token.approve(address(vault), assets);
        vault.addYield(assets);

        vm.stopPrank();
    }
}
