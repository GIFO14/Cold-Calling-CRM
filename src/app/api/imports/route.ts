import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth/api";
import { parseCsvText } from "@/lib/csv/parser";
import { CsvColumnMapping, inferCsvMapping } from "@/lib/csv/mapping";
import { importLeads } from "@/lib/leads/import-service";

export async function GET() {
  return withUser(async (user) => {
    const imports = await prisma.importBatch.findMany({
      where: user.role === "ADMIN" ? undefined : { createdById: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { createdBy: { select: { name: true } } }
    });
    return NextResponse.json({ imports });
  });
}

export async function POST(request: Request) {
  return withUser(async (user) => {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV no trobat" }, { status: 400 });
    }

    const parsed = parseCsvText(await file.text());
    const mappingRaw = formData.get("mapping");
    const mapping = mappingRaw
      ? (JSON.parse(String(mappingRaw)) as CsvColumnMapping[])
      : inferCsvMapping(parsed.headers);

    const importBatch = await importLeads({
      filename: file.name,
      rows: parsed.rows,
      mapping,
      userId: user.id
    });

    return NextResponse.json({ importBatch });
  });
}
