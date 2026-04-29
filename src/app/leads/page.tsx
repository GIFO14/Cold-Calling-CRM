import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { LeadCreateForm } from "@/components/leads/LeadCreateForm";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  normalizeCompanySize,
  parsePriorityTier,
  priorityTierLabel
} from "@/lib/leads/enriched-field-helpers";

type LeadSearchParams = {
  q?: string;
  stageId?: string;
  priority?: string;
  companySize?: string;
};

function asCustomFieldRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function compareCompanySize(a: string, b: string) {
  const aStart = Number.parseInt(a, 10);
  const bStart = Number.parseInt(b, 10);
  const aHasNumber = Number.isFinite(aStart);
  const bHasNumber = Number.isFinite(bStart);

  if (aHasNumber && bHasNumber && aStart !== bStart) return aStart - bStart;
  if (aHasNumber !== bHasNumber) return aHasNumber ? -1 : 1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export default async function LeadsPage({
  searchParams
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const priorityFilter = parsePriorityTier(params.priority);
  const companySizeFilter = normalizeCompanySize(params.companySize);
  const clearFilterParams = new URLSearchParams();
  if (params.q) clearFilterParams.set("q", params.q);
  const clearFiltersHref = clearFilterParams.size ? `/leads?${clearFilterParams.toString()}` : "/leads";
  const baseLeadAccessWhere = {
    ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
    NOT: {
      stage: {
        is: { isLost: true }
      }
    }
  };

  const [stages, businessSettings, leadFilterValues, leadCandidates] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true }
    }),
    prisma.businessSettings.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.lead.findMany({
      where: baseLeadAccessWhere,
      select: { customFields: true }
    }),
    prisma.lead.findMany({
      where: {
        ...baseLeadAccessWhere,
        ...(params.stageId ? { stageId: params.stageId } : {}),
        ...(params.q
          ? {
              OR: [
                { fullName: { contains: params.q, mode: "insensitive" } },
                { company: { contains: params.q, mode: "insensitive" } },
                { email: { contains: params.q, mode: "insensitive" } },
                { phone: { contains: params.q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        company: true,
        jobTitle: true,
        phone: true,
        email: true,
        stageId: true,
        phoneInvalid: true,
        phoneOptOut: true,
        emailOptOut: true,
        customFields: true
      },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  const companySizeOptions = Array.from(
    new Set(
      leadFilterValues
        .map((lead) => normalizeCompanySize(asCustomFieldRecord(lead.customFields)?.mida_empresa))
        .filter((value): value is string => Boolean(value))
    )
  ).sort(compareCompanySize);

  const leads = leadCandidates
    .filter((lead) => {
      const fields = asCustomFieldRecord(lead.customFields);
      if (priorityFilter && parsePriorityTier(fields?.priority_tier) !== priorityFilter) return false;
      if (companySizeFilter && normalizeCompanySize(fields?.mida_empresa) !== companySizeFilter) return false;
      return true;
    })
    .slice(0, 200);

  return (
    <AppShell user={user}>
      <div className="page-header">
        <div>
          <h1>Leads</h1>
          <p>Search, filter, move through the pipeline, and call directly from the CRM.</p>
        </div>
        <LeadCreateForm
          stages={stages}
          defaultDealValueCents={businessSettings?.defaultDealValueCents ?? 0}
        />
      </div>
      <form className="toolbar leads-toolbar">
        <input name="q" type="search" placeholder="Search by name, company, email, or phone" defaultValue={params.q} />
        <details className="filter-menu">
          <summary className="ghost-button">Filter</summary>
          <div className="filter-menu__panel">
            <div className="field">
              <label>Stage</label>
              <select name="stageId" defaultValue={params.stageId ?? ""}>
                <option value="">All stages</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Priority</label>
              <select name="priority" defaultValue={priorityFilter ?? ""}>
                <option value="">Any priority</option>
                {(["top", "high", "mid", "low"] as const).map((tier) => (
                  <option key={tier} value={tier}>
                    {priorityTierLabel(tier)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Company size</label>
              <select name="companySize" defaultValue={companySizeFilter ?? ""}>
                <option value="">Any size</option>
                {companySizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-menu__actions">
              <button className="button" type="submit">Apply filters</button>
              <a className="ghost-button" href={clearFiltersHref}>Clear</a>
            </div>
          </div>
        </details>
      </form>
      <section className="panel">
        <LeadsTable leads={leads} stages={stages} />
      </section>
    </AppShell>
  );
}
