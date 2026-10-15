/**
 * Domain-level unit tests: hashing/canonicalization, the verification engine,
 * registry logic, validation, metrics, and demo-data integrity.
 */

import { describe, expect, it } from "vitest";
import {
  canonicalCertificatePayload,
  certificateFingerprint,
  detectMetadataDifferences,
  isValidFingerprint,
  sha256FileBytes,
  sha256Hex,
  stableStringify,
} from "@/lib/hash";
import {
  findCertificate,
  issueCertificateAsync,
  proposeCertificateId,
  revokeCertificate,
  restoreCertificate,
} from "@/lib/certificates";
import { verify } from "@/lib/verification";
import { validateIssueForm, isValidIsoDate } from "@/lib/validation";
import { buildDemoRegistry } from "@/lib/demo-data";
import { computeMetrics } from "@/lib/metrics";
import type { Certificate, VerificationLog } from "@/lib/types";
import type { IssueFormInput } from "@/lib/validation";

const BASE_FORM: IssueFormInput = {
  id: "CRT-2026-TEST01",
  studentName: "Ajay Verma",
  studentEmail: "ajay.verma@demo.edu",
  course: "B.Tech Computer Science",
  institution: "Northbridge Technical University",
  department: "",
  registrationNumber: "",
  grade: "First Class with Distinction",
  issueDate: "2026-05-10",
  expiryDate: "",
  issuerName: "Dr. Test Registrar",
  notes: "",
};

function formWith(overrides: Partial<IssueFormInput>): IssueFormInput {
  return { ...BASE_FORM, ...overrides };
}

describe("SHA-256 via Web Crypto", () => {
  it("produces a 64-character lowercase hex fingerprint", async () => {
    const digest = await sha256Hex("abc");
    expect(digest).toHaveLength(64);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("matches the known SHA-256 vector for 'abc'", async () => {
    const digest = await sha256Hex("abc");
    expect(digest).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("hashes raw bytes identically to the string form", async () => {
    const bytes = new TextEncoder().encode("abc");
    const fromBytes = await sha256FileBytes(bytes);
    expect(fromBytes).toBe(await sha256Hex("abc"));
  });

  it("validates fingerprint shape", () => {
    expect(isValidFingerprint("a".repeat(64))).toBe(true);
    expect(isValidFingerprint("A".repeat(64))).toBe(false); // uppercase rejected
    expect(isValidFingerprint("abc123")).toBe(false);
    expect(isValidFingerprint(undefined)).toBe(false);
  });
});

describe("canonical serialization & fingerprints", () => {
  it("is stable against property insertion order", async () => {
    const meta = {
      id: "CRT-1",
      studentName: "Asha",
      course: "Test Course",
      institution: "Demo U",
      issueDate: "2026-01-01",
      issuerName: "Registrar",
    };
    const reordered = {
      issuerName: "Registrar",
      issueDate: "2026-01-01",
      institution: "Demo U",
      course: "Test Course",
      studentName: "Asha",
      id: "CRT-1",
    };
    expect(canonicalCertificatePayload(meta as never)).toBe(
      canonicalCertificatePayload(reordered as never)
    );
  });

  it("omits empty strings and undefined fields", () => {
    const payload = stableStringify({ a: "", b: undefined, c: "x", d: null });
    expect(payload).toBe('{"c":"x"}');
  });

  it("identical canonical data yields identical fingerprints", async () => {
    const a = await certificateFingerprint({
      id: "CRT-2",
      studentName: "NIkhil Rao",
      course: "M.Sc Physics",
      institution: "Demo U",
      issueDate: "2025-11-02",
      issuerName: "Dean",
    });
    const b = await certificateFingerprint({
      institution: "Demo U",
      id: "CRT-2",
      studentName: "NIkhil Rao",
      issuerName: "Dean",
      issueDate: "2025-11-02",
      course: "M.Sc Physics",
    });
    expect(a).toBe(b);
  });

  it("a changed field produces a different fingerprint", async () => {
    const a = await certificateFingerprint({
      id: "CRT-3",
      studentName: "Rohit",
      course: "B.Com",
      institution: "Demo U",
      issueDate: "2025-08-08",
      issuerName: "HOD",
    });
    const b = await certificateFingerprint({
      id: "CRT-3",
      studentName: "Rohit",
      course: "B.com", // altered case/letter
      institution: "Demo U",
      issueDate: "2025-08-08",
      issuerName: "HOD",
    });
    expect(a).not.toBe(b);
  });

  it("lists differing metadata fields", () => {
    const differences = detectMetadataDifferences(
      { grade: "First Class", studentName: "Rohit" },
      { grade: "Third Class", studentName: "Rohit" }
    );
    expect(differences).toEqual(["grade"]);
  });
});

describe("registry: issuance & duplicate protection", () => {
  it("issues a certificate with a valid fingerprint and active status", async () => {
    const result = await issueCertificateAsync(BASE_FORM, {
      registry: [],
      issuedBy: "Test Admin",
    });
    expect(result.ok).toBe(true);
    const cert = result.certificate as Certificate;
    expect(cert.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(cert.status).toBe("active");
    expect(cert.id).toBe("CRT-2026-TEST01");
  });

  it("rejects duplicate certificate IDs", async () => {
    const first = await issueCertificateAsync(BASE_FORM, { registry: [] });
    expect(first.ok).toBe(true);
    const duplicate = await issueCertificateAsync(formWith({ studentName: "Someone Else" }), {
      registry: first.ok ? [first.certificate as Certificate] : [],
    });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.errorKind).toBe("duplicate_id");
  });

  it("different IDs never overwrite each other", async () => {
    const a = await issueCertificateAsync(BASE_FORM, { registry: [] });
    const b = await issueCertificateAsync(
      formWith({ id: "CRT-2026-TEST02" }),
      { registry: a.ok ? [a.certificate as Certificate] : [] }
    );
    expect(b.ok).toBe(true);
    const registry = [a.certificate as Certificate, b.certificate as Certificate];
    expect(findCertificate(registry, "CRT-2026-TEST01")?.id).toBe("CRT-2026-TEST01");
    expect(findCertificate(registry, "crt-2026-test02")?.id).toBe("CRT-2026-TEST02"); // case-insensitive
    expect(registry).toHaveLength(2);
  });

  it("proposes collision-free IDs", () => {
    const existing: Certificate[] = [
      { id: proposeCertificateId([]) } as Certificate,
    ];
    const proposed = proposeCertificateId(existing);
    expect(proposed).toMatch(/^CRT-\d{4}-[A-Z2-9]{6}$/);
    expect(existing.some((c) => c.id === proposed)).toBe(false);
  });
});

describe("verification engine", () => {
  let registry: Certificate[];

  it("prepares an issued certificate for engine tests", async () => {
    const result = await issueCertificateAsync(BASE_FORM, { registry: [] });
    expect(result.ok).toBe(true);
    registry = [result.certificate as Certificate];
  });

  it("returns VERIFIED for intact re-entered metadata", async () => {
    const outcome = await verify(
      { id: "CRT-2026-TEST01", method: "metadata", metadata: BASE_FORM },
      registry
    );
    expect(outcome.result).toBe("verified");
    expect(outcome.certificate?.id).toBe("CRT-2026-TEST01");
  });

  it("returns TAMPERED (hash mismatch) for modified metadata", async () => {
    const outcome = await verify(
      {
        id: "CRT-2026-TEST01",
        method: "metadata",
        metadata: formWith({ grade: "Second Class" }),
      },
      registry
    );
    expect(outcome.result).toBe("tampered");
    expect(outcome.suppliedFingerprint).not.toBe(outcome.expectedFingerprint);
  });

  it("a REVOKED certificate never reports VERIFIED, even with matching hash", async () => {
    const result = revokeCertificate("CRT-2026-TEST01", "Tail Coordinator", {
      registry,
    });
    expect(result.ok).toBe(true);
    const revokedRecord = result.certificate as Certificate;

    const outcome = await verify(
      { id: "CRT-2026-TEST01", method: "metadata", metadata: BASE_FORM },
      [revokedRecord]
    );
    expect(outcome.result).toBe("revoked");

    // Also via bare ID lookup.
    const lookup = await verify(
      { id: "CRT-2026-TEST01", method: "manual_id" },
      [revokedRecord]
    );
    expect(lookup.result).toBe("revoked");
  });

  it("returns NOT_FOUND for unknown IDs", async () => {
    const outcome = await verify(
      { id: "CRT-9999-NOPE", method: "manual_id" },
      registry
    );
    expect(outcome.result).toBe("not_found");
  });

  it("returns INVALID_INPUT when no ID is supplied", async () => {
    const outcome = await verify({ id: "   ", method: "manual_id" }, registry);
    expect(outcome.result).toBe("invalid_input");
  });

  it("returns a registry_lookup (never VERIFIED) for bare ID checks", async () => {
    const active = await issueCertificateAsync(formWith({ id: "CRT-2026-LOOKUP" }), {
      registry: [],
    });
    expect(active.ok).toBe(true);
    const outcome = await verify(
      { id: "CRT-2026-LOOKUP", method: "manual_id" },
      [active.certificate as Certificate]
    );
    expect(outcome.result).toBe("registry_lookup");
  });

  it("re-activating a revoked demo record restores verification", async () => {
    const issued = await issueCertificateAsync(formWith({ id: "CRT-2026-RESTORE" }), { registry: [] });
    expect(issued.ok).toBe(true);
    const record = issued.certificate as Certificate;
    const revoked = revokeCertificate("CRT-2026-RESTORE", "demo", { registry: [record] });
    expect(revoked.ok).toBe(true);
    const restored = restoreCertificate("CRT-2026-RESTORE", { registry: [revoked.certificate as Certificate] });
    expect(restored.ok).toBe(true);
    expect((restored.certificate as Certificate).status).toBe("active");
    expect(restoreCertificate("CRT-2026-RESTORE", { registry }).ok).toBe(false); // active → nothing to restore
  });

  it("double revocation is rejected", async () => {
    const issued = await issueCertificateAsync(formWith({ id: "CRT-2026-DOUBLE" }), { registry: [] });
    expect(issued.ok).toBe(true);
    const first = revokeCertificate("CRT-2026-DOUBLE", "demo", { registry: [issued.certificate as Certificate] });
    expect(first.ok).toBe(true);
    const second = revokeCertificate("CRT-2026-DOUBLE", "demo", { registry: [first.certificate as Certificate] });
    expect(second.ok).toBe(false);
  });
});

describe("validation", () => {
  it("accepts a complete valid form", () => {
    const errors = validateIssueForm(BASE_FORM);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("flags missing required fields and bad emails", () => {
    const errors = validateIssueForm(formWith({ studentName: " ", studentEmail: "nope" }));
    expect(errors.studentName).toBeTruthy();
    expect(errors.studentEmail).toBeTruthy();
  });

  it("rejects expiry before issue date", () => {
    const errors = validateIssueForm(
      formWith({ issueDate: "2026-05-10", expiryDate: "2026-01-01" })
    );
    expect(errors.expiryDate).toBeTruthy();
  });

  it("validates ISO dates properly", () => {
    expect(isValidIsoDate("2026-02-29")).toBe(false); // 2026 not a leap year
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
  });
});

describe("dashboard metrics", () => {
  it("counts real records only", () => {
    const certs = [
      { id: "a", status: "active" },
      { id: "b", status: "active" },
      { id: "c", status: "revoked" },
    ] as Certificate[];
    const logs = [
      { result: "verified" },
      { result: "tampered" },
      { result: "verified" },
      { result: "not_found" },
    ] as VerificationLog[];
    const metrics = computeMetrics(certs, logs);
    expect(metrics.totalIssued).toBe(3);
    expect(metrics.active).toBe(2);
    expect(metrics.revoked).toBe(1);
    expect(metrics.verificationAttempts).toBe(4);
    expect(metrics.successful).toBe(2);
    expect(metrics.mismatches).toBe(1);
  });
});

describe("demo data integrity", () => {
  it("builds a registry with valid fingerprints and a revoked sample", async () => {
    const records = await buildDemoRegistry();
    expect(records.length).toBeGreaterThanOrEqual(4);
    expect(records.every((r) => isValidFingerprint(r.fingerprint))).toBe(true);
    const revoked = records.find((r) => r.status === "revoked");
    expect(revoked).toBeDefined();
    expect(revoked?.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("each demo record's fingerprint matches its own metadata", async () => {
    const records = await buildDemoRegistry();
    for (const record of records) {
      // Recompute over the metadata subset only (the hash payload excludes
      // lifecycle fields like status/issuedAt by design).
      const recomputed = await certificateFingerprint({
        id: record.id,
        studentName: record.studentName,
        studentEmail: record.studentEmail ?? "",
        course: record.course,
        institution: record.institution,
        department: record.department ?? "",
        registrationNumber: record.registrationNumber ?? "",
        grade: record.grade ?? "",
        issueDate: record.issueDate,
        expiryDate: record.expiryDate ?? "",
        issuerName: record.issuerName,
        notes: record.notes ?? "",
      });
      expect(recomputed).toBe(record.fingerprint);
    }
  });
});
