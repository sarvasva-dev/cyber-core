"use client";

/**
 * Metadata check form — the heart of the tamper demonstration. Fields are
 * pre-filled from the stored record; changing any value and re-checking
 * reproduces a hash mismatch. Also offers a one-click "simulate tampering"
 * button that alters the grade.
 */

import { useState } from "react";
import { Fingerprint, TriangleAlert } from "lucide-react";
import { useStore } from "./providers";
import { Button, Card, Field, Input } from "./ui";
import type { IssueFormInput } from "@/lib/validation";
import type { VerificationOutcome } from "@/lib/verification";
import type { VerificationMethod } from "@/lib/types";

export function MetadataCheckForm({
  initial,
  onOutcome,
  method = "metadata",
}: {
  initial: IssueFormInput;
  onOutcome: (outcome: VerificationOutcome) => void;
  method?: VerificationMethod;
}) {
  const { runVerification } = useStore();
  const [form, setForm] = useState<IssueFormInput>(initial);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof IssueFormInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function check() {
    setBusy(true);
    const outcome = await runVerification({ id: form.id, method, metadata: form });
    onOutcome(outcome);
    setBusy(false);
  }

  async function simulateTamper() {
    set("grade", `${form.grade} — EDITED`);
    const tampered: IssueFormInput = { ...form, grade: `${form.grade} — EDITED` };
    setBusy(true);
    const outcome = await runVerification({ id: tampered.id, method, metadata: tampered });
    onOutcome(outcome);
    setBusy(false);
  }

  function resetToRecord() {
    setForm(initial);
    onOutcome(null as unknown as VerificationOutcome);
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Metadata check</h2>
        <Button size="sm" variant="ghost" onClick={resetToRecord}>Restore stored values</Button>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-muted">
        These are all the fields the stored fingerprint was computed from. Leave
        them untouched and the SHA-256 will match — edit any value and it will
        not.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Student full name" htmlFor="m-studentName">
          <Input id="m-studentName" value={form.studentName} onChange={(e) => set("studentName", e.target.value)} />
        </Field>
        <Field label="Course / degree" htmlFor="m-course">
          <Input id="m-course" value={form.course} onChange={(e) => set("course", e.target.value)} />
        </Field>
        <Field label="Institution" htmlFor="m-institution">
          <Input id="m-institution" value={form.institution} onChange={(e) => set("institution", e.target.value)} />
        </Field>
        <Field label="Grade" htmlFor="m-grade">
          <Input id="m-grade" value={form.grade} onChange={(e) => set("grade", e.target.value)} />
        </Field>
        <Field label="Issue date" htmlFor="m-issueDate">
          <Input id="m-issueDate" type="date" value={form.issueDate} onChange={(e) => set("issueDate", e.target.value)} />
        </Field>
        <Field label="Issuer" htmlFor="m-issuerName">
          <Input id="m-issuerName" value={form.issuerName} onChange={(e) => set("issuerName", e.target.value)} />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={check} loading={busy} disabled={busy}>
          <Fingerprint className="h-4 w-4" /> Recompute fingerprint &amp; check
        </Button>
        <Button variant="secondary" onClick={simulateTamper} disabled={busy}>
          <TriangleAlert className="h-4 w-4" /> Simulate tampering (edit grade)
        </Button>
      </div>
    </Card>
  );
}
