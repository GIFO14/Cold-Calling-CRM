import { NextResponse } from "next/server";
import { ensureActiveCallScript } from "@/lib/call-script";
import { withUser } from "@/lib/auth/api";

export async function GET() {
  return withUser(async (user) => {
    const script = await ensureActiveCallScript(user.id);
    return NextResponse.json({ script });
  });
}
