import type {
  Address,
  Hash,
} from "viem";
import {
  privateKeyToAccount,
} from "viem/accounts";

import { environment } from "./config.js";

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

type RiskEvidenceHashes = {
  requestHash: Hash;
  planEvidenceHash: Hash;
  evidenceHash: Hash;
};

const signerAccount =
  privateKeyToAccount(
    environment
      .AGENT_SIGNER_PRIVATE_KEY,
  );

if (
  signerAccount.address !==
  environment.AGENT_SIGNER_ADDRESS
) {
  throw new Error(
    "AGENT_SIGNER_PRIVATE_KEY does not belong to AGENT_SIGNER_ADDRESS.",
  );
}

export const riskAgentSignerAddress:
  Address = signerAccount.address;

export function createRiskEvidenceSignatureMessage(
  hashes: RiskEvidenceHashes,
) {
  return {
    agentWallet:
      riskAgentSignerAddress,

    requestHash:
      hashes.requestHash,

    planEvidenceHash:
      hashes.planEvidenceHash,

    evidenceHash:
      hashes.evidenceHash,
  } as const;
}

export async function signRiskEvidence(
  hashes: RiskEvidenceHashes,
) {
  const message =
    createRiskEvidenceSignatureMessage(
      hashes,
    );

  return signerAccount.signTypedData({
    domain:
      RISK_EVIDENCE_SIGNATURE_DOMAIN,

    types:
      RISK_EVIDENCE_SIGNATURE_TYPES,

    primaryType:
      RISK_EVIDENCE_SIGNATURE_PRIMARY_TYPE,

    message,
  });
}