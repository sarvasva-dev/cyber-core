"use client";

/**
 * Role-aware overview dashboard. Every metric is computed from actual local
 * records via computeMetrics — no fabricated statistics.
 */

import Link from "next/link";
import {
  Activity,
  BadgeCheck,
  FilePlus2,
  FolderOpen,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Donut, ResultBars } from "@/components/charts";
import { useStore } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  SectionTitle,
  StatCard,
  StatusBadge,
} from "@/components/ui";
import { RESULT_LABELS } from "@/lib/certificates";
import { formatDateTime } from "@/lib/format";
import { computeMetrics, countByResult } from "@/lib/metrics";
import { certificatesForStudent } from "@/lib/certificates";

const RESULT_COLORS: Record<string, string> = {
  verified: "#34d399",
  tampered: "#f87171",
  revoked: "#fbbf24",
  not_found: "#8ea3cb",
  invalid_input: "#5d6f95",
  registry_lookup: "#2f6bff",
};

function QuickActions({ role }: { role?: string }) {
  const actions = role === "admin"
    ? [
        { href: "/admin/issue", label: "Issue certificate", icon: <FilePlus2 className="h-4 w-4" /> },
        { href: "/admin/certificates", label: "Manage registry", icon: <FolderOpen className="h-4 w-4" /> },
        { href: "/verify", label: "Verify portal", icon: <ShieldCheck className="h-4 w-4" /> },
      ]
    : role === "student"
      ? [
          { href: "/student/certificates", label: "My certificates", icon: <BadgeCheck className="h-4 w-4" /> },
          { href: "/verify", label: "Verify a certificate", icon: <ShieldCheck className="h-4 w-4" /> },
        ]
      : [
          { href: "/verify", label: "Verification portal", icon: <Search className="h-4 w-4" /> },
          { href: "/history", label: "Check history", icon: <Activity className="h-4 w-4" /> },
        ];
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Link key={a.href} href={a.href}>
          <Button variant="secondary" size="sm">
            {a.icon} {a.label}
          </Button>
        </Link>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { ready, certificates, logs, profile, storageOk } = useStore();

  if (!ready) return <LoadingBlock label="Reading local registry…" />;

  const m = computeMetrics(certificates, logs);
  const isStudent = profile?.role === "student";
  const certs = isStudent && profile ? certificatesForStudent(certificates, profile) : certificates;
  const sorted = [...certs].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  const title = isStudent
    ? `Welcome, ${profile?.name}`
    : profile?.role === "admin"
      ? "Institution overview"
      : profile?.role === "verifier"
        ? "Verification overview"
        : "Overview — pick a demo role to get the curated experience";

  return (
    <div className="space-y-8">
      <SectionTitle title={title} description="All numbers come from records stored in this browser." />

      {!storageOk ? (
        <Card className="border-bad/40 text-sm text-bad">
          Browser storage is unavailable or blocked (private mode?). Data cannot
          be saved and will reset on refresh.
        </Card>
      ) : null}

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Issued certificates" value={m.totalIssued} tone="brand" icon={<FolderOpen className="h-5 w-5" />} />
        <StatCard label="Active" value={m.active} tone="good" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Revoked" value={m.revoked} tone="bad" icon={<ShieldAlert className="h-5 w-5" />} />
        <StatCard label="Verification checks" value={m.verificationAttempts} tone="neutral" icon={<Activity className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status distribution */}
        <Card>
          <h2 className="text-sm font-semibold text-ink">Registry status distribution</h2>
          <p className="mb-4 text-xs text-faint">Live from the local registry.</p>
          {m.totalIssued > 0 ? (
            <Donut
              slices={[
                { label: "Active", value: m.active, color: "#34d399" },
                { label: "Revoked", value: m.revoked, color: "#f87171" },
              ]}
            />
          ) : (
            <EmptyState title="No certificates yet" description="Issue the first certificate to populate this chart." />
          )}
        </Card>

        {/* Verification results */}
        <Card>
          <h2 className="text-sm font-semibold text-ink">Verification outcomes</h2>
          <p className="mb-4 text-xs text-faint">
            {m.successful} successful · {m.mismatches} hash mismatches · recorded locally.
          </p>
          {logs.length > 0 ? (
            <ResultBars
              rows={countByResult(logs).map(([result, count]) => ({
                label: RESULT_LABELS[result] ?? result,
                value: count,
                total: logs.length,
                color: RESULT_COLORS[result] ?? "#8ea3cb",
              }))}
            />
          ) : (
            <EmptyState
              title="No verification checks yet"
              description="Run a check from the verify portal — results will chart here."
              actions={<Link href="/verify"><Button size="sm">Open verify portal</Button></Link>}
            />
          )}
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <QuickActions role={profile?.role} />
      </Card>

      {/* Recent issuance */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Recent certificates</h2>
          <Link href={profile?.role === "admin" ? "/admin/certificates" : "/verify"} className="text-xs text-brand-soft hover:underline">
            View all →
          </Link>
        </div>
        {sorted.length === 0 ? (
          <EmptyState title="Empty registry" description="Demo records can be restored in Settings → Data." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {sorted.slice(0, 5).map((cert) => (
              <li key={cert.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {cert.studentName} · {cert.course}
                  </p>
                  <p className="truncate font-mono text-xs text-faint">{cert.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={cert.status} />
                  <span className="text-xs text-faint">{formatDateTime(cert.issuedAt)}</span>
                  <Link href={`/verify/${cert.id}`} className="text-xs text-brand-soft hover:underline">
                    Verify
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Recent checks */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Recent verification checks</h2>
          <Link href="/history" className="text-xs text-brand-soft hover:underline">
            Full history →
          </Link>
        </div>
        {logs.length === 0 ? (
          <EmptyState title="No checks recorded yet" />
        ) : (
          <ul className="divide-y divide-line-soft">
            {logs.slice(0, 5).map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge
                    tone={
                      log.result === "verified"
                        ? "good"
                        : log.result === "tampered"
                          ? "bad"
                          : log.result === "revoked"
                            ? "warn"
                            : "neutral"
                    }
                  >
                    {RESULT_LABELS[log.result] ?? log.result}
                  </Badge>
                  <span className="truncate font-mono text-xs text-faint">
                    {log.certificateId ?? "—"}
                  </span>
                </div>
                <span className="text-xs text-faint">{formatDateTime(log.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
