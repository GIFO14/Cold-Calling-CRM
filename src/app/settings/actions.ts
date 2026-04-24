"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { parseCurrencyInputToCents } from "@/lib/money";
import { encryptSecret } from "@/lib/telephony/crypto";

const pbxSchema = z.object({
  sipWsUrl: z.string().url(),
  sipDomain: z.string().min(1),
  outboundDialPrefix: z.string().optional(),
  defaultCountryCode: z.string().optional(),
  enabled: z.boolean()
});

export async function savePbxSettings(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") throw new Error("Admin access required");

  const parsed = pbxSchema.parse({
    sipWsUrl: formData.get("sipWsUrl"),
    sipDomain: formData.get("sipDomain"),
    outboundDialPrefix: formData.get("outboundDialPrefix") || undefined,
    defaultCountryCode: formData.get("defaultCountryCode") || undefined,
    enabled: formData.get("enabled") === "on"
  });

  const existing = await prisma.pbxSettings.findFirst();
  if (existing) {
    await prisma.pbxSettings.update({ where: { id: existing.id }, data: parsed });
  } else {
    await prisma.pbxSettings.create({ data: parsed });
  }
  revalidatePath("/settings");
}

export async function saveBusinessSettings(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") throw new Error("Admin access required");

  const defaultDealValueCents = parseCurrencyInputToCents(formData.get("defaultDealValue"));
  if (defaultDealValueCents === null) {
    throw new Error("Ticket mitja no valid");
  }

  const existing = await prisma.businessSettings.findFirst();
  if (existing) {
    await prisma.businessSettings.update({
      where: { id: existing.id },
      data: { defaultDealValueCents }
    });
  } else {
    await prisma.businessSettings.create({
      data: { defaultDealValueCents }
    });
  }

  revalidatePath("/settings");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath("/leads");
}

const telephonySchema = z.object({
  userId: z.string(),
  sipUsername: z.string().min(1),
  sipPassword: z.string().optional(),
  sipDisplayName: z.string().optional(),
  sipExtension: z.string().min(1),
  enabled: z.boolean()
});

export async function saveTelephonySettings(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const targetUserId = String(formData.get("userId"));
  if (user.role !== "ADMIN" && targetUserId !== user.id) {
    throw new Error("Forbidden");
  }

  const parsed = telephonySchema.parse({
    userId: targetUserId,
    sipUsername: formData.get("sipUsername"),
    sipPassword: formData.get("sipPassword") || undefined,
    sipDisplayName: formData.get("sipDisplayName") || undefined,
    sipExtension: formData.get("sipExtension"),
    enabled: formData.get("enabled") === "on"
  });

  const existing = await prisma.agentTelephonySettings.findUnique({
    where: { userId: targetUserId }
  });
  const passwordData = parsed.sipPassword
    ? { sipPasswordEncrypted: encryptSecret(parsed.sipPassword) }
    : {};

  if (existing) {
    await prisma.agentTelephonySettings.update({
      where: { userId: targetUserId },
      data: {
        sipUsername: parsed.sipUsername,
        sipDisplayName: parsed.sipDisplayName,
        sipExtension: parsed.sipExtension,
        enabled: parsed.enabled,
        ...passwordData
      }
    });
  } else {
    await prisma.agentTelephonySettings.create({
      data: {
        userId: targetUserId,
        sipUsername: parsed.sipUsername,
        sipDisplayName: parsed.sipDisplayName,
        sipExtension: parsed.sipExtension,
        enabled: parsed.enabled,
        sipPasswordEncrypted: encryptSecret(parsed.sipPassword ?? "")
      }
    });
  }
  revalidatePath("/settings");
}

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "AGENT"])
});

export async function createUser(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") throw new Error("Admin access required");

  const parsed = userSchema.parse({
    name: formData.get("name"),
    email: String(formData.get("email")).toLowerCase(),
    password: formData.get("password"),
    role: formData.get("role")
  });

  await prisma.user.create({
    data: {
      name: parsed.name,
      email: parsed.email,
      passwordHash: await hashPassword(parsed.password),
      role: parsed.role
    }
  });
  revalidatePath("/settings");
}

const stageSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string().min(1),
  isWon: z.boolean(),
  isLost: z.boolean(),
  active: z.boolean()
});

function revalidateStageViews() {
  revalidatePath("/settings");
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function saveStage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") throw new Error("Admin access required");

  const parsed = stageSchema.parse({
    id: formData.get("id"),
    name: formData.get("name"),
    color: formData.get("color"),
    isWon: formData.get("isWon") === "on",
    isLost: formData.get("isLost") === "on",
    active: formData.get("active") === "on"
  });

  await prisma.pipelineStage.update({
    where: { id: parsed.id },
    data: {
      name: parsed.name,
      color: parsed.color,
      isWon: parsed.isWon,
      isLost: parsed.isLost,
      active: parsed.active
    }
  });
  revalidateStageViews();
}

export async function createStage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") throw new Error("Admin access required");

  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#0f766e").trim();
  if (!name) return;

  const last = await prisma.pipelineStage.findFirst({ orderBy: { position: "desc" } });
  await prisma.pipelineStage.create({
    data: {
      name,
      color,
      position: (last?.position ?? 0) + 1,
      active: true
    }
  });
  revalidateStageViews();
}
