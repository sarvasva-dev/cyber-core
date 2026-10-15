/**
 * Storage-flow tests: simulated reload cycles through lib/storage-backed
 * flows — certificates persist, revocation persists, logs persist, seeding
 * never overwrites existing data, and restore-demo behaves as documented.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { issueCertificateAsync, revokeCertificate, replaceRegistry } from "@/lib/certificates";
import {
  eraseAppData,
  listAppDataKeys,
  readCertificates,
  readPreferences,
  readSession,
  readVerificationLogs,
  readJson,
  writeJson,
  STORAGE_KEYS,
} from "@/lib/storage";
import { logVerification } from "@/lib/verification";
import { buildDemoRegistry, seedDemoRegistryIfEmpty } from "@/lib/demo-data";
import { certificateFingerprint } from "@/lib/hash";

const FORM = {
  id: "CRT-2026-PERSIST",
  studentName: "Persist Test",
  studentEmail: "",
  course: "Persistence 101",
  institution: "Demo U",
  department: "",
  registrationNumber: "",
  grade: "",
  issueDate: "2026-01-01",
  expiryDate: "",
  issuerName: "Tester",
  notes: "",
};

describe("persistence across simulated reloads", () => {
  beforeEach(() => {
    // Each test starts with an empty "browser".
    (globalThis as { window?: { localStorage: { clear(): void } } }).window!.localStorage.clear();
  });

  it("certificates survive reload (write → fresh read)", async () => {
    const issued = await issueCertificateAsync(FORM, {});
    expect(issued.ok).toBe(true);

    // Fresh read = what a new page render performs.
    const reloaded = readCertificates();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].id).toBe("CRT-2026-PERSIST");
  });

  it("revocation survives reload", async () => {
    await issueCertificateAsync(FORM, {});
    const revoked = revokeCertificate("CRT-2026-PERSIST", "Test Registrar");
    expect(revoked.ok).toBe(true);

    const afterReload = readCertificates();
    expect(afterReload[0].status).toBe("revoked");
    expect(afterReload[0].revokedBy).toBe("Test Registrar");
    // Fingerprint survives revocation.
    expect(afterReload[0].fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verification logs survive reload", async () => {
    const entry = logVerification({
      certificateId: "CRT-2026-PERSIST",
      timestamp: new Date().toISOString(),
      method: "manual_id",
      result: "verified",
      message: "test",
    });
    expect(entry).not.toBeNull();
    expect(readVerificationLogs().map((l) => l.certificateId)).toContain("CRT-2026-PERSIST");
  });

  it("malformed stored data degrades to the fallback instead of crashing", () => {
    window.localStorage.setItem(STORAGE_KEYS.certificates, "{{{not json");
    expect(readCertificates()).toEqual([]);
  });

  it("storage data keys stay inside the app namespace only", async () => {
    window.localStorage.setItem("unrelated-site:key", "keep me");
    await issueCertificateAsync(FORM, {});
    const appKeys = listAppDataKeys();
    expect(appKeys.some((k) => k.startsWith("certichain:v1:"))).toBe(true);
    expect(appKeys.some((k) => k.startsWith("unrelated-site:"))).toBe(false);
    expect(window.localStorage.getItem("unrelated-site:key")).toBe("keep me");
  });

  it("erase touches only certichain keys", () => {
    window.localStorage.setItem("unrelated-site:key", "keep me");
    const removed = eraseAppData();
    expect(removed).toBeGreaterThanOrEqual(0);
    expect(window.localStorage.getItem("unrelated-site:key")).toBe("keep me");
    expect(listAppDataKeys()).toHaveLength(0);
  });
});

describe("demo seeding rules", () => {
  beforeEach(() => {
    (globalThis as { window?: { localStorage: { clear(): void } } }).window!.localStorage.clear();
  });

  it("seeds on first run and not afterwards", async () => {
    expect(await seedDemoRegistryIfEmpty()).toBe(true);
    const first = readCertificates().map((c) => c.id);
    expect(first.length).toBeGreaterThanOrEqual(4);

    // Add a user record; seeding again must not erase or overwrite it.
    await issueCertificateAsync({ ...FORM, id: "CRT-2026-USERREC" }, {});
    expect(await seedDemoRegistryIfEmpty()).toBe(false);
    const ids = readCertificates().map((c) => c.id);
    expect(ids).toContain("CRT-2026-USERREC");
    expect(ids).toEqual(expect.arrayContaining(first));
  });

  it("user edits are not overwritten by seeding", async () => {
    const demo = await buildDemoRegistry();
    expect(await seedDemoRegistryIfEmpty()).toBe(true);
    const revokedResult = revokeCertificate(demo[0].id, "User action");
    expect(revokedResult.ok).toBe(true);
    expect(await seedDemoRegistryIfEmpty()).toBe(false);
    const record = readCertificates().find((c) => c.id === demo[0].id);
    expect(record?.status).toBe("revoked");
  });

  it("restore-demo builds records whose fingerprints match own metadata", async () => {
    const demo = await buildDemoRegistry();
    expect(replaceRegistry(demo)).toBe(true);
    for (const record of readCertificates()) {
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

describe("session & preferences persistence", () => {
  beforeEach(() => {
    (globalThis as { window?: { localStorage: { clear(): void } } }).window!.localStorage.clear();
  });

  it("session round-trips; malformed data falls back", () => {
    expect(readSession()).toBeNull();
    writeJson(STORAGE_KEYS.session, { profileId: "admin-demo", startedAt: "t" });
    expect(readSession()?.profileId).toBe("admin-demo");

    window.localStorage.setItem(STORAGE_KEYS.session, "garbage");
    expect(readSession()).toBeNull();
  });

  it("preferences round-trip", () => {
    writeJson(STORAGE_KEYS.preferences, { walkthroughSeen: true });
    expect(readPreferences().walkthroughSeen).toBe(true);
  });
});
