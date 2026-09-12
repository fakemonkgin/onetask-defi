// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MockYieldVault
/// @notice Local-only ERC-4626 vault used by OneTask simulations.
/// @dev This contract does not contain a real yield strategy.
contract MockYieldVault is ERC4626 {
    using SafeERC20 for IERC20;

    error MockYieldVault__ZeroYield();

    event YieldAdded(address indexed provider, uint256 assets);

    constructor(IERC20 asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC4626(asset_) {}

    /// @notice Adds simulated yield without minting new vault shares.
    /// @dev Existing shares become redeemable for more underlying assets.
    function addYield(uint256 assets) external {
        if (assets == 0) {
            revert MockYieldVault__ZeroYield();
        }

        IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);

        emit YieldAdded(msg.sender, assets);
    }
}
