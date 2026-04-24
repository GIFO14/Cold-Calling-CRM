import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth/api";

const schema = z.object({ stageId: z.string() });
type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return withUser(async (user) => {
    const { id } = await params;
    const body = schema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Stage no vàlid" }, { status: 400 });

    const existing = await prisma.lead.findFirst({
      where: { id, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) },
      include: { stage: true }
    });
    if (!existing) return NextResponse.json({ error: "Lead no trobat" }, { status: 404 });

    const stage = await prisma.pipelineStage.findUnique({ where: { id: body.data.stageId } });
    if (!stage) return NextResponse.json({ error: "Stage no trobat" }, { status: 404 });

    const lead = await prisma.lead.update({
      where: { id },
      data: { stageId: stage.id }
    });

    await prisma.leadActivity.create({
      data: {
        leadId: id,
        userId: user.id,
        type: "STAGE_CHANGED",
        title: "Stage canviat",
        body: `${existing.stage?.name ?? "Sense stage"} -> ${stage.name}`,
        metadata: { fromStageId: existing.stageId, toStageId: stage.id }
      }
    });

    return NextResponse.json({ lead });
  });
}
