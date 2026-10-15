"use client";

/**
 * Shared UI primitives — the design system’s building blocks.
 * Kept small and concrete so student contributors can read it quickly.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Check, Copy, X } from "lucide-react";
import { cn } from "@/lib/format";

/* ------------------------------ Button ------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-soft hover:text-night border border-brand/70",
  secondary:
    "bg-surface-2 text-ink border border-line hover:border-brand hover:text-white",
  ghost: "text-muted hover:text-ink hover:bg-surface border border-transparent",
  danger:
    "bg-bad/15 text-bad border border-bad/40 hover:bg-bad/25",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-2.5 text-sm",
        buttonClasses[variant],
        className
      )}
    >
      {loading ? <LoadingSpinner className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-5 w-5 animate-spin text-brand-soft", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}

/* ------------------------------ Surfaces ------------------------------ */

export function Card({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  role?: string;
  "aria-live"?: "polite" | "assertive" | "off";
}) {
  return (
    <div
      role={"role" in rest ? rest.role : undefined}
      aria-live={"aria-live" in rest ? rest["aria-live"] : undefined}
      className={cn(
        "rounded-xl border border-line bg-surface/80 p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "good" | "bad" | "warn" | "brand";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "border-line bg-surface-2 text-muted",
    good: "border-good/40 bg-good/10 text-good",
    bad: "border-bad/40 bg-bad/10 text-bad",
    warn: "border-warn/40 bg-warn/10 text-warn",
    brand: "border-brand/40 bg-brand/10 text-brand-soft",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Certificate status chip with the agreed color language. */
export function StatusBadge({ status }: { status: "active" | "revoked" }) {
  return status === "active" ? (
    <Badge tone="good">
      <span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden="true" />
      Active
    </Badge>
  ) : (
    <Badge tone="bad">
      <span className="h-1.5 w-1.5 rounded-full bg-bad" aria-hidden="true" />
      Revoked
    </Badge>
  );
}

/* ------------------------------ Form fields ------------------------------ */

export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-muted">
      {children}
    </label>
  );
}

const inputBase =
  "w-full rounded-lg border border-line bg-night-2 px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-brand disabled:opacity-60";

export function Input({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(inputBase, invalid && "border-bad/60", className)}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(inputBase, "appearance-none", className)}>
      {children}
    </select>
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputBase, "min-h-20", className)} />;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? (
        <p className="mt-1 text-xs text-faint">{hint}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------ Copy button ------------------------------ */

export function CopyButton({
  value,
  label = "Copy",
  className,
  title,
}: {
  value: string;
  label?: string;
  className?: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be blocked; select-based fallback for older browsers.
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopied(true);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={title ?? label}
      aria-label={title ?? label}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-muted transition hover:border-brand hover:text-ink",
        copied && "text-good",
        className
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

/** Fingerprint text with a copy action, in mono type. */
export function FingerprintText({ value }: { value: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <code className="break-all rounded-md border border-line-soft bg-night-2 px-2 py-1 font-mono text-xs text-brand-soft">
        {value}
      </code>
      <CopyButton value={value} label="Copy fingerprint" />
    </span>
  );
}

/* ------------------------------ Modal ------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center print-hide"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="text-sm text-muted">{children}</div>
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ------------------------------ Empty / loading ------------------------------ */

export function EmptyState({
  icon,
  title,
  description,
  actions,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-surface/50 px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-faint">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-xs text-muted">{description}</p>
      ) : null}
      {actions ? <div className="mt-4 flex gap-2">{actions}</div> : null}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-line bg-surface/60 px-6 py-12">
      <LoadingSpinner />
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}

/* ------------------------------ Stat card ------------------------------ */

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "good" | "bad" | "warn" | "brand";
  icon?: ReactNode;
}) {
  const accents = {
    neutral: "text-ink",
    good: "text-good",
    bad: "text-bad",
    warn: "text-warn",
    brand: "text-brand-soft",
  } as const;
  return (
    <Card className="flex items-center gap-4">
      {icon ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-night-2 text-brand-soft">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        <p className={cn("mt-0.5 text-2xl font-semibold tabular-nums", accents[tone])}>
          {value}
        </p>
        {hint ? <p className="text-xs text-faint">{hint}</p> : null}
      </div>
    </Card>
  );
}

export { useId };
