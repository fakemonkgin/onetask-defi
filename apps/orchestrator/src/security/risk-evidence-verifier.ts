import {
  type Address,
  type Hash,
  type Hex,
  keccak256,
  stringToHex,
  verifyTypedData,
} from "viem";

export const
  RISK_EVIDENCE_SIGNATURE_DOMAIN = {
    name: "OneTask Risk Evidence",
    version: "1",
    chainId: 84_532,
  } as const;

export const
  RISK_EVIDENCE_SIGNATURE_TYPES = {
    RiskEvidenceAttestation: [
      {
        name: "agentWallet",
        type: "address",
      },

      {
        name: "requestHash",
        type: "bytes32",
      },

      {
        name: "planEvidenceHash",
        type: "bytes32",
      },

      {
        name: "evidenceHash",
        type: "bytes32",
      },
    ],
  } as const;

export const
  RISK_EVIDENCE_SIGNATURE_PRIMARY_TYPE =
    "RiskEvidenceAttestation" as const;

type RiskCheck = {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  detail: string;
};

export type SignedRiskEvidence = {
  schema:
    "onetask.risk-evidence.v1";

  agent: {
    name: string;
    version: string;
    walletAddress: Address;
  };

  requestHash: Hash;
  planEvidenceHash: Hash;

  decision:
    | "approve"
    | "reject";

  riskScore: number;

  riskLevel:
    | "low"
    | "medium"
    | "high";

  checks: RiskCheck[];
  evaluatedAt: string;

  signatureScheme:
    "eip712";

  evidenceHash: Hash;
  signature: Hex;
};

export type RiskEvidenceVerificationCode =
  | "REQUEST_HASH_MISMATCH"
  | "PLAN_HASH_MISMATCH"
  | "SIGNER_MISMATCH"
  | "EVIDENCE_HASH_MISMATCH"
  | "INVALID_SIGNATURE";

export type RiskEvidenceVerificationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      code:
        RiskEvidenceVerificationCode;
      message: string;
    };

function valuesEqual(
  firstValue: string,
  secondValue: string,
) {
  return (
    firstValue.toLowerCase() ===
    secondValue.toLowerCase()
  );
}

function canonicalize(
  value: unknown,
): string {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    const serializedValue =
      JSON.stringify(value);

    if (
      serializedValue === undefined
    ) {
      throw new Error(
        "Unable to canonicalize the supplied value.",
      );
    }

    return serializedValue;
  }

  if (Array.isArray(value)) {
    return `[${value
      .map((item) =>
        canonicalize(item),
      )
      .join(",")}]`;
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  const serializedEntries =
    Object.keys(record)
      .sort()
      .map((key) => {
        return `${JSON.stringify(
          key,
        )}:${canonicalize(
          record[key],
        )}`;
      });

  return `{${serializedEntries.join(
    ",",
  )}}`;
}

export function hashCanonicalValue(
  value: unknown,
) {
  return keccak256(
    stringToHex(
      canonicalize(value),
    ),
  );
}

export async function verifyRiskEvidence({
  evidence,
  expectedRequestHash,
  expectedPlanEvidenceHash,
  expectedSigner,
}: {
  evidence: SignedRiskEvidence;
  expectedRequestHash: Hash;
  expectedPlanEvidenceHash: Hash;
  expectedSigner: Address;
}): Promise<RiskEvidenceVerificationResult> {
  if (
    !valuesEqual(
      evidence.requestHash,
      expectedRequestHash,
    )
  ) {
    return {
      valid: false,

      code:
        "REQUEST_HASH_MISMATCH",

      message:
        "The Risk Agent request hash does not match the request sent by the Orchestrator.",
    };
  }

  if (
    !valuesEqual(
      evidence.planEvidenceHash,
      expectedPlanEvidenceHash,
    )
  ) {
    return {
      valid: false,

      code:
        "PLAN_HASH_MISMATCH",

      message:
        "The Risk Agent reviewed a different migration plan hash.",
    };
  }

  if (
    !valuesEqual(
      evidence.agent.walletAddress,
      expectedSigner,
    )
  ) {
    return {
      valid: false,

      code:
        "SIGNER_MISMATCH",

      message:
        "The Risk Agent declared an untrusted signing wallet.",
    };
  }

  const unsignedEvidence = {
    schema:
      evidence.schema,

    agent:
      evidence.agent,

    requestHash:
      evidence.requestHash,

    planEvidenceHash:
      evidence.planEvidenceHash,

    decision:
      evidence.decision,

    riskScore:
      evidence.riskScore,

    riskLevel:
      evidence.riskLevel,

    checks:
      evidence.checks,

    evaluatedAt:
      evidence.evaluatedAt,

    signatureScheme:
      evidence.signatureScheme,
  };

  const expectedEvidenceHash =
    hashCanonicalValue(
      unsignedEvidence,
    );

  if (
    !valuesEqual(
      evidence.evidenceHash,
      expectedEvidenceHash,
    )
  ) {
    return {
      valid: false,

      code:
        "EVIDENCE_HASH_MISMATCH",

      message:
        "The Risk Agent evidence hash does not match the returned evidence fields.",
    };
  }

  let signatureIsValid = false;

  try {
    signatureIsValid =
      await verifyTypedData({
        address:
          expectedSigner,

        domain:
          RISK_EVIDENCE_SIGNATURE_DOMAIN,

        types:
          RISK_EVIDENCE_SIGNATURE_TYPES,

        primaryType:
          RISK_EVIDENCE_SIGNATURE_PRIMARY_TYPE,

        message: {
          agentWallet:
            evidence.agent
              .walletAddress,

          requestHash:
            evidence.requestHash,

          planEvidenceHash:
            evidence
              .planEvidenceHash,

          evidenceHash:
            evidence.evidenceHash,
        },

        signature:
          evidence.signature,
      });
  } catch {
    signatureIsValid = false;
  }

  if (!signatureIsValid) {
    return {
      valid: false,

      code:
        "INVALID_SIGNATURE",

      message:
        "The Risk Agent evidence does not contain a valid EIP-712 signature from the trusted Agent wallet.",
    };
  }

  return {
    valid: true,
  };
}