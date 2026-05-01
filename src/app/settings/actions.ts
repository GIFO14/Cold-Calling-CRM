"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { ensureActiveCallScript } from "@/lib/call-script";
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
    throw new Error("Invalid default deal size");
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
  revalidatePath("/call-script");
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

function revalidateCallScriptViews() {
  revalidatePath("/settings");
  revalidatePath("/call-script");
  revalidatePath("/call-script/customize");
  revalidatePath("/dashboard");
}

function requireAdminUserRole(role: "ADMIN" | "AGENT") {
  if (role !== "ADMIN") {
    throw new Error("Admin access required");
  }
}

const scriptSchema = z.object({
  scriptId: z.string(),
  name: z.string().min(1)
});

const branchTargetTypeSchema = z.enum(["STEP", "OBJECTION", "TERMINAL"]);

const stepSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  text: z.string().min(1),
  position: z.coerce.number().int().min(1),
  advanceTargetType: branchTargetTypeSchema.optional(),
  advanceTargetStepId: z.string().optional(),
  advanceTargetObjectionId: z.string().optional(),
  advanceTerminalLabel: z.string().optional()
});

const newStepSchema = z.object({
  scriptId: z.string(),
  title: z.string().min(1),
  text: z.string().min(1),
  position: z.coerce.number().int().min(1),
  advanceTargetType: branchTargetTypeSchema.optional(),
  advanceTargetStepId: z.string().optional(),
  advanceTargetObjectionId: z.string().optional(),
  advanceTerminalLabel: z.string().optional()
});

const objectionSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  position: z.coerce.number().int().min(1)
});

const newObjectionSchema = z.object({
  scriptId: z.string(),
  label: z.string().min(1),
  position: z.coerce.number().int().min(1)
});

const responseSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  text: z.string().min(1),
  position: z.coerce.number().int().min(1)
});

const newResponseSchema = z.object({
  objectionId: z.string(),
  label: z.string().optional(),
  text: z.string().min(1),
  position: z.coerce.number().int().min(1)
});

const stepChoiceSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  position: z.coerce.number().int().min(1),
  targetType: branchTargetTypeSchema,
  targetStepId: z.string().optional(),
  targetObjectionId: z.string().optional(),
  terminalLabel: z.string().optional()
});

const newStepChoiceSchema = z.object({
  stepId: z.string(),
  label: z.string().min(1),
  position: z.coerce.number().int().min(1),
  targetType: branchTargetTypeSchema,
  targetStepId: z.string().optional(),
  targetObjectionId: z.string().optional(),
  terminalLabel: z.string().optional()
});

const objectionChoiceSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  position: z.coerce.number().int().min(1),
  targetType: branchTargetTypeSchema,
  targetStepId: z.string().optional(),
  targetObjectionId: z.string().optional(),
  terminalLabel: z.string().optional()
});

const newObjectionChoiceSchema = z.object({
  objectionId: z.string(),
  label: z.string().min(1),
  position: z.coerce.number().int().min(1),
  targetType: branchTargetTypeSchema,
  targetStepId: z.string().optional(),
  targetObjectionId: z.string().optional(),
  terminalLabel: z.string().optional()
});

function normalizeBranchTargetInput(parsed: {
  targetType: "STEP" | "OBJECTION" | "TERMINAL";
  targetStepId?: string;
  targetObjectionId?: string;
  terminalLabel?: string;
}) {
  return {
    targetType: parsed.targetType,
    targetStepId: parsed.targetType === "STEP" ? parsed.targetStepId || null : null,
    targetObjectionId: parsed.targetType === "OBJECTION" ? parsed.targetObjectionId || null : null,
    terminalLabel: parsed.targetType === "TERMINAL" ? parsed.terminalLabel?.trim() || "Final" : null
  };
}

export async function saveCallScript(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const fallbackScript = await ensureActiveCallScript(user.id);
  const parsed = scriptSchema.parse({
    scriptId: formData.get("scriptId") ?? fallbackScript.id,
    name: formData.get("name")
  });

  await prisma.callScript.update({
    where: { id: parsed.scriptId },
    data: { name: parsed.name, isActive: true }
  });

  revalidateCallScriptViews();
}

export async function saveCallScriptStep(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const parsed = stepSchema.parse({
    id: formData.get("id"),
    title: formData.get("title"),
    text: formData.get("text"),
    position: formData.get("position"),
    advanceTargetType: String(formData.get("advanceTargetType") ?? "").trim() || undefined,
    advanceTargetStepId: String(formData.get("advanceTargetStepId") ?? "").trim() || undefined,
    advanceTargetObjectionId: String(formData.get("advanceTargetObjectionId") ?? "").trim() || undefined,
    advanceTerminalLabel: String(formData.get("advanceTerminalLabel") ?? "").trim() || undefined
  });

  const advanceTarget =
    parsed.advanceTargetType
      ? normalizeBranchTargetInput({
          targetType: parsed.advanceTargetType,
          targetStepId: parsed.advanceTargetStepId,
          targetObjectionId: parsed.advanceTargetObjectionId,
          terminalLabel: parsed.advanceTerminalLabel
        })
      : {
          targetType: null,
          targetStepId: null,
          targetObjectionId: null,
          terminalLabel: null
        };

  await prisma.callScriptStep.update({
    where: { id: parsed.id },
    data: {
      title: parsed.title,
      text: parsed.text,
      position: parsed.position,
      advanceTargetType: advanceTarget.targetType,
      advanceTargetStepId: advanceTarget.targetStepId,
      advanceTargetObjectionId: advanceTarget.targetObjectionId,
      advanceTerminalLabel: advanceTarget.terminalLabel
    }
  });

  revalidateCallScriptViews();
}

export async function createCallScriptStep(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const fallbackScript = await ensureActiveCallScript(user.id);
  const parsed = newStepSchema.parse({
    scriptId: formData.get("scriptId") ?? fallbackScript.id,
    title: formData.get("title"),
    text: formData.get("text"),
    position: formData.get("position"),
    advanceTargetType: String(formData.get("advanceTargetType") ?? "").trim() || undefined,
    advanceTargetStepId: String(formData.get("advanceTargetStepId") ?? "").trim() || undefined,
    advanceTargetObjectionId: String(formData.get("advanceTargetObjectionId") ?? "").trim() || undefined,
    advanceTerminalLabel: String(formData.get("advanceTerminalLabel") ?? "").trim() || undefined
  });

  const advanceTarget =
    parsed.advanceTargetType
      ? normalizeBranchTargetInput({
          targetType: parsed.advanceTargetType,
          targetStepId: parsed.advanceTargetStepId,
          targetObjectionId: parsed.advanceTargetObjectionId,
          terminalLabel: parsed.advanceTerminalLabel
        })
      : {
          targetType: null,
          targetStepId: null,
          targetObjectionId: null,
          terminalLabel: null
        };

  await prisma.callScriptStep.create({
    data: {
      scriptId: parsed.scriptId,
      title: parsed.title,
      text: parsed.text,
      position: parsed.position,
      advanceTargetType: advanceTarget.targetType,
      advanceTargetStepId: advanceTarget.targetStepId,
      advanceTargetObjectionId: advanceTarget.targetObjectionId,
      advanceTerminalLabel: advanceTarget.terminalLabel
    }
  });

  revalidateCallScriptViews();
}

export async function deleteCallScriptStep(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await prisma.callScriptStep.delete({ where: { id } });
  revalidateCallScriptViews();
}

export async function saveCallScriptStepChoice(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const parsed = stepChoiceSchema.parse({
    id: formData.get("id"),
    label: formData.get("label"),
    position: formData.get("position"),
    targetType: formData.get("targetType"),
    targetStepId: String(formData.get("targetStepId") ?? "").trim() || undefined,
    targetObjectionId: String(formData.get("targetObjectionId") ?? "").trim() || undefined,
    terminalLabel: String(formData.get("terminalLabel") ?? "").trim() || undefined
  });

  await prisma.callScriptStepChoice.update({
    where: { id: parsed.id },
    data: {
      label: parsed.label,
      position: parsed.position,
      ...normalizeBranchTargetInput(parsed)
    }
  });

  revalidateCallScriptViews();
}

export async function createCallScriptStepChoice(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const parsed = newStepChoiceSchema.parse({
    stepId: formData.get("stepId"),
    label: formData.get("label"),
    position: formData.get("position"),
    targetType: formData.get("targetType"),
    targetStepId: String(formData.get("targetStepId") ?? "").trim() || undefined,
    targetObjectionId: String(formData.get("targetObjectionId") ?? "").trim() || undefined,
    terminalLabel: String(formData.get("terminalLabel") ?? "").trim() || undefined
  });

  await prisma.callScriptStepChoice.create({
    data: {
      stepId: parsed.stepId,
      label: parsed.label,
      position: parsed.position,
      ...normalizeBranchTargetInput(parsed)
    }
  });

  revalidateCallScriptViews();
}

export async function deleteCallScriptStepChoice(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await prisma.callScriptStepChoice.delete({ where: { id } });
  revalidateCallScriptViews();
}

export async function saveCallScriptObjection(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const parsed = objectionSchema.parse({
    id: formData.get("id"),
    label: formData.get("label"),
    position: formData.get("position")
  });

  await prisma.callScriptObjection.update({
    where: { id: parsed.id },
    data: {
      label: parsed.label,
      position: parsed.position
    }
  });

  revalidateCallScriptViews();
}

export async function createCallScriptObjection(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const fallbackScript = await ensureActiveCallScript(user.id);
  const parsed = newObjectionSchema.parse({
    scriptId: formData.get("scriptId") ?? fallbackScript.id,
    label: formData.get("label"),
    position: formData.get("position")
  });

  await prisma.callScriptObjection.create({
    data: {
      scriptId: parsed.scriptId,
      label: parsed.label,
      position: parsed.position
    }
  });

  revalidateCallScriptViews();
}

export async function deleteCallScriptObjection(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await prisma.callScriptObjection.delete({ where: { id } });
  revalidateCallScriptViews();
}

export async function saveCallScriptObjectionChoice(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const parsed = objectionChoiceSchema.parse({
    id: formData.get("id"),
    label: formData.get("label"),
    position: formData.get("position"),
    targetType: formData.get("targetType"),
    targetStepId: String(formData.get("targetStepId") ?? "").trim() || undefined,
    targetObjectionId: String(formData.get("targetObjectionId") ?? "").trim() || undefined,
    terminalLabel: String(formData.get("terminalLabel") ?? "").trim() || undefined
  });

  await prisma.callScriptObjectionChoice.update({
    where: { id: parsed.id },
    data: {
      label: parsed.label,
      position: parsed.position,
      ...normalizeBranchTargetInput(parsed)
    }
  });

  revalidateCallScriptViews();
}

export async function createCallScriptObjectionChoice(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const parsed = newObjectionChoiceSchema.parse({
    objectionId: formData.get("objectionId"),
    label: formData.get("label"),
    position: formData.get("position"),
    targetType: formData.get("targetType"),
    targetStepId: String(formData.get("targetStepId") ?? "").trim() || undefined,
    targetObjectionId: String(formData.get("targetObjectionId") ?? "").trim() || undefined,
    terminalLabel: String(formData.get("terminalLabel") ?? "").trim() || undefined
  });

  await prisma.callScriptObjectionChoice.create({
    data: {
      objectionId: parsed.objectionId,
      label: parsed.label,
      position: parsed.position,
      ...normalizeBranchTargetInput(parsed)
    }
  });

  revalidateCallScriptViews();
}

export async function deleteCallScriptObjectionChoice(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await prisma.callScriptObjectionChoice.delete({ where: { id } });
  revalidateCallScriptViews();
}

export async function saveCallScriptResponse(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const parsed = responseSchema.parse({
    id: formData.get("id"),
    label: String(formData.get("label") ?? "").trim() || undefined,
    text: formData.get("text"),
    position: formData.get("position")
  });

  await prisma.callScriptResponse.update({
    where: { id: parsed.id },
    data: {
      label: parsed.label,
      text: parsed.text,
      position: parsed.position
    }
  });

  revalidateCallScriptViews();
}

export async function createCallScriptResponse(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const parsed = newResponseSchema.parse({
    objectionId: formData.get("objectionId"),
    label: String(formData.get("label") ?? "").trim() || undefined,
    text: formData.get("text"),
    position: formData.get("position")
  });

  await prisma.callScriptResponse.create({
    data: {
      objectionId: parsed.objectionId,
      label: parsed.label,
      text: parsed.text,
      position: parsed.position
    }
  });

  revalidateCallScriptViews();
}

export async function deleteCallScriptResponse(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireAdminUserRole(user.role);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await prisma.callScriptResponse.delete({ where: { id } });
  revalidateCallScriptViews();
}
