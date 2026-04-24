import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function PipelinePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [stages, businessSettings] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
      include: {
        leads: {
          where: user.role === "ADMIN" ? undefined : { ownerId: user.id },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fullName: true,
            company: true,
            phone: true,
            email: true,
            stageId: true,
            dealValueOverrideCents: true
          }
        }
      }
    }),
    prisma.businessSettings.findFirst({ orderBy: { createdAt: "desc" } })
  ]);

  return (
    <AppShell user={user}>
      <div className="page-header">
        <div>
          <h1>Pipeline</h1>
          <p>Arrossega leads entre stages per fer seguiment del valor econòmic.</p>
        </div>
      </div>
      <PipelineBoard
        stages={stages}
        canManageStages={user.role === "ADMIN"}
        defaultDealValueCents={businessSettings?.defaultDealValueCents ?? 0}
      />
    </AppShell>
  );
}
