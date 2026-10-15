import Link from "next/link";
import { Button } from "@/components/ui";
import { ShieldQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface text-brand-soft">
        <ShieldQuestion className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-muted">
        This route doesn’t exist in CertiChain. If you followed a verification
        link, double-check the certificate ID — or check it directly below.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/verify">
          <Button variant="primary" size="md">Verify a certificate</Button>
        </Link>
        <Link href="/">
          <Button variant="secondary" size="md">Back to home</Button>
        </Link>
      </div>
    </div>
  );
}
