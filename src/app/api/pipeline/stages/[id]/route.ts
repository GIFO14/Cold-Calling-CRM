import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { forbidden, withUser } from "@/lib/auth/api";

const schema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
  active: z.boolean().optional()
});

type Params = { params: Promise<{ id: string }> };

function revalidateStageViews() {
  revalidatePath("/settings");
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function PATCH(request: Request, { params }: Params) {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return forbidden();
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Stage no vàlid" }, { status: 400 });

    const stage = await prisma.pipelineStage.update({
      where: { id },
      data: parsed.data
    });
    revalidateStageViews();

    return NextResponse.json({ stage });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return forbidden();
    const { id } = await params;

    await prisma.pipelineStage.delete({
      where: { id }
    });
    revalidateStageViews();

    return NextResponse.json({ ok: true });
  });
}
