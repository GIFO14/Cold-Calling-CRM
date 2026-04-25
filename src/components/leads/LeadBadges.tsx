import {
  classifyIcpScore,
  classifySignalFreshness,
  isDecisionMaker,
  parsePriorityTier,
  priorityTierLabel,
  toStringValue,
  type PriorityTier,
  type IcpBucket,
  type SignalFreshness
} from "@/lib/leads/enriched-field-helpers";

type LeadBadgesProps = {
  customFields: Record<string, unknown> | null | undefined;
  jobTitle?: string | null;
  compact?: boolean;
  responsive?: boolean;
};

function icpBadgeText(score: number): { text: string; tier: IcpBucket } {
  const tier = (score >= 12 ? "hi" : score >= 8 ? "mid" : "lo") as IcpBucket;
  return { text: `ICP ${score}/15`, tier };
}

function freshnessTitle(freshness: SignalFreshness): string {
  switch (freshness) {
    case "fresh":
      return "Senyal recent (<7 dies)";
    case "stale":
      return "Senyal d'entre 7 i 30 dies";
    case "cold":
      return "Senyal antic (>30 dies)";
  }
}

function priorityTitle(tier: PriorityTier): string {
  switch (tier) {
    case "top":
      return "Prioritat TOP — trucar ja";
    case "high":
      return "Prioritat alta";
    case "mid":
      return "Prioritat mitjana";
    case "low":
      return "Prioritat baixa";
  }
}

export function LeadBadges({ customFields, jobTitle, compact, responsive }: LeadBadgesProps) {
  const fields = customFields ?? {};
  const priorityTier = parsePriorityTier(fields.priority_tier);
  const icpScoreRaw = fields.icp_score;
  const icpScoreNum =
    typeof icpScoreRaw === "number"
      ? icpScoreRaw
      : typeof icpScoreRaw === "string"
      ? Number(icpScoreRaw)
      : null;
  const icpBucket = classifyIcpScore(icpScoreRaw);
  const freshness = classifySignalFreshness(toStringValue(fields.signal_date));
  const dm = isDecisionMaker({ jobTitle, midaEmpresa: toStringValue(fields.mida_empresa) });

  const classes = ["lead-badges"];
  if (compact) classes.push("lead-badges--compact");
  if (responsive) classes.push("lead-badges--responsive");

  const hasAny = priorityTier || icpBucket || freshness || dm;
  if (!hasAny) return null;

  return (
    <span className={classes.join(" ")}>
      {priorityTier ? (
        <span
          className={`badge badge--priority-${priorityTier}`}
          title={priorityTitle(priorityTier)}
        >
          Priority: {priorityTierLabel(priorityTier)}
        </span>
      ) : null}
      {icpBucket && icpScoreNum !== null && Number.isFinite(icpScoreNum) ? (
        <span
          className={`badge badge--icp-${icpBucket}`}
          title={`Puntuació ICP ${icpScoreNum}/15`}
        >
          {icpBadgeText(icpScoreNum).text}
        </span>
      ) : null}
      {freshness ? (
        <span
          className={`dot dot--${freshness}`}
          role="img"
          aria-label={freshnessTitle(freshness)}
          title={freshnessTitle(freshness)}
        />
      ) : null}
      {dm ? (
        <span className="badge badge--dm" title="Decisor únic — founder/CEO o empresa petita">
          👑 Sole DM
        </span>
      ) : null}
    </span>
  );
}
