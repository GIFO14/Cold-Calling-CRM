import { parsePriorityBreakdown } from "@/lib/leads/enriched-field-helpers";

const SEG_COLORS = [
  "var(--accent)",
  "var(--accent-3)",
  "var(--priority-mid)",
  "var(--priority-high)",
  "var(--priority-top)",
  "#0e7490"
];

export function PriorityBreakdownBar({ value }: { value: unknown }) {
  const parsed = parsePriorityBreakdown(value);
  if (!parsed) {
    if (typeof value === "string" && value.trim()) return <>{value}</>;
    return <>-</>;
  }

  const total = parsed.total ?? parsed.segments.reduce((acc, s) => acc + (s.value > 0 ? s.value : 0), 0);
  const sumAbs = parsed.segments.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  const safeSum = sumAbs > 0 ? sumAbs : 1;

  return (
    <div className="priority-bar">
      <div className="priority-bar__track" title={typeof value === "string" ? value : undefined}>
        {parsed.segments.map((seg, idx) => {
          const pct = Math.max(0, seg.value) / safeSum * 100;
          if (pct <= 0) return null;
          const color = SEG_COLORS[idx % SEG_COLORS.length];
          return (
            <span
              key={`${seg.label}-${idx}`}
              className="priority-bar__seg"
              style={{ width: `${pct}%`, background: color }}
              aria-label={`${seg.label}: ${seg.value}`}
            />
          );
        })}
      </div>
      <div className="priority-bar__legend">
        {parsed.segments.map((seg, idx) => (
          <span key={`${seg.label}-${idx}`} style={{ color: SEG_COLORS[idx % SEG_COLORS.length] }}>
            <i />
            <span style={{ color: "var(--muted)" }}>{seg.label}</span>
            <strong style={{ color: "var(--text)" }}>{seg.value}</strong>
          </span>
        ))}
        {total !== null ? (
          <span className="priority-bar__total" style={{ color: "var(--text)" }}>
            Total: {total}
          </span>
        ) : null}
      </div>
    </div>
  );
}
