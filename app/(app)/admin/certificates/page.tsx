"use client";

/**
 * Admin certificate management: search/filter/sort the registry, open
 * details, revoke with confirmation, export records as JSON.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Eye, FolderOpen, Search, ShieldOff } from "lucide-react";
import { useStore, useToast } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  Modal,
  SectionTitle,
  Select,
  StatusBadge,
} from "@/components/ui";
import { sortCertificates } from "@/lib/certificates";
import { formatDate } from "@/lib/format";
import type { Certificate, VerificationLog } from "@/lib/types";

export default function AdminCertificatesPage() {
  const { ready, certificates, logs, profile, revoke } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "revoked">("all");
  const [sort, setSort] = useState<"recent" | "oldest" | "student" | "status">("recent");
  const [target, setTarget] = useState<Certificate | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = certificates.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (!q) return true;
      return (
        c.id.toLowerCase().includes(q) ||
        c.studentName.toLowerCase().includes(q) ||
        c.course.toLowerCase().includes(q) ||
        c.institution.toLowerCase().includes(q)
      );
    });
    return sortCertificates(matched, sort);
  }, [certificates, query, status, sort]);

  if (!ready) return <LoadingBlock label="Loading registry…" />;

  const checksByCert = new Map<string, VerificationLog[]>();
  for (const log of logs) {
    if (log.certificateId) {
      const list = checksByCert.get(log.certificateId) ?? [];
      list.push(log);
      checksByCert.set(log.certificateId, list);
    }
  }

  async function exportJson() {
    try {
      const data = JSON.stringify(filtered, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "certichain-registry.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", description: "The browser blocked the download.", variant: "error" });
    }
  }

  function confirmRevoke() {
    if (!target) return;
    const actor = profile ? `${profile.name} (demo revoke)` : "Registrar (demo revoke)";
    const result = revoke(target.id, actor);
    setTarget(null);
    if (result.ok) {
      toast({
        title: "Certificate revoked",
        description: `${result.certificate?.id} is now revoked in this registry.`,
        variant: "success",
      });
    } else {
      toast({ title: "Revocation failed", description: result.error, variant: "error" });
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Manage certificates"
        description={`${certificates.length} record${certificates.length === 1 ? "" : "s"} in this browser’s registry.`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportJson}>
              <Download className="h-4 w-4" /> Export JSON
            </Button>
            <Link href="/admin/issue">
              <Button size="sm">Issue new</Button>
            </Link>
          </>
        }
      />

      <Card className="!p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-52 flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint" aria-hidden="true" />
            <input
              aria-label="Search certificates"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ID, student, course, institution…"
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
          <Select
            aria-label="Sort records"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="w-40"
          >
            <option value="recent">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="student">Student A–Z</option>
            <option value="status">By status</option>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-8 w-8" />}
          title={certificates.length === 0 ? "The registry is empty" : "No certificates match this filter"}
          description={certificates.length === 0 ? "Restore demo data from Settings → Data, or issue the first certificate." : undefined}
          actions={
            certificates.length === 0 ? (
              <Link href="/admin/issue"><Button size="sm">Issue a certificate</Button></Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Certificates in the local registry</caption>
              <thead>
                <tr className="border-b border-line bg-surface-2/50 text-left text-xs uppercase tracking-wide text-faint">
                  <th scope="col" className="px-4 py-3 font-medium">Certificate</th>
                  <th scope="col" className="px-4 py-3 font-medium">Student</th>
                  <th scope="col" className="px-4 py-3 font-medium">Issued</th>
                  <th scope="col" className="px-4 py-3 font-medium">Checks</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {filtered.map((cert) => (
                  <tr key={cert.id} className="hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/certificates/${cert.id}`} className="font-mono text-xs text-brand-soft hover:underline">
                        {cert.id}
                      </Link>
                      <p className="mt-0.5 max-w-56 truncate text-xs text-muted">{cert.course}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-ink">{cert.studentName}</p>
                      <p className="text-xs text-faint">{cert.institution}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {formatDate(cert.issueDate)}
                      <p className="text-faint">{cert.issuerName}</p>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-muted">
                      {(checksByCert.get(cert.id) ?? []).length}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={cert.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Link href={`/admin/certificates/${cert.id}`}>
                          <Button variant="ghost" size="sm" aria-label={`Open ${cert.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {cert.status === "active" ? (
                          <Button variant="danger" size="sm" onClick={() => setTarget(cert)} aria-label={`Revoke ${cert.id}`}>
                            <ShieldOff className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Badge tone="bad">{formatDate(cert.revokedAt ?? "")}</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={`Revoke ${target?.id ?? ""}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmRevoke}>
              <ShieldOff className="h-4 w-4" /> Revoke certificate
            </Button>
          </>
        }
      >
        <p>
          Revocation changes the record’s status in this browser’s registry. The
          fingerprint and metadata are kept — every later check of this
          certificate will report <strong>REVOKED</strong>, even when the hash
          still matches.
        </p>
        <p className="mt-2 text-xs text-faint">
          This is a local demo action recorded with your demo identity — it does
          not write to a blockchain or affect other devices.
        </p>
      </Modal>
    </div>
  );
}
