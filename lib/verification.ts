/**
 * Verification engine.
 *
 * Decision order (documented again in the verify UI):
 *
 *   1. INVALID INPUT — missing/malformed supplied data (no certificate ID,
 *      or a file check against a record with no stored file fingerprint).
 *   2. NOT FOUND     — no record with that ID in THIS browser's registry.
 *   3. REVOKED       — record is revoked. Revocation beats every other
 *      result: a revoked certificate is NEVER shown as valid, even when the
 *      fingerprint still matches.
 *   4. TAMPERED      — supplied data (metadata or file bytes) produces a
 *      different SHA-256 than the stored fingerprint.
 *   5. VERIFIED      — fingerprint matches AND the record is active.
 *
 * Two hash domains exist and are never mixed:
 *   - metadata fingerprint  (canonical JSON → SHA-256) via
 *     `certificateFingerprint` — the value stored on the record.
 *   - raw document bytes    (file bytes → SHA-256) via `sha256FileBytes`
 *     compared against the record's optional `documentSha256`.
 */

import { certificateFingerprint, detectMetadataDifferences, sha256FileBytes } from "./hash";
import { normalizeMetadata } from "./certificates";
import {
  STORAGE_KEYS,
  notifySelf,
  readVerificationLogs,
  writeJson,
} from "./storage";
import type {
  Certificate,
  SuppliedCertificateInput,
  VerificationLog,
  VerificationMethod,
  VerificationResult,
} from "./types";
import type { IssueFormInput } from "./validation";

export interface MetadataComparison {
  suppliedFingerprint: string;
  storedFingerprint: string;
  matches: boolean;
  differingFields: string[];
}

/**
 * Compare supplied metadata against a stored certificate. Both sides go
 * through normalizeMetadata, so this is exactly the comparison the stored
 * fingerprint was computed with.
 */
export async function compareMetadata(
  suppliedInput: IssueFormInput,
  stored: Certificate
): Promise<MetadataComparison> {
  const suppliedMetadata = normalizeMetadata(suppliedInput);
  const suppliedFingerprint = await certificateFingerprint(suppliedMetadata);
  // Field-level differences (informational, drives the "why" messaging).
  // Compare METADATA-ONLY views on both sides — lifecycle fields like
  // status/issuedAt/fingerprint must not appear as "differences".
  const storedMetadata: Record<string, unknown> = {
    id: stored.id,
    studentName: stored.studentName,
    studentEmail: stored.studentEmail ?? "",
    course: stored.course,
    institution: stored.institution,
    department: stored.department ?? "",
    registrationNumber: stored.registrationNumber ?? "",
    grade: stored.grade ?? "",
    issueDate: stored.issueDate,
    expiryDate: stored.expiryDate ?? "",
    issuerName: stored.issuerName,
    notes: stored.notes ?? "",
  };
  const differingFields = detectMetadataDifferences(
    storedMetadata,
    suppliedMetadata as unknown as Record<string, unknown>
  );
  return {
    suppliedFingerprint,
    storedFingerprint: stored.fingerprint,
    matches: suppliedFingerprint === stored.fingerprint,
    differingFields,
  };
}

export interface VerificationInput {
  id: string;
  method: VerificationMethod;
  /** Full metadata entry when method is "metadata". */
  metadata?: IssueFormInput;
  /** Fresh raw-file hash when method is "file_upload". */
  uploadedFileSha256?: string;
}

export interface VerificationOutcome {
  result: VerificationResult | "registry_lookup";
  message: string;
  certificateId?: string;
  certificate?: Certificate;
  suppliedFingerprint?: string;
  expectedFingerprint?: string;
  differingFields: string[];
  checkedAt: string;
  tamperReady?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  id: "Certificate ID",
  studentName: "Student name",
  studentEmail: "Student email",
  course: "Course / degree",
  institution: "Institution",
  department: "Department",
  registrationNumber: "Registration number",
  grade: "Grade",
  issueDate: "Issue date",
  expiryDate: "Expiry date",
  issuerName: "Issuer",
  notes: "Notes",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function outcome(
  result: VerificationOutcome["result"],
  message: string,
  extra: Partial<VerificationOutcome> = {}
): VerificationOutcome {
  return {
    result,
    message,
    differingFields: [],
    checkedAt: new Date().toISOString(),
    ...extra,
  };
}

/** Main engine entry point. Pure with respect to storage; logging is separate. */
export async function verify(
  input: VerificationInput,
  registry: Certificate[]
): Promise<VerificationOutcome> {
  const id = input.id.trim().toUpperCase();

  if (!id) {
    return outcome(
      "invalid_input",
      "No certificate ID was provided. Enter a certificate ID, paste a verification link, or scan a QR code."
    );
  }

  const record = registry.find((cert) => cert.id.toUpperCase() === id);
  if (!record) {
    return outcome(
      "not_found",
      `No certificate with ID ${id} exists in this browser's local registry. This registry is per-browser; records issued on another device are not visible here.`,
      { certificateId: id }
    );
  }

  // REVOKED wins over everything else for this record.
  if (record.status === "revoked") {
    const revokedMessage =
      `Certificate ${record.id} was revoked` +
      (record.revokedAt ? ` on ${new Date(record.revokedAt).toLocaleString()}` : "") +
      (record.revokedBy ? ` by ${record.revokedBy}` : "") +
      ". It must not be treated as currently valid.";
    return outcome("revoked", revokedMessage, {
      certificateId: record.id,
      certificate: record,
      expectedFingerprint: record.fingerprint,
    });
  }

  if (input.method === "metadata" && input.metadata) {
    const comparison = await compareMetadata(input.metadata, record);
    if (comparison.matches) {
      return outcome(
        "verified",
        "Fingerprint matches the stored SHA-256 and the certificate is active in this registry.",
        {
          certificateId: record.id,
          certificate: record,
          suppliedFingerprint: comparison.suppliedFingerprint,
          expectedFingerprint: record.fingerprint,
        }
      );
    }
    // Mismatch: explain which fields the supplied data differs in.
    const differing = comparison.differingFields.filter((f) => f !== "id");
    const why = differing.length
      ? ` Supplied values differ from the stored record in: ${differing
          .map(fieldLabel)
          .join(", ")}.`
      : " The canonical serialization of the supplied data does not match the stored fingerprint.";
    return outcome(
      "tampered",
      `HASH MISMATCH — recomputed fingerprint ${comparison.suppliedFingerprint.slice(0, 16)}… does not match the stored fingerprint.${why}`,
      {
        certificateId: record.id,
        certificate: record,
        suppliedFingerprint: comparison.suppliedFingerprint,
        expectedFingerprint: record.fingerprint,
        differingFields: differing,
      }
    );
  }

  if (input.method === "file_upload" && input.uploadedFileSha256) {
    if (!record.documentSha256) {
      return outcome(
        "invalid_input",
        `Certificate ${record.id} has no stored original-document fingerprint, so raw-file comparison is not available for it. Use metadata verification instead.`,
        { certificateId: record.id, certificate: record }
      );
    }
    if (input.uploadedFileSha256 === record.documentSha256) {
      return outcome(
        "verified",
        "Uploaded file's raw-byte SHA-256 matches the original document fingerprint and the certificate is active.",
        {
          certificateId: record.id,
          certificate: record,
          suppliedFingerprint: input.uploadedFileSha256,
          expectedFingerprint: record.documentSha256,
        }
      );
    }
    return outcome(
      "tampered",
      "HASH MISMATCH — the uploaded file's raw bytes do not match the original document fingerprint recorded at issuance. The file has been modified or is not the same artifact.",
      {
        certificateId: record.id,
        certificate: record,
        suppliedFingerprint: input.uploadedFileSha256,
        expectedFingerprint: record.documentSha256,
      }
    );
  }

  // manual_id / qr_link without metadata: existence + status lookup only.
  // This is intentionally NOT reported as VERIFIED — no fingerprint was
  // compared. The UI offers the full metadata check as the next step.
  return outcome(
    "registry_lookup",
    `Record found and ACTIVE in this registry. This lookup confirmed existence and status only — no fingerprint has been compared yet. Enter the certificate's printed fields (or use the file check) to complete cryptographic verification.`,
    {
      certificateId: record.id,
      certificate: record,
      expectedFingerprint: record.fingerprint,
      tamperReady: true,
    }
  );
}

/** Persist one verification attempt. Fails silently (returns false) on quota errors. */
export function logVerification(
  log: Omit<VerificationLog, "id"> & { id?: string }
): VerificationLog | null {
  const entry: VerificationLog = {
    id: log.id ?? `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...log,
  } as VerificationLog;
  const logs = readVerificationLogs();
  const next = [entry, ...logs].slice(0, 500); // cap history size
  if (!writeJson(STORAGE_KEYS.verificationLogs, next)) return null;
  notifySelf(STORAGE_KEYS.verificationLogs);
  return entry;
}

/** Build a VerificationLog from an outcome (UI → storage bridge). */
export function logFromOutcome(
  input: VerificationInput,
  outcomeResult: VerificationOutcome
): Omit<VerificationLog, "id"> {
  return {
    certificateId: outcomeResult.certificateId,
    timestamp: outcomeResult.checkedAt,
    method: input.method,
    result: outcomeResult.result,
    message: outcomeResult.message,
    suppliedFingerprint: outcomeResult.suppliedFingerprint,
  };
}

/** Quick helpers for filtering the history list. */
export function isVerificationResult(value: string): value is VerificationResult {
  return ["verified", "tampered", "revoked", "not_found", "invalid_input"].includes(value);
}

export function emptySuppliedInput(id = ""): SuppliedCertificateInput {
  return {
    id,
    studentName: "",
    studentEmail: "",
    course: "",
    institution: "",
    department: "",
    registrationNumber: "",
    grade: "",
    issueDate: "",
    expiryDate: "",
    issuerName: "",
    notes: "",
  };
}
