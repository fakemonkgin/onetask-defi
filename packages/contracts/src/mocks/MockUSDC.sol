// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice Test-only ERC-20 asset used by the OneTask local DeFi environment.
/// @dev Anyone can mint tokens. Never deploy this contract for real assets.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "mUSDC") {}

    /// @notice Returns the number of decimals used by MockUSDC.
    /// @dev USDC-style test amounts use six decimals instead of the default 18.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Creates test tokens and sends them to `to`.
    /// @param to Address receiving the test tokens.
    /// @param amount Amount expressed in the smallest six-decimal unit.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
