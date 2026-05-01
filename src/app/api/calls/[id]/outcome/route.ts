import { NextResponse } from "next/server";
import { z } from "zod";
import { CALL_OUTCOME_VALUES } from "@/lib/calls/outcomes";
import { closeCallScriptSessionByCallLogId } from "@/lib/call-script";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth/api";

const schema = z.object({
  outcome: z.enum(CALL_OUTCOME_VALUES),
  notes: z.string().optional()
});
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withUser(async (user) => {
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });

    const existing = await prisma.callLog.findFirst({
      where: { id, ...(user.role === "ADMIN" ? {} : { userId: user.id }) }
    });
    if (!existing) return NextResponse.json({ error: "Call not found" }, { status: 404 });

    const endedAt = existing.endedAt ?? new Date();
    const durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - existing.startedAt.getTime()) / 1000)
    );

    const call = await prisma.callLog.update({
      where: { id },
      data: {
        status: existing.status === "FAILED" ? "FAILED" : "COMPLETED",
        outcome: parsed.data.outcome,
        notes: parsed.data.notes,
        endedAt,
        durationSeconds
      }
    });

    await closeCallScriptSessionByCallLogId(id, `outcome_${parsed.data.outcome.toLowerCase()}`);

    await prisma.leadActivity.create({
      data: {
        leadId: existing.leadId,
        userId: user.id,
        type: existing.status === "FAILED" ? "CALL_FAILED" : "CALL_ENDED",
        title: "Call ended",
        body: parsed.data.notes,
        metadata: { callLogId: id, outcome: parsed.data.outcome }
      }
    });

    if (parsed.data.outcome === "DO_NOT_CALL" || parsed.data.outcome === "WRONG_NUMBER") {
      await prisma.lead.update({
        where: { id: existing.leadId },
        data: {
          phoneOptOut: parsed.data.outcome === "DO_NOT_CALL" ? true : undefined,
          phoneInvalid: parsed.data.outcome === "WRONG_NUMBER" ? true : undefined
        }
      });
    }

    return NextResponse.json({ call });
  });
}
