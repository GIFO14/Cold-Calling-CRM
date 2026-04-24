import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth/api";
import { decryptSecret } from "@/lib/telephony/crypto";

export async function GET() {
  return withUser(async (user) => {
    const [pbx, settings] = await Promise.all([
      prisma.pbxSettings.findFirst({ where: { enabled: true }, orderBy: { createdAt: "desc" } }),
      prisma.agentTelephonySettings.findUnique({ where: { userId: user.id } })
    ]);

    if (!pbx || !settings?.enabled) {
      return NextResponse.json({ enabled: false });
    }

    return NextResponse.json({
      enabled: true,
      sipWsUrl: pbx.sipWsUrl,
      sipDomain: pbx.sipDomain,
      outboundDialPrefix: pbx.outboundDialPrefix,
      username: settings.sipUsername,
      password: decryptSecret(settings.sipPasswordEncrypted),
      displayName: settings.sipDisplayName ?? user.name,
      extension: settings.sipExtension
    });
  });
}
