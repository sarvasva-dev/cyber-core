"use client";

/**
 * Verification history — every check run through the portals, persisted
 * locally. Supports result filtering, text search, and JSON export.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, Download, Search } from "lucide-react";
import { useStore } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  SectionTitle,
  Select,
} from "@/components/ui";
import { RESULT_LABELS } from "@/lib/certificates";
import { formatDateTime } from "@/lib/format";
import type { LoggableResult } from "@/lib/types";

export default function HistoryPage() {
  const { ready, logs } = useStore();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<"all" | LoggableResult>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (result !== "all" && log.result !== result) return false;
      if (!q) return true;
      return (
        (log.certificateId ?? "").toLowerCase().includes(q) ||
        log.message.toLowerCase().includes(q)
      );
    });
  }, [logs, query, result]);

  if (!ready) return <LoadingBlock label="Loading history…" />;

  const resultOptions: ("all" | LoggableResult)[] = [
    "all",
    "verified",
    "tampered",
    "revoked",
    "not_found",
    "invalid_input",
    "registry_lookup",
  ];

  async function exportJson() {
    try {
      const data = JSON.stringify(filtered, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "certichain-verification-history.json";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Verification history"
        description={`${logs.length} logged check${logs.length === 1 ? "" : "s"} in this browser. History is local — it does not sync.`}
        actions={
          logs.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={exportJson}>
              <Download className="h-4 w-4" /> Export JSON
            </Button>
          ) : undefined
        }
      />

      <Card className="!p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-52 flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint" aria-hidden="true" />
            <input
              aria-label="Search history"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search certificate ID or message…"
              className="w-full rounded-lg border border-line bg-night-2 py-2 pl-9 pr-3 text-sm placeholder:text-faint focus:border-brand"
            />
          </label>
          <Select
            aria-label="Filter by result"
            value={result}
            onChange={(e) => setResult(e.target.value as typeof result)}
            className="w-44"
          >
            {resultOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All results" : RESULT_LABELS[option]}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-8 w-8" />}
          title={logs.length === 0 ? "No verification checks logged yet" : "No checks match this filter"}
          description={
            logs.length === 0
              ? "Run a check from the verification portal — attempts (including mismatches) are recorded here."
              : undefined
          }
          actions={<Link href="/verify"><Button size="sm">Open verification portal</Button></Link>}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <caption className="sr-only">Verification check history</caption>
              <thead>
                <tr className="border-b border-line bg-surface-2/50 text-left text-xs uppercase tracking-wide text-faint">
                  <th scope="col" className="px-4 py-3 font-medium">When</th>
                  <th scope="col" className="px-4 py-3 font-medium">Certificate</th>
                  <th scope="col" className="px-4 py-3 font-medium">Method</th>
                  <th scope="col" className="px-4 py-3 font-medium">Result</th>
                  <th scope="col" className="px-4 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-surface/60">
                    <td className="px-4 py-3 text-xs text-muted">{formatDateTime(log.timestamp)}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {log.certificateId ? (
                        <Link href={`/verify/${log.certificateId}`} className="text-brand-soft hover:underline">
                          {log.certificateId}
                        </Link>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{log.method}</td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          log.result === "verified" ? "good" : log.result === "tampered" ? "bad" : log.result === "revoked" ? "warn" : log.result === "registry_lookup" ? "brand" : "neutral"
                        }
                      >
                        {RESULT_LABELS[log.result] ?? log.result}
                      </Badge>
                    </td>
                    <td className="max-w-96 truncate px-4 py-3 text-xs text-muted">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
