import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { forbidden, withUser } from "@/lib/auth/api";

const schema = z.object({ ids: z.array(z.string()).min(1) });

function revalidateStageViews() {
  revalidatePath("/settings");
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function POST(request: Request) {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return forbidden();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Ordre no vàlid" }, { status: 400 });

    await prisma.$transaction(
      parsed.data.ids.map((id, position) =>
        prisma.pipelineStage.update({ where: { id }, data: { position } })
      )
    );
    revalidateStageViews();
    return NextResponse.json({ ok: true });
  });
}
