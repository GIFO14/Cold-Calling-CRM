import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth/api";
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

export async function GET(request: Request) {
  return withUser(async (user) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim();
    const stageId = url.searchParams.get("stageId") || undefined;
    const ownerId = url.searchParams.get("ownerId") || undefined;

    const leads = await prisma.lead.findMany({
      where: {
        ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
        ...(stageId ? { stageId } : {}),
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
      orderBy: { updatedAt: "desc" },
      take: 200
    });

    return NextResponse.json({ leads });
  });
}

export async function POST(request: Request) {
  return withUser(async (user) => {
    const body = await request.json();
    const parsed = createLeadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Lead no vàlid" }, { status: 400 });
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
        title: "Lead creat manualment"
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
