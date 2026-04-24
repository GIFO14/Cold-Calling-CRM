import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { forbidden, withUser } from "@/lib/auth/api";

const stageSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1).default("#0f766e"),
  isWon: z.boolean().default(false),
  isLost: z.boolean().default(false),
  active: z.boolean().default(true)
});

function revalidateStageViews() {
  revalidatePath("/settings");
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function GET() {
  return withUser(async () => {
    const stages = await prisma.pipelineStage.findMany({
      orderBy: { position: "asc" },
      include: { _count: { select: { leads: true } } }
    });
    return NextResponse.json({ stages });
  });
}

export async function POST(request: Request) {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return forbidden();
    const parsed = stageSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Stage no vàlid" }, { status: 400 });

    const last = await prisma.pipelineStage.findFirst({ orderBy: { position: "desc" } });
    const stage = await prisma.pipelineStage.create({
      data: { ...parsed.data, position: (last?.position ?? 0) + 1 }
    });
    revalidateStageViews();
    return NextResponse.json({ stage }, { status: 201 });
  });
}
