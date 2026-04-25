export type PriorityTier = "top" | "high" | "mid" | "low";

export function parsePriorityTier(raw: unknown): PriorityTier | null {
  if (typeof raw !== "string") return null;
  const text = raw.toLowerCase();
  if (/\btop\b/.test(text)) return "top";
  if (/\bhigh\b|alt(a|o)?\b/.test(text)) return "high";
  if (/\bmid\b|med(i|io)?\b|mitj(à|a)\b/.test(text)) return "mid";
  if (/\blow\b|baix(a|o)?\b/.test(text)) return "low";
  return null;
}

export function priorityTierLabel(tier: PriorityTier): string {
  switch (tier) {
    case "top":
      return "TOP";
    case "high":
      return "HIGH";
    case "mid":
      return "MID";
    case "low":
      return "LOW";
  }
}

export type PriorityBreakdown = {
  segments: { label: string; value: number }[];
  total: number | null;
};

/**
 * Parses strings like:
 *   "icp:10 + urgency:3(content,2026) + volume:0(1-5emp) + contact:1(csv) = 14"
 * Returns null if no segments could be parsed.
 */
export function parsePriorityBreakdown(raw: unknown): PriorityBreakdown | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const segRegex = /([a-zA-Z_][a-zA-Z0-9_ -]*)\s*:\s*(-?\d+(?:\.\d+)?)/g;
  const segments: { label: string; value: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = segRegex.exec(raw)) !== null) {
    segments.push({ label: match[1].trim(), value: Number(match[2]) });
  }
  if (!segments.length) return null;
  const totalMatch = /=\s*(-?\d+(?:\.\d+)?)/.exec(raw);
  const total = totalMatch ? Number(totalMatch[1]) : null;
  // The last "X:Y" can actually be the total if there's no "=". Drop if it matches total.
  if (total !== null && segments.length && segments[segments.length - 1].value === total) {
    // keep all — it's fine; total is separate
  }
  return { segments, total };
}

export function parseSignalsFound(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/[,|;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s, i, arr) => arr.indexOf(s) === i);
}

export function classifySignalChip(signal: string): string {
  const s = signal.toLowerCase();
  if (s.includes("cta")) return "cta";
  if (s.includes("pixel") || s.includes("gtag") || s.includes("fbq")) return "pixel";
  if (s.includes("form")) return "form";
  if (s.includes("magnet") || s.includes("lead magnet") || s.includes("guide") || s.includes("ebook")) return "magnet";
  if (s.includes("chat")) return "chat";
  if (s.includes("audit") || s.includes("seo")) return "audit";
  return "default";
}

export type IcpBucket = "hi" | "mid" | "lo";

export function classifyIcpScore(score: unknown): IcpBucket | null {
  const n = toNumber(score);
  if (n === null) return null;
  if (n >= 12) return "hi";
  if (n >= 8) return "mid";
  return "lo";
}

export type SignalFreshness = "fresh" | "stale" | "cold";

/**
 * Accepts ISO (2026-04-24), YYYY-MM (2026-04), YYYY (2026), or a JS-parseable date.
 * Uses the start of the given granularity.
 */
export function classifySignalFreshness(raw: unknown, nowMs: number = Date.now()): SignalFreshness | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let date: Date | null = null;
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
  const ym = /^(\d{4})-(\d{1,2})$/.exec(trimmed);
  const y = /^(\d{4})$/.exec(trimmed);
  if (ymd) {
    date = new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])));
  } else if (ym) {
    date = new Date(Date.UTC(Number(ym[1]), Number(ym[2]) - 1, 1));
  } else if (y) {
    date = new Date(Date.UTC(Number(y[1]), 0, 1));
  } else {
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) date = new Date(parsed);
  }
  if (!date) return null;
  const diffDays = (nowMs - date.getTime()) / (1000 * 60 * 60 * 24);
  // Negative = future date; treat as fresh
  if (diffDays < 0) return "fresh";
  if (diffDays < 7) return "fresh";
  if (diffDays < 30) return "stale";
  return "cold";
}

const DM_TITLE_REGEX = /(funda(dor|dora|tor)|founder|ceo|propietar(i|ia)|director(a)?\s+general|owner|managing\s+director|co-?founder)/i;

export function isDecisionMaker({
  jobTitle,
  midaEmpresa
}: {
  jobTitle?: string | null;
  midaEmpresa?: string | null;
}): boolean {
  if (typeof jobTitle === "string" && DM_TITLE_REGEX.test(jobTitle)) return true;
  if (typeof midaEmpresa === "string") {
    const trimmed = midaEmpresa.trim();
    if (trimmed === "1-5" || /^1\s*[–-]\s*5/.test(trimmed)) return true;
  }
  return false;
}

export function extractFaviconUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url.trim());
    if (!parsed.hostname) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=32`;
  } catch {
    return null;
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function toStringValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

export function splitResearchSources(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /^https?:\/\//i.test(s));
}
