/**
 * Demo data seeding.
 *
 * Rules:
 * - Seeding happens ONLY when the certificate registry key is entirely
 *   absent (first run in this browser) or when the user explicitly clicks
 *   "Restore demo data". Existing user records are never overwritten
 *   automatically.
 * - All identities and institutions are fictional, synthetic data — marked
 *   as demo content where it is shown.
 */

import { certificateFingerprint } from "./hash";
import { replaceRegistry } from "./certificates";
import { STORAGE_KEYS, notifySelf } from "./storage";
import type { Certificate } from "./types";
import type { DemoProfile } from "./types";

export const DEMO_PROFILES: DemoProfile[] = [
  {
    id: "admin-demo",
    role: "admin",
    name: "Dr. Meera Kulkarni",
    email: "registrar@northbridge-demo.edu",
    affiliation: "Northbridge Technical University (demo)",
  },
  {
    id: "student-demo",
    role: "student",
    name: "Aarav Sharma",
    email: "aarav.sharma@northbridge-demo.edu",
    affiliation: "B.Tech CSE, Class of 2025 (demo)",
  },
  {
    id: "student-demo-2",
    role: "student",
    name: "Diya Raman",
    email: "diya.raman@silverline-demo.edu",
    affiliation: "Cybersecurity Diploma (demo)",
  },
  {
    id: "verifier-demo",
    role: "verifier",
    name: "Priya Patel",
    email: "priya.patel@talentbridge-demo.com",
    affiliation: "TalentBridge Recruiters (demo)",
  },
];

const NB = "Northbridge Technical University";
const SLP = "Silverline Institute of Design & Analytics";

interface SeedCert {
  id: string;
  studentName: string;
  studentEmail?: string;
  course: string;
  institution: string;
  department?: string;
  registrationNumber?: string;
  grade?: string;
  issueDate: string;
  expiryDate?: string;
  issuerName: string;
  notes?: string;
  status?: "active";
  revokedAt?: string;
  revokedBy?: string;
}

const SEED_META: SeedCert[] = [
  {
    id: "CRT-2025-M88X2Q",
    studentName: "Aarav Sharma",
    studentEmail: "aarav.sharma@northbridge-demo.edu",
    course: "B.Tech Computer Science & Engineering",
    institution: NB,
    department: "School of Computing",
    registrationNumber: "NBU-CSE-2021-0417",
    grade: "First Class with Distinction",
    issueDate: "2025-06-20",
    expiryDate: "",
    issuerName: "Dr. Meera Kulkarni, Registrar",
    notes: "Convocation 2025. Demo record for the CertiChain sample registry.",
  },
  {
    id: "CRT-2025-K3PL4N",
    studentName: "Diya Raman",
    studentEmail: "diya.raman@silverline-demo.edu",
    course: "Postgraduate Diploma in Cybersecurity",
    institution: SLP,
    department: "Center for Information Security",
    registrationNumber: "SLP-CIS-2024-0098",
    grade: "A",
    issueDate: "2025-03-14",
    issuerName: "Prof. Nandita Bose, Dean of Programs",
    notes: "Completed with capstone project on phishing detection.",
  },
  {
    id: "CRT-2024-R9VC5D",
    studentName: "Kabir Nair",
    studentEmail: "kabir.nair@northbridge-demo.edu",
    course: "Expert Diploma in Cybersecurity",
    institution: NB,
    department: "School of Computing",
    registrationNumber: "NBU-DIP-2023-1122",
    grade: "First Class",
    issueDate: "2024-12-05",
    issuerName: "Dr. Meera Kulkarni, Registrar",
    revokedAt: "2025-08-02T10:15:00.000Z",
    revokedBy: "Registrar (demo revoke action)",
    notes: "For capsule demo purpose — for demonstration purposes. Revocation is a local demo state, not a blockchain operation.",
  },
  {
    id: "CRT-2025-V7HQ8B",
    studentName: "Sana Qureshi",
    studentEmail: "sana.qureshi@northbridge-demo.edu",
    course: "M.Sc Data Science",
    institution: NB,
    department: "School of Computing",
    registrationNumber: "NBU-DS-2023-0031",
    grade: "First Class with Distinction",
    issueDate: "2025-09-30",
    issuerName: "Dr. Meera Kulkarni, Registrar",
    notes: "Golden sample for the tamper demonstration: re-enter this certificate's fields on its verification page, change the grade, and the check turns TAMPERED.",
  },
];

/** Build full records (with fingerprints) from the seed metadata. */
export async function buildDemoRegistry(): Promise<Certificate[]> {
  const records: Certificate[] = [];
  for (const meta of SEED_META) {
    const metadata = {
      id: meta.id,
      studentName: meta.studentName,
      studentEmail: meta.studentEmail,
      course: meta.course,
      institution: meta.institution,
      department: meta.department,
      registrationNumber: meta.registrationNumber,
      grade: meta.grade,
      issueDate: meta.issueDate,
      expiryDate: meta.expiryDate,
      issuerName: meta.issuerName,
      notes: meta.notes,
    };
    const fingerprint = await certificateFingerprint(metadata);
    records.push({
      ...metadata,
      fingerprint,
      status: meta.revokedAt ? "revoked" : "active",
      issuedAt: new Date(`${meta.issueDate}T09:00:00.000Z`).toISOString(),
      issuedBy: "Demo seeder",
      revokedAt: meta.revokedAt,
      revokedBy: meta.revokedBy,
    });
  }
  return records;
}

/**
 * Seed demo data if (and only if) the registry key does not exist yet.
 * Returns true when seeding happened.
 */
export async function seedDemoRegistryIfEmpty(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    if (window.localStorage.getItem(STORAGE_KEYS.certificates) !== null) {
      return false; // existing user data — never overwrite automatically
    }
    const records = await buildDemoRegistry();
    return replaceRegistry(records);
  } catch {
    return false;
  }
}

/**
 * Explicitly restore demo data (user action). Replaces ONLY the CertiChain
 * certificate + verification-history keys inside our namespace. Returns
 * whether the write succeeded.
 */
export async function restoreDemoData(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const records = await buildDemoRegistry();
  const ok = replaceRegistry(records);
  if (ok) {
    // Clear verification history too, so the walkthrough starts clean.
    try {
      window.localStorage.removeItem(STORAGE_KEYS.verificationLogs);
      notifySelf(STORAGE_KEYS.verificationLogs);
    } catch {
      // ignore
    }
    notifySelf(STORAGE_KEYS.certificates);
  }
  return ok;
}

/** Demo metadata for the guided walkthrough (the "golden" active record). */
export const DEMO_ACTIVE_SAMPLE = SEED_META[0];
/** Demo record for the tampering walkthrough. */
export const DEMO_TAMPER_SAMPLE = SEED_META[3];
/** Demo record that ships pre-revoked. */
export const DEMO_REVOKED_SAMPLE = SEED_META[2];
