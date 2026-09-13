"use client";

import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useSwitchChain,
} from "wagmi";

import { anvilChain } from "@/lib/wagmi-config";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const connection = useConnection();
  const connectors = useConnectors();

  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();

  const connector = connectors[0];

  if (
    !connection.isConnected ||
    !connection.address
  ) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={
            !connector || connect.isPending
          }
          onClick={() => {
            if (!connector) {
              return;
            }

            connect.mutate({
              connector,
              chainId: anvilChain.id,
            });
          }}
          className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {connect.isPending
            ? "Connecting..."
            : "Connect wallet"}
        </button>

        {connect.error ? (
          <p className="max-w-56 text-right text-xs text-red-600 dark:text-red-400">
            {connect.error.message}
          </p>
        ) : null}
      </div>
    );
  }

  if (connection.chainId !== anvilChain.id) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={switchChain.isPending}
          onClick={() => {
            switchChain.mutate({
              chainId: anvilChain.id,
            });
          }}
          className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {switchChain.isPending
            ? "Switching..."
            : "Switch to Anvil"}
        </button>

        {switchChain.error ? (
          <p className="max-w-56 text-right text-xs text-red-600 dark:text-red-400">
            {switchChain.error.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-2 font-mono text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
        title={connection.address}
      >
        {shortenAddress(connection.address)}
      </span>

      <button
        type="button"
        disabled={disconnect.isPending}
        onClick={() => {
          disconnect.mutate();
        }}
        className="rounded-full border border-zinc-300 px-3 py-2 text-xs font-medium transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {disconnect.isPending
          ? "Disconnecting..."
          : "Disconnect"}
      </button>
    </div>
  );
}