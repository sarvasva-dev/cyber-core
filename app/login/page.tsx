"use client";

/**
 * Demo access & role selection.
 *
 * This a SIMULATED login for demo purposes: it stores a demo profile in
 * LocalStorage and shapes the product experience. It is not authentication,
 * offers no security, and gives no privacy guarantees.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { Building2, GraduationCap, Search } from "lucide-react";
import { useStore, useToast } from "@/components/providers";
import { Button, Card, LoadingBlock } from "@/components/ui";
import { cn } from "@/lib/format";

interface RoleCardProps {
  title: string;
  description: string;
  points: string[];
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}

function RoleCard({ title, description, points, icon, selected, onSelect }: RoleCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors hover:border-brand/60",
        selected && "border-brand bg-brand/5"
      )}
    >
      <label className="flex cursor-pointer gap-4">
        <input
          type="radio"
          name="demo-role"
          checked={selected}
          onChange={onSelect}
          className="sr-only"
        />
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-night-2 text-brand-soft">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-xs text-muted">{description}</p>
          <ul className="mt-2 space-y-1 text-xs text-faint">
            {points.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
        </div>
      </label>
    </Card>
  );
}

function LoginContent() {
  const { ready, profiles, profile, login } = useStore();
  const toast = useToast();
  const router = useRouter();
  const [manualSelection, setManualSelection] = useState<string | null>(null);

  // Derive the effective selection: explicit click wins over any restored
  // profile — no setState-in-effect needed.
  const selectedId = manualSelection ?? (ready && profile ? profile.id : null);

  function enter() {
    if (!selectedId) return;
    const chosen = profiles.find((p) => p.id === selectedId);
    login(selectedId);
    toast({
      title: "Demo role active",
      description: `${chosen?.name} — simulated login (browser-local, no real auth).`,
      variant: "success",
    });
    router.push(
      chosen?.role === "admin" ? "/admin" : chosen?.role === "student" ? "/student/certificates" : "/verify"
    );
  }

  if (!ready) return <LoadingBlock label="Preparing demo workspace…" />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <RoleCard
        title="Institution Admin / University staff"
        description="Issue certificates, manage the registry, revoke credentials."
        points={["Issuance form with validation", "Registry table & filters", "Revocation with audit trail"]}
        icon={<Building2 className="h-5 w-5" />}
        selected={selectedId === "admin-demo"}
        onSelect={() => setManualSelection("admin-demo")}
      />
      <RoleCard
        title="Student / Certificate holder"
        description="A wallet of your certificates with QR codes and share links."
        points={["Credential wallet view", "Shareable verification links", "Download & print a certificate"]}
        icon={<GraduationCap className="h-5 w-5" />}
        selected={selectedId === "student-demo" || selectedId === "student-demo-2"}
        onSelect={() => setManualSelection("student-demo")}
      />
      <RoleCard
        title="Verifier / Employer"
        description="Check IDs, links, QR codes and uploaded files — no signup."
        points={["Instant verification results", "Tampering explanations", "Personal check history"]}
        icon={<Search className="h-5 w-5" />}
        selected={selectedId === "verifier-demo"}
        onSelect={() => setManualSelection("verifier-demo")}
      />

      <Card className="flex flex-col justify-between border-dashed">
        <div>
          <h2 className="text-sm font-semibold text-ink">About this demo login</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            The selected role is stored locally and only changes what the UI
            shows. There is no server, no password, and no real authorization —
            treat it as a product tour, not a security mechanism.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-faint">
            Verification and history remain open to visitors without a role.
          </p>
        </div>
        <Button className="mt-4 w-full" size="lg" onClick={enter} disabled={!selectedId}>
          Enter demo as selected role
        </Button>
      </Card>

      <div className="md:col-span-2 text-center">
        <Link href="/verify" className="text-xs text-brand-soft hover:underline">
          Skip the role tour — go straight to the verification portal →
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <Link href="/" className="text-xs text-faint hover:text-muted">
          ← Back to home
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
          Choose a demo role
        </h1>
        <p className="mt-1 text-sm text-muted">
          Three simulated profiles demonstrate the whole CertiChain workflow —
          issuing, holding, and verifying credentials.
        </p>
      </div>
      <Suspense fallback={<LoadingBlock />}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
