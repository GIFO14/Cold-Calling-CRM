import { endOfDay, endOfWeek, startOfDay, startOfWeek } from "date-fns";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { LeadCreateForm } from "@/components/leads/LeadCreateForm";
import { LeadsPageStateSync } from "@/components/leads/LeadsPageStateSync";
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
  stageId?: string | string[];
  stageFilter?: string | string[];
  page?: string | string[];
  priority?: string;
  companySize?: string;
  scheduledCall?: string;
  includeCalledToday?: string;
  includeCalledWeek?: string;
};

const PAGE_SIZE = 50;

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

function getQueryValues(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) return 1;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function createLeadsPageHref(params: LeadSearchParams, page: number) {
  const searchParams = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(params)) {
    if (key === "page") continue;

    const values = getQueryValues(rawValue);
    for (const value of values) {
      if (value) searchParams.append(key, value);
    }
  }

  if (page > 1) searchParams.set("page", String(page));

  const query = searchParams.toString();
  return query ? `/leads?${query}` : "/leads";
}

export default async function LeadsPage({
  searchParams
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const requestedPage = parsePositiveInteger(getQueryValues(params.page)[0]);
  const priorityFilter = parsePriorityTier(params.priority);
  const companySizeFilter = normalizeCompanySize(params.companySize);
  const rawSelectedStageIds = getQueryValues(params.stageId);
  const hasStageFilter = getQueryValues(params.stageFilter).includes("1");
  const scheduledCallFilter =
    params.scheduledCall === "scheduled" || params.scheduledCall === "unscheduled"
      ? params.scheduledCall
      : null;
  const includeCalledToday = params.includeCalledToday !== "0";
  const includeCalledWeek = params.includeCalledWeek !== "0";
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const calledExclusionFilters = [
    ...(!includeCalledToday
      ? [
          {
            callLogs: {
              none: {
                userId: user.id,
                startedAt: { gte: todayStart, lte: todayEnd }
              }
            }
          }
        ]
      : []),
    ...(!includeCalledWeek
      ? [
          {
            callLogs: {
              none: {
                userId: user.id,
                startedAt: { gte: weekStart, lte: weekEnd }
              }
            }
          }
        ]
      : [])
  ];
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
        ...(scheduledCallFilter === "scheduled"
          ? { nextFollowUpAt: { not: null } }
          : scheduledCallFilter === "unscheduled"
          ? { nextFollowUpAt: null }
          : {}),
        ...(calledExclusionFilters.length ? { AND: calledExclusionFilters } : {}),
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
        nextFollowUpAt: true,
        stageId: true,
        testing: true,
        phoneInvalid: true,
        phoneOptOut: true,
        emailOptOut: true,
        customFields: true
      },
      orderBy: { updatedAt: "desc" }
    })
  ]);
  const validStageIds = new Set(stages.map((stage) => stage.id));
  const selectedStageIds = rawSelectedStageIds.filter((stageId) => validStageIds.has(stageId));
  const selectedStageIdSet = new Set(selectedStageIds);
  const isAllStagesSelected = !hasStageFilter || selectedStageIds.length === stages.length;
  const filtersAppliedCount = [
    hasStageFilter && !isAllStagesSelected,
    Boolean(priorityFilter),
    Boolean(companySizeFilter),
    Boolean(scheduledCallFilter),
    !includeCalledToday,
    !includeCalledWeek
  ].filter(Boolean).length;

  const companySizeOptions = Array.from(
    new Set(
      leadFilterValues
        .map((lead) => normalizeCompanySize(asCustomFieldRecord(lead.customFields)?.mida_empresa))
        .filter((value): value is string => Boolean(value))
    )
  ).sort(compareCompanySize);

  const filteredLeads = leadCandidates.filter((lead) => {
      if (hasStageFilter) {
        if (selectedStageIdSet.size === 0) return false;
        if (!lead.stageId || !selectedStageIdSet.has(lead.stageId)) return false;
      }

      const fields = asCustomFieldRecord(lead.customFields);
      if (priorityFilter && parsePriorityTier(fields?.priority_tier) !== priorityFilter) return false;
      if (companySizeFilter && normalizeCompanySize(fields?.mida_empresa) !== companySizeFilter) return false;
      return true;
  });
  const totalLeads = filteredLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalLeads / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStartIndex = totalLeads === 0 ? 0 : (currentPage - 1) * PAGE_SIZE;
  const pageEndIndex = Math.min(pageStartIndex + PAGE_SIZE, totalLeads);
  const leads = filteredLeads.slice(pageStartIndex, pageEndIndex);
  const pageNumbers = Array.from(
    new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages].filter((page) => page >= 1 && page <= totalPages))
  ).sort((a, b) => a - b);

  return (
    <AppShell user={user}>
      <LeadsPageStateSync />
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
          <summary className="ghost-button">
            <span>Filter</span>
            {filtersAppliedCount > 0 ? <span className="filter-menu__count">{filtersAppliedCount}</span> : null}
          </summary>
          <div className="filter-menu__panel">
            <div className="field">
              <label>Stage</label>
              <input type="hidden" name="stageFilter" value="1" />
              <div className="filter-menu__checkbox-list">
                {stages.map((stage) => (
                  <label key={stage.id} className="filter-menu__checkbox-item">
                    <input
                      type="checkbox"
                      name="stageId"
                      value={stage.id}
                      defaultChecked={isAllStagesSelected || selectedStageIdSet.has(stage.id)}
                    />
                    {stage.name}
                  </label>
                ))}
              </div>
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
            <div className="field">
              <label>Scheduled call</label>
              <select name="scheduledCall" defaultValue={scheduledCallFilter ?? ""}>
                <option value="">Any</option>
                <option value="scheduled">Has scheduled call</option>
                <option value="unscheduled">No scheduled call</option>
              </select>
            </div>
            <div className="field">
              <label>Calls already made</label>
              <div className="checkbox-grid checkbox-grid--compact">
                <label>
                  <input type="checkbox" name="includeCalledToday" value="1" defaultChecked={includeCalledToday} />
                  Include called today
                </label>
                <input type="hidden" name="includeCalledToday" value="0" />
                <label>
                  <input type="checkbox" name="includeCalledWeek" value="1" defaultChecked={includeCalledWeek} />
                  Include called this week
                </label>
                <input type="hidden" name="includeCalledWeek" value="0" />
              </div>
            </div>
            <div className="filter-menu__actions">
              <button className="button" type="submit">Apply filters</button>
              <a className="ghost-button" href={clearFiltersHref}>Clear</a>
            </div>
          </div>
        </details>
      </form>
      <section className="panel">
        <div className="pagination-bar">
          <p className="pagination-bar__summary">
            {totalLeads === 0
              ? "No leads found"
              : `Showing ${pageStartIndex + 1}-${pageEndIndex} of ${totalLeads} leads`}
          </p>
          {totalPages > 1 ? (
            <nav className="pagination-bar__controls" aria-label="Leads pagination">
              {currentPage > 1 ? (
                <a className="ghost-button pagination-bar__page" href={createLeadsPageHref(params, currentPage - 1)}>
                  Previous
                </a>
              ) : (
                <span className="ghost-button pagination-bar__page is-disabled" aria-disabled="true">
                  Previous
                </span>
              )}
              <div className="pagination-bar__pages">
                {pageNumbers.map((pageNumber, index) => {
                  const showEllipsis = index > 0 && pageNumber - pageNumbers[index - 1] > 1;

                  return (
                    <span key={pageNumber} className="pagination-bar__page-group">
                      {showEllipsis ? <span className="pagination-bar__ellipsis">…</span> : null}
                      {pageNumber === currentPage ? (
                        <span className="pagination-bar__page is-active" aria-current="page">
                          {pageNumber}
                        </span>
                      ) : (
                        <a className="ghost-button pagination-bar__page" href={createLeadsPageHref(params, pageNumber)}>
                          {pageNumber}
                        </a>
                      )}
                    </span>
                  );
                })}
              </div>
              {currentPage < totalPages ? (
                <a className="ghost-button pagination-bar__page" href={createLeadsPageHref(params, currentPage + 1)}>
                  Next
                </a>
              ) : (
                <span className="ghost-button pagination-bar__page is-disabled" aria-disabled="true">
                  Next
                </span>
              )}
            </nav>
          ) : null}
        </div>
        <LeadsTable leads={leads} stages={stages} />
      </section>
    </AppShell>
  );
}
