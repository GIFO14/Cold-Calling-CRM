import { endOfDay, endOfWeek, startOfDay, startOfWeek } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth/api";
import { normalizeCompanySize, parsePriorityTier } from "@/lib/leads/enriched-field-helpers";
import { getEffectiveDealValueCents } from "@/lib/money";
import { normalizeEmail, normalizePhone } from "@/lib/leads/normalize";

const createLeadSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  linkedinUrl: z.string().optional(),
  source: z.string().optional(),
  stageId: z.string().optional(),
  dealValueOverrideCents: z.number().int().nonnegative().nullable().optional(),
  customFields: z.record(z.string(), z.unknown()).optional()
});

function getSearchParamValues(searchParams: URLSearchParams, key: string) {
  return searchParams.getAll(key).map((value) => value.trim()).filter(Boolean);
}

export async function GET(request: Request) {
  return withUser(async (user) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim();
    const hasStageFilter = url.searchParams.getAll("stageFilter").includes("1");
    const selectedStageIds = getSearchParamValues(url.searchParams, "stageId");
    const ownerId = url.searchParams.get("ownerId") || undefined;
    const priorityFilter = parsePriorityTier(url.searchParams.get("priority"));
    const companySizeFilter = normalizeCompanySize(url.searchParams.get("companySize"));
    const scheduledCallFilter =
      url.searchParams.get("scheduledCall") === "scheduled" ||
      url.searchParams.get("scheduledCall") === "unscheduled"
        ? url.searchParams.get("scheduledCall")
        : null;
    const includeCalledToday = url.searchParams.get("includeCalledToday") !== "0";
    const includeCalledWeek = url.searchParams.get("includeCalledWeek") !== "0";
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

    const leadCandidates = await prisma.lead.findMany({
      where: {
        ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
        NOT: {
          stage: {
            is: { isLost: true }
          }
        },
        ...(hasStageFilter
          ? selectedStageIds.length
            ? { stageId: { in: selectedStageIds } }
            : { id: "__no-matching-stage-selection__" }
          : {}),
        ...(scheduledCallFilter === "scheduled"
          ? { nextFollowUpAt: { not: null } }
          : scheduledCallFilter === "unscheduled"
          ? { nextFollowUpAt: null }
          : {}),
        ...(calledExclusionFilters.length ? { AND: calledExclusionFilters } : {}),
        ...(ownerId && user.role === "ADMIN" ? { ownerId } : {}),
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { company: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: {
        owner: { select: { name: true } },
        stage: true,
        callLogs: { orderBy: { startedAt: "desc" }, take: 1 }
      },
      orderBy: { updatedAt: "desc" }
    });

    const leads = leadCandidates
      .filter((lead) => {
        const fields =
          lead.customFields && typeof lead.customFields === "object" && !Array.isArray(lead.customFields)
            ? (lead.customFields as Record<string, unknown>)
            : null;

        if (priorityFilter && parsePriorityTier(fields?.priority_tier) !== priorityFilter) return false;
        if (companySizeFilter && normalizeCompanySize(fields?.mida_empresa) !== companySizeFilter) return false;
        return true;
      })
      .slice(0, 200);

    return NextResponse.json({ leads });
  });
}

export async function POST(request: Request) {
  return withUser(async (user) => {
    const body = await request.json();
    const parsed = createLeadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid lead" }, { status: 400 });
    }

    const businessSettings = await prisma.businessSettings.findFirst({
      orderBy: { createdAt: "desc" }
    });
    const defaultStage = await prisma.pipelineStage.findFirst({
      where: { active: true },
      orderBy: { position: "asc" }
    });

    const data = parsed.data;
    const lead = await prisma.lead.create({
      data: {
        ...data,
        ownerId: user.id,
        stageId: data.stageId || defaultStage?.id,
        emailNormalized: normalizeEmail(data.email),
        phoneNormalized: normalizePhone(data.phone),
        fullName:
          data.fullName ||
          [data.firstName, data.lastName].filter(Boolean).join(" ") ||
          undefined,
        customFields: (data.customFields ?? {}) as Prisma.InputJsonValue
      }
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        userId: user.id,
        type: "FIELD_UPDATED",
        title: "Lead created manually"
      }
    });

    return NextResponse.json(
      {
        lead: {
          ...lead,
          effectiveDealValueCents: getEffectiveDealValueCents(
            lead.dealValueOverrideCents,
            businessSettings?.defaultDealValueCents
          )
        }
      },
      { status: 201 }
    );
  });
}
