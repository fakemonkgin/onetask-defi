"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { useConnection } from "wagmi";

import { MigrationPlanCard } from "@/components/migration-plan-card";
import { getVaultState } from "@/lib/orchestrator-client";
import { anvilChain } from "@/lib/wagmi-config";

const DEMO_USER_ADDRESS =
  process.env
    .NEXT_PUBLIC_DEMO_USER_ADDRESS ??
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

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

function shortenAddress(
  address: string,
) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function VaultStateCard() {
  const connection =
    useConnection();

  const connectedAddress =
    connection.status ===
      "connected" &&
    connection.chainId ===
      anvilChain.id
      ? connection.address
      : undefined;

  const selectedUserAddress =
    connectedAddress ??
    DEMO_USER_ADDRESS;

  const isConnectedAnvilUser =
    connectedAddress !== undefined;

  const hasNetworkMismatch =
    connection.status ===
      "connected" &&
    connection.chainId !==
      anvilChain.id;

  const vaultStateQuery =
    useQuery({
      queryKey: [
        "vault-state",
        selectedUserAddress,
      ],

      queryFn: () =>
        getVaultState(
          selectedUserAddress,
        ),

      refetchOnWindowFocus: false,
    });

  const state =
    vaultStateQuery.data?.state;

  return (
    <section className="w-full rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
            Live contract state
          </p>

          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Vault migration preview
          </h2>

          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Reading the local Anvil
            contracts through the
            orchestrator.
          </p>
        </div>

        <button
          type="button"
          disabled={
            vaultStateQuery.isFetching
          }
          onClick={() => {
            void vaultStateQuery.refetch();
          }}
          className="shrink-0 rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {vaultStateQuery.isFetching
            ? "Refreshing..."
            : "Refresh state"}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
          Chain {anvilChain.id}
        </span>

        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {isConnectedAnvilUser
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

        {hasNetworkMismatch ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Wallet is not on Anvil
          </span>
        ) : null}
      </div>

      {vaultStateQuery.isPending ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Loading local contract state...
        </div>
      ) : null}

      {vaultStateQuery.isError ? (
        <div
          className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          role="alert"
        >
          {vaultStateQuery.error
            instanceof Error
            ? vaultStateQuery.error.message
            : "Unable to load the vault state."}
        </div>
      ) : null}

      {state ? (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Source
                  </p>

                  <h3 className="mt-1 text-lg font-semibold">
                    Mock Vault A
                  </h3>
                </div>

                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  User position
                </span>
              </div>

              <dl className="mt-6 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-zinc-500">
                    User shares
                  </dt>

                  <dd className="font-mono text-sm font-semibold">
                    {formatTokenAmount(
                      state.vaultA
                        .userShares,
                      state.asset.decimals,
                    )}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-zinc-500">
                    Total shares
                  </dt>

                  <dd className="font-mono text-sm font-semibold">
                    {formatTokenAmount(
                      state.vaultA
                        .totalSupply,
                      state.asset.decimals,
                    )}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-zinc-500">
                    Managed assets
                  </dt>

                  <dd className="font-mono text-sm font-semibold">
                    {formatTokenAmount(
                      state.vaultA
                        .totalAssets,
                      state.asset.decimals,
                    )}{" "}
                    {state.asset.symbol}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-zinc-500">
                    Contract
                  </dt>

                  <dd
                    className="font-mono text-sm"
                    title={
                      state.vaultA.address
                    }
                  >
                    {shortenAddress(
                      state.vaultA.address,
                    )}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Destination
                  </p>

                  <h3 className="mt-1 text-lg font-semibold">
                    Mock Vault B
                  </h3>
                </div>

                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  Simulated yield
                </span>
              </div>

              <dl className="mt-6 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-zinc-500">
                    User shares
                  </dt>

                  <dd className="font-mono text-sm font-semibold">
                    {formatTokenAmount(
                      state.vaultB
                        .userShares,
                      state.asset.decimals,
                    )}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-zinc-500">
                    Total shares
                  </dt>

                  <dd className="font-mono text-sm font-semibold">
                    {formatTokenAmount(
                      state.vaultB
                        .totalSupply,
                      state.asset.decimals,
                    )}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-zinc-500">
                    Managed assets
                  </dt>

                  <dd className="font-mono text-sm font-semibold">
                    {formatTokenAmount(
                      state.vaultB
                        .totalAssets,
                      state.asset.decimals,
                    )}{" "}
                    {state.asset.symbol}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-zinc-500">
                    Contract
                  </dt>

                  <dd
                    className="font-mono text-sm"
                    title={
                      state.vaultB.address
                    }
                  >
                    {shortenAddress(
                      state.vaultB.address,
                    )}
                  </dd>
                </div>
              </dl>
            </article>
          </div>

          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Current simulation
                </p>

                <h3 className="mt-1 text-lg font-semibold">
                  Migrate the complete Vault
                  A position
                </h3>
              </div>

              <span className="w-fit rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white">
                {state.migrationPreview
                  .executable
                  ? "Position detected"
                  : "No source position"}
              </span>
            </div>

            <dl className="mt-6 grid gap-5 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-zinc-500">
                  Source shares
                </dt>

                <dd className="mt-1 font-mono text-xl font-semibold">
                  {formatTokenAmount(
                    state.migrationPreview
                      .sourceShares,
                    state.asset.decimals,
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-sm text-zinc-500">
                  Assets redeemed
                </dt>

                <dd className="mt-1 font-mono text-xl font-semibold">
                  {formatTokenAmount(
                    state.migrationPreview
                      .assetsReceived,
                    state.asset.decimals,
                  )}{" "}
                  {state.asset.symbol}
                </dd>
              </div>

              <div>
                <dt className="text-sm text-zinc-500">
                  Destination shares
                </dt>

                <dd className="mt-1 font-mono text-xl font-semibold">
                  {formatTokenAmount(
                    state.migrationPreview
                      .destinationShares,
                    state.asset.decimals,
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <MigrationPlanCard
            key={selectedUserAddress}
            user={state.user}
            assetSymbol={
              state.asset.symbol
            }
            assetDecimals={
              state.asset.decimals
            }
            executable={
              state.migrationPreview
                .executable
            }
          />

          <div className="mt-6 rounded-2xl bg-zinc-100 p-5 dark:bg-zinc-900">
            <p className="text-sm font-semibold">
              Local Anvil environment only
            </p>

            <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              This state reflects the local
              development chain. Execution
              controls may create Anvil
              transactions using mock assets,
              but must never be used with a
              real-asset wallet.
            </p>

            <p className="mt-3 break-all font-mono text-xs text-zinc-500">
              TaskExecutor:{" "}
              {
                state.taskExecutor
                  .address
              }
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
}