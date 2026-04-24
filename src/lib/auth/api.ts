import { NextResponse } from "next/server";
import { getCurrentUser, SessionUser } from "@/lib/auth/session";

export async function withUser<T>(
  handler: (user: SessionUser) => Promise<T | NextResponse>
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return handler(user);
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
