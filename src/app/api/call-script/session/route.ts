import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CALL_SCRIPT_SESSION_INCLUDE,
  ensureActiveCallScript,
  normalizeCallScriptLanguage
} from "@/lib/call-script";
import { withUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { displayLeadName } from "@/lib/leads/normalize";

const schema = z
  .object({
    leadId: z.string().min(1).optional(),
    callLogId: z.string().min(1).optional(),
    languageCode: z.string().optional(),
    testMode: z.boolean().optional()
  })
  .superRefine((value, ctx) => {
    if (value.testMode) return;

    if (!value.leadId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["leadId"],
        message: "Lead is required"
      });
    }

    if (!value.callLogId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["callLogId"],
        message: "Call log is required"
      });
    }
  });

export async function POST(request: Request) {
  return withUser(async (user) => {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid session start" }, { status: 400 });
    }

    const languageCode = normalizeCallScriptLanguage(parsed.data.languageCode);
    const script = await ensureActiveCallScript(user.id, languageCode);

    if (parsed.data.testMode) {
      let lead = await prisma.lead.findFirst({
        where: {
          testing: true,
          source: "CALL_SCRIPT_TEST",
          ...(user.role === "ADMIN" ? { ownerId: user.id } : { ownerId: user.id })
        }
      });

      if (!lead) {
        lead = await prisma.lead.create({
          data: {
            fullName: "Test Script",
            company: "Practice Mode",
            source: "CALL_SCRIPT_TEST",
            testing: true,
            ownerId: user.id
          }
        });
      }

      const existing = await prisma.callScriptSession.findFirst({
        where: {
          scriptId: script.id,
          leadId: lead.id,
          callLogId: null,
          status: "ACTIVE",
          ...(user.role === "ADMIN" ? {} : { userId: user.id })
        },
        include: CALL_SCRIPT_SESSION_INCLUDE,
        orderBy: { startedAt: "desc" }
      });

      if (existing) {
        return NextResponse.json({
          session: existing,
          script: existing.script,
          leadLabel: displayLeadName(lead)
        });
      }

      const session = await prisma.callScriptSession.create({
        data: {
          scriptId: script.id,
          leadId: lead.id,
          userId: user.id,
          status: "ACTIVE",
          pane: "SCRIPT",
          currentStepIndex: 0,
          highestStepIndex: 0,
          events: {
            create: [
              {
                type: "SESSION_STARTED",
                stepPosition: 1,
                metadata: { mode: "test" }
              },
              {
                type: "STEP_SHOWN",
                stepId: script.steps[0]?.id,
                stepPosition: 1,
                metadata: { mode: "test" }
              }
            ]
          }
        },
        include: CALL_SCRIPT_SESSION_INCLUDE
      });

      return NextResponse.json(
        {
          session,
          script: session.script,
          leadLabel: displayLeadName(lead)
        },
        { status: 201 }
      );
    }

    const [lead, callLog] = await Promise.all([
      prisma.lead.findFirst({
        where: {
          id: parsed.data.leadId,
          ...(user.role === "ADMIN" ? {} : { ownerId: user.id })
        }
      }),
      prisma.callLog.findFirst({
        where: {
          id: parsed.data.callLogId,
          leadId: parsed.data.leadId,
          ...(user.role === "ADMIN" ? {} : { userId: user.id })
        }
      })
    ]);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!callLog) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const existing = await prisma.callScriptSession.findUnique({
      where: { callLogId: callLog.id },
      include: CALL_SCRIPT_SESSION_INCLUDE
    });

    if (existing) {
      return NextResponse.json({
        session: existing,
        script: existing.script,
        leadLabel: displayLeadName(lead)
      });
    }

    const session = await prisma.callScriptSession.create({
      data: {
        scriptId: script.id,
        leadId: lead.id,
        userId: user.id,
        callLogId: callLog.id,
        status: "ACTIVE",
        pane: "SCRIPT",
        currentStepIndex: 0,
        highestStepIndex: 0,
        events: {
          create: [
            {
              type: "SESSION_STARTED",
              stepPosition: 1,
              metadata: { callLogId: callLog.id }
            },
            {
              type: "STEP_SHOWN",
              stepId: script.steps[0]?.id,
              stepPosition: 1
            }
          ]
        }
      },
      include: CALL_SCRIPT_SESSION_INCLUDE
    });

    return NextResponse.json(
      {
        session,
        script: session.script,
        leadLabel: displayLeadName(lead)
      },
      { status: 201 }
    );
  });
}
