// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TaskExecutor
/// @notice Executes user-authorized DeFi plans under explicit limits.
/// @dev The first supported action is migration between two ERC-4626 vaults.
contract TaskExecutor is ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant VAULT_MIGRATION_PLAN_TYPEHASH = keccak256(
        "VaultMigrationPlan(address user,address sourceVault,address destinationVault,uint256 sourceShares,uint256 minAssetsReceived,uint256 minDestinationShares,uint256 deadline,uint256 nonce,bytes32 evidenceHash)"
    );

    struct VaultMigrationPlan {
        address user;
        IERC4626 sourceVault;
        IERC4626 destinationVault;
        uint256 sourceShares;
        uint256 minAssetsReceived;
        uint256 minDestinationShares;
        uint256 deadline;
        uint256 nonce;
        bytes32 evidenceHash;
    }

    mapping(address => mapping(uint256 => bool)) public usedNonces;

    error TaskExecutor__ZeroAddress();
    error TaskExecutor__UnauthorizedCaller(address caller, address expectedUser);
    error TaskExecutor__PlanExpired(uint256 deadline, uint256 currentTimestamp);
    error TaskExecutor__NonceAlreadyUsed(address user, uint256 nonce);
    error TaskExecutor__ZeroSourceShares();
    error TaskExecutor__ZeroMinimumAssets();
    error TaskExecutor__ZeroMinimumDestinationShares();
    error TaskExecutor__EmptyEvidenceHash();
    error TaskExecutor__SameVault();
    error TaskExecutor__AssetMismatch(address sourceAsset, address destinationAsset);
    error TaskExecutor__InsufficientAssets(uint256 assetsReceived, uint256 minimumAssets);
    error TaskExecutor__InsufficientDestinationShares(uint256 sharesReceived, uint256 minimumShares);

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

    /// @notice Migrates a user's shares between compatible ERC-4626 vaults.
    /// @dev The user must first approve this contract to spend source shares.
    function executeVaultMigration(VaultMigrationPlan calldata plan)
        external
        nonReentrant
        returns (uint256 assetsReceived, uint256 destinationShares)
    {
        IERC20 assetToken = _validatePlan(plan);

        bytes32 planHash = hashVaultMigrationPlan(plan);

        // Effects are recorded before external interactions.
        usedNonces[plan.user][plan.nonce] = true;

        // Receive the user's source-vault shares.
        IERC20(address(plan.sourceVault)).safeTransferFrom(plan.user, address(this), plan.sourceShares);

        // Burn source shares and receive the underlying asset.
        assetsReceived = plan.sourceVault.redeem(plan.sourceShares, address(this), address(this));

        if (assetsReceived < plan.minAssetsReceived) {
            revert TaskExecutor__InsufficientAssets(assetsReceived, plan.minAssetsReceived);
        }

        // Approve only the exact amount needed by the
        // destination vault.
        assetToken.forceApprove(address(plan.destinationVault), assetsReceived);

        destinationShares = plan.destinationVault.deposit(assetsReceived, plan.user);

        // Remove any unexpected remaining allowance.
        assetToken.forceApprove(address(plan.destinationVault), 0);

        if (destinationShares < plan.minDestinationShares) {
            revert TaskExecutor__InsufficientDestinationShares(destinationShares, plan.minDestinationShares);
        }

        emit VaultMigrationExecuted(
            planHash,
            plan.evidenceHash,
            plan.user,
            address(plan.sourceVault),
            address(plan.destinationVault),
            plan.sourceShares,
            assetsReceived,
            destinationShares,
            plan.nonce
        );
    }

    /// @notice Produces a deterministic hash for an execution plan.
    /// @dev This binds evidence to a plan but does not yet verify
    ///      an Agent signature.
    function hashVaultMigrationPlan(VaultMigrationPlan calldata plan) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                VAULT_MIGRATION_PLAN_TYPEHASH,
                plan.user,
                address(plan.sourceVault),
                address(plan.destinationVault),
                plan.sourceShares,
                plan.minAssetsReceived,
                plan.minDestinationShares,
                plan.deadline,
                plan.nonce,
                plan.evidenceHash
            )
        );
    }

    function _validatePlan(VaultMigrationPlan calldata plan) internal view returns (IERC20 assetToken) {
        if (
            plan.user == address(0) || address(plan.sourceVault) == address(0)
                || address(plan.destinationVault) == address(0)
        ) {
            revert TaskExecutor__ZeroAddress();
        }

        if (msg.sender != plan.user) {
            revert TaskExecutor__UnauthorizedCaller(msg.sender, plan.user);
        }

        if (block.timestamp > plan.deadline) {
            revert TaskExecutor__PlanExpired(plan.deadline, block.timestamp);
        }

        if (usedNonces[plan.user][plan.nonce]) {
            revert TaskExecutor__NonceAlreadyUsed(plan.user, plan.nonce);
        }

        if (plan.sourceShares == 0) {
            revert TaskExecutor__ZeroSourceShares();
        }

        if (plan.minAssetsReceived == 0) {
            revert TaskExecutor__ZeroMinimumAssets();
        }

        if (plan.minDestinationShares == 0) {
            revert TaskExecutor__ZeroMinimumDestinationShares();
        }

        if (plan.evidenceHash == bytes32(0)) {
            revert TaskExecutor__EmptyEvidenceHash();
        }

        if (address(plan.sourceVault) == address(plan.destinationVault)) {
            revert TaskExecutor__SameVault();
        }

        address sourceAsset = plan.sourceVault.asset();
        address destinationAsset = plan.destinationVault.asset();

        if (sourceAsset == address(0) || destinationAsset == address(0)) {
            revert TaskExecutor__ZeroAddress();
        }

        if (sourceAsset != destinationAsset) {
            revert TaskExecutor__AssetMismatch(sourceAsset, destinationAsset);
        }

        assetToken = IERC20(sourceAsset);
    }
}
