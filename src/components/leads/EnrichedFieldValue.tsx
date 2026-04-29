import {
  classifyIcpScore,
  classifySignalFreshness,
  extractFaviconUrl,
  parsePriorityTier,
  priorityTierLabel,
  splitResearchSources,
  toStringValue
} from "@/lib/leads/enriched-field-helpers";
import type { NativeImportLeadFieldType } from "@/lib/leads/native-import-fields";
import { PriorityBreakdownBar } from "@/components/leads/PriorityBreakdownBar";
import { SignalChips } from "@/components/leads/SignalChips";

function genericDisplay(value: unknown, type: NativeImportLeadFieldType): React.ReactNode {
  if (type === "BOOLEAN") return Boolean(value) ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "-";
  if (type === "URL" && typeof value === "string" && /^https?:\/\//i.test(value.trim())) {
    return (
      <a href={value} target="_blank" rel="noreferrer">
        {value}
      </a>
    );
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function renderEnrichedField(key: string, value: unknown, type: NativeImportLeadFieldType): React.ReactNode {
  switch (key) {
    case "priority_tier": {
      const tier = parsePriorityTier(value);
      if (!tier) return genericDisplay(value, type);
      return (
        <span className={`badge badge--priority-${tier}`}>Priority: {priorityTierLabel(tier)}</span>
      );
    }
    case "priority_score": {
      const n = typeof value === "number" ? value : Number(toStringValue(value) ?? "");
      if (!Number.isFinite(n)) return genericDisplay(value, type);
      return (
        <strong style={{ fontSize: 16 }}>
          {n}
          <span className="muted" style={{ fontWeight: 400, marginLeft: 4 }}>/ 15</span>
        </strong>
      );
    }
    case "icp_score": {
      const n = typeof value === "number" ? value : Number(toStringValue(value) ?? "");
      if (!Number.isFinite(n)) return genericDisplay(value, type);
      const bucket = classifyIcpScore(n);
      return (
        <span className={bucket ? `badge badge--icp-${bucket}` : "badge"}>
          {n}/15
        </span>
      );
    }
    case "signals_found":
      return <SignalChips value={value} />;
    case "priority_breakdown":
      return <PriorityBreakdownBar value={value} />;
    case "signal_date": {
      const raw = toStringValue(value);
      if (!raw) return genericDisplay(value, type);
      const freshness = classifySignalFreshness(raw);
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {freshness ? (
            <span
              className={`dot dot--${freshness}`}
              role="img"
              aria-label={
                freshness === "fresh" ? "Recent" : freshness === "stale" ? "Aging" : "Old"
              }
            />
          ) : null}
          {raw}
        </span>
      );
    }
    case "all_research_sources": {
      const urls = splitResearchSources(value);
      if (!urls.length) return genericDisplay(value, type);
      return (
        <div className="research-sources">
          {urls.map((url) => {
            const favicon = extractFaviconUrl(url);
            return (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                {favicon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="favicon" src={favicon} alt="" width={14} height={14} />
                ) : null}
                <span>{url}</span>
              </a>
            );
          })}
        </div>
      );
    }
    default:
      return genericDisplay(value, type);
  }
}
