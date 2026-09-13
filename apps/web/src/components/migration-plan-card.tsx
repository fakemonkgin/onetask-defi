"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type ReactNode,
} from "react";
import { formatUnits } from "viem";
import { useConnection } from "wagmi";

import {
  type MigrationExecutionPhase,
  useVaultMigrationExecution,
} from "@/hooks/use-vault-migration-execution";
import { createMigrationPlan } from "@/lib/orchestrator-client";
import { anvilChain } from "@/lib/wagmi-config";

const DEFAULT_MAX_LOSS_BPS = 50;

const PHASE_LABELS: Record<
  MigrationExecutionPhase,
  string
> = {
  idle: "Ready",
  "checking-plan":
    "Checking plan and nonce...",
  "simulating-approval":
    "Simulating exact approval...",
  "awaiting-approval-signature":
    "Confirm approval in wallet...",
  "confirming-approval":
    "Waiting for approval confirmation...",
  "simulating-migration":
    "Simulating vault migration...",
  "awaiting-migration-signature":
    "Confirm migration in wallet...",
  "confirming-migration":
    "Waiting for migration confirmation...",
  success: "Migration confirmed",
  error: "Execution stopped",
};

type MigrationPlanCardProps = {
  user: string;
  assetSymbol: string;
  assetDecimals: number;
  executable: boolean;
};

type PlanMetricProps = {
  label: string;
  children: ReactNode;
};

type DetailRowProps = {
  label: string;
  children: ReactNode;
};

type TransactionHashProps = {
  label: string;
  hash: string;
};

function trimFormattedUnits(
  value: string,
) {
  if (!value.includes(".")) {
    return value;
  }

  return value
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function formatTokenAmount(
  value: string,
  decimals: number,
) {
  return trimFormattedUnits(
    formatUnits(
      BigInt(value),
      decimals,
    ),
  );
}

function formatBasisPoints(
  basisPoints: number,
) {
  const percentage =
    basisPoints / 100;

  return Number.isInteger(percentage)
    ? percentage.toFixed(0)
    : percentage
        .toFixed(2)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
}

function formatUnixTimestamp(
  timestamp: string,
) {
  return new Date(
    Number(BigInt(timestamp)) * 1_000,
  ).toLocaleString();
}

function shortenAddress(
  address: string,
) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function PlanMetric({
  label,
  children,
}: PlanMetricProps) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-4 dark:border-blue-900 dark:bg-zinc-950">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>

      <p className="mt-2 font-mono text-lg font-semibold">
        {children}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: DetailRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-zinc-500">
        {label}
      </dt>

      <dd className="text-right font-medium">
        {children}
      </dd>
    </div>
  );
}

function TransactionHash({
  label,
  hash,
}: TransactionHashProps) {
  return (
    <div>
      <p className="text-xs text-zinc-500">
        {label}
      </p>

      <p className="mt-1 break-all font-mono text-xs">
        {hash}
      </p>
    </div>
  );
}

export function MigrationPlanCard({
  user,
  assetSymbol,
  assetDecimals,
  executable,
}: MigrationPlanCardProps) {
  const queryClient =
    useQueryClient();

  const connection =
    useConnection();

  const execution =
    useVaultMigrationExecution();

  const migrationPlanMutation =
    useMutation({
      mutationFn: () =>
        createMigrationPlan(
          user,
          DEFAULT_MAX_LOSS_BPS,
        ),
    });

  const result =
    migrationPlanMutation.data
      ?.migrationPlan;

  const isConnectedPlanUser =
    connection.status ===
      "connected" &&
    connection.chainId ===
      anvilChain.id &&
    result !== undefined &&
    connection.address.toLowerCase() ===
      result.plan.user.toLowerCase();

  function generatePlan() {
    execution.resetExecution();
    migrationPlanMutation.mutate();
  }

  function executePlan() {
    if (!result) {
      return;
    }

    void execution.executeMigration({
      migrationPlan: result,

      onConfirmed: async () => {
        await queryClient.invalidateQueries({
          queryKey: [
            "vault-state",
          ],
        });
      },
    });
  }

  return (
    <section className="mt-6 rounded-3xl border border-blue-200 bg-blue-50/50 p-6 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
            Constrained execution plan
          </p>

          <h3 className="mt-2 text-xl font-semibold tracking-tight">
            Build contract-ready parameters
          </h3>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            The orchestrator reads the
            current quote and applies a
            0.5% maximum-loss constraint.
          </p>
        </div>

        <button
          type="button"
          disabled={
            !executable ||
            migrationPlanMutation.isPending ||
            execution.isRunning
          }
          onClick={generatePlan}
          className="shrink-0 rounded-full bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {migrationPlanMutation.isPending
            ? "Building plan..."
            : result
              ? "Regenerate plan"
              : "Generate 0.5% plan"}
        </button>
      </div>

      {!executable && !execution.isSuccess ? (
        <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          This account has no Vault A
          position, so no new migration
          plan can be generated.
        </div>
      ) : null}

      {migrationPlanMutation.isError ? (
        <div
          className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          role="alert"
        >
          {migrationPlanMutation.error
            instanceof Error
            ? migrationPlanMutation.error
                .message
            : "Unable to create the migration plan."}
        </div>
      ) : null}

      {result ? (
        <div
          className="mt-6 space-y-5"
          aria-live="polite"
        >
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-700 px-3 py-1 text-xs font-semibold text-white">
              Anvil simulation
            </span>

            <span className="rounded-full border border-blue-300 bg-white px-3 py-1 text-xs font-semibold text-blue-800 dark:border-blue-800 dark:bg-zinc-950 dark:text-blue-300">
              Max loss{" "}
              {formatBasisPoints(
                result.constraints
                  .maxLossBps,
              )}
              %
            </span>

            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              Unsigned local evidence
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PlanMetric label="Quoted assets">
              {formatTokenAmount(
                result.quote
                  .quotedAssetsReceived,
                assetDecimals,
              )}{" "}
              {assetSymbol}
            </PlanMetric>

            <PlanMetric label="Minimum assets">
              {formatTokenAmount(
                result.plan
                  .minAssetsReceived,
                assetDecimals,
              )}{" "}
              {assetSymbol}
            </PlanMetric>

            <PlanMetric label="Quoted B shares">
              {formatTokenAmount(
                result.quote
                  .quotedDestinationShares,
                assetDecimals,
              )}
            </PlanMetric>

            <PlanMetric label="Minimum B shares">
              {formatTokenAmount(
                result.plan
                  .minDestinationShares,
                assetDecimals,
              )}
            </PlanMetric>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Execution constraints
              </p>

              <dl className="mt-4 space-y-3 text-sm">
                <DetailRow label="Source shares">
                  <span className="font-mono">
                    {formatTokenAmount(
                      result.plan
                        .sourceShares,
                      assetDecimals,
                    )}
                  </span>
                </DetailRow>

                <DetailRow label="Valid until">
                  {formatUnixTimestamp(
                    result.plan.deadline,
                  )}
                </DetailRow>

                <DetailRow label="Observed block">
                  <span className="font-mono">
                    {
                      result.quote
                        .observedBlockNumber
                    }
                  </span>
                </DetailRow>

                <DetailRow label="Nonce">
                  <span
                    className="font-mono"
                    title={
                      result.plan.nonce
                    }
                  >
                    {result.plan.nonce.length >
                    16
                      ? `${result.plan.nonce.slice(0, 8)}...${result.plan.nonce.slice(-8)}`
                      : result.plan.nonce}
                  </span>
                </DetailRow>
              </dl>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Exact approval
              </p>

              <dl className="mt-4 space-y-3 text-sm">
                <DetailRow label="Share token">
                  <span
                    className="font-mono"
                    title={
                      result.approval.token
                    }
                  >
                    {shortenAddress(
                      result.approval.token,
                    )}
                  </span>
                </DetailRow>

                <DetailRow label="Spender">
                  <span
                    className="font-mono"
                    title={
                      result.approval
                        .spender
                    }
                  >
                    {shortenAddress(
                      result.approval
                        .spender,
                    )}
                  </span>
                </DetailRow>

                <DetailRow label="Amount">
                  <span className="font-mono">
                    {formatTokenAmount(
                      result.approval.amount,
                      assetDecimals,
                    )}{" "}
                    Vault A shares
                  </span>
                </DetailRow>

                <DetailRow label="Executor">
                  <span
                    className="font-mono"
                    title={
                      result.taskExecutor
                        .address
                    }
                  >
                    {shortenAddress(
                      result.taskExecutor
                        .address,
                    )}
                  </span>
                </DetailRow>
              </dl>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Evidence binding
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-zinc-500">
                  Evidence schema
                </p>

                <p className="mt-1 break-all font-mono text-xs">
                  {result.evidence.schema}
                </p>
              </div>

              <div>
                <p className="text-xs text-zinc-500">
                  Evidence hash
                </p>

                <p className="mt-1 break-all font-mono text-xs">
                  {result.evidence.hash}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Local execution
                </p>

                <h4 className="mt-1 text-lg font-semibold">
                  Approve and migrate
                </h4>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  Status:{" "}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {
                      PHASE_LABELS[
                        execution.phase
                      ]
                    }
                  </span>
                </p>
              </div>

              <button
                type="button"
                disabled={
                  !isConnectedPlanUser ||
                  execution.isRunning ||
                  execution.isSuccess
                }
                onClick={executePlan}
                className="shrink-0 rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {execution.isRunning
                  ? PHASE_LABELS[
                      execution.phase
                    ]
                  : execution.isSuccess
                    ? "Migration complete"
                    : "Approve & execute on Anvil"}
              </button>
            </div>

            {!isConnectedPlanUser &&
            !execution.isSuccess ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                Connect the same Anvil
                development account used by
                this plan before execution.
              </div>
            ) : null}

            {!execution.isSuccess &&
            !execution.approvalTransactionHash &&
            !execution.migrationTransactionHash ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4 text-sm leading-6 text-zinc-600 dark:border-emerald-900 dark:bg-zinc-950 dark:text-zinc-400">
                Clicking the execution
                button may open two wallet
                prompts: one exact share
                approval and one constrained
                migration transaction.
              </div>
            ) : null}

            {execution.isError ? (
              <div
                className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                role="alert"
              >
                {execution.errorMessage ??
                  "The local execution stopped."}
              </div>
            ) : null}

            {execution.approvalTransactionHash ||
            execution.migrationTransactionHash ? (
              <div className="mt-4 space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                {execution.approvalTransactionHash ? (
                  <TransactionHash
                    label="Approval transaction"
                    hash={
                      execution.approvalTransactionHash
                    }
                  />
                ) : null}

                {execution.migrationTransactionHash ? (
                  <TransactionHash
                    label="Migration transaction"
                    hash={
                      execution.migrationTransactionHash
                    }
                  />
                ) : null}
              </div>
            ) : null}

            {execution.isSuccess ? (
              <div className="mt-4 rounded-2xl border border-emerald-300 bg-white p-5 dark:border-emerald-800 dark:bg-zinc-950">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Vault migration confirmed
                  on Anvil
                </p>

                {!execution.approvalWasRequired ? (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    The exact allowance was
                    already present, so no
                    new approval transaction
                    was required.
                  </p>
                ) : null}

                {execution.executionResult ? (
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-zinc-500">
                        Assets received
                      </dt>

                      <dd className="mt-1 font-mono font-semibold">
                        {execution
                          .executionResult
                          .assetsReceived
                          ? formatTokenAmount(
                              execution
                                .executionResult
                                .assetsReceived,
                              assetDecimals,
                            )
                          : "Unavailable"}{" "}
                        {assetSymbol}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-zinc-500">
                        Destination shares
                      </dt>

                      <dd className="mt-1 font-mono font-semibold">
                        {execution
                          .executionResult
                          .destinationShares
                          ? formatTokenAmount(
                              execution
                                .executionResult
                                .destinationShares,
                              assetDecimals,
                            )
                          : "Unavailable"}
                      </dd>
                    </div>
                  </dl>
                ) : null}

                {execution.executionResult
                  ?.planHash ? (
                  <div className="mt-4">
                    <p className="text-xs text-zinc-500">
                      Onchain plan hash
                    </p>

                    <p className="mt-1 break-all font-mono text-xs">
                      {
                        execution
                          .executionResult
                          .planHash
                      }
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              Current limitation: the
              contract binds a nonzero
              evidence hash but does not yet
              verify an ERC-8004 Agent
              signature. This execution path
              is only for the local Anvil
              MVP.
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}