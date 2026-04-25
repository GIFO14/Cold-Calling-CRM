import { format } from "date-fns";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CallReadyBlock } from "@/components/leads/CallReadyBlock";
import { LeadBadges } from "@/components/leads/LeadBadges";
import { LeadCallButton } from "@/components/leads/LeadCallButton";
import { LeadPropertiesForm } from "@/components/leads/LeadPropertiesForm";
import { LeadStageSelect } from "@/components/leads/LeadStageSelect";
import { NoteForm } from "@/components/leads/NoteForm";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { displayLeadName } from "@/lib/leads/normalize";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const [lead, stages, customFieldDefinitions, businessSettings] = await Promise.all([
    prisma.lead.findFirst({
      where: { id, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) },
      include: {
        owner: { select: { name: true } },
        stage: true,
        activities: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 100
        },
        callLogs: { orderBy: { startedAt: "desc" } }
      }
    }),
    prisma.pipelineStage.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true }
    }),
    prisma.customFieldDefinition.findMany({
      orderBy: { createdAt: "asc" },
      select: { key: true, label: true, type: true }
    }),
    prisma.businessSettings.findFirst({ orderBy: { createdAt: "desc" } })
  ]);

  if (!lead) redirect("/leads");
  const customFields =
    lead.customFields && typeof lead.customFields === "object" && !Array.isArray(lead.customFields)
      ? (lead.customFields as Record<string, unknown>)
      : {};
  const leadProperties = {
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    fullName: lead.fullName,
    company: lead.company,
    jobTitle: lead.jobTitle,
    phone: lead.phone,
    phoneInvalid: lead.phoneInvalid,
    phoneOptOut: lead.phoneOptOut,
    email: lead.email,
    emailInvalid: lead.emailInvalid,
    emailOptOut: lead.emailOptOut,
    website: lead.website,
    linkedinUrl: lead.linkedinUrl,
    source: lead.source,
    nextFollowUpAt: lead.nextFollowUpAt ? format(lead.nextFollowUpAt, "yyyy-MM-dd'T'HH:mm") : null,
    dealValueOverrideCents: lead.dealValueOverrideCents,
    ownerName: lead.owner?.name ?? null,
    customFields
  };

  return (
    <AppShell user={user}>
      <div className="page-header">
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <h1>{displayLeadName(lead)}</h1>
            <LeadBadges customFields={customFields} jobTitle={lead.jobTitle} />
          </div>
          <p>{lead.company ?? "Sense empresa"} {lead.jobTitle ? `· ${lead.jobTitle}` : ""}</p>
        </div>
        <LeadCallButton
          leadId={lead.id}
          leadLabel={displayLeadName(lead)}
          phone={lead.phone}
          disabled={lead.phoneInvalid || lead.phoneOptOut}
        />
      </div>
      {lead.phone ? (
        <CallReadyBlock
          leadId={lead.id}
          leadName={displayLeadName(lead)}
          company={lead.company}
          jobTitle={lead.jobTitle}
          phone={lead.phone}
          phoneDisabled={lead.phoneInvalid || lead.phoneOptOut}
          openingLine={typeof customFields.opening_line === "string" ? customFields.opening_line : null}
          bestCallWindow={typeof customFields.best_call_window === "string" ? customFields.best_call_window : null}
        />
      ) : null}
      <div className="grid grid-2">
        <div className="grid">
          <LeadPropertiesForm
            lead={leadProperties}
            customFieldDefinitions={customFieldDefinitions}
            defaultDealValueCents={businessSettings?.defaultDealValueCents ?? 0}
          />
          <section className="panel">
            <div className="field">
              <label>Stage</label>
              <LeadStageSelect leadId={lead.id} stageId={lead.stageId} stages={stages} />
            </div>
          </section>
        </div>
        <section className="panel">
          <h2>Notes</h2>
          <NoteForm leadId={lead.id} />
        </section>
      </div>
      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <section className="panel">
          <h2>Historial</h2>
          <div className="timeline">
            {lead.activities.map((activity) => (
              <div className="timeline-item" key={activity.id}>
                <strong>{activity.title}</strong>
                <div className="muted">
                  {format(activity.createdAt, "dd/MM/yyyy HH:mm")} · {activity.user?.name ?? "Sistema"}
                </div>
                {activity.body ? <p>{activity.body}</p> : null}
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>Trucades</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Telèfon</th>
                  <th>Estat</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {lead.callLogs.map((call) => (
                  <tr key={call.id}>
                    <td>{format(call.startedAt, "dd/MM HH:mm")}</td>
                    <td>{call.phoneDialed}</td>
                    <td>{call.status}</td>
                    <td>{call.outcome ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
