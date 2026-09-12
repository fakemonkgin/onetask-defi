// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

import {MockUSDC} from "../../src/mocks/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC internal token;

    address internal alice;
    address internal bob;

    uint256 internal constant ONE_TOKEN = 1e6;

    function setUp() public {
        token = new MockUSDC();

        alice = makeAddr("alice");
        bob = makeAddr("bob");
    }

    function test_MetadataUsesUsdcStyleValues() public view {
        assertEq(token.name(), "Mock USD Coin");
        assertEq(token.symbol(), "mUSDC");
        assertEq(token.decimals(), 6);
    }

    function test_MintIncreasesBalanceAndTotalSupply() public {
        uint256 amount = 100 * ONE_TOKEN;

        token.mint(alice, amount);

        assertEq(token.balanceOf(alice), amount);
        assertEq(token.totalSupply(), amount);
    }

    function test_TransferMovesTokensBetweenAccounts() public {
        uint256 startingBalance = 100 * ONE_TOKEN;
        uint256 transferAmount = 40 * ONE_TOKEN;

        token.mint(alice, startingBalance);

        vm.prank(alice);
        bool success = token.transfer(bob, transferAmount);

        assertTrue(success);
        assertEq(token.balanceOf(alice), startingBalance - transferAmount);
        assertEq(token.balanceOf(bob), transferAmount);
    }

    function test_TransferFromConsumesAllowance() public {
        uint256 startingBalance = 100 * ONE_TOKEN;
        uint256 approvedAmount = 25 * ONE_TOKEN;

        token.mint(alice, startingBalance);

        vm.prank(alice);
        token.approve(bob, approvedAmount);

        vm.prank(bob);
        bool success = token.transferFrom(alice, bob, approvedAmount);

        assertTrue(success);
        assertEq(token.balanceOf(alice), startingBalance - approvedAmount);
        assertEq(token.balanceOf(bob), approvedAmount);
        assertEq(token.allowance(alice, bob), 0);
    }

    function test_RevertWhenMintingToZeroAddress() public {
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));

        token.mint(address(0), ONE_TOKEN);
    }

    function testFuzz_MintUpdatesAccounting(address receiver, uint96 amount) public {
        vm.assume(receiver != address(0));

        token.mint(receiver, amount);

        assertEq(token.balanceOf(receiver), amount);
        assertEq(token.totalSupply(), amount);
    }
}
