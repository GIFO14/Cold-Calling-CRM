import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth/api";

const schema = z.object({
  leadId: z.string(),
  phoneDialed: z.string().min(1),
  sipCallId: z.string().optional()
});

export async function POST(request: Request) {
  return withUser(async (user) => {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid call" }, { status: 400 });

    const lead = await prisma.lead.findFirst({
      where: {
        id: parsed.data.leadId,
        ...(user.role === "ADMIN" ? {} : { ownerId: user.id })
      }
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    if (lead.phoneInvalid || lead.phoneOptOut) {
      return NextResponse.json({ error: "This lead cannot be called" }, { status: 409 });
    }

    const call = await prisma.callLog.create({
      data: {
        leadId: lead.id,
        userId: user.id,
        phoneDialed: parsed.data.phoneDialed,
        sipCallId: parsed.data.sipCallId,
        status: "STARTED"
      }
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastContactedAt: new Date() }
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        userId: user.id,
        type: "CALL_STARTED",
        title: "Call started",
        body: parsed.data.phoneDialed,
        metadata: { callLogId: call.id }
      }
    });

    return NextResponse.json({ call }, { status: 201 });
  });
}
