import type {
  RiskEvidence,
  X402Payment,
} from "@/lib/orchestrator-client";

const BASE_SEPOLIA_EXPLORER_URL =
  "https://sepolia.basescan.org";

type RiskEvidencePanelProps = {
  riskEvidence: RiskEvidence;
  planEvidenceHash: string;
  x402Payment: X402Payment;
};

function hashesEqual(
  firstHash: string,
  secondHash: string,
) {
  return (
    firstHash.toLowerCase() ===
    secondHash.toLowerCase()
  );
}

function shortenHexValue(
  value: string,
) {
  return `${value.slice(
    0,
    8,
  )}...${value.slice(-6)}`;
}

export function isRiskEvidenceExecutable(
  riskEvidence: RiskEvidence,
  planEvidenceHash: string,
  x402Payment: X402Payment,
) {
  const evidenceIsBound =
    hashesEqual(
      riskEvidence.planEvidenceHash,
      planEvidenceHash,
    );

  const everyCheckPassed =
    riskEvidence.checks.every(
      (check) => check.passed,
    );

  const paymentIsSettled =
    x402Payment.status ===
      "settled" &&
    x402Payment.success &&
    x402Payment.network ===
      "eip155:84532";

  return (
    riskEvidence.decision ===
      "approve" &&
    evidenceIsBound &&
    everyCheckPassed &&
    paymentIsSettled
  );
}

export function RiskEvidencePanel({
  riskEvidence,
  planEvidenceHash,
  x402Payment,
}: RiskEvidencePanelProps) {
  const evidenceIsBound =
    hashesEqual(
      riskEvidence.planEvidenceHash,
      planEvidenceHash,
    );

  const passedChecks =
    riskEvidence.checks.filter(
      (check) => check.passed,
    ).length;

  const everyCheckPassed =
    passedChecks ===
    riskEvidence.checks.length;

  const paymentIsSettled =
    x402Payment.status ===
      "settled" &&
    x402Payment.success &&
    x402Payment.network ===
      "eip155:84532";

  const executionApproved =
    isRiskEvidenceExecutable(
      riskEvidence,
      planEvidenceHash,
      x402Payment,
    );

  const decisionLabel =
    riskEvidence.decision ===
    "approve"
      ? "Approved"
      : "Rejected";

  const riskLevelLabel =
    riskEvidence.riskLevel
      .charAt(0)
      .toUpperCase() +
    riskEvidence.riskLevel.slice(1);

  const paymentExplorerUrl =
    `${BASE_SEPOLIA_EXPLORER_URL}/tx/${x402Payment.transaction}`;

  return (
    <section
      className={
        executionApproved
          ? "rounded-2xl border border-emerald-300 bg-emerald-50/70 p-5 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "rounded-2xl border border-red-300 bg-red-50/70 p-5 dark:border-red-900 dark:bg-red-950/30"
      }
      aria-label="Risk Agent evidence"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p
            className={
              executionApproved
                ? "text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
                : "text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400"
            }
          >
            Independent Risk Agent
          </p>

          <h4 className="mt-1 text-lg font-semibold">
            {riskEvidence.agent.name}
          </h4>

          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Version{" "}
            {riskEvidence.agent.version}
            {" · "}
            Evaluated{" "}
            {new Date(
              riskEvidence.evaluatedAt,
            ).toLocaleString()}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={
              executionApproved
                ? "rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full bg-red-700 px-3 py-1 text-xs font-semibold text-white"
            }
          >
            {decisionLabel}
          </span>

          <span className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
            {riskEvidence.signature === null
              ? "Unsigned"
              : "Signed"}
          </span>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              x402 paid service receipt
            </p>

            <h5 className="mt-1 font-semibold">
              Risk evaluation payment
            </h5>
          </div>

          <span
            className={
              paymentIsSettled
                ? "rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full bg-red-700 px-3 py-1 text-xs font-semibold text-white"
            }
          >
            {paymentIsSettled
              ? "Settled"
              : "Invalid receipt"}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          The orchestrator paid the Risk
          Agent through x402 before accepting
          this evidence. This service payment
          uses Base Sepolia test assets; the
          vault migration remains on local
          Anvil.
        </p>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-zinc-500">
              Payment network
            </dt>

            <dd className="mt-1 font-semibold">
              Base Sepolia
            </dd>

            <dd className="mt-1 font-mono text-xs text-zinc-500">
              {x402Payment.network}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-zinc-500">
              Buyer
            </dt>

            <dd
              className="mt-1 font-mono text-sm font-semibold"
              title={x402Payment.payer}
            >
              {shortenHexValue(
                x402Payment.payer,
              )}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-zinc-500">
              Settlement transaction
            </dt>

            <dd className="mt-1">
              <a
                href={paymentExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm font-semibold text-blue-700 underline decoration-blue-300 underline-offset-4 transition hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                title={
                  x402Payment.transaction
                }
              >
                {shortenHexValue(
                  x402Payment.transaction,
                )}
              </a>
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500">
            Decision
          </p>

          <p className="mt-2 text-lg font-semibold">
            {decisionLabel}
          </p>
        </div>

        <div className="rounded-xl border border-white/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500">
            Risk score
          </p>

          <p className="mt-2 font-mono text-lg font-semibold">
            {riskEvidence.riskScore}
            /100
          </p>
        </div>

        <div className="rounded-xl border border-white/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500">
            Risk level
          </p>

          <p className="mt-2 text-lg font-semibold">
            {riskLevelLabel}
          </p>
        </div>

        <div className="rounded-xl border border-white/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500">
            Checks passed
          </p>

          <p className="mt-2 font-mono text-lg font-semibold">
            {passedChecks}/
            {riskEvidence.checks.length}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold">
            Policy checks
          </p>

          <span
            className={
              everyCheckPassed
                ? "text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                : "text-xs font-semibold text-red-700 dark:text-red-400"
            }
          >
            {everyCheckPassed
              ? "All checks passed"
              : "One or more checks failed"}
          </span>
        </div>

        <ul className="mt-3 grid gap-3 lg:grid-cols-2">
          {riskEvidence.checks.map(
            (check) => (
              <li
                key={check.id}
                className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <span
                  className={
                    check.passed
                      ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-800 dark:bg-red-950 dark:text-red-300"
                  }
                  aria-hidden="true"
                >
                  {check.passed
                    ? "✓"
                    : "×"}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold">
                      {check.label}
                    </p>

                    <span
                      className={
                        check.passed
                          ? "shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                          : "shrink-0 text-xs font-semibold text-red-700 dark:text-red-400"
                      }
                    >
                      {check.passed
                        ? "Passed"
                        : `+${check.weight} risk`}
                    </span>
                  </div>

                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {check.detail}
                  </p>
                </div>
              </li>
            ),
          )}
        </ul>
      </div>

      <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">
            Evidence chain
          </p>

          <span
            className={
              evidenceIsBound
                ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-300"
            }
          >
            {evidenceIsBound
              ? "Plan hash matched"
              : "Plan hash mismatch"}
          </span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs text-zinc-500">
              Contract plan evidence hash
            </p>

            <p className="mt-1 break-all font-mono text-xs">
              {planEvidenceHash}
            </p>
          </div>

          <div>
            <p className="text-xs text-zinc-500">
              Agent-reviewed plan hash
            </p>

            <p className="mt-1 break-all font-mono text-xs">
              {
                riskEvidence
                  .planEvidenceHash
              }
            </p>
          </div>

          <div>
            <p className="text-xs text-zinc-500">
              Agent request hash
            </p>

            <p className="mt-1 break-all font-mono text-xs">
              {riskEvidence.requestHash}
            </p>
          </div>

          <div>
            <p className="text-xs text-zinc-500">
              Risk evidence hash
            </p>

            <p className="mt-1 break-all font-mono text-xs">
              {riskEvidence.evidenceHash}
            </p>
          </div>
        </div>

        <div
          className={
            riskEvidence.signature === null
              ? "mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
              : "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
          }
        >
          {riskEvidence.signature === null
            ? "This assessment is hash-bound but not yet signed by the Agent wallet."
            : `Agent signature: ${riskEvidence.signature}`}
        </div>
      </div>
    </section>
  );
}