import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth/api";

const idsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200)
});

const changeStageSchema = idsSchema.extend({
  stageId: z.string().min(1)
});

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

export async function PATCH(request: Request) {
  return withUser(async (user) => {
    const parsed = changeStageSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Dades no vàlides" }, { status: 400 });
    }

    const ids = uniqueIds(parsed.data.ids);
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: parsed.data.stageId, active: true },
      select: { id: true, name: true }
    });

    if (!stage) {
      return NextResponse.json({ error: "Stage no trobat" }, { status: 404 });
    }

    const leads = await prisma.lead.findMany({
      where: {
        id: { in: ids },
        ...(user.role === "ADMIN" ? {} : { ownerId: user.id })
      },
      select: {
        id: true,
        stageId: true,
        stage: { select: { name: true } }
      }
    });

    if (leads.length !== ids.length) {
      return NextResponse.json(
        { error: "Alguns leads no existeixen o no són accessibles" },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      prisma.lead.updateMany({
        where: {
          id: { in: ids },
          ...(user.role === "ADMIN" ? {} : { ownerId: user.id })
        },
        data: { stageId: stage.id }
      }),
      prisma.leadActivity.createMany({
        data: leads.map((lead) => ({
          leadId: lead.id,
          userId: user.id,
          type: "STAGE_CHANGED",
          title: "Stage canviat en massa",
          body: `${lead.stage?.name ?? "Sense stage"} -> ${stage.name}`,
          metadata: { fromStageId: lead.stageId, toStageId: stage.id }
        }))
      })
    ]);

    return NextResponse.json({ updatedCount: leads.length });
  });
}

export async function DELETE(request: Request) {
  return withUser(async (user) => {
    const parsed = idsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Dades no vàlides" }, { status: 400 });
    }

    const ids = uniqueIds(parsed.data.ids);
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: ids },
        ...(user.role === "ADMIN" ? {} : { ownerId: user.id })
      },
      select: { id: true }
    });

    if (leads.length !== ids.length) {
      return NextResponse.json(
        { error: "Alguns leads no existeixen o no són accessibles" },
        { status: 404 }
      );
    }

    await prisma.lead.deleteMany({
      where: {
        id: { in: ids },
        ...(user.role === "ADMIN" ? {} : { ownerId: user.id })
      }
    });

    return NextResponse.json({ deletedCount: leads.length });
  });
}
