import { endOfWeek, format, startOfWeek, subDays } from "date-fns";
import { redirect } from "next/navigation";
import { FollowUpCalendar } from "@/components/dashboard/FollowUpCalendar";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { StatCard } from "@/components/ui/StatCard";
import { getCurrentUser } from "@/lib/auth/session";
import { POSITIVE_SCRIPT_OUTCOMES, getActiveCallScript } from "@/lib/call-script";
import { formatCallOutcome } from "@/lib/calls/outcomes";
import { prisma } from "@/lib/db";
import { displayLeadName } from "@/lib/leads/normalize";
import { formatCurrencyFromCents, getEffectiveDealValueCents } from "@/lib/money";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const leadWhere = { testing: false, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) };
  const callWhere = {
    ...(user.role === "ADMIN" ? {} : { userId: user.id }),
    lead: { is: { testing: false } }
  };
  const stageActivityLeadWhere = user.role === "ADMIN" ? { testing: false } : { ownerId: user.id, testing: false };
  const sevenDaysAgo = subDays(new Date(), 7);
  const thirtyDaysAgo = subDays(new Date(), 30);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const [
    businessSettings,
    stages,
    leads,
    calls,
    answeredCalls,
    outcomes,
    imports,
    stageChangedActivities,
    scheduledCalls,
    activeScript
  ] =
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
          firstName: true,
          lastName: true,
          fullName: true,
          company: true,
          phone: true,
          nextFollowUpAt: true,
          owner: { select: { name: true } },
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
          lead: { is: stageActivityLeadWhere }
        },
        select: {
          createdAt: true,
          metadata: true,
          lead: { select: { dealValueOverrideCents: true } }
        },
        orderBy: { createdAt: "asc" }
      }),
      prisma.lead.findMany({
        where: {
          ...leadWhere,
          nextFollowUpAt: {
            gte: weekStart,
            lte: weekEnd
          }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          company: true,
          phone: true,
          nextFollowUpAt: true,
          owner: { select: { name: true } }
        },
        orderBy: { nextFollowUpAt: "asc" }
      }),
      getActiveCallScript()
    ]);

  const [scriptSessions, scriptEvents] = activeScript
    ? await Promise.all([
        prisma.callScriptSession.findMany({
          where: {
            scriptId: activeScript.id,
            startedAt: { gte: thirtyDaysAgo },
            lead: { is: { testing: false } },
            ...(user.role === "ADMIN" ? {} : { userId: user.id })
          },
          include: {
            callLog: {
              select: { outcome: true }
            }
          }
        }),
        prisma.callScriptSessionEvent.findMany({
          where: {
            createdAt: { gte: thirtyDaysAgo },
            type: { in: ["OBJECTION_OPENED", "RESPONSE_SHOWN"] },
            session: {
              scriptId: activeScript.id,
              lead: { is: { testing: false } },
              ...(user.role === "ADMIN" ? {} : { userId: user.id })
            }
          },
          select: {
            type: true,
            sessionId: true,
            objectionId: true,
            responseId: true,
            objection: { select: { label: true } },
            response: { select: { label: true, position: true } },
            session: { select: { callLog: { select: { outcome: true } } } }
          },
          orderBy: { createdAt: "asc" }
        })
      ])
    : [[], []];

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

  const scriptSessionCount = scriptSessions.length;
  const completedScriptCount = scriptSessions.filter((session) => session.status === "COMPLETED").length;
  const scriptCompletionRate = scriptSessionCount ? Math.round((completedScriptCount / scriptSessionCount) * 100) : 0;
  const hangupsByStep = activeScript
    ? activeScript.steps.map((step, index) => ({
        step: step.title,
        count: scriptSessions.filter((session) => session.status === "CALL_ENDED" && session.currentStepIndex === index).length
      }))
    : [];
  const reachByStep = activeScript
    ? activeScript.steps.map((step, index) => ({
        step: step.title,
        count: scriptSessions.filter((session) => session.highestStepIndex >= index).length
      }))
    : [];

  const objectionCountsMap = new Map<string, number>();
  const responsePerformanceMap = new Map<
    string,
    { label: string; shown: number; positive: number }
  >();

  for (const event of scriptEvents) {
    if (event.type === "OBJECTION_OPENED" && event.objection?.label) {
      objectionCountsMap.set(event.objection.label, (objectionCountsMap.get(event.objection.label) ?? 0) + 1);
    }

    if (event.type === "RESPONSE_SHOWN" && event.responseId) {
      const responseKey = `${event.sessionId}:${event.responseId}`;
      if (responsePerformanceMap.has(responseKey)) continue;

      const responseLabel = event.response?.label?.trim()
        ? event.response.label
        : `Resposta ${event.response?.position ?? ""}`.trim();
      const outcome = event.session.callLog?.outcome ?? null;
      responsePerformanceMap.set(responseKey, {
        label: responseLabel,
        shown: 1,
        positive: outcome && POSITIVE_SCRIPT_OUTCOMES.includes(outcome) ? 1 : 0
      });
    }
  }

  const objectionCounts = Array.from(objectionCountsMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const responseRollupMap = new Map<string, { label: string; shown: number; positive: number }>();
  for (const item of responsePerformanceMap.values()) {
    const current = responseRollupMap.get(item.label);
    if (current) {
      current.shown += item.shown;
      current.positive += item.positive;
      continue;
    }

    responseRollupMap.set(item.label, { ...item });
  }

  const responsePerformance = Array.from(responseRollupMap.values())
    .map((item) => ({
      ...item,
      successRate: item.shown ? Math.round((item.positive / item.shown) * 100) : 0
    }))
    .sort((a, b) => {
      if (b.successRate !== a.successRate) return b.successRate - a.successRate;
      return b.shown - a.shown;
    })
    .slice(0, 8);

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
          name: formatCallOutcome(item.outcome),
          value: item._count.outcome
        }))}
      />
      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <StatCard label="Deals won" value={wonCount} />
        <StatCard label="Lost value" value={formatCurrencyFromCents(lostValueCents)} />
      </div>
      {activeScript ? (
        <>
          <div className="grid grid-3" style={{ marginTop: 18 }}>
            <StatCard label="Script sessions (30d)" value={scriptSessionCount} />
            <StatCard label="Completed script" value={`${scriptCompletionRate}%`} />
            <StatCard
              label="Most used objection"
              value={objectionCounts[0]?.label ?? "-"}
              hint={objectionCounts[0] ? `${objectionCounts[0].count} times` : "No objection data yet"}
            />
          </div>
          <div className="grid grid-3" style={{ marginTop: 18 }}>
            <section className="panel">
              <h2>Where calls usually stop</h2>
              <div className="grid">
                {hangupsByStep.length ? (
                  hangupsByStep.map((item) => (
                    <div key={item.step} className="callout">
                      <strong>{item.step}</strong>
                      <span>{item.count} calls ended here</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">No script sessions yet.</p>
                )}
              </div>
            </section>
            <section className="panel">
              <h2>How far conversations get</h2>
              <div className="grid">
                {reachByStep.length ? (
                  reachByStep.map((item) => (
                    <div key={item.step} className="callout">
                      <strong>{item.step}</strong>
                      <span>{item.count} sessions reached this step</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">No reach data yet.</p>
                )}
              </div>
            </section>
            <section className="panel">
              <h2>Top objections</h2>
              <div className="grid">
                {objectionCounts.length ? (
                  objectionCounts.map((item) => (
                    <div key={item.label} className="callout">
                      <strong>{item.label}</strong>
                      <span>{item.count} times</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">No objections logged yet.</p>
                )}
              </div>
            </section>
          </div>
          <section className="panel" style={{ marginTop: 18 }}>
            <h2>Response variant performance</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Variant</th>
                    <th>Shown</th>
                    <th>Positive outcomes</th>
                    <th>Success rate</th>
                  </tr>
                </thead>
                <tbody>
                  {responsePerformance.length ? (
                    responsePerformance.map((item) => (
                      <tr key={item.label}>
                        <td>{item.label}</td>
                        <td>{item.shown}</td>
                        <td>{item.positive}</td>
                        <td>{item.successRate}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="muted">
                        No response variants have been shown yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="section-title-row">
          <div>
            <h2>Scheduled calls this week</h2>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              All leads with a next call date in the current week.
            </p>
          </div>
        </div>
        <FollowUpCalendar
          items={scheduledCalls
            .filter((lead) => Boolean(lead.nextFollowUpAt))
            .map((lead) => ({
              leadId: lead.id,
              leadLabel: displayLeadName(lead),
              company: lead.company,
              ownerName: lead.owner?.name ?? null,
              phone: lead.phone,
              nextFollowUpAt: lead.nextFollowUpAt as Date
            }))}
        />
      </section>
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
