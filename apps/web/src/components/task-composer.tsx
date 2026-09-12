"use client";

import { useState, type FormEvent } from "react";

import {
  createTaskPreview,
  type TaskPreviewResponse,
} from "@/lib/orchestrator-client";

const EXAMPLE_INTENT =
  "Move 100 MockUSDC from Mock Vault A to Mock Vault B with a maximum loss of 0.5%.";

export function TaskComposer() {
  const [intent, setIntent] = useState(EXAMPLE_INTENT);
  const [previewResult, setPreviewResult] =
    useState<TaskPreviewResponse | null>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const normalizedIntent = intent.trim();
  const canPreview = normalizedIntent.length >= 12;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!canPreview || isLoading) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setPreviewResult(null);

    try {
      const result = await createTaskPreview(normalizedIntent);
      setPreviewResult(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
      );
    } finally {
      setIsLoading(false);
    }
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

      <form
        className="mt-6 space-y-4"
        onSubmit={handleSubmit}
        aria-busy={isLoading}
      >
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
              setPreviewResult(null);
              setErrorMessage(null);
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
            disabled={!canPreview || isLoading}
            className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {isLoading ? "Creating preview..." : "Preview task"}
          </button>
        </div>
      </form>

      {errorMessage ? (
        <div
          className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      {previewResult ? (
        <div
          className="mt-6 space-y-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white">
              {previewResult.preview.network}
            </span>

            <span className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold dark:border-emerald-800">
              {previewResult.preview.mode}
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Preview ID
            </p>

            <p className="mt-1 break-all font-mono text-xs">
              {previewResult.preview.id}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Captured intent
            </p>

            <p className="mt-2 text-sm leading-6">
              {previewResult.preview.intent}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Planned pipeline
            </p>

            <ol className="mt-3 space-y-2">
              {previewResult.pipeline.map((stage, index) => (
                <li
                  className="flex items-center gap-3 text-sm"
                  key={stage}
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-emerald-700 text-xs font-semibold text-white">
                    {index + 1}
                  </span>

                  <span>{stage.replaceAll("-", " ")}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Expires at{" "}
            {new Date(
              previewResult.preview.expiresAt,
            ).toLocaleTimeString()}
          </p>
        </div>
      ) : null}
    </section>
  );
}