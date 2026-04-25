import { classifySignalChip, parseSignalsFound } from "@/lib/leads/enriched-field-helpers";

export function SignalChips({ value }: { value: unknown }) {
  const signals = parseSignalsFound(value);
  if (!signals.length) {
    if (typeof value === "string" && value.trim()) return <>{value}</>;
    return <>-</>;
  }
  return (
    <div className="chip--row">
      {signals.map((signal, idx) => (
        <span key={`${idx}-${signal}`} className="chip" data-kind={classifySignalChip(signal)}>
          {signal}
        </span>
      ))}
    </div>
  );
}
