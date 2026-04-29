import { NextResponse } from "next/server";
import { withUser } from "@/lib/auth/api";
import { parseCsvText } from "@/lib/csv/parser";
import { inferCsvMapping } from "@/lib/csv/mapping";

export async function POST(request: Request) {
  return withUser(async () => {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV not found" }, { status: 400 });
    }

    const parsed = parseCsvText(await file.text());
    return NextResponse.json({
      filename: file.name,
      headers: parsed.headers,
      previewRows: parsed.rows.slice(0, 10),
      totalRows: parsed.rows.length,
      mapping: inferCsvMapping(parsed.headers)
    });
  });
}
