import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { StageSettingsList } from "@/components/settings/StageSettingsList";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatCurrencyInputFromCents } from "@/lib/money";
import { createStage, createUser, saveBusinessSettings, savePbxSettings, saveStage, saveTelephonySettings } from "./actions";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [pbx, businessSettings, users, myTelephony, stages] = await Promise.all([
    prisma.pbxSettings.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.businessSettings.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { telephonySettings: true }
    }),
    prisma.agentTelephonySettings.findUnique({ where: { userId: user.id } }),
    prisma.pipelineStage.findMany({ orderBy: { position: "asc" } })
  ]);

  return (
    <AppShell user={user}>
      <div className="page-header">
        <div>
          <h1>Configuració</h1>
          <p>PBX WebRTC, extensió SIP del CRM i usuaris interns.</p>
        </div>
      </div>
      <div className="grid grid-2">
        {user.role === "ADMIN" ? (
          <section className="panel">
            <h2>PBX WebRTC</h2>
            <form action={savePbxSettings} className="grid">
              <div className="field">
                <label>WSS URL</label>
                <input name="sipWsUrl" defaultValue={pbx?.sipWsUrl ?? "wss://pbx.example.com:8089/ws"} required />
              </div>
              <div className="field">
                <label>SIP domain</label>
                <input name="sipDomain" defaultValue={pbx?.sipDomain ?? "pbx.example.com"} required />
              </div>
              <div className="grid grid-2">
                <div className="field">
                  <label>Prefix sortida</label>
                  <input name="outboundDialPrefix" defaultValue={pbx?.outboundDialPrefix ?? ""} />
                </div>
                <div className="field">
                  <label>País per defecte</label>
                  <input name="defaultCountryCode" defaultValue={pbx?.defaultCountryCode ?? "ES"} />
                </div>
              </div>
              <label>
                <input type="checkbox" name="enabled" defaultChecked={pbx?.enabled ?? false} /> Activat
              </label>
              <button className="button">Guardar PBX</button>
            </form>
          </section>
        ) : null}
        {user.role === "ADMIN" ? (
          <section className="panel">
            <h2>Configuració comercial</h2>
            <form action={saveBusinessSettings} className="grid">
              <div className="field">
                <label>Ticket mitjà per deal</label>
                <input
                  name="defaultDealValue"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={formatCurrencyInputFromCents(businessSettings?.defaultDealValueCents)}
                  placeholder="0.00"
                  required
                />
              </div>
              <p className="muted" style={{ margin: 0 }}>
                Valor per defecte que s&apos;aplica a tots els leads si no tenen un import propi.
              </p>
              <button className="button">Guardar ticket mitjà</button>
            </form>
          </section>
        ) : null}
        <section className="panel">
          <h2>La meva extensió WebRTC</h2>
          <form action={saveTelephonySettings} className="grid">
            <input type="hidden" name="userId" value={user.id} />
            <div className="field">
              <label>SIP username</label>
              <input name="sipUsername" defaultValue={myTelephony?.sipUsername ?? "702"} required />
            </div>
            <div className="field">
              <label>SIP password</label>
              <input name="sipPassword" type="password" placeholder={myTelephony ? "Deixa en blanc per mantenir-la" : ""} />
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label>Extensió</label>
                <input name="sipExtension" defaultValue={myTelephony?.sipExtension ?? "702"} required />
              </div>
              <div className="field">
                <label>Display name</label>
                <input name="sipDisplayName" defaultValue={myTelephony?.sipDisplayName ?? user.name} />
              </div>
            </div>
            <label>
              <input type="checkbox" name="enabled" defaultChecked={myTelephony?.enabled ?? true} /> Activada
            </label>
            <button className="button">Guardar extensió</button>
          </form>
        </section>
      </div>
      {user.role === "ADMIN" ? (
        <div className="grid grid-2" style={{ marginTop: 18 }}>
          <section className="panel">
            <h2>Crear usuari</h2>
            <form action={createUser} className="grid">
              <div className="field">
                <label>Nom</label>
                <input name="name" required />
              </div>
              <div className="field">
                <label>Email</label>
                <input name="email" type="email" required />
              </div>
              <div className="field">
                <label>Contrasenya</label>
                <input name="password" type="password" minLength={8} required />
              </div>
              <div className="field">
                <label>Rol</label>
                <select name="role" defaultValue="AGENT">
                  <option value="AGENT">AGENT</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <button className="button">Crear usuari</button>
            </form>
          </section>
          <section className="panel">
            <h2>Usuaris</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Extensió</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.email}</td>
                      <td>{item.role}</td>
                      <td>{item.telephonySettings?.sipExtension ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
      {user.role === "ADMIN" ? (
        <section className="panel" style={{ marginTop: 18 }}>
          <h2>Estats del pipeline</h2>
          <StageSettingsList stages={stages} saveStageAction={saveStage} createStageAction={createStage} />
        </section>
      ) : null}
    </AppShell>
  );
}
