import Link from "next/link";
import { redirect } from "next/navigation";
import { CallScriptSettings } from "@/components/settings/CallScriptSettings";
import {
  CALL_SCRIPT_LANGUAGE_OPTIONS,
  ensureActiveCallScript,
  ensureDefaultLanguageScripts,
  normalizeCallScriptLanguage
} from "@/lib/call-script";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createCallScriptObjection,
  createCallScriptObjectionChoice,
  createCallScriptResponse,
  createCallScriptStep,
  createCallScriptStepChoice,
  deleteCallScriptObjection,
  deleteCallScriptObjectionChoice,
  deleteCallScriptResponse,
  deleteCallScriptStep,
  deleteCallScriptStepChoice,
  saveCallScript,
  saveCallScriptObjection,
  saveCallScriptObjectionChoice,
  saveCallScriptResponse,
  saveCallScriptStep,
  saveCallScriptStepChoice
} from "@/app/settings/actions";

export default async function CallScriptCustomizePage({
  searchParams
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/call-script");

  const params = await searchParams;
  const languageCode = normalizeCallScriptLanguage(params.lang);
  await ensureDefaultLanguageScripts(user.id);
  const script = await ensureActiveCallScript(user.id, languageCode);
  const languageLabel =
    CALL_SCRIPT_LANGUAGE_OPTIONS.find((item) => item.code === languageCode)?.label ?? languageCode.toUpperCase();

  return (
    <AppShell user={user}>
      <div className="page-header">
        <div>
          <h1>Script Customization</h1>
          <p>Edita els missatges del guio i les objeccions dins del mateix apartat Script.</p>
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: 18 }}>
        <Link className="ghost-button" href={`/call-script?lang=${languageCode}`}>
          Live
        </Link>
        <Link className="button" href={`/call-script/customize?lang=${languageCode}`}>
          Personalitzacio
        </Link>
        {CALL_SCRIPT_LANGUAGE_OPTIONS.map((item) => (
          <Link
            key={item.code}
            className={item.code === languageCode ? "button" : "ghost-button"}
            href={`/call-script/customize?lang=${item.code}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <CallScriptSettings
        script={script}
        languageLabel={languageLabel}
        saveScriptAction={saveCallScript}
        saveStepAction={saveCallScriptStep}
        createStepAction={createCallScriptStep}
        deleteStepAction={deleteCallScriptStep}
        saveStepChoiceAction={saveCallScriptStepChoice}
        createStepChoiceAction={createCallScriptStepChoice}
        deleteStepChoiceAction={deleteCallScriptStepChoice}
        saveObjectionAction={saveCallScriptObjection}
        createObjectionAction={createCallScriptObjection}
        deleteObjectionAction={deleteCallScriptObjection}
        saveResponseAction={saveCallScriptResponse}
        createResponseAction={createCallScriptResponse}
        deleteResponseAction={deleteCallScriptResponse}
        saveObjectionChoiceAction={saveCallScriptObjectionChoice}
        createObjectionChoiceAction={createCallScriptObjectionChoice}
        deleteObjectionChoiceAction={deleteCallScriptObjectionChoice}
      />
    </AppShell>
  );
}
