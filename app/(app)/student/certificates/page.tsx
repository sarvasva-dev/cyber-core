"use client";

/**
 * Student credential wallet. Ownership is derived from the shared registry by
 * matching the demo student profile (name or email) — no second data source.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { GraduationCap, Printer, Search, Share2 } from "lucide-react";
import { QRCodeImage } from "@/components/qr";
import { useStore, useToast } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  CopyButton,
  EmptyState,
  LoadingBlock,
  SectionTitle,
  Select,
  StatusBadge,
} from "@/components/ui";
import {
  certificatesForStudent,
  sortCertificates,
} from "@/lib/certificates";
import { formatDate, verificationUrl } from "@/lib/format";
import type { Certificate } from "@/lib/types";

export default function StudentWalletPage() {
  const { ready, certificates, logs, profile, storageOk } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "revoked">("all");

  const mine = useMemo(
    () => (ready && profile ? certificatesForStudent(certificates, profile) : []),
    [ready, certificates, profile]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortCertificates(
      mine.filter((c) => {
        if (status !== "all" && c.status !== status) return false;
        if (!q) return true;
        return (
          c.id.toLowerCase().includes(q) ||
          c.course.toLowerCase().includes(q) ||
          c.institution.toLowerCase().includes(q)
        );
      }),
      "recent"
    );
  }, [mine, query, status]);

  if (!ready) return <LoadingBlock label="Loading your wallet…" />;

  const relevantLogs = logs.filter((l) =>
    mine.some((c) => c.id === l.certificateId)
  );

  return (
    <div className="space-y-6">
      <SectionTitle
        title={profile ? `${profile.name}'s credential wallet` : "Credential wallet"}
        description={
          storageOk
            ? "Certificates issued to this demo profile appear here the moment they enter the registry."
            : undefined
        }
        actions={
          <Link href="/verify">
            <Button size="sm" variant="secondary">
              <Search className="h-4 w-4" /> Verify a certificate
            </Button>
          </Link>
        }
      />

      {!profile || profile.role !== "student" ? (
        <Card className="border-warn/40 text-sm text-warn">
          You are viewing as a {profile ? profile.role : "visitor"}. A student
          demo role shows certificates addressed to that profile —{" "}
          <Link href="/login" className="underline">choose a student role</Link>{" "}
          for the full wallet experience.
        </Card>
      ) : null}

      {ready && profile?.role === "student" && mine.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-8 w-8" />}
          title="No certificates yet for this profile"
          description={
            certificates.length === 0
              ? "The local registry is empty. Restore demo data from Settings → Data, or have an admin issue a certificate to this profile."
              : `The registry holds ${certificates.length} record(s), but none match "${profile.name}". Admin-issued certificates appear here when the student name or email matches.`
          }
          actions={
            <>
              <Link href="/settings"><Button size="sm">Settings → Data</Button></Link>
              <Link href="/admin/issue"><Button size="sm" variant="secondary">Issue as admin</Button></Link>
            </>
          }
        />
      ) : null}

      {mine.length > 0 ? (
        <>
          <Card className="!p-4">
            <div className="flex flex-wrap gap-2">
              <label className="relative min-w-52 flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint" aria-hidden="true" />
                <input
                  aria-label="Search my certificates"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by ID, course, institution…"
                  className="w-full rounded-lg border border-line bg-night-2 py-2 pl-9 pr-3 text-sm placeholder:text-faint focus:border-brand"
                />
              </label>
              <Select
                aria-label="Filter by status"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="w-36"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="revoked">Revoked</option>
              </Select>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {visible.map((cert) => (
              <WalletCard key={cert.id} cert={cert} certificateId={cert.id} />
            ))}
          </div>
        </>
      ) : null}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink">Checks on my certificates</h2>
        {relevantLogs.length === 0 ? (
          <p className="text-xs text-muted">
            No verification attempts touch your certificates yet. When an
            employer or you checks them, results are logged here.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft text-sm">
            {relevantLogs.slice(0, 6).map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      log.result === "verified" ? "good" : log.result === "tampered" ? "bad" : log.result === "revoked" ? "warn" : "neutral"
                    }
                  >
                    {log.result}
                  </Badge>
                  <span className="font-mono text-xs text-faint">{log.certificateId}</span>
                </div>
                <span className="text-xs text-faint">{new Date(log.timestamp).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function WalletCard({ cert, certificateId }: { cert: Certificate; certificateId: string }) {
  const url = verificationUrl(cert.id);
  const toast = useToast();

  async function share() {
    const data = {
      title: `CertiChain certificate — ${cert.studentName}`,
      text: `My ${cert.course} certificate`,
      url,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* cancelled → fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Verification link copied", variant: "success" });
    } catch {
      toast({ title: "Could not copy the link", variant: "error" });
    }
  }

  return (
    <Card className="flex gap-4">
      <div className="shrink-0 self-start">
        <QRCodeImage value={url} size={96} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="truncate font-mono text-xs text-brand-soft">{certificateId}</h2>
          <StatusBadge status={cert.status} />
        </div>
        <p className="mt-2 text-sm font-semibold leading-snug text-ink">{cert.course}</p>
        <p className="mt-0.5 text-xs text-muted">{cert.institution}</p>
        <p className="mt-1 text-xs text-faint">
          Issued {formatDate(cert.issueDate)} · {cert.grade ?? "no grade recorded"}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Link href={`/verify/${cert.id}`}>
            <Button size="sm" variant="secondary">Details &amp; verify</Button>
          </Link>
          <Link href={`/certificates/${cert.id}/print`}>
            <Button size="sm" variant="ghost"><Printer className="h-3.5 w-3.5" /> Print</Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={share}><Share2 className="h-3.5 w-3.5" /> Share</Button>
          <CopyButton value={url} label="Link" />
        </div>
      </div>
    </Card>
  );
}
