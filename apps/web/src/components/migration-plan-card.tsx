"use client";

import { useMutation } from "@tanstack/react-query";
import { formatUnits } from "viem";

import { createMigrationPlan } from "@/lib/orchestrator-client";

const DEFAULT_MAX_LOSS_BPS = 50;

type MigrationPlanCardProps = {
  user: string;
  assetSymbol: string;
  assetDecimals: number;
  executable: boolean;
};

function trimFormattedUnits(value: string) {
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
    formatUnits(BigInt(value), decimals),
  );
}

function formatBasisPoints(
  basisPoints: number,
) {
  const percentage = basisPoints / 100;

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

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function MigrationPlanCard({
  user,
  assetSymbol,
  assetDecimals,
  executable,
}: MigrationPlanCardProps) {
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
            The orchestrator reads the current
            vault quote and applies a 0.5%
            maximum-loss constraint.
          </p>
        </div>

        <button
          type="button"
          disabled={
            !executable ||
            migrationPlanMutation.isPending
          }
          onClick={() => {
            migrationPlanMutation.mutate();
          }}
          className="shrink-0 rounded-full bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {migrationPlanMutation.isPending
            ? "Building plan..."
            : result
              ? "Regenerate plan"
              : "Generate 0.5% plan"}
        </button>
      </div>

      {!executable ? (
        <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          This account has no Vault A
          position, so no migration plan can
          be generated.
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
              {result.mode}
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
              Agent signature pending
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-blue-100 bg-white p-4 dark:border-blue-900 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Quoted assets
              </p>

              <p className="mt-2 font-mono text-lg font-semibold">
                {formatTokenAmount(
                  result.quote
                    .quotedAssetsReceived,
                  assetDecimals,
                )}{" "}
                {assetSymbol}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-4 dark:border-blue-900 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Minimum assets
              </p>

              <p className="mt-2 font-mono text-lg font-semibold">
                {formatTokenAmount(
                  result.plan
                    .minAssetsReceived,
                  assetDecimals,
                )}{" "}
                {assetSymbol}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-4 dark:border-blue-900 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Quoted B shares
              </p>

              <p className="mt-2 font-mono text-lg font-semibold">
                {formatTokenAmount(
                  result.quote
                    .quotedDestinationShares,
                  assetDecimals,
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-4 dark:border-blue-900 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Minimum B shares
              </p>

              <p className="mt-2 font-mono text-lg font-semibold">
                {formatTokenAmount(
                  result.plan
                    .minDestinationShares,
                  assetDecimals,
                )}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Execution constraints
              </p>

              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-zinc-500">
                    Source shares
                  </dt>

                  <dd className="font-mono">
                    {formatTokenAmount(
                      result.plan
                        .sourceShares,
                      assetDecimals,
                    )}
                  </dd>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <dt className="text-zinc-500">
                    Valid until
                  </dt>

                  <dd className="text-right font-medium">
                    {formatUnixTimestamp(
                      result.plan.deadline,
                    )}
                  </dd>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <dt className="text-zinc-500">
                    Observed block
                  </dt>

                  <dd className="font-mono">
                    {
                      result.quote
                        .observedBlockNumber
                    }
                  </dd>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <dt className="text-zinc-500">
                    Chain
                  </dt>

                  <dd className="font-mono">
                    {result.chainId}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Required approval
              </p>

              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-zinc-500">
                    Share token
                  </dt>

                  <dd
                    className="font-mono"
                    title={
                      result.approval.token
                    }
                  >
                    {shortenAddress(
                      result.approval.token,
                    )}
                  </dd>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <dt className="text-zinc-500">
                    Spender
                  </dt>

                  <dd
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
                  </dd>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <dt className="text-zinc-500">
                    Exact amount
                  </dt>

                  <dd className="font-mono">
                    {formatTokenAmount(
                      result.approval.amount,
                      assetDecimals,
                    )}{" "}
                    Vault A shares
                  </dd>
                </div>
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

              <div>
                <p className="text-xs text-zinc-500">
                  Nonce
                </p>

                <p className="mt-1 break-all font-mono text-xs">
                  {result.plan.nonce}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              No transaction has been sent
            </p>

            <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-300">
              These parameters are ready for
              review, but the wallet has not
              approved Vault A shares and the
              TaskExecutor has not been
              called.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}