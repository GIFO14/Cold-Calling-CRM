import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth/api";

const schema = z.object({ body: z.string().min(1) });
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withUser(async (user) => {
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Nota buida" }, { status: 400 });

    const lead = await prisma.lead.findFirst({
      where: { id, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) }
    });
    if (!lead) return NextResponse.json({ error: "Lead no trobat" }, { status: 404 });

    const activity = await prisma.leadActivity.create({
      data: {
        leadId: id,
        userId: user.id,
        type: "NOTE",
        title: "Nota",
        body: parsed.data.body
      }
    });

    return NextResponse.json({ activity }, { status: 201 });
  });
}
