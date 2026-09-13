import { TaskComposer } from "@/components/task-composer";
import { VaultStateCard } from "@/components/vault-state-card";

const workflowSteps = [
  "Discover ERC-8004 registered agents",
  "Pay selected services through x402",
  "Verify evidence before onchain execution",
] as const;

export default function Home() {
  return (
    <main className="flex flex-1 bg-zinc-50 px-5 py-6 font-sans text-zinc-950 dark:bg-black dark:text-zinc-50 sm:px-8 sm:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold tracking-tight">
              OneTask DeFi
            </p>

            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Verified agent-assisted execution
            </p>
          </div>

          <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium dark:border-zinc-700">
            Prototype v0.1
          </span>
        </header>

        <section className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              x402 × ERC-8004
            </p>

            <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Describe one outcome. Get one
              verifiable DeFi plan.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              OneTask coordinates specialized
              agents, collects signed evidence, and
              lets the user approve a constrained
              execution plan.
            </p>

            <ol className="mt-8 space-y-4">
              {workflowSteps.map(
                (step, index) => (
                  <li
                    className="flex items-center gap-4"
                    key={step}
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-white dark:text-black">
                      {index + 1}
                    </span>

                    <span className="text-sm font-medium">
                      {step}
                    </span>
                  </li>
                ),
              )}
            </ol>
          </div>

          <TaskComposer />
        </section>

        <VaultStateCard />
      </div>
    </main>
  );
}