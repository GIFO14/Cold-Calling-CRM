"use client";

import Link from "next/link";
import { Mic, MicOff, Pause, PhoneOff, PhoneOutgoing, Play, UserRound } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SimpleUser } from "sip.js/lib/platform/web";
import { normalizePhone } from "@/lib/leads/normalize";

const outcomes = [
  "NO_ANSWER",
  "BUSY",
  "WRONG_NUMBER",
  "INTERESTED",
  "CALL_BACK",
  "NOT_INTERESTED",
  "MEETING_BOOKED",
  "DO_NOT_CALL",
  "OTHER"
] as const;

type TelephonyConfig = {
  enabled: boolean;
  sipWsUrl: string;
  sipDomain: string;
  outboundDialPrefix?: string | null;
  username: string;
  password: string;
  displayName?: string | null;
  extension?: string | null;
};

type ActiveCall = {
  callId: string;
  leadId: string;
  leadLabel?: string;
  phone: string;
  dialed: string;
  startedAt: number;
  answeredAt: number | null;
  status: "connecting" | "dialing" | "active" | "ended" | "failed";
  statusLabel: string;
};

type StartCallInput = {
  leadId: string;
  leadLabel?: string;
  phone: string;
};

type CallContextValue = {
  activeCall: ActiveCall | null;
  isMuted: boolean;
  isHeld: boolean;
  isBusy: boolean;
  startCall: (input: StartCallInput) => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => void;
  toggleHold: () => Promise<void>;
  saveOutcome: () => Promise<void>;
  outcome: string;
  notes: string;
  setOutcome: (value: string) => void;
  setNotes: (value: string) => void;
};

const CallContext = createContext<CallContextValue | null>(null);

async function patchCallStatus(callId: string, status: "RINGING" | "ANSWERED" | "COMPLETED" | "FAILED" | "CANCELED") {
  await fetch(`/api/calls/${callId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
}

async function ensureMicrophoneAccess() {
  if (!window.isSecureContext) {
    throw new Error("La trucada WebRTC necessita HTTPS o localhost per accedir al micròfon.");
  }

  if (typeof RTCPeerConnection === "undefined") {
    throw new Error("Aquest navegador no és compatible amb trucades WebRTC.");
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("La trucada WebRTC necessita HTTPS o localhost per accedir al micròfon.");
  }

  let stream: MediaStream | null = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (error) {
    throw normalizeCallError(error);
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
}

function normalizeCallError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      if (error.message.toLowerCase().includes("dismiss")) {
        return new Error("Permís de micròfon descartat. Torna-ho a intentar i accepta'l.");
      }

      return new Error("Has de permetre l'accés al micròfon per iniciar la trucada.");
    }

    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return new Error("No s'ha detectat cap micròfon disponible.");
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return new Error("El micròfon està ocupat o no es pot utilitzar ara.");
    }

    if (error.name === "SecurityError") {
      return new Error("L'accés al micròfon està bloquejat pel navegador.");
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("permission dismissed") || message.includes("permission denied")) {
    return new Error("Has de permetre l'accés al micròfon per iniciar la trucada.");
  }

  if (message.includes("insecure context") || message.includes("media devices not available")) {
    return new Error("La trucada WebRTC necessita HTTPS o localhost per accedir al micròfon.");
  }

  return error instanceof Error ? error : new Error("Error de trucada");
}

function buildDialedNumber(phone: string, outboundDialPrefix?: string | null) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw new Error("El telèfon del lead no és vàlid.");
  }

  const prefix = (outboundDialPrefix ?? "").trim();
  if (!prefix) {
    return normalizedPhone;
  }

  return `${prefix}${normalizedPhone.replace(/^\+/, "")}`;
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  return [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const userRef = useRef<SimpleUser | null>(null);
  const activeCallRef = useRef<ActiveCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [outcome, setOutcome] = useState("NO_ANSWER");
  const [notes, setNotes] = useState("");
  const [clock, setClock] = useState(Date.now());

  const syncActiveCall = useCallback((nextCall: ActiveCall | null) => {
    activeCallRef.current = nextCall;
    setActiveCall(nextCall);
  }, []);

  const resetComposer = useCallback(() => {
    setOutcome("NO_ANSWER");
    setNotes("");
  }, []);

  const markCallFinished = useCallback(
    async (status: "COMPLETED" | "FAILED" | "CANCELED", statusLabel: string) => {
      const current = activeCallRef.current;
      if (!current) return;
      if (current.status === "ended" || current.status === "failed") return;

      try {
        await patchCallStatus(current.callId, status);
      } catch {
        // Keep the in-app state usable even if the log update fails.
      }

      syncActiveCall({
        ...current,
        status: status === "FAILED" ? "failed" : "ended",
        statusLabel
      });
      setIsHeld(false);
      setIsMuted(false);
    },
    [syncActiveCall]
  );

  const ensureSipUser = useCallback(
    async (config: TelephonyConfig) => {
      if (userRef.current?.isConnected()) return userRef.current;

      const simpleUser = new SimpleUser(config.sipWsUrl, {
        aor: `sip:${config.username}@${config.sipDomain}`,
        media: {
          constraints: { audio: true, video: false },
          remote: audioRef.current ? { audio: audioRef.current } : undefined
        },
        userAgentOptions: {
          authorizationUsername: config.username,
          authorizationPassword: config.password,
          displayName: config.displayName ?? config.username,
          contactName: config.extension ?? config.username
        },
        delegate: {
          onCallCreated: () => {
            const current = activeCallRef.current;
            if (!current) return;
            syncActiveCall({ ...current, status: "dialing", statusLabel: "Trucant" });
            void patchCallStatus(current.callId, "RINGING");
          },
          onCallAnswered: () => {
            const current = activeCallRef.current;
            if (!current) return;
            const answeredAt = Date.now();
            syncActiveCall({
              ...current,
              answeredAt,
              status: "active",
              statusLabel: "En trucada"
            });
            void patchCallStatus(current.callId, "ANSWERED");
          },
          onCallHangup: () => {
            void markCallFinished("COMPLETED", "Trucada finalitzada");
          },
          onCallHold: (held) => {
            setIsHeld(held);
          },
          onServerDisconnect: (error) => {
            if (!activeCallRef.current) return;
            void markCallFinished(error ? "FAILED" : "CANCELED", error ? "Error de connexio" : "Trucada cancel·lada");
          }
        }
      });

      await simpleUser.connect();
      await simpleUser.register();
      userRef.current = simpleUser;
      return simpleUser;
    },
    [markCallFinished, syncActiveCall]
  );

  const startCall = useCallback(
    async ({ leadId, leadLabel, phone }: StartCallInput) => {
      if (activeCallRef.current && !["ended", "failed"].includes(activeCallRef.current.status)) {
        throw new Error("Ja tens una trucada activa.");
      }

      setIsBusy(true);
      resetComposer();

      let createdCallId: string | null = null;

      try {
        // Request mic access before the first awaited network call so the browser
        // keeps the permission prompt tied to the original click interaction.
        await ensureMicrophoneAccess();

        const configResponse = await fetch("/api/telephony/config");
        if (!configResponse.ok) {
          throw new Error("No s'ha pogut carregar la configuració de telefonia.");
        }

        const config = (await configResponse.json()) as TelephonyConfig;
        if (!config.enabled) {
          throw new Error("Configura PBX i extensio WebRTC a Configuracio.");
        }

        const dialed = buildDialedNumber(phone, config.outboundDialPrefix);
        const callResponse = await fetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, phoneDialed: dialed })
        });

        if (!callResponse.ok) {
          const data = (await callResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "No s'ha pogut crear el registre de trucada.");
        }

        const { call } = (await callResponse.json()) as { call: { id: string } };
        createdCallId = call.id;

        syncActiveCall({
          callId: call.id,
          leadId,
          leadLabel,
          phone,
          dialed,
          startedAt: Date.now(),
          answeredAt: null,
          status: "connecting",
          statusLabel: "Connectant SIP"
        });

        const simpleUser = await ensureSipUser(config);
        const current = activeCallRef.current;
        if (current) {
          syncActiveCall({ ...current, status: "dialing", statusLabel: "Trucant" });
        }
        await simpleUser.call(`sip:${dialed}@${config.sipDomain}`);
      } catch (error) {
        if (createdCallId) {
          try {
            await patchCallStatus(createdCallId, "FAILED");
          } catch {
            // Ignore secondary failure and surface the original error.
          }
        }
        syncActiveCall(null);
        setIsHeld(false);
        setIsMuted(false);
        throw normalizeCallError(error);
      } finally {
        setIsBusy(false);
      }
    },
    [ensureSipUser, resetComposer, syncActiveCall]
  );

  const hangup = useCallback(async () => {
    const current = activeCallRef.current;
    if (!current || ["ended", "failed"].includes(current.status)) return;

    setIsBusy(true);
    try {
      await userRef.current?.hangup();
      await markCallFinished("COMPLETED", "Trucada finalitzada");
    } finally {
      setIsBusy(false);
    }
  }, [markCallFinished]);

  const toggleMute = useCallback(() => {
    const currentUser = userRef.current;
    if (!currentUser || !activeCallRef.current || activeCallRef.current.status !== "active") return;

    if (currentUser.isMuted()) {
      currentUser.unmute();
      setIsMuted(false);
      return;
    }

    currentUser.mute();
    setIsMuted(true);
  }, []);

  const toggleHold = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser || !activeCallRef.current || activeCallRef.current.status !== "active") return;

    setIsBusy(true);
    try {
      if (currentUser.isHeld()) {
        await currentUser.unhold();
        setIsHeld(false);
      } else {
        await currentUser.hold();
        setIsHeld(true);
      }
    } finally {
      setIsBusy(false);
    }
  }, []);

  const saveOutcome = useCallback(async () => {
    const current = activeCallRef.current;
    if (!current) return;

    setIsBusy(true);
    try {
      await fetch(`/api/calls/${current.callId}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, notes })
      });
      syncActiveCall(null);
      resetComposer();
      setIsHeld(false);
      setIsMuted(false);
    } finally {
      setIsBusy(false);
    }
  }, [notes, outcome, resetComposer, syncActiveCall]);

  useEffect(() => {
    if (!activeCall) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeCall]);

  useEffect(() => {
    return () => {
      void userRef.current?.disconnect();
    };
  }, []);

  const value = useMemo<CallContextValue>(
    () => ({
      activeCall,
      isMuted,
      isHeld,
      isBusy,
      startCall,
      hangup,
      toggleMute,
      toggleHold,
      saveOutcome,
      outcome,
      notes,
      setOutcome,
      setNotes
    }),
    [activeCall, hangup, isBusy, isHeld, isMuted, notes, outcome, saveOutcome, startCall, toggleHold, toggleMute]
  );

  const durationSeconds =
    activeCall?.answeredAt ? Math.max(0, Math.floor((clock - activeCall.answeredAt) / 1000)) : 0;
  const shouldShowBanner = Boolean(activeCall);
  const showLiveControls = activeCall?.status === "active";
  const showOutcomeEditor = activeCall?.status === "ended" || activeCall?.status === "failed";
  const bannerCall = activeCall;

  return (
    <CallContext.Provider value={value}>
      {children}
      <audio ref={audioRef} autoPlay />
      {shouldShowBanner && bannerCall ? (
        <section className="call-banner" aria-live="polite">
          <div className="call-banner__summary">
            <div className="call-banner__icon">
              <PhoneOutgoing size={18} />
            </div>
            <div className="call-banner__identity">
              <strong>{bannerCall.leadLabel ?? "Trucada activa"}</strong>
              <div className="call-banner__meta">
                <span>{bannerCall.phone}</span>
                <span>{bannerCall.statusLabel}</span>
              </div>
            </div>
            <div className="call-banner__timer">
              <span>Durada</span>
              <strong>{formatDuration(durationSeconds)}</strong>
            </div>
          </div>

          <div className="call-banner__controls">
            <Link href={`/leads/${bannerCall.leadId}`} className="ghost-button call-banner__link">
              <UserRound size={16} />
              Lead
            </Link>
            <button className="ghost-button icon-button" onClick={toggleMute} disabled={!showLiveControls} title="Silenciar">
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button className="ghost-button icon-button" onClick={toggleHold} disabled={!showLiveControls || isBusy} title="Pausa">
              {isHeld ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button className="danger-button" onClick={hangup} disabled={showOutcomeEditor || isBusy}>
              <PhoneOff size={16} />
              Penjar
            </button>
          </div>

          {showOutcomeEditor ? (
            <div className="call-banner__outcome">
              <div className="field">
                <label>Outcome</label>
                <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
                  {outcomes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
              </div>
              <button className="button" onClick={saveOutcome} disabled={isBusy}>
                Guardar outcome
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall s'ha d'usar dins de CallProvider.");
  }

  return context;
}
