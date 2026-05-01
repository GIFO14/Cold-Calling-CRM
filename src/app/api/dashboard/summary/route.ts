import { NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import { formatCallOutcome } from "@/lib/calls/outcomes";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth/api";
import { getEffectiveDealValueCents } from "@/lib/money";

export async function GET() {
  return withUser(async (user) => {
    const leadWhere = { testing: false, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) };
    const callWhere = {
      ...(user.role === "ADMIN" ? {} : { userId: user.id }),
      lead: { is: { testing: false } }
    };
    const stageActivityLeadWhere = user.role === "ADMIN" ? { testing: false } : { ownerId: user.id, testing: false };
    const weekStart = subDays(new Date(), 7);
    const monthStart = subDays(new Date(), 30);

    const [businessSettings, stages, leads, callsWeek, answeredCallsWeek, outcomes, imports, stageChangedActivities] = await Promise.all([
      prisma.businessSettings.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.pipelineStage.findMany({
        where: { active: true },
        orderBy: { position: "asc" },
        select: { id: true, name: true, color: true, isWon: true, isLost: true }
      }),
      prisma.lead.findMany({
        where: leadWhere,
        select: { stageId: true, dealValueOverrideCents: true, createdAt: true }
      }),
      prisma.callLog.findMany({
        where: { ...callWhere, startedAt: { gte: weekStart } },
        orderBy: { startedAt: "asc" }
      }),
      prisma.callLog.count({
        where: {
          ...callWhere,
          startedAt: { gte: weekStart },
          status: { in: ["ANSWERED", "COMPLETED"] }
        }
      }),
      prisma.callLog.groupBy({
        by: ["outcome"],
        where: { ...callWhere, startedAt: { gte: monthStart }, outcome: { not: null } },
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
          createdAt: { gte: monthStart },
          lead: { is: stageActivityLeadWhere }
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
    const newLeadsWeek = leads.filter((lead) => lead.createdAt >= weekStart).length;
    const responseRate = callsWeek.length ? Math.round((answeredCallsWeek / callsWeek.length) * 100) : 0;
    const stageMap = new Map(
      stages.map((stage) => [
        stage.id,
        { ...stage, count: 0, valueCents: 0 }
      ])
    );
    let pipelineValueCents = 0;
    let wonRevenueCents = 0;

    for (const lead of leads) {
      if (!lead.stageId) continue;
      const stage = stageMap.get(lead.stageId);
      if (!stage) continue;

      const valueCents = getEffectiveDealValueCents(lead.dealValueOverrideCents, defaultDealValueCents);
      stage.count += 1;
      stage.valueCents += valueCents;

      if (stage.isWon) {
        wonRevenueCents += valueCents;
      } else if (!stage.isLost) {
        pipelineValueCents += valueCents;
      }
    }

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

    return NextResponse.json({
      defaultDealValueCents,
      totalLeads,
      newLeadsWeek,
      responseRate,
      pipelineValueCents,
      wonRevenueCents,
      stageOverview: Array.from(stageMap.values()).map((stage) => ({
        id: stage.id,
        name: stage.name,
        count: stage.count,
        valueCents: stage.valueCents,
        color: stage.color
      })),
      callsWeek,
      wonRevenueByDay,
      outcomeBreakdown: outcomes.map((item) => ({
        name: formatCallOutcome(item.outcome),
        value: item._count.outcome
      })),
      imports
    });
  });
}
