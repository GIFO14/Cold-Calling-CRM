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
          <h1>Settings</h1>
          <p>WebRTC PBX, CRM SIP extension, and internal users.</p>
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
                  <label>Outbound prefix</label>
                  <input name="outboundDialPrefix" defaultValue={pbx?.outboundDialPrefix ?? ""} />
                </div>
                <div className="field">
                  <label>Default country</label>
                  <input name="defaultCountryCode" defaultValue={pbx?.defaultCountryCode ?? "ES"} />
                </div>
              </div>
              <label>
                <input type="checkbox" name="enabled" defaultChecked={pbx?.enabled ?? false} /> Enabled
              </label>
              <button className="button">Save PBX</button>
            </form>
          </section>
        ) : null}
        {user.role === "ADMIN" ? (
          <section className="panel">
            <h2>Business settings</h2>
            <form action={saveBusinessSettings} className="grid">
              <div className="field">
                <label>Default deal size</label>
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
                Default value applied to all leads that do not have their own amount.
              </p>
              <button className="button">Save default deal size</button>
            </form>
          </section>
        ) : null}
        <section className="panel">
          <h2>My WebRTC extension</h2>
          <form action={saveTelephonySettings} className="grid">
            <input type="hidden" name="userId" value={user.id} />
            <div className="field">
              <label>SIP username</label>
              <input name="sipUsername" defaultValue={myTelephony?.sipUsername ?? "702"} required />
            </div>
              <div className="field">
                <label>SIP password</label>
                <input name="sipPassword" type="password" placeholder={myTelephony ? "Leave blank to keep it" : ""} />
              </div>
              <div className="grid grid-2">
                <div className="field">
                <label>Extension</label>
                  <input name="sipExtension" defaultValue={myTelephony?.sipExtension ?? "702"} required />
                </div>
              <div className="field">
                <label>Display name</label>
                <input name="sipDisplayName" defaultValue={myTelephony?.sipDisplayName ?? user.name} />
              </div>
            </div>
            <label>
              <input type="checkbox" name="enabled" defaultChecked={myTelephony?.enabled ?? true} /> Enabled
            </label>
            <button className="button">Save extension</button>
          </form>
        </section>
      </div>
      {user.role === "ADMIN" ? (
        <div className="grid grid-2" style={{ marginTop: 18 }}>
          <section className="panel">
            <h2>Create user</h2>
            <form action={createUser} className="grid">
              <div className="field">
                <label>Name</label>
                <input name="name" required />
              </div>
              <div className="field">
                <label>Email</label>
                <input name="email" type="email" required />
              </div>
              <div className="field">
                <label>Password</label>
                <input name="password" type="password" minLength={8} required />
              </div>
              <div className="field">
                <label>Role</label>
                <select name="role" defaultValue="AGENT">
                  <option value="AGENT">AGENT</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <button className="button">Create user</button>
            </form>
          </section>
          <section className="panel">
            <h2>Users</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Extension</th>
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
          <h2>Pipeline stages</h2>
          <StageSettingsList stages={stages} saveStageAction={saveStage} createStageAction={createStage} />
        </section>
      ) : null}
    </AppShell>
  );
}
