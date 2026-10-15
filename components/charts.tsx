"use client";

/**
 * Lightweight, dependency-free visualization components. All inputs come
 * from actual local application records — nothing decorative or fabricated.
 */

import { cn } from "@/lib/format";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** Accessible SVG donut for status distribution. */
export function Donut({
  slices,
  size = 150,
  total,
}: {
  slices: DonutSlice[];
  size?: number;
  total?: number;
}) {
  const sum = total ?? slices.reduce((acc, s) => acc + s.value, 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let dashOffset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 150 150"
        role="img"
        aria-label="Status distribution donut chart"
      >
        <circle cx="75" cy="75" r={radius} fill="none" stroke="#16223f" strokeWidth="14" />
        {sum > 0 &&
          slices.map((slice) => {
            const length = (slice.value / sum) * circumference;
            const circle = (
              <circle
                key={slice.label}
                cx="75"
                cy="75"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth="14"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-dashOffset}
                strokeLinecap="butt"
                transform="rotate(-90 75 75)"
              />
            );
            dashOffset += length;
            return circle;
          })}
        <text
          x="75"
          y="79"
          textAnchor="middle"
          className="fill-ink"
          style={{ fontSize: 22, fontWeight: 600 }}
        >
          {sum}
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2 text-muted">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: slice.color }}
              aria-hidden="true"
            />
            {slice.label}
            <span className="font-medium tabular-nums text-ink">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal result-distribution bars for verification history. */
export function ResultBars({
  rows,
  className,
}: {
  rows: { label: string; value: number; total: number; color: string }[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted">{row.label}</span>
            <span className="tabular-nums text-ink">{row.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-night-2">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${row.total > 0 ? Math.max((row.value / row.total) * 100, row.value > 0 ? 4 : 0) : 0}%`,
                backgroundColor: row.color,
              }}
              role="img"
              aria-label={`${row.label}: ${row.value} of ${row.total}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
