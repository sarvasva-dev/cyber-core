/** Dashboard metrics derived from real local records (pure functions). */

import type { Certificate, LoggableResult, VerificationLog } from "./types";

export interface DashboardMetrics {
  totalIssued: number;
  active: number;
  revoked: number;
  verificationAttempts: number;
  successful: number;
  mismatches: number;
  revokedResults: number;
  notFound: number;
}

export function computeMetrics(
  certificates: Certificate[],
  logs: VerificationLog[]
): DashboardMetrics {
  const active = certificates.filter((c) => c.status === "active").length;
  return {
    totalIssued: certificates.length,
    active,
    revoked: certificates.length - active,
    verificationAttempts: logs.length,
    successful: logs.filter((l) => l.result === "verified").length,
    mismatches: logs.filter((l) => l.result === "tampered").length,
    revokedResults: logs.filter((l) => l.result === "revoked").length,
    notFound: logs.filter((l) => l.result === "not_found").length,
  };
}

/** Count logs by result, ordered for the results chart. */
export function countByResult(logs: VerificationLog[]): [LoggableResult, number][] {
  const counts = new Map<LoggableResult, number>();
  for (const log of logs) counts.set(log.result, (counts.get(log.result) ?? 0) + 1);
  const order: LoggableResult[] = [
    "verified",
    "tampered",
    "revoked",
    "not_found",
    "invalid_input",
    "registry_lookup",
  ];
  return order
    .filter((key) => (counts.get(key) ?? 0) > 0)
    .map((key) => [key, counts.get(key) ?? 0]);
}
