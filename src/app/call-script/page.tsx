import { PhoneCall } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CallScriptMockup } from "@/components/call-script/CallScriptMockup";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth/session";
import {
  CALL_SCRIPT_LANGUAGE_OPTIONS,
  ensureActiveCallScript,
  normalizeCallScriptLanguage
} from "@/lib/call-script";

export default async function CallScriptPage({
  searchParams
}: {
  searchParams: Promise<{ lang?: string; mode?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const languageCode = normalizeCallScriptLanguage(params.lang);
  const testMode = params.mode === "test";
  const script = await ensureActiveCallScript(user.id, languageCode);

  return (
    <AppShell user={user}>
      <div className="page-header">
        <div>
          <h1>Call Script Flow</h1>
          <p>
            {testMode
              ? "Mode de practica: simula una trucada per provar el guio sense fer una call real."
              : "Versio simplificada: una sola frase per pantalla i una sortida rapida cap a objeccions."}
          </p>
        </div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <span className="badge">
            <PhoneCall size={13} />
            {testMode ? "Mode test" : "Trucada activa"}
          </span>
        </div>
      </div>
      <div className="toolbar" style={{ marginBottom: 18 }}>
        <Link className={!testMode ? "button" : "ghost-button"} href={`/call-script?lang=${languageCode}`}>
          Live
        </Link>
        <Link className={testMode ? "button" : "ghost-button"} href={`/call-script?lang=${languageCode}&mode=test`}>
          Test
        </Link>
        {user.role === "ADMIN" ? (
          <Link className="ghost-button" href={`/call-script/customize?lang=${languageCode}`}>
            Personalitzacio
          </Link>
        ) : null}
        {CALL_SCRIPT_LANGUAGE_OPTIONS.map((item) => (
          <Link
            key={item.code}
            className={item.code === languageCode ? "button" : "ghost-button"}
            href={`/call-script?lang=${item.code}${testMode ? "&mode=test" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <CallScriptMockup initialScript={script} languageCode={languageCode} testMode={testMode} />
    </AppShell>
  );
}
