"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";

import { getVaultState } from "@/lib/orchestrator-client";
import { anvilChain } from "@/lib/wagmi-config";

const DEMO_USER_ADDRESS =
  process.env.NEXT_PUBLIC_DEMO_USER_ADDRESS ??
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

function formatTokenAmount(
  rawValue: string,
  decimals: number,
) {
  if (decimals === 0) {
    return rawValue;
  }

  const paddedValue = rawValue.padStart(
    decimals + 1,
    "0",
  );

  const integerPart = paddedValue.slice(
    0,
    -decimals,
  );

  const fractionPart = paddedValue
    .slice(-decimals)
    .replace(/0+$/, "");

  return fractionPart.length > 0
    ? `${integerPart}.${fractionPart}`
    : integerPart;
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function VaultStateCard() {
  const connection = useConnection();

  const connectedAddress =
    connection.isConnected &&
    connection.chainId === anvilChain.id
      ? connection.address
      : undefined;

  const selectedUserAddress =
    connectedAddress ?? DEMO_USER_ADDRESS;

  const vaultStateQuery = useQuery({
    queryKey: [
      "vault-state",
      selectedUserAddress,
    ],
    queryFn: () =>
      getVaultState(selectedUserAddress),
    refetchOnWindowFocus: false,
  });

  const vaultState =
    vaultStateQuery.data?.state ?? null;

  const errorMessage =
    vaultStateQuery.error instanceof Error
      ? vaultStateQuery.error.message
      : vaultStateQuery.isError
        ? "Unable to load vault state."
        : null;

  const isLoading =
    vaultStateQuery.isPending ||
    vaultStateQuery.isFetching;

  const decimals =
    vaultState?.asset.decimals ?? 6;

  function handleRefresh() {
    void vaultStateQuery.refetch();
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
            Live contract state
          </p>

          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Vault migration preview
          </h2>

          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Reading the local Anvil contracts
            through the orchestrator.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="self-start rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {isLoading
            ? "Refreshing..."
            : "Refresh state"}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
          Chain{" "}
          {vaultState?.chainId ??
            anvilChain.id}
        </span>

        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          Read only
        </span>

        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
          {connectedAddress
            ? "Connected wallet"
            : "Demo account"}
        </span>

        <span
          className="rounded-full border border-zinc-300 px-3 py-1 font-mono text-xs dark:border-zinc-700"
          title={selectedUserAddress}
        >
          {shortenAddress(
            selectedUserAddress,
          )}
        </span>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorMessage}
        </div>
      ) : null}

      {isLoading && !vaultState ? (
        <div className="mt-6 rounded-2xl bg-zinc-100 p-6 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          Loading local vault state…
        </div>
      ) : null}

      {vaultState ? (
        <div className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Source
                  </p>

                  <h3 className="mt-1 font-semibold">
                    Mock Vault A
                  </h3>
                </div>

                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  User position
                </span>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">
                    User shares
                  </dt>

                  <dd className="font-mono font-medium">
                    {formatTokenAmount(
                      vaultState.vaultA
                        .userShares,
                      decimals,
                    )}
                  </dd>
                </div>

                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">
                    Managed assets
                  </dt>

                  <dd className="font-mono font-medium">
                    {formatTokenAmount(
                      vaultState.vaultA
                        .totalAssets,
                      decimals,
                    )}{" "}
                    {vaultState.asset.symbol}
                  </dd>
                </div>

                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">
                    Contract
                  </dt>

                  <dd
                    className="font-mono"
                    title={
                      vaultState.vaultA
                        .address
                    }
                  >
                    {shortenAddress(
                      vaultState.vaultA
                        .address,
                    )}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Destination
                  </p>

                  <h3 className="mt-1 font-semibold">
                    Mock Vault B
                  </h3>
                </div>

                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  Simulated yield
                </span>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">
                    Total shares
                  </dt>

                  <dd className="font-mono font-medium">
                    {formatTokenAmount(
                      vaultState.vaultB
                        .totalSupply,
                      decimals,
                    )}
                  </dd>
                </div>

                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">
                    Managed assets
                  </dt>

                  <dd className="font-mono font-medium">
                    {formatTokenAmount(
                      vaultState.vaultB
                        .totalAssets,
                      decimals,
                    )}{" "}
                    {vaultState.asset.symbol}
                  </dd>
                </div>

                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">
                    Contract
                  </dt>

                  <dd
                    className="font-mono"
                    title={
                      vaultState.vaultB
                        .address
                    }
                  >
                    {shortenAddress(
                      vaultState.vaultB
                        .address,
                    )}
                  </dd>
                </div>
              </dl>
            </article>
          </div>

          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Current simulation
                </p>

                <h3 className="mt-1 font-semibold">
                  Migrate the complete Vault
                  A position
                </h3>
              </div>

              <span className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white">
                {vaultState.migrationPreview
                  .executable
                  ? "Position detected"
                  : "No source position"}
              </span>
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-zinc-500">
                  Source shares
                </dt>

                <dd className="mt-1 font-mono text-lg font-semibold">
                  {formatTokenAmount(
                    vaultState
                      .migrationPreview
                      .sourceShares,
                    decimals,
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-zinc-500">
                  Assets redeemed
                </dt>

                <dd className="mt-1 font-mono text-lg font-semibold">
                  {formatTokenAmount(
                    vaultState
                      .migrationPreview
                      .assetsReceived,
                    decimals,
                  )}{" "}
                  {vaultState.asset.symbol}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-zinc-500">
                  Destination shares
                </dt>

                <dd className="mt-1 font-mono text-lg font-semibold">
                  {formatTokenAmount(
                    vaultState
                      .migrationPreview
                      .destinationShares,
                    decimals,
                  )}
                </dd>
              </div>
            </dl>
          </article>

          <div className="rounded-2xl bg-zinc-100 p-4 text-sm dark:bg-zinc-900">
            <p className="font-medium">
              No transaction has been sent
            </p>

            <p className="mt-1 text-zinc-500 dark:text-zinc-400">
              This is a read-only preview. No
              wallet signature or token approval
              has been requested.
            </p>

            <p className="mt-3 break-all font-mono text-xs text-zinc-500">
              TaskExecutor:{" "}
              {
                vaultState.taskExecutor
                  .address
              }
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}