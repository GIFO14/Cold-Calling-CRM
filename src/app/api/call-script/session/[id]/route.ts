import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CALL_SCRIPT_SESSION_INCLUDE,
  chooseRandomResponse,
  closeCallScriptSessionByCallLogId
} from "@/lib/call-script";
import { withUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";

const schema = z.object({
  action: z.enum([
    "BACK",
    "ADVANCE",
    "OPEN_OBJECTION",
    "CHOOSE_STEP_OPTION",
    "CHOOSE_OBJECTION_OPTION",
    "RETURN_TO_SCRIPT",
    "ADVANCE_FROM_OBJECTION",
    "CLOSE"
  ]),
  stepChoiceId: z.string().optional(),
  objectionChoiceId: z.string().optional(),
  objectionId: z.string().optional(),
  responseId: z.string().optional(),
  reason: z.string().optional()
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return withUser(async (user) => {
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid script action" }, { status: 400 });
    }

    const session = await prisma.callScriptSession.findFirst({
      where: {
        id,
        ...(user.role === "ADMIN" ? {} : { userId: user.id })
      },
      include: CALL_SCRIPT_SESSION_INCLUDE
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const totalSteps = session.script.steps.length;
    const currentStep = session.script.steps[session.currentStepIndex] ?? null;

    if (parsed.data.action === "CLOSE") {
      const closed = session.callLogId
        ? await closeCallScriptSessionByCallLogId(session.callLogId, parsed.data.reason ?? "manual_close")
        : await prisma.callScriptSession.update({
            where: { id: session.id },
            data: {
              status: "CALL_ENDED",
              endedAt: new Date(),
              endReason: parsed.data.reason ?? "manual_close",
              pane: "SCRIPT",
              selectedObjectionId: null,
              selectedResponseId: null,
              events: {
                create: {
                  type: "SESSION_CLOSED",
                  stepPosition: session.currentStepIndex + 1,
                  metadata: { reason: parsed.data.reason ?? "manual_close" }
                }
              }
            },
            include: CALL_SCRIPT_SESSION_INCLUDE
          });

      return NextResponse.json({ session: closed, script: session.script });
    }

    if (session.status !== "ACTIVE") {
      return NextResponse.json({ session, script: session.script });
    }

    if (parsed.data.action === "BACK") {
      const nextIndex = Math.max(0, session.currentStepIndex - 1);
      const nextStep = session.script.steps[nextIndex] ?? null;
      const updated =
        nextIndex === session.currentStepIndex
          ? session
          : await prisma.callScriptSession.update({
              where: { id: session.id },
              data: {
                pane: "SCRIPT",
                currentStepIndex: nextIndex,
                selectedObjectionId: null,
                selectedResponseId: null,
                events: {
                  create: [
                    {
                      type: "STEP_BACK",
                      stepId: nextStep?.id,
                      stepPosition: nextIndex + 1
                    },
                    {
                      type: "STEP_SHOWN",
                      stepId: nextStep?.id,
                      stepPosition: nextIndex + 1
                    }
                  ]
                }
              },
              include: CALL_SCRIPT_SESSION_INCLUDE
            });

      return NextResponse.json({ session: updated, script: updated.script });
    }

    if (parsed.data.action === "OPEN_OBJECTION") {
      const objection = session.script.objections.find((item) => item.id === parsed.data.objectionId);
      if (!objection) {
        return NextResponse.json({ error: "Objection not found" }, { status: 404 });
      }

      const selectedResponse = parsed.data.responseId
        ? objection.responses.find((item) => item.id === parsed.data.responseId) ?? null
        : chooseRandomResponse(objection.responses);
      if (!selectedResponse) {
        return NextResponse.json({ error: "This objection has no responses" }, { status: 409 });
      }

      const updated = await prisma.callScriptSession.update({
        where: { id: session.id },
        data: {
          pane: "OBJECTION",
          selectedObjectionId: objection.id,
          selectedResponseId: selectedResponse.id,
          events: {
            create: [
              {
                type: "OBJECTION_OPENED",
                objectionId: objection.id,
                stepId: currentStep?.id,
                stepPosition: session.currentStepIndex + 1
              },
              {
                type: "RESPONSE_SHOWN",
                objectionId: objection.id,
                responseId: selectedResponse.id,
                stepId: currentStep?.id,
                stepPosition: session.currentStepIndex + 1
              }
            ]
          }
        },
        include: CALL_SCRIPT_SESSION_INCLUDE
      });

      return NextResponse.json({ session: updated, script: updated.script });
    }

    if (parsed.data.action === "RETURN_TO_SCRIPT") {
      const updated = await prisma.callScriptSession.update({
        where: { id: session.id },
        data: {
          pane: "SCRIPT",
          selectedObjectionId: null,
          selectedResponseId: null,
          events: {
            create: {
              type: "RETURNED_TO_SCRIPT",
              stepId: currentStep?.id,
              stepPosition: session.currentStepIndex + 1
            }
          }
        },
        include: CALL_SCRIPT_SESSION_INCLUDE
      });

      return NextResponse.json({ session: updated, script: updated.script });
    }

    if (parsed.data.action === "CHOOSE_STEP_OPTION") {
      const choice = currentStep?.choices.find((item) => item.id === parsed.data.stepChoiceId);
      if (!choice) {
        return NextResponse.json({ error: "Step choice not found" }, { status: 404 });
      }

      if (choice.targetType === "OBJECTION") {
        const objection = session.script.objections.find((item) => item.id === choice.targetObjectionId);
        const selectedResponse = objection ? chooseRandomResponse(objection.responses) : null;
        if (!objection || !selectedResponse) {
          return NextResponse.json({ error: "Objection target is invalid" }, { status: 409 });
        }

        const updated = await prisma.callScriptSession.update({
          where: { id: session.id },
          data: {
            pane: "OBJECTION",
            selectedObjectionId: objection.id,
            selectedResponseId: selectedResponse.id,
            events: {
              create: [
                {
                  type: "STEP_OPTION_SELECTED",
                  stepId: currentStep?.id,
                  stepPosition: session.currentStepIndex + 1,
                  metadata: { choiceId: choice.id, label: choice.label }
                },
                {
                  type: "OBJECTION_OPENED",
                  objectionId: objection.id,
                  stepId: currentStep?.id,
                  stepPosition: session.currentStepIndex + 1
                },
                {
                  type: "RESPONSE_SHOWN",
                  objectionId: objection.id,
                  responseId: selectedResponse.id,
                  stepId: currentStep?.id,
                  stepPosition: session.currentStepIndex + 1
                }
              ]
            }
          },
          include: CALL_SCRIPT_SESSION_INCLUDE
        });

        return NextResponse.json({ session: updated, script: updated.script });
      }

      if (choice.targetType === "TERMINAL") {
        const updated = await prisma.callScriptSession.update({
          where: { id: session.id },
          data: {
            status: "COMPLETED",
            endedAt: new Date(),
            endReason: choice.terminalLabel ?? "terminal",
            pane: "SCRIPT",
            selectedObjectionId: null,
            selectedResponseId: null,
            events: {
              create: [
                {
                  type: "STEP_OPTION_SELECTED",
                  stepId: currentStep?.id,
                  stepPosition: session.currentStepIndex + 1,
                  metadata: { choiceId: choice.id, label: choice.label }
                },
                {
                  type: "SESSION_COMPLETED",
                  stepId: currentStep?.id,
                  stepPosition: session.currentStepIndex + 1,
                  metadata: { terminalLabel: choice.terminalLabel ?? "Final" }
                }
              ]
            }
          },
          include: CALL_SCRIPT_SESSION_INCLUDE
        });

        return NextResponse.json({ session: updated, script: updated.script });
      }

      const targetIndex = session.script.steps.findIndex((item) => item.id === choice.targetStepId);
      if (targetIndex === -1) {
        return NextResponse.json({ error: "Step target is invalid" }, { status: 409 });
      }

      const targetStep = session.script.steps[targetIndex] ?? null;
      const updated = await prisma.callScriptSession.update({
        where: { id: session.id },
        data: {
          pane: "SCRIPT",
          currentStepIndex: targetIndex,
          highestStepIndex: Math.max(session.highestStepIndex, targetIndex),
          selectedObjectionId: null,
          selectedResponseId: null,
          events: {
            create: [
              {
                type: "STEP_OPTION_SELECTED",
                stepId: currentStep?.id,
                stepPosition: session.currentStepIndex + 1,
                metadata: { choiceId: choice.id, label: choice.label }
              },
              {
                type: "STEP_SHOWN",
                stepId: targetStep?.id,
                stepPosition: targetIndex + 1
              }
            ]
          }
        },
        include: CALL_SCRIPT_SESSION_INCLUDE
      });

      return NextResponse.json({ session: updated, script: updated.script });
    }

    if (parsed.data.action === "CHOOSE_OBJECTION_OPTION") {
      const currentObjection = session.selectedObjectionId
        ? session.script.objections.find((item) => item.id === session.selectedObjectionId) ?? null
        : null;
      const choice = currentObjection?.choices.find((item) => item.id === parsed.data.objectionChoiceId);
      if (!currentObjection || !choice) {
        return NextResponse.json({ error: "Objection choice not found" }, { status: 404 });
      }

      if (choice.targetType === "OBJECTION") {
        const nextObjection = session.script.objections.find((item) => item.id === choice.targetObjectionId);
        const selectedResponse = nextObjection ? chooseRandomResponse(nextObjection.responses) : null;
        if (!nextObjection || !selectedResponse) {
          return NextResponse.json({ error: "Objection target is invalid" }, { status: 409 });
        }

        const updated = await prisma.callScriptSession.update({
          where: { id: session.id },
          data: {
            pane: "OBJECTION",
            selectedObjectionId: nextObjection.id,
            selectedResponseId: selectedResponse.id,
            events: {
              create: [
                {
                  type: "OBJECTION_OPTION_SELECTED",
                  objectionId: currentObjection.id,
                  stepPosition: session.currentStepIndex + 1,
                  metadata: { choiceId: choice.id, label: choice.label }
                },
                {
                  type: "OBJECTION_OPENED",
                  objectionId: nextObjection.id,
                  stepPosition: session.currentStepIndex + 1
                },
                {
                  type: "RESPONSE_SHOWN",
                  objectionId: nextObjection.id,
                  responseId: selectedResponse.id,
                  stepPosition: session.currentStepIndex + 1
                }
              ]
            }
          },
          include: CALL_SCRIPT_SESSION_INCLUDE
        });

        return NextResponse.json({ session: updated, script: updated.script });
      }

      if (choice.targetType === "TERMINAL") {
        const updated = await prisma.callScriptSession.update({
          where: { id: session.id },
          data: {
            status: "COMPLETED",
            endedAt: new Date(),
            endReason: choice.terminalLabel ?? "terminal",
            pane: "SCRIPT",
            selectedObjectionId: null,
            selectedResponseId: null,
            events: {
              create: [
                {
                  type: "OBJECTION_OPTION_SELECTED",
                  objectionId: currentObjection.id,
                  stepPosition: session.currentStepIndex + 1,
                  metadata: { choiceId: choice.id, label: choice.label }
                },
                {
                  type: "SESSION_COMPLETED",
                  objectionId: currentObjection.id,
                  stepPosition: session.currentStepIndex + 1,
                  metadata: { terminalLabel: choice.terminalLabel ?? "Final" }
                }
              ]
            }
          },
          include: CALL_SCRIPT_SESSION_INCLUDE
        });

        return NextResponse.json({ session: updated, script: updated.script });
      }

      const targetIndex = session.script.steps.findIndex((item) => item.id === choice.targetStepId);
      if (targetIndex === -1) {
        return NextResponse.json({ error: "Step target is invalid" }, { status: 409 });
      }

      const targetStep = session.script.steps[targetIndex] ?? null;
      const updated = await prisma.callScriptSession.update({
        where: { id: session.id },
        data: {
          pane: "SCRIPT",
          currentStepIndex: targetIndex,
          highestStepIndex: Math.max(session.highestStepIndex, targetIndex),
          selectedObjectionId: null,
          selectedResponseId: null,
          events: {
            create: [
              {
                type: "OBJECTION_OPTION_SELECTED",
                objectionId: currentObjection.id,
                stepPosition: session.currentStepIndex + 1,
                metadata: { choiceId: choice.id, label: choice.label }
              },
              {
                type: "STEP_SHOWN",
                stepId: targetStep?.id,
                stepPosition: targetIndex + 1
              }
            ]
          }
        },
        include: CALL_SCRIPT_SESSION_INCLUDE
      });

      return NextResponse.json({ session: updated, script: updated.script });
    }

    const shouldAdvance = parsed.data.action === "ADVANCE" || parsed.data.action === "ADVANCE_FROM_OBJECTION";
    if (!shouldAdvance) {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    if (currentStep?.advanceTargetType) {
      const eventCreates =
        parsed.data.action === "ADVANCE_FROM_OBJECTION"
          ? [
              {
                type: "RETURNED_TO_SCRIPT" as const,
                stepId: currentStep.id,
                stepPosition: session.currentStepIndex + 1
              },
              {
                type: "STEP_COMPLETED" as const,
                stepId: currentStep.id,
                stepPosition: session.currentStepIndex + 1
              }
            ]
          : [
              {
                type: "STEP_COMPLETED" as const,
                stepId: currentStep?.id,
                stepPosition: session.currentStepIndex + 1
              }
            ];

      if (currentStep.advanceTargetType === "OBJECTION") {
        const nextObjection = session.script.objections.find((item) => item.id === currentStep.advanceTargetObjectionId);
        const selectedResponse = nextObjection ? chooseRandomResponse(nextObjection.responses) : null;
        if (!nextObjection || !selectedResponse) {
          return NextResponse.json({ error: "Advance objection target is invalid" }, { status: 409 });
        }

        const updated = await prisma.callScriptSession.update({
          where: { id: session.id },
          data: {
            pane: "OBJECTION",
            selectedObjectionId: nextObjection.id,
            selectedResponseId: selectedResponse.id,
            events: {
              create: [
                ...eventCreates,
                {
                  type: "OBJECTION_OPENED",
                  objectionId: nextObjection.id,
                  stepId: currentStep.id,
                  stepPosition: session.currentStepIndex + 1
                },
                {
                  type: "RESPONSE_SHOWN",
                  objectionId: nextObjection.id,
                  responseId: selectedResponse.id,
                  stepId: currentStep.id,
                  stepPosition: session.currentStepIndex + 1
                }
              ]
            }
          },
          include: CALL_SCRIPT_SESSION_INCLUDE
        });

        return NextResponse.json({ session: updated, script: updated.script });
      }

      if (currentStep.advanceTargetType === "TERMINAL") {
        const updated = await prisma.callScriptSession.update({
          where: { id: session.id },
          data: {
            status: "COMPLETED",
            endedAt: new Date(),
            endReason: currentStep.advanceTerminalLabel ?? "terminal",
            pane: "SCRIPT",
            selectedObjectionId: null,
            selectedResponseId: null,
            events: {
              create: [
                ...eventCreates,
                {
                  type: "SESSION_COMPLETED",
                  stepId: currentStep.id,
                  stepPosition: session.currentStepIndex + 1,
                  metadata: { terminalLabel: currentStep.advanceTerminalLabel ?? "Final" }
                }
              ]
            }
          },
          include: CALL_SCRIPT_SESSION_INCLUDE
        });

        return NextResponse.json({ session: updated, script: updated.script });
      }

      const explicitTargetIndex = session.script.steps.findIndex((item) => item.id === currentStep.advanceTargetStepId);
      if (explicitTargetIndex === -1) {
        return NextResponse.json({ error: "Advance step target is invalid" }, { status: 409 });
      }

      const explicitTargetStep = session.script.steps[explicitTargetIndex] ?? null;
      const updated = await prisma.callScriptSession.update({
        where: { id: session.id },
        data: {
          pane: "SCRIPT",
          currentStepIndex: explicitTargetIndex,
          highestStepIndex: Math.max(session.highestStepIndex, explicitTargetIndex),
          selectedObjectionId: null,
          selectedResponseId: null,
          events: {
            create: [
              ...eventCreates,
              {
                type: "STEP_SHOWN",
                stepId: explicitTargetStep?.id,
                stepPosition: explicitTargetIndex + 1
              }
            ]
          }
        },
        include: CALL_SCRIPT_SESSION_INCLUDE
      });

      return NextResponse.json({ session: updated, script: updated.script });
    }

    const isLastStep = session.currentStepIndex >= totalSteps - 1;
    const nextIndex = isLastStep ? session.currentStepIndex : session.currentStepIndex + 1;
    const nextStep = session.script.steps[nextIndex] ?? null;
    const eventCreates =
      parsed.data.action === "ADVANCE_FROM_OBJECTION"
        ? [
            {
              type: "RETURNED_TO_SCRIPT" as const,
              stepId: currentStep?.id,
              stepPosition: session.currentStepIndex + 1
            },
            {
              type: "STEP_COMPLETED" as const,
              stepId: currentStep?.id,
              stepPosition: session.currentStepIndex + 1
            }
          ]
        : [
            {
              type: "STEP_COMPLETED" as const,
              stepId: currentStep?.id,
              stepPosition: session.currentStepIndex + 1
            }
          ];

    const updated = await prisma.callScriptSession.update({
      where: { id: session.id },
      data: isLastStep
        ? {
            status: "COMPLETED",
            endedAt: new Date(),
            endReason: "script_completed",
            pane: "SCRIPT",
            selectedObjectionId: null,
            selectedResponseId: null,
            events: {
              create: [
                ...eventCreates,
                {
                  type: "SESSION_COMPLETED",
                  stepId: currentStep?.id,
                  stepPosition: session.currentStepIndex + 1
                }
              ]
            }
          }
        : {
            pane: "SCRIPT",
            currentStepIndex: nextIndex,
            highestStepIndex: Math.max(session.highestStepIndex, nextIndex),
            selectedObjectionId: null,
            selectedResponseId: null,
            events: {
              create: [
                ...eventCreates,
                {
                  type: "STEP_SHOWN",
                  stepId: nextStep?.id,
                  stepPosition: nextIndex + 1
                }
              ]
            }
          },
      include: CALL_SCRIPT_SESSION_INCLUDE
    });

    return NextResponse.json({ session: updated, script: updated.script });
  });
}
