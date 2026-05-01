import { NextResponse } from "next/server";
import { z } from "zod";
import { closeCallScriptSessionByCallLogId } from "@/lib/call-script";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth/api";

const schema = z.object({
  status: z.enum(["STARTED", "RINGING", "ANSWERED", "COMPLETED", "FAILED", "MISSED", "CANCELED"]),
  sipCallId: z.string().optional()
});
type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return withUser(async (user) => {
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

    const existing = await prisma.callLog.findFirst({
      where: { id, ...(user.role === "ADMIN" ? {} : { userId: user.id }) }
    });
    if (!existing) return NextResponse.json({ error: "Call not found" }, { status: 404 });

    const now = new Date();
    const call = await prisma.callLog.update({
      where: { id },
      data: {
        status: parsed.data.status,
        sipCallId: parsed.data.sipCallId,
        answeredAt: parsed.data.status === "ANSWERED" ? now : undefined,
        endedAt: ["COMPLETED", "FAILED", "MISSED", "CANCELED"].includes(parsed.data.status) ? now : undefined
      }
    });

    if (["COMPLETED", "FAILED", "MISSED", "CANCELED"].includes(parsed.data.status)) {
      await closeCallScriptSessionByCallLogId(id, parsed.data.status.toLowerCase());
    }

    return NextResponse.json({ call });
  });
}
