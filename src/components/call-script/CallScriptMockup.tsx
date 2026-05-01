"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Bot,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Coins,
  Mail,
  MessageSquareQuote,
  PhoneCall,
  RotateCcw,
  ShieldCheck,
  UserRoundX,
  Users,
  Wrench,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCall } from "@/components/telephony/CallProvider";

type ScriptStep = {
  id: string;
  title: string;
  text: string;
  position: number;
  advanceTargetType: "STEP" | "OBJECTION" | "TERMINAL" | null;
  advanceTargetStepId: string | null;
  advanceTargetObjectionId: string | null;
  advanceTerminalLabel: string | null;
  choices: ScriptBranchChoice[];
};

type ScriptResponse = {
  id: string;
  label: string | null;
  text: string;
  position: number;
};

type ScriptObjection = {
  id: string;
  label: string;
  position: number;
  responses: ScriptResponse[];
  choices: ScriptBranchChoice[];
};

type ScriptBranchChoice = {
  id: string;
  label: string;
  position: number;
  targetType: "STEP" | "OBJECTION" | "TERMINAL";
  targetStepId: string | null;
  targetObjectionId: string | null;
  terminalLabel: string | null;
};

type ScriptData = {
  id: string;
  name: string;
  steps: ScriptStep[];
  objections: ScriptObjection[];
};

type SessionData = {
  id: string;
  status: "ACTIVE" | "COMPLETED" | "CALL_ENDED";
  pane: "SCRIPT" | "OBJECTION";
  currentStepIndex: number;
  highestStepIndex: number;
  selectedObjectionId: string | null;
  selectedResponseId: string | null;
  callLogId: string | null;
  startedAt: string;
};

type SessionAction =
  | "BACK"
  | "ADVANCE"
  | "OPEN_OBJECTION"
  | "CHOOSE_STEP_OPTION"
  | "CHOOSE_OBJECTION_OPTION"
  | "RETURN_TO_SCRIPT"
  | "ADVANCE_FROM_OBJECTION"
  | "CLOSE";

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function parseJson<T>(response: Response) {
  const data = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    const errorMessage =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "Request failed";
    throw new Error(errorMessage);
  }

  if (!data) {
    throw new Error("Empty response");
  }

  return data;
}

function getObjectionVisual(label: string): { Icon: LucideIcon; tone: string } {
  const prefix = label.trim().charAt(0).toUpperCase();

  switch (prefix) {
    case "A":
      return { Icon: UserRoundX, tone: "reject" };
    case "B":
      return { Icon: ShieldCheck, tone: "existing" };
    case "C":
      return { Icon: Users, tone: "decision" };
    case "D":
      return { Icon: Clock3, tone: "timing" };
    case "E":
      return { Icon: Mail, tone: "email" };
    case "F":
      return { Icon: CircleHelp, tone: "proof" };
    case "G":
      return { Icon: PhoneCall, tone: "clients" };
    case "H":
      return { Icon: BadgeDollarSign, tone: "price" };
    case "I":
      return { Icon: Coins, tone: "budget" };
    case "J":
      return { Icon: Wrench, tone: "setup" };
    case "K":
      return { Icon: Bot, tone: "system" };
    default:
      return { Icon: Briefcase, tone: "default" };
  }
}

export function CallScriptMockup({
  initialScript,
  languageCode,
  testMode = false
}: {
  initialScript: ScriptData;
  languageCode: string;
  testMode?: boolean;
}) {
  const { activeCall } = useCall();
  const [script, setScript] = useState<ScriptData>(initialScript);
  const [session, setSession] = useState<SessionData | null>(null);
  const [sessionLeadLabel, setSessionLeadLabel] = useState<string | null>(null);
  const [entryGateDismissed, setEntryGateDismissed] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [isBootingSession, setIsBootingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<SessionData | null>(null);
  const persistChainRef = useRef<Promise<void>>(Promise.resolve());
  const effectiveCall = testMode ? null : activeCall;

  useEffect(() => {
    setScript(initialScript);
  }, [initialScript]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("preferredScriptLanguage", languageCode);
  }, [languageCode]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    setEntryGateDismissed(false);
  }, [session?.id]);

  function pickRandomResponse(objection: ScriptObjection) {
    if (objection.responses.length === 0) return null;
    const index = Math.floor(Math.random() * objection.responses.length);
    return objection.responses[index] ?? null;
  }

  function enqueuePersist(
    sessionId: string,
    action: SessionAction,
    extra?: {
      objectionId?: string;
      responseId?: string;
      stepChoiceId?: string;
      objectionChoiceId?: string;
      reason?: string;
    }
  ) {
    persistChainRef.current = persistChainRef.current
      .catch(() => undefined)
      .then(async () => {
        const response = await fetch(`/api/call-script/session/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ...extra
          })
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "Could not sync the script session.");
        }
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "Could not sync the script session.");
      });
  }

  function applyOptimisticAction(
    currentSession: SessionData,
    action: SessionAction,
    extra?: {
      objectionId?: string;
      responseId?: string;
      stepChoiceId?: string;
      objectionChoiceId?: string;
      reason?: string;
    }
  ) {
    if (currentSession.status !== "ACTIVE" && action !== "CLOSE") {
      return currentSession;
    }

    if (action === "CLOSE") {
      return {
        ...currentSession,
        status: "CALL_ENDED",
        pane: "SCRIPT",
        selectedObjectionId: null,
        selectedResponseId: null
      } satisfies SessionData;
    }

    if (action === "BACK") {
      return {
        ...currentSession,
        pane: "SCRIPT",
        currentStepIndex: Math.max(0, currentSession.currentStepIndex - 1),
        selectedObjectionId: null,
        selectedResponseId: null
      } satisfies SessionData;
    }

    if (action === "RETURN_TO_SCRIPT") {
      return {
        ...currentSession,
        pane: "SCRIPT",
        selectedObjectionId: null,
        selectedResponseId: null
      } satisfies SessionData;
    }

    if (action === "OPEN_OBJECTION") {
      return {
        ...currentSession,
        pane: "OBJECTION",
        selectedObjectionId: extra?.objectionId ?? null,
        selectedResponseId: extra?.responseId ?? null
      } satisfies SessionData;
    }

    if (action === "CHOOSE_STEP_OPTION") {
      const currentStep = script.steps[currentSession.currentStepIndex] ?? null;
      const choice = currentStep?.choices.find((item) => item.id === extra?.stepChoiceId) ?? null;
      if (!choice) return currentSession;

      if (choice.targetType === "OBJECTION") {
        return {
          ...currentSession,
          pane: "OBJECTION",
          selectedObjectionId: choice.targetObjectionId,
          selectedResponseId: extra?.responseId ?? null
        } satisfies SessionData;
      }

      if (choice.targetType === "TERMINAL") {
        return {
          ...currentSession,
          status: "COMPLETED",
          pane: "SCRIPT",
          selectedObjectionId: null,
          selectedResponseId: null
        } satisfies SessionData;
      }

      const targetIndex = script.steps.findIndex((item) => item.id === choice.targetStepId);
      if (targetIndex === -1) return currentSession;

      return {
        ...currentSession,
        pane: "SCRIPT",
        currentStepIndex: targetIndex,
        highestStepIndex: Math.max(currentSession.highestStepIndex, targetIndex),
        selectedObjectionId: null,
        selectedResponseId: null
      } satisfies SessionData;
    }

    if (action === "CHOOSE_OBJECTION_OPTION") {
      const currentObjection = script.objections.find((item) => item.id === currentSession.selectedObjectionId) ?? null;
      const choice = currentObjection?.choices.find((item) => item.id === extra?.objectionChoiceId) ?? null;
      if (!choice) return currentSession;

      if (choice.targetType === "OBJECTION") {
        return {
          ...currentSession,
          pane: "OBJECTION",
          selectedObjectionId: choice.targetObjectionId,
          selectedResponseId: extra?.responseId ?? null
        } satisfies SessionData;
      }

      if (choice.targetType === "TERMINAL") {
        return {
          ...currentSession,
          status: "COMPLETED",
          pane: "SCRIPT",
          selectedObjectionId: null,
          selectedResponseId: null
        } satisfies SessionData;
      }

      const targetIndex = script.steps.findIndex((item) => item.id === choice.targetStepId);
      if (targetIndex === -1) return currentSession;

      return {
        ...currentSession,
        pane: "SCRIPT",
        currentStepIndex: targetIndex,
        highestStepIndex: Math.max(currentSession.highestStepIndex, targetIndex),
        selectedObjectionId: null,
        selectedResponseId: null
      } satisfies SessionData;
    }

    const isLastStep = currentSession.currentStepIndex >= script.steps.length - 1;
    const advanceSourceStep = script.steps[currentSession.currentStepIndex] ?? null;
    if ((action === "ADVANCE" || action === "ADVANCE_FROM_OBJECTION") && advanceSourceStep?.advanceTargetType) {
      if (advanceSourceStep.advanceTargetType === "OBJECTION") {
        return {
          ...currentSession,
          pane: "OBJECTION",
          selectedObjectionId: advanceSourceStep.advanceTargetObjectionId,
          selectedResponseId: extra?.responseId ?? null
        } satisfies SessionData;
      }

      if (advanceSourceStep.advanceTargetType === "TERMINAL") {
        return {
          ...currentSession,
          status: "COMPLETED",
          pane: "SCRIPT",
          selectedObjectionId: null,
          selectedResponseId: null
        } satisfies SessionData;
      }

      const advanceTargetIndex = script.steps.findIndex((item) => item.id === advanceSourceStep.advanceTargetStepId);
      if (advanceTargetIndex !== -1) {
        return {
          ...currentSession,
          pane: "SCRIPT",
          currentStepIndex: advanceTargetIndex,
          highestStepIndex: Math.max(currentSession.highestStepIndex, advanceTargetIndex),
          selectedObjectionId: null,
          selectedResponseId: null
        } satisfies SessionData;
      }
    }

    if (isLastStep) {
      return {
        ...currentSession,
        status: "COMPLETED",
        pane: "SCRIPT",
        selectedObjectionId: null,
        selectedResponseId: null
      } satisfies SessionData;
    }

    const nextIndex = currentSession.currentStepIndex + 1;
    return {
      ...currentSession,
      pane: "SCRIPT",
      currentStepIndex: nextIndex,
      highestStepIndex: Math.max(currentSession.highestStepIndex, nextIndex),
      selectedObjectionId: null,
      selectedResponseId: null
    } satisfies SessionData;
  }

  useEffect(() => {
    if (!effectiveCall && !testMode) {
      setSession(null);
      setSessionLeadLabel(null);
      return;
    }

    let cancelled = false;

    async function startSession() {
      setIsBootingSession(true);
      setError(null);

      try {
        const data = await parseJson<{ session: SessionData; script: ScriptData; leadLabel?: string }>(
          await fetch("/api/call-script/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(effectiveCall
                ? {
                    leadId: effectiveCall.leadId,
                    callLogId: effectiveCall.callId
                  }
                : {}),
              languageCode,
              testMode
            })
          })
        );

        if (cancelled) return;
        setScript(data.script);
        setSession(data.session);
        setSessionLeadLabel(data.leadLabel ?? null);
      } catch (nextError) {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : "Could not start the script session.");
      } finally {
        if (!cancelled) {
          setIsBootingSession(false);
        }
      }
    }

    void startSession();

    return () => {
      cancelled = true;
    };
  }, [effectiveCall?.callId, effectiveCall?.leadId, languageCode, testMode]);

  useEffect(() => {
    if (!effectiveCall && !testMode) return;

    const timerId = window.setInterval(() => {
      setClock(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [effectiveCall, testMode]);

  useEffect(() => {
    if (!effectiveCall || !session || session.status !== "ACTIVE") return;
    if (!["ended", "failed"].includes(effectiveCall.status)) return;

    const optimistic = applyOptimisticAction(session, "CLOSE", { reason: effectiveCall.status });
    setSession(optimistic);
    enqueuePersist(session.id, "CLOSE", { reason: effectiveCall.status });
  }, [effectiveCall, session]);

  const currentStep = session ? script.steps[session.currentStepIndex] ?? null : script.steps[0] ?? null;
  const nextStep = session ? script.steps[session.currentStepIndex + 1] ?? null : script.steps[1] ?? null;
  const selectedObjection = session?.selectedObjectionId
    ? script.objections.find((item) => item.id === session.selectedObjectionId) ?? null
    : null;
  const selectedResponse =
    selectedObjection && session?.selectedResponseId
      ? selectedObjection.responses.find((item) => item.id === session.selectedResponseId) ?? null
      : null;

  const timerSeconds = useMemo(() => {
    if (effectiveCall) {
      const anchor = effectiveCall.answeredAt ?? effectiveCall.startedAt;
      return Math.max(0, Math.floor((clock - anchor) / 1000));
    }

    if (testMode && session) {
      return Math.max(0, Math.floor((clock - new Date(session.startedAt).getTime()) / 1000));
    }

    return 0;
  }, [effectiveCall, clock, session, testMode]);

  const canGoBack = Boolean(session && session.status === "ACTIVE" && session.pane === "SCRIPT" && session.currentStepIndex > 0);
  const isObjectionMode = session?.status === "ACTIVE" && session.pane === "OBJECTION";
  const isScriptMode = session?.status === "ACTIVE" && session.pane === "SCRIPT";
  const isCompleted = session?.status === "COMPLETED";
  const isEnded = session?.status === "CALL_ENDED";
  const currentStepChoices = currentStep?.choices ?? [];
  const currentObjectionChoices = selectedObjection?.choices ?? [];
  const possibleOwnerChoice =
    currentStep?.choices.find(
      (choice) =>
        choice.targetType === "STEP" &&
        (choice.label.toLowerCase().includes("propiet") || choice.label.toLowerCase().includes("owner"))
    ) ?? null;
  const looksLikeSecretaryStep =
    currentStep?.title.toLowerCase().includes("secretaria") ||
    currentStep?.title.toLowerCase().includes("secretaria") ||
    currentStep?.text.toLowerCase().includes("por favor.");
  const showEntryGate = Boolean(
    isScriptMode &&
      session?.currentStepIndex === 0 &&
      !entryGateDismissed &&
      looksLikeSecretaryStep &&
      possibleOwnerChoice
  );

  const hasSessionContext = Boolean(effectiveCall || testMode);
  const leadLabel = effectiveCall?.leadLabel ?? sessionLeadLabel ?? (testMode ? "Test Script" : "Sense lead actiu");

  const mainLabel = !hasSessionContext
    ? "Sense trucada activa"
    : showEntryGate
    ? "Inici de trucada"
    : isObjectionMode
    ? "Pantalla d'objeccio"
    : isCompleted
    ? "Final del flow"
    : isEnded
    ? "Sessio tancada"
    : `Pantalla ${String((session?.currentStepIndex ?? 0) + 1)}`;

  const mainTitle = !hasSessionContext
    ? "Comenca una trucada"
    : showEntryGate
    ? "Amb qui parles ara?"
    : isObjectionMode
    ? selectedObjection?.label ?? "Objeccio"
    : isCompleted
    ? "Guio completat"
    : isEnded
    ? "La trucada ja ha acabat"
    : currentStep?.title ?? "Sense passos";

  const mainText = !hasSessionContext
    ? "Quan iniciis una trucada des d'un lead, aqui se t'obriran els passos del guio en viu."
    : showEntryGate
    ? "Tria si t'ha agafat secretaria o directament el propietari per entrar al punt correcte del guio."
    : isObjectionMode
    ? selectedResponse?.text ?? "Aquesta objeccio no te resposta configurada."
    : isCompleted
    ? testMode
      ? "Has arribat al final del guio de prova. Pots tornar a clicar Test per arrencar una nova sessio de practica."
      : "Has arribat al final del guio principal. Ara el valor esta a guardar be l'outcome de la call."
    : isEnded
    ? testMode
      ? "La sessio de prova s'ha tancat."
      : "La sessio del guio s'ha tancat amb la trucada. L'analytics ja te guardat fins a on has arribat."
    : currentStep?.text ?? "No hi ha cap pas configurat.";

  function handleSessionAction(
    action: SessionAction,
    extra?: {
      objectionId?: string;
      responseId?: string;
      stepChoiceId?: string;
      objectionChoiceId?: string;
      reason?: string;
    }
  ) {
    const currentSession = sessionRef.current;
    if (!currentSession) return;

    setError(null);

    let nextExtra = extra;
    if (action === "OPEN_OBJECTION" && extra?.objectionId) {
      const objection = script.objections.find((item) => item.id === extra.objectionId);
      const response = objection ? pickRandomResponse(objection) : null;
      nextExtra = {
        ...extra,
        responseId: response?.id
      };
    }

    if (action === "CHOOSE_STEP_OPTION" && extra?.stepChoiceId) {
      const choice = currentStepChoices.find((item) => item.id === extra.stepChoiceId) ?? null;
      if (choice?.targetType === "OBJECTION" && choice.targetObjectionId) {
        const objection = script.objections.find((item) => item.id === choice.targetObjectionId);
        const response = objection ? pickRandomResponse(objection) : null;
        nextExtra = {
          ...extra,
          objectionId: choice.targetObjectionId,
          responseId: response?.id
        };
      }
    }

    if (action === "CHOOSE_OBJECTION_OPTION" && extra?.objectionChoiceId) {
      const choice = currentObjectionChoices.find((item) => item.id === extra.objectionChoiceId) ?? null;
      if (choice?.targetType === "OBJECTION" && choice.targetObjectionId) {
        const objection = script.objections.find((item) => item.id === choice.targetObjectionId);
        const response = objection ? pickRandomResponse(objection) : null;
        nextExtra = {
          ...extra,
          objectionId: choice.targetObjectionId,
          responseId: response?.id
        };
      }
    }

    if ((action === "ADVANCE" || action === "ADVANCE_FROM_OBJECTION") && currentStep?.advanceTargetType === "OBJECTION") {
      const objection = script.objections.find((item) => item.id === currentStep.advanceTargetObjectionId);
      const response = objection ? pickRandomResponse(objection) : null;
      nextExtra = {
        ...extra,
        objectionId: currentStep.advanceTargetObjectionId ?? undefined,
        responseId: response?.id
      };
    }

    const optimistic = applyOptimisticAction(currentSession, action, nextExtra);
    sessionRef.current = optimistic;
    setSession(optimistic);
    enqueuePersist(currentSession.id, action, nextExtra);
  }

  return (
    <div className="flow-mockup">
      <section className="flow-mockup__main">
        <div className="flow-screen panel">
          <div className="flow-screen__top">
            <span className="flow-pill">
              Lead: {leadLabel}
            </span>
            <span className="flow-pill">{hasSessionContext ? formatTimer(timerSeconds) : "--:--"}</span>
          </div>

          <div className="flow-screen__body">
            <span className="script-stage__label">{mainLabel}</span>
            {showEntryGate || !hasSessionContext || isCompleted || isEnded ? <h2>{mainTitle}</h2> : null}
            <p>{mainText}</p>
            {error ? <span className="error">{error}</span> : null}
          </div>

          <div className="flow-screen__actions">
            {showEntryGate ? (
              <>
                <button className="ghost-button" disabled={isBootingSession} onClick={() => setEntryGateDismissed(true)} type="button">
                  <ArrowLeft size={16} />
                  Secretaria
                </button>
                <button
                  className="button"
                  disabled={isBootingSession}
                  onClick={() => handleSessionAction("CHOOSE_STEP_OPTION", { stepChoiceId: possibleOwnerChoice?.id })}
                  type="button"
                >
                  <ArrowRight size={16} />
                  Propietari
                </button>
              </>
            ) : null}

            {isScriptMode && !showEntryGate ? (
              <>
                <button className="ghost-button" disabled={!canGoBack || isBootingSession} onClick={() => handleSessionAction("BACK")} type="button">
                  <ArrowLeft size={16} />
                  Enrere
                </button>
                <button className="button" disabled={isBootingSession} onClick={() => handleSessionAction("ADVANCE")} type="button">
                  <CheckCircle2 size={16} />
                  Ja ho he dit
                </button>
              </>
            ) : null}

            {isObjectionMode ? (
              <>
                <button className="ghost-button" disabled={isBootingSession} onClick={() => handleSessionAction("RETURN_TO_SCRIPT")} type="button">
                  <ArrowLeft size={16} />
                  Tornar al guio
                </button>
                <button className="button" disabled={isBootingSession} onClick={() => handleSessionAction("ADVANCE_FROM_OBJECTION")} type="button">
                  <ArrowRight size={16} />
                  Seguent pantalla
                </button>
              </>
            ) : null}

            {isCompleted || isEnded || !session ? (
              <>
                <button className="ghost-button" disabled>
                  <ArrowLeft size={16} />
                  Enrere
                </button>
                <button className="button" disabled>
                  <RotateCcw size={16} />
                  Sessio tancada
                </button>
              </>
            ) : null}
          </div>

          {isScriptMode && !showEntryGate && currentStepChoices.length ? (
            <div className="flow-branch-grid">
              {currentStepChoices.map((choice) => (
                <button
                  key={choice.id}
                  className="flow-branch-button"
                  disabled={isBootingSession}
                  onClick={() => handleSessionAction("CHOOSE_STEP_OPTION", { stepChoiceId: choice.id })}
                  type="button"
                >
                  {choice.label}
                </button>
              ))}
            </div>
          ) : null}

          {isObjectionMode && currentObjectionChoices.length ? (
            <div className="flow-branch-grid">
              {currentObjectionChoices.map((choice) => (
                <button
                  key={choice.id}
                  className="flow-branch-button"
                  disabled={isBootingSession}
                  onClick={() => handleSessionAction("CHOOSE_OBJECTION_OPTION", { objectionChoiceId: choice.id })}
                  type="button"
                >
                  {choice.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flow-preview-grid">
          <article className="flow-preview panel">
            <div className="flow-preview__header">
              <span>Seguent pantalla</span>
              <ArrowRight size={15} />
            </div>
            <strong>{nextStep?.title ?? "No n'hi ha mes"}</strong>
            <p>{nextStep?.text ?? "Aquest era l'ultim pas configurat del guio."}</p>
          </article>

          <article className={`flow-preview panel flow-preview--objection${isObjectionMode ? " flow-preview--active" : ""}`}>
            <div className="flow-preview__header">
              <span>Resposta d'objeccio</span>
              <MessageSquareQuote size={15} />
            </div>
            <strong>{selectedObjection?.label ?? "Selecciona una objeccio"}</strong>
            <p>{selectedResponse?.text ?? "Quan cliquis una objeccio, aqui veuras una de les variants configurades."}</p>
          </article>
        </div>
      </section>

      <aside className="flow-mockup__aside">
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Objeccions</h2>
          <div className="script-objections">
            {script.objections.map((objection) => (
              (() => {
                const { Icon, tone } = getObjectionVisual(objection.label);

                return (
                  <button
                    key={objection.id}
                    className={`script-objection-chip script-objection-chip--${tone}${selectedObjection?.id === objection.id ? " is-selected" : ""}`}
                    disabled={!session || session.status !== "ACTIVE" || isBootingSession}
                    onClick={() => handleSessionAction("OPEN_OBJECTION", { objectionId: objection.id })}
                    type="button"
                  >
                    <span className={`script-objection-chip__icon script-objection-chip__icon--${tone}`}>
                      <Icon size={16} />
                    </span>
                    <span>{objection.label}</span>
                  </button>
                );
              })()
            ))}
          </div>
          <div className="flow-objection-help">
            <p>
              Si surt una objeccio en qualsevol moment, la cliques aqui i el CRM et mostra una variant aleatoria de resposta.
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
