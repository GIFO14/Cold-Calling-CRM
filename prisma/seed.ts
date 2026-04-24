import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { encryptSecret } from "../src/lib/telephony/crypto";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@example.com",
      passwordHash: await hashPassword("admin1234"),
      role: "ADMIN"
    }
  });

  const agent = await prisma.user.upsert({
    where: { email: "agent@example.com" },
    update: {},
    create: {
      name: "Agent",
      email: "agent@example.com",
      passwordHash: await hashPassword("agent1234"),
      role: "AGENT"
    }
  });

  const stages = [
    { name: "Nou", color: "#0f766e", isDefault: true },
    { name: "Per trucar", color: "#155eef" },
    { name: "Trucat", color: "#7a5af8" },
    { name: "Interessat", color: "#f79009" },
    { name: "Seguiment", color: "#6172f3" },
    { name: "Reunió agendada", color: "#12b76a" },
    { name: "Guanyat", color: "#039855", isWon: true },
    { name: "Perdut", color: "#b42318", isLost: true }
  ];

  for (const [position, stage] of stages.entries()) {
    await prisma.pipelineStage.upsert({
      where: { id: `seed-stage-${position}` },
      update: {
        name: stage.name,
        position,
        color: stage.color,
        isDefault: Boolean(stage.isDefault),
        isWon: Boolean(stage.isWon),
        isLost: Boolean(stage.isLost),
        active: true
      },
      create: {
        id: `seed-stage-${position}`,
        name: stage.name,
        position,
        color: stage.color,
        isDefault: Boolean(stage.isDefault),
        isWon: Boolean(stage.isWon),
        isLost: Boolean(stage.isLost)
      }
    });
  }

  await prisma.pbxSettings.upsert({
    where: { id: "seed-pbx-settings" },
    update: {},
    create: {
      id: "seed-pbx-settings",
      sipWsUrl: "wss://pbx.example.com:8089/ws",
      sipDomain: "pbx.example.com",
      outboundDialPrefix: "",
      defaultCountryCode: "ES",
      enabled: false
    }
  });

  await prisma.businessSettings.upsert({
    where: { id: "seed-business-settings" },
    update: {
      defaultDealValueCents: 450000
    },
    create: {
      id: "seed-business-settings",
      defaultDealValueCents: 450000
    }
  });

  await prisma.agentTelephonySettings.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      sipUsername: "702",
      sipPasswordEncrypted: encryptSecret("change-me"),
      sipDisplayName: "CRM Admin",
      sipExtension: "702",
      enabled: false
    }
  });

  const firstStage = await prisma.pipelineStage.findFirst({ orderBy: { position: "asc" } });
  await prisma.lead.upsert({
    where: { id: "seed-lead-1" },
    update: {},
    create: {
      id: "seed-lead-1",
      firstName: "Laura",
      lastName: "Serra",
      fullName: "Laura Serra",
      company: "Acme Industrial",
      jobTitle: "Directora comercial",
      phone: "+34900111222",
      phoneNormalized: "+34900111222",
      email: "laura@example.com",
      emailNormalized: "laura@example.com",
      source: "Seed",
      ownerId: agent.id,
      stageId: firstStage?.id,
      dealValueOverrideCents: 720000,
      customFields: { sector: "Manufactura", mida_empresa: "50-200" }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
