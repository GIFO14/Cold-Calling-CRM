export function StatCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="panel stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small className="muted">{hint}</small> : null}
    </div>
  );
}
