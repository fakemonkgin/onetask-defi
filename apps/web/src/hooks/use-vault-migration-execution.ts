"use client";

import { useState } from "react";
import {
  BaseError,
  getAddress,
  parseEventLogs,
  type Hash,
} from "viem";
import {
  useConnection,
  usePublicClient,
  useWriteContract,
} from "wagmi";

import {
  taskExecutorAbi,
  vaultShareTokenAbi,
} from "@/lib/contract-abis";
import type { MigrationPlanResponse } from "@/lib/orchestrator-client";
import { anvilChain } from "@/lib/wagmi-config";

export type MigrationExecutionPhase =
  | "idle"
  | "checking-plan"
  | "simulating-approval"
  | "awaiting-approval-signature"
  | "confirming-approval"
  | "simulating-migration"
  | "awaiting-migration-signature"
  | "confirming-migration"
  | "success"
  | "error";

type PreparedMigrationPlan =
  MigrationPlanResponse["migrationPlan"];

type ExecuteMigrationInput = {
  migrationPlan: PreparedMigrationPlan;
  onConfirmed?: () =>
    | Promise<void>
    | void;
};

export type MigrationExecutionResult = {
  planHash?: Hash;
  evidenceHash?: Hash;
  assetsReceived?: string;
  destinationShares?: string;
};

const ZERO_BYTES32 =
  `0x${"0".repeat(64)}` as Hash;

const MINIMUM_EXECUTION_WINDOW_SECONDS =
  BigInt(30);

function addressesEqual(
  firstAddress: string,
  secondAddress: string,
) {
  return (
    getAddress(firstAddress) ===
    getAddress(secondAddress)
  );
}

function getCurrentUnixTimestamp() {
  return BigInt(
    Math.floor(Date.now() / 1_000),
  );
}

function assertPlanIsFresh(
  blockTimestamp: bigint,
  deadline: bigint,
) {
  const browserTimestamp =
    getCurrentUnixTimestamp();

  const effectiveTimestamp =
    blockTimestamp >
    browserTimestamp
      ? blockTimestamp
      : browserTimestamp;

  if (
    effectiveTimestamp >
    deadline
  ) {
    throw new Error(
      "TaskExecutor__PlanExpired: This migration plan has expired. Generate a new plan.",
    );
  }

  const remainingSeconds =
    deadline -
    effectiveTimestamp;

  if (
    remainingSeconds <
    MINIMUM_EXECUTION_WINDOW_SECONDS
  ) {
    throw new Error(
      "PLAN_NEAR_EXPIRY: Less than 30 seconds remain. Generate a new plan before requesting wallet approval.",
    );
  }
}

function getExecutionErrorMessage(
  error: unknown,
) {
  if (error instanceof BaseError) {
    return error.shortMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The local migration transaction failed.";
}

export function useVaultMigrationExecution() {
  const connection =
    useConnection();

  const publicClient =
    usePublicClient({
      chainId: anvilChain.id,
    });

  const writeContract =
    useWriteContract();

  const [phase, setPhase] =
    useState<MigrationExecutionPhase>(
      "idle",
    );

  const [
    approvalTransactionHash,
    setApprovalTransactionHash,
  ] = useState<Hash>();

  const [
    migrationTransactionHash,
    setMigrationTransactionHash,
  ] = useState<Hash>();

  const [
    executionResult,
    setExecutionResult,
  ] =
    useState<MigrationExecutionResult>();

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string>();

  const [
    approvalWasRequired,
    setApprovalWasRequired,
  ] = useState(false);

  const isRunning =
    phase !== "idle" &&
    phase !== "success" &&
    phase !== "error";

  function resetExecution() {
    if (isRunning) {
      return;
    }

    setPhase("idle");

    setApprovalTransactionHash(
      undefined,
    );

    setMigrationTransactionHash(
      undefined,
    );

    setExecutionResult(undefined);
    setErrorMessage(undefined);

    setApprovalWasRequired(
      false,
    );

    writeContract.reset();
  }

  async function executeMigration({
    migrationPlan,
    onConfirmed,
  }: ExecuteMigrationInput) {
    if (isRunning) {
      return;
    }

    setPhase("checking-plan");

    setApprovalTransactionHash(
      undefined,
    );

    setMigrationTransactionHash(
      undefined,
    );

    setExecutionResult(undefined);
    setErrorMessage(undefined);

    setApprovalWasRequired(
      false,
    );

    writeContract.reset();

    try {
      if (
        connection.status !==
        "connected"
      ) {
        throw new Error(
          "Connect an Anvil development wallet before executing.",
        );
      }

      if (
        connection.chainId !==
        anvilChain.id
      ) {
        throw new Error(
          `Switch the wallet to Anvil chain ${anvilChain.id}.`,
        );
      }

      if (!publicClient) {
        throw new Error(
          "The Anvil public client is unavailable.",
        );
      }

      const connectedUser =
        connection.address;

      const {
        plan,
        approval,
        taskExecutor,
      } = migrationPlan;

      if (
        migrationPlan.chainId !==
        anvilChain.id
      ) {
        throw new Error(
          "The plan was generated for the wrong chain.",
        );
      }

      if (
        !addressesEqual(
          connectedUser,
          plan.user,
        )
      ) {
        throw new Error(
          "The connected wallet does not match the plan user.",
        );
      }

      if (
        !addressesEqual(
          approval.token,
          plan.sourceVault,
        )
      ) {
        throw new Error(
          "The approval token does not match the source vault.",
        );
      }

      if (
        !addressesEqual(
          approval.spender,
          taskExecutor.address,
        )
      ) {
        throw new Error(
          "The approval spender does not match the TaskExecutor.",
        );
      }

      if (
        BigInt(approval.amount) !==
        BigInt(plan.sourceShares)
      ) {
        throw new Error(
          "The approval amount does not match the source shares.",
        );
      }

      if (
        plan.evidenceHash ===
          ZERO_BYTES32 ||
        migrationPlan.evidence.hash !==
          plan.evidenceHash
      ) {
        throw new Error(
          "The plan evidence binding is invalid.",
        );
      }

      const sourceVaultAddress =
        getAddress(
          plan.sourceVault,
        );

      const destinationVaultAddress =
        getAddress(
          plan.destinationVault,
        );

      const taskExecutorAddress =
        getAddress(
          taskExecutor.address,
        );

      const sourceShares =
        BigInt(plan.sourceShares);

      const nonce =
        BigInt(plan.nonce);

      const deadline =
        BigInt(plan.deadline);

      const contractPlan = {
        user:
          getAddress(plan.user),

        sourceVault:
          sourceVaultAddress,

        destinationVault:
          destinationVaultAddress,

        sourceShares,

        minAssetsReceived:
          BigInt(
            plan.minAssetsReceived,
          ),

        minDestinationShares:
          BigInt(
            plan.minDestinationShares,
          ),

        deadline,
        nonce,

        evidenceHash:
          plan.evidenceHash as Hash,
      };

      if (
        sourceShares ===
        BigInt(0)
      ) {
        throw new Error(
          "The plan contains zero source shares.",
        );
      }

      const latestBlock =
        await publicClient.getBlock({
          blockTag: "latest",
        });

      assertPlanIsFresh(
        latestBlock.timestamp,
        deadline,
      );

      const nonceAlreadyUsed =
        await publicClient.readContract({
          address:
            taskExecutorAddress,

          abi: taskExecutorAbi,

          functionName:
            "usedNonces",

          args: [
            connectedUser,
            nonce,
          ],
        });

      if (nonceAlreadyUsed) {
        throw new Error(
          "TaskExecutor__NonceAlreadyUsed: Generate a new migration plan.",
        );
      }

      const currentAllowance =
        await publicClient.readContract({
          address:
            sourceVaultAddress,

          abi: vaultShareTokenAbi,

          functionName:
            "allowance",

          args: [
            connectedUser,
            taskExecutorAddress,
          ],
        });

      if (
        currentAllowance !==
        sourceShares
      ) {
        setApprovalWasRequired(
          true,
        );

        setPhase(
          "simulating-approval",
        );

        await publicClient
          .simulateContract({
            account:
              connectedUser,

            address:
              sourceVaultAddress,

            abi:
              vaultShareTokenAbi,

            functionName:
              "approve",

            args: [
              taskExecutorAddress,
              sourceShares,
            ],
          });

        setPhase(
          "awaiting-approval-signature",
        );

        const approvalHash =
          await writeContract
            .mutateAsync({
              chainId:
                anvilChain.id,

              address:
                sourceVaultAddress,

              abi:
                vaultShareTokenAbi,

              functionName:
                "approve",

              args: [
                taskExecutorAddress,
                sourceShares,
              ],
            });

        setApprovalTransactionHash(
          approvalHash,
        );

        setPhase(
          "confirming-approval",
        );

        const approvalReceipt =
          await publicClient
            .waitForTransactionReceipt({
              hash:
                approvalHash,
            });

        if (
          approvalReceipt.status !==
          "success"
        ) {
          throw new Error(
            "The Vault A share approval reverted.",
          );
        }
      }

      const blockBeforeMigration =
        await publicClient.getBlock({
          blockTag: "latest",
        });

      assertPlanIsFresh(
        blockBeforeMigration.timestamp,
        deadline,
      );

      setPhase(
        "simulating-migration",
      );

      await publicClient
        .simulateContract({
          account:
            connectedUser,

          address:
            taskExecutorAddress,

          abi:
            taskExecutorAbi,

          functionName:
            "executeVaultMigration",

          args: [contractPlan],
        });

      setPhase(
        "awaiting-migration-signature",
      );

      const migrationHash =
        await writeContract
          .mutateAsync({
            chainId:
              anvilChain.id,

            address:
              taskExecutorAddress,

            abi:
              taskExecutorAbi,

            functionName:
              "executeVaultMigration",

            args: [contractPlan],
          });

      setMigrationTransactionHash(
        migrationHash,
      );

      setPhase(
        "confirming-migration",
      );

      const migrationReceipt =
        await publicClient
          .waitForTransactionReceipt({
            hash:
              migrationHash,
          });

      if (
        migrationReceipt.status !==
        "success"
      ) {
        throw new Error(
          "The vault migration reverted.",
        );
      }

      const migrationEvents =
        parseEventLogs({
          abi:
            taskExecutorAbi,

          eventName:
            "VaultMigrationExecuted",

          logs:
            migrationReceipt.logs,

          strict: true,
        });

      const migrationEvent =
        migrationEvents[0];

      if (migrationEvent) {
        setExecutionResult({
          planHash:
            migrationEvent.args
              .planHash,

          evidenceHash:
            migrationEvent.args
              .evidenceHash,

          assetsReceived:
            migrationEvent.args
              .assetsReceived
              .toString(),

          destinationShares:
            migrationEvent.args
              .destinationShares
              .toString(),
        });
      }

      setPhase("success");

      if (onConfirmed) {
        try {
          await onConfirmed();
        } catch {
          // A refresh failure does not
          // change the transaction result.
        }
      }
    } catch (error) {
      setErrorMessage(
        getExecutionErrorMessage(
          error,
        ),
      );

      setPhase("error");
    }
  }

  return {
    phase,
    isRunning,

    isSuccess:
      phase === "success",

    isError:
      phase === "error",

    errorMessage,
    approvalWasRequired,
    approvalTransactionHash,
    migrationTransactionHash,
    executionResult,
    executeMigration,
    resetExecution,
  };
}