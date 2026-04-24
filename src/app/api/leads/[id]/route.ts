import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth/api";
import { getEffectiveDealValueCents } from "@/lib/money";
import { normalizeEmail, normalizePhone } from "@/lib/leads/normalize";

const updateLeadSchema = z.object({
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  phoneInvalid: z.boolean().optional(),
  phoneOptOut: z.boolean().optional(),
  email: z.string().nullable().optional(),
  emailInvalid: z.boolean().optional(),
  emailOptOut: z.boolean().optional(),
  website: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  nextFollowUpAt: z.string().nullable().optional(),
  dealValueOverrideCents: z.number().int().nonnegative().nullable().optional(),
  customFields: z.record(z.string(), z.unknown()).optional()
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withUser(async (user) => {
    const { id } = await params;
    const businessSettings = await prisma.businessSettings.findFirst({
      orderBy: { createdAt: "desc" }
    });
    const lead = await prisma.lead.findFirst({
      where: { id, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) },
      include: {
        owner: { select: { id: true, name: true } },
        stage: true,
        activities: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 100
        },
        callLogs: {
          include: { user: { select: { name: true } } },
          orderBy: { startedAt: "desc" }
        }
      }
    });

    if (!lead) return NextResponse.json({ error: "Lead no trobat" }, { status: 404 });
    return NextResponse.json({
      lead: {
        ...lead,
        effectiveDealValueCents: getEffectiveDealValueCents(
          lead.dealValueOverrideCents,
          businessSettings?.defaultDealValueCents
        )
      }
    });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withUser(async (user) => {
    const { id } = await params;
    const existing = await prisma.lead.findFirst({
      where: { id, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) }
    });
    if (!existing) return NextResponse.json({ error: "Lead no trobat" }, { status: 404 });

    const parsed = updateLeadSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Lead no vàlid" }, { status: 400 });

    const { customFields, ...data } = parsed.data;
    const updateData: Prisma.LeadUpdateInput = {
      ...data,
      nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : data.nextFollowUpAt,
      emailNormalized: data.email !== undefined ? normalizeEmail(data.email) : undefined,
      phoneNormalized: data.phone !== undefined ? normalizePhone(data.phone) : undefined,
      customFields: customFields as Prisma.InputJsonValue | undefined
    };

    const updated = await prisma.lead.update({
      where: { id },
      data: updateData
    });

    await prisma.leadActivity.create({
      data: {
        leadId: id,
        userId: user.id,
        type: "FIELD_UPDATED",
        title: "Lead actualitzat"
      }
    });

    return NextResponse.json({ lead: updated });
  });
}
