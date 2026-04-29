import { format, subDays } from "date-fns";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { StatCard } from "@/components/ui/StatCard";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatCurrencyFromCents, getEffectiveDealValueCents } from "@/lib/money";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const leadWhere = user.role === "ADMIN" ? {} : { ownerId: user.id };
  const callWhere = user.role === "ADMIN" ? {} : { userId: user.id };
  const sevenDaysAgo = subDays(new Date(), 7);
  const thirtyDaysAgo = subDays(new Date(), 30);

  const [businessSettings, stages, leads, calls, answeredCalls, outcomes, imports, stageChangedActivities] =
    await Promise.all([
      prisma.businessSettings.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.pipelineStage.findMany({
        where: { active: true },
        orderBy: { position: "asc" },
        select: { id: true, name: true, color: true, isWon: true, isLost: true }
      }),
      prisma.lead.findMany({
        where: leadWhere,
        select: {
          id: true,
          stageId: true,
          dealValueOverrideCents: true,
          createdAt: true
        }
      }),
      prisma.callLog.findMany({
        where: { ...callWhere, startedAt: { gte: sevenDaysAgo } },
        orderBy: { startedAt: "asc" }
      }),
      prisma.callLog.count({
        where: {
          ...callWhere,
          startedAt: { gte: sevenDaysAgo },
          status: { in: ["ANSWERED", "COMPLETED"] }
        }
      }),
      prisma.callLog.groupBy({
        by: ["outcome"],
        where: { ...callWhere, startedAt: { gte: thirtyDaysAgo }, outcome: { not: null } },
        _count: { outcome: true }
      }),
      prisma.importBatch.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { createdBy: { select: { name: true } } }
      }),
      prisma.leadActivity.findMany({
        where: {
          type: "STAGE_CHANGED",
          createdAt: { gte: thirtyDaysAgo },
          ...(user.role === "ADMIN" ? {} : { lead: { is: { ownerId: user.id } } })
        },
        select: {
          createdAt: true,
          metadata: true,
          lead: { select: { dealValueOverrideCents: true } }
        },
        orderBy: { createdAt: "asc" }
      })
    ]);

  const defaultDealValueCents = businessSettings?.defaultDealValueCents ?? 0;
  const totalLeads = leads.length;
  const newLeadsWeek = leads.filter((lead) => lead.createdAt >= sevenDaysAgo).length;
  const stageMap = new Map(
    stages.map((stage) => [
      stage.id,
      { ...stage, count: 0, valueCents: 0 }
    ])
  );

  let pipelineValueCents = 0;
  let wonRevenueCents = 0;
  let lostValueCents = 0;
  let wonCount = 0;
  let lostCount = 0;

  for (const lead of leads) {
    if (!lead.stageId) continue;
    const stage = stageMap.get(lead.stageId);
    if (!stage) continue;

    const valueCents = getEffectiveDealValueCents(lead.dealValueOverrideCents, defaultDealValueCents);
    stage.count += 1;
    stage.valueCents += valueCents;

    if (stage.isWon) {
      wonRevenueCents += valueCents;
      wonCount += 1;
    } else if (stage.isLost) {
      lostValueCents += valueCents;
      lostCount += 1;
    } else {
      pipelineValueCents += valueCents;
    }
  }

  const callsByDay = Array.from({ length: 7 }).map((_, index) => {
    const date = subDays(new Date(), 6 - index);
    const day = format(date, "dd/MM");
    return {
      day,
      calls: calls.filter((call) => format(call.startedAt, "dd/MM") === day).length
    };
  });

  const responseRate = calls.length ? Math.round((answeredCalls / calls.length) * 100) : 0;
  const winRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;
  const wonStageIds = new Set(stages.filter((stage) => stage.isWon).map((stage) => stage.id));
  const wonRevenueByDay = Array.from({ length: 30 }).map((_, index) => ({
    day: format(subDays(new Date(), 29 - index), "dd/MM"),
    valueCents: 0
  }));
  const wonRevenueByDayMap = new Map(wonRevenueByDay.map((item) => [item.day, item]));

  for (const activity of stageChangedActivities) {
    const metadata =
      activity.metadata && typeof activity.metadata === "object" && !Array.isArray(activity.metadata)
        ? (activity.metadata as Record<string, unknown>)
        : {};
    const toStageId = typeof metadata.toStageId === "string" ? metadata.toStageId : null;
    const fromStageId = typeof metadata.fromStageId === "string" ? metadata.fromStageId : null;
    if (!toStageId || !wonStageIds.has(toStageId) || (fromStageId && wonStageIds.has(fromStageId))) continue;

    const bucket = wonRevenueByDayMap.get(format(activity.createdAt, "dd/MM"));
    if (!bucket) continue;
    bucket.valueCents += getEffectiveDealValueCents(activity.lead.dealValueOverrideCents, defaultDealValueCents);
  }

  return (
    <AppShell user={user}>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Sales metrics, recent activity, and tracking for pipeline value and won revenue.</p>
        </div>
      </div>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="Total leads" value={totalLeads} />
        <StatCard label="New in 7 days" value={newLeadsWeek} />
        <StatCard label="Pipeline value" value={formatCurrencyFromCents(pipelineValueCents)} />
        <StatCard label="Won revenue" value={formatCurrencyFromCents(wonRevenueCents)} />
        <StatCard label="Calls in 7 days" value={calls.length} />
        <StatCard label="Response rate" value={`${responseRate}%`} />
        <StatCard label="Win rate" value={`${winRate}%`} />
        <StatCard
          label="Average deal size"
          value={formatCurrencyFromCents(defaultDealValueCents)}
          hint="Default value from settings"
        />
      </div>
      <DashboardCharts
        stageOverview={Array.from(stageMap.values()).map((stage) => ({
          id: stage.id,
          name: stage.name,
          count: stage.count,
          valueCents: stage.valueCents,
          color: stage.color
        }))}
        callsByDay={callsByDay}
        wonRevenueByDay={wonRevenueByDay}
        outcomes={outcomes.map((item) => ({
          name: item.outcome ?? "OTHER",
          value: item._count.outcome
        }))}
      />
      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <StatCard label="Deals won" value={wonCount} />
        <StatCard label="Lost value" value={formatCurrencyFromCents(lostValueCents)} />
      </div>
      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Recent imports</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>User</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Error count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((item) => (
                <tr key={item.id}>
                  <td>{item.filename}</td>
                  <td>{item.createdBy.name}</td>
                  <td>{item.createdRows}</td>
                  <td>{item.updatedRows}</td>
                  <td>{item.errorRows}</td>
                  <td><span className="badge">{item.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
