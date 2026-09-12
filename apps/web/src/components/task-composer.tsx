"use client";

import { useState, type FormEvent } from "react";

const EXAMPLE_INTENT =
  "Move 100 MockUSDC from Mock Vault A to Mock Vault B with a maximum loss of 0.5%.";

export function TaskComposer() {
  const [intent, setIntent] = useState(EXAMPLE_INTENT);
  const [submittedIntent, setSubmittedIntent] = useState<string | null>(null);

  const normalizedIntent = intent.trim();
  const canPreview = normalizedIntent.length >= 12;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canPreview) {
      return;
    }

    setSubmittedIntent(normalizedIntent);
  }

  return (
    <section className="w-full rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            New task
          </p>

          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            What should the agents accomplish?
          </h2>
        </div>

        <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Local / testnet
        </span>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="intent">
            DeFi intent
          </label>

          <textarea
            id="intent"
            name="intent"
            value={intent}
            onChange={(event) => {
              setIntent(event.target.value);
              setSubmittedIntent(null);
            }}
            aria-describedby="intent-help"
            className="min-h-36 w-full resize-y rounded-2xl border border-zinc-300 bg-transparent p-4 text-base leading-7 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-700"
            placeholder="Describe one outcome using test assets..."
            required
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            id="intent-help"
            className="text-sm text-zinc-500 dark:text-zinc-400"
          >
            No transaction will be sent at this stage.
          </p>

          <button
            type="submit"
            disabled={!canPreview}
            className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Preview task
          </button>
        </div>
      </form>

      {submittedIntent ? (
        <div
          className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40"
          aria-live="polite"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Captured intent
          </p>

          <p className="mt-2 text-sm leading-6">{submittedIntent}</p>
        </div>
      ) : null}
    </section>
  );
}