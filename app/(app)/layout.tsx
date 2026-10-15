import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

// AppShell reads the dynamic pathname (active-nav highlighting + breadcrumb);
// the Suspense boundary lets each route prerender and stream in the shell.
export default function AppAreaLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <div
            role="status"
            aria-label="Loading application shell"
            className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand"
          />
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
