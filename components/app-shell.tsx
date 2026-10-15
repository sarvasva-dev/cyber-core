"use client";

/**
 * Dashboard shell: desktop sidebar + mobile drawer + top bar. Navigation is
 * role-aware (admin / student / verifier / visitor). The demo role lives in
 * LocalStorage and is purely presentational — it is NOT a security boundary.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Award,
  BadgeCheck,
  ChevronRight,
  FilePlus2,
  FolderOpen,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanLine,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn, verificationUrl } from "@/lib/format";
import { useStore } from "./providers";
import { Badge, Button } from "./ui";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Deep routes that shouldn’t highlight a parent item falsely. */
  exact?: boolean;
}

function navForRole(role: "admin" | "student" | "verifier" | null): NavItem[] {
  switch (role) {
    case "admin":
      return [
        { href: "/dashboard", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/admin/issue", label: "Issue certificate", icon: <FilePlus2 className="h-4 w-4" /> },
        { href: "/admin/certificates", label: "Manage certificates", icon: <FolderOpen className="h-4 w-4" /> },
        { href: "/history", label: "Verification history", icon: <History className="h-4 w-4" /> },
        { href: "/settings", label: "Settings & data", icon: <Settings className="h-4 w-4" /> },
      ];
    case "student":
      return [
        { href: "/dashboard", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/student/certificates", label: "My certificates", icon: <Award className="h-4 w-4" /> },
        { href: "/verify", label: "Verify a certificate", icon: <ShieldCheck className="h-4 w-4" /> },
        { href: "/history", label: "Verification history", icon: <History className="h-4 w-4" /> },
        { href: "/settings", label: "Settings & data", icon: <Settings className="h-4 w-4" /> },
      ];
    case "verifier":
      return [
        { href: "/dashboard", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/verify", label: "Verify portal", icon: <ShieldCheck className="h-4 w-4" /> },
        { href: "/history", label: "Verification history", icon: <History className="h-4 w-4" /> },
        { href: "/settings", label: "Settings & data", icon: <Settings className="h-4 w-4" /> },
      ];
    default:
      return [
        { href: "/login", label: "Choose a demo role", icon: <BadgeCheck className="h-4 w-4" /> },
        { href: "/verify", label: "Verify portal", icon: <ShieldCheck className="h-4 w-4" /> },
        { href: "/history", label: "Verification history", icon: <History className="h-4 w-4" /> },
        { href: "/settings", label: "Settings & data", icon: <Settings className="h-4 w-4" /> },
      ];
  }
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Institution Admin",
  student: "Student",
  verifier: "Verifier / Employer",
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { profile, logout } = useStore();
  const items = navForRole(profile?.role ?? null);

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/"
        className="flex items-center gap-2.5 px-5 py-5 text-ink hover:text-white"
        onClick={onNavigate}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-aqua font-bold text-night">
          C
        </span>
        <span>
          <span className="block text-sm font-semibold leading-tight">CertiChain</span>
          <span className="block text-[10px] uppercase tracking-wider text-faint">
            Credential verification
          </span>
        </span>
      </Link>

      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (!item.exact && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-brand/15 text-white"
                  : "text-muted hover:bg-surface hover:text-ink"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line-soft p-4">
        {profile ? (
          <div className="space-y-2">
            <div className="rounded-lg bg-surface-2/60 px-3 py-2.5">
              <p className="truncate text-sm font-medium text-ink">{profile.name}</p>
              <p className="truncate text-xs text-faint">{profile.email}</p>
              <Badge tone="brand" className="mt-2">
                {ROLE_LABEL[profile.role]}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                logout();
                onNavigate?.();
              }}
            >
              <LogOut className="h-4 w-4" /> Switch demo role
            </Button>
          </div>
        ) : (
          <div className="rounded-lg bg-surface-2/60 px-3 py-2.5 text-xs text-muted">
            <p className="font-medium text-ink">Visitor</p>
            <p className="mt-1">
              No demo role selected. Verification and history are open to
              everyone.
            </p>
            <Link href="/login" onClick={onNavigate} className="mt-2 inline-block text-brand-soft hover:underline">
              Choose a demo role →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useStore();

  // The drawer closes via onNavigate on every sidebar link — no navigation
  // effect needed (and no setState-in-effect).

  const crumbs = pathname
    .split("/")
    .filter(Boolean)
    .map((part) => ({ label: part, href: `/${part}` }));

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line-soft bg-night-2/80 backdrop-blur lg:block print-hide">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden print-hide" role="dialog" aria-modal="true" aria-label="Navigation">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-line bg-night-2">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-md p-1.5 text-muted hover:text-ink"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-line-soft bg-night/85 backdrop-blur print-hide">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="rounded-md p-2 text-muted hover:bg-surface hover:text-ink lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-xs text-faint sm:flex">
                <Link href="/dashboard" className="hover:text-muted">
                  Home
                </Link>
                {crumbs.map((crumb) => (
                  <span key={crumb.href} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" aria-hidden="true" />
                    <span className="capitalize text-muted">{crumb.label.replace(/-/g, " ")}</span>
                  </span>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => router.push("/verify")}>
                <ScanLine className="h-4 w-4" /> Verify
              </Button>
              {profile ? (
                <span className="hidden rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-medium text-brand-soft sm:inline">
                  {ROLE_LABEL[profile.role]} · demo
                </span>
              ) : (
                <Link
                  href="/login"
                  className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted hover:text-ink"
                >
                  Select demo role
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

        <footer className="border-t border-line-soft px-6 py-6 text-xs text-faint print-hide">
          CertiChain MVP · Team Cyber Core · Data lives in this browser’s
          LocalStorage only — nothing is uploaded or synced between devices.
        </footer>
      </div>
    </div>
  );
}

/* Exported for pages that need nav helpers. */
export { navForRole, ROLE_LABEL };
export const DEFAULT_VERIFY_URL_BASE = (): string => verificationUrl("__ID__");
