import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { LeadCreateForm } from "@/components/leads/LeadCreateForm";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function LeadsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; stageId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const [stages, businessSettings, leads] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true }
    }),
    prisma.businessSettings.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.lead.findMany({
      where: {
        ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
        ...(params.stageId ? { stageId: params.stageId } : {}),
        ...(params.q
          ? {
              OR: [
                { fullName: { contains: params.q, mode: "insensitive" } },
                { company: { contains: params.q, mode: "insensitive" } },
                { email: { contains: params.q, mode: "insensitive" } },
                { phone: { contains: params.q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        company: true,
        jobTitle: true,
        phone: true,
        email: true,
        stageId: true,
        phoneInvalid: true,
        phoneOptOut: true,
        emailOptOut: true,
        customFields: true
      },
      orderBy: { updatedAt: "desc" },
      take: 200
    })
  ]);

  return (
    <AppShell user={user}>
      <div className="page-header">
        <div>
          <h1>Leads</h1>
          <p>Cerca, filtra, mou pel pipeline i truca directament des del CRM.</p>
        </div>
        <LeadCreateForm
          stages={stages}
          defaultDealValueCents={businessSettings?.defaultDealValueCents ?? 0}
        />
      </div>
      <form className="toolbar">
        <input name="q" type="search" placeholder="Cerca per nom, empresa, email o telèfon" defaultValue={params.q} />
        <select name="stageId" defaultValue={params.stageId ?? ""}>
          <option value="">Tots els stages</option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
        <button className="ghost-button">Filtrar</button>
      </form>
      <section className="panel">
        <LeadsTable leads={leads} stages={stages} />
      </section>
    </AppShell>
  );
}
