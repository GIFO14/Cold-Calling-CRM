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
    throw new Error("WebRTC calling requires HTTPS or localhost to access the microphone.");
  }

  if (typeof RTCPeerConnection === "undefined") {
    throw new Error("This browser does not support WebRTC calling.");
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("WebRTC calling requires HTTPS or localhost to access the microphone.");
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
        return new Error("Microphone permission was dismissed. Try again and allow it.");
      }

      return new Error("You must allow microphone access to start the call.");
    }

    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return new Error("No microphone was detected.");
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return new Error("The microphone is busy or unavailable right now.");
    }

    if (error.name === "SecurityError") {
      return new Error("Microphone access is blocked by the browser.");
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("permission dismissed") || message.includes("permission denied")) {
    return new Error("You must allow microphone access to start the call.");
  }

  if (message.includes("insecure context") || message.includes("media devices not available")) {
    return new Error("WebRTC calling requires HTTPS or localhost to access the microphone.");
  }

  return error instanceof Error ? error : new Error("Call error");
}

function buildDialedNumber(phone: string, outboundDialPrefix?: string | null) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw new Error("The lead's phone number is invalid.");
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
  const ringtoneContextRef = useRef<AudioContext | null>(null);
  const ringtoneGainRef = useRef<GainNode | null>(null);
  const ringtoneOscillatorsRef = useRef<OscillatorNode[]>([]);
  const ringtoneLoopRef = useRef<number | null>(null);
  const ringtoneEchoRef = useRef<number | null>(null);
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

  const stopRingingTone = useCallback(() => {
    if (ringtoneLoopRef.current) {
      window.clearInterval(ringtoneLoopRef.current);
      ringtoneLoopRef.current = null;
    }

    if (ringtoneEchoRef.current) {
      window.clearTimeout(ringtoneEchoRef.current);
      ringtoneEchoRef.current = null;
    }

    const context = ringtoneContextRef.current;
    const gain = ringtoneGainRef.current;
    const oscillators = ringtoneOscillatorsRef.current;
    if (!context || !gain) return;

    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    window.setTimeout(() => {
      oscillators.forEach((oscillator) => {
        try {
          oscillator.stop();
        } catch {
          // Ignore duplicate stops while tearing down.
        }
        oscillator.disconnect();
      });
      gain.disconnect();
      ringtoneGainRef.current = null;
      ringtoneOscillatorsRef.current = [];
    }, 160);
  }, []);

  const ensureRingtoneContext = useCallback(async () => {
    if (typeof window === "undefined") return null;

    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) return null;

    if (!ringtoneContextRef.current) {
      ringtoneContextRef.current = new AudioContextConstructor();
    }

    if (ringtoneContextRef.current.state === "suspended") {
      await ringtoneContextRef.current.resume();
    }

    return ringtoneContextRef.current;
  }, []);

  const startRingingTone = useCallback(async () => {
    const context = await ensureRingtoneContext();
    if (!context || ringtoneGainRef.current) return;

    const gain = context.createGain();
    gain.gain.value = 0.0001;
    gain.connect(context.destination);

    const oscillators = [440, 480].map((frequency) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start();
      return oscillator;
    });

    const triggerBurst = () => {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    };

    triggerBurst();
    ringtoneEchoRef.current = window.setTimeout(triggerBurst, 700);
    ringtoneLoopRef.current = window.setInterval(() => {
      triggerBurst();
      ringtoneEchoRef.current = window.setTimeout(triggerBurst, 700);
    }, 2800);

    ringtoneGainRef.current = gain;
    ringtoneOscillatorsRef.current = oscillators;
  }, [ensureRingtoneContext]);

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
            syncActiveCall({ ...current, status: "dialing", statusLabel: "Dialing" });
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
              statusLabel: "In call"
            });
            void patchCallStatus(current.callId, "ANSWERED");
          },
          onCallHangup: () => {
            void markCallFinished("COMPLETED", "Call ended");
          },
          onCallHold: (held) => {
            setIsHeld(held);
          },
          onServerDisconnect: (error) => {
            if (!activeCallRef.current) return;
            void markCallFinished(error ? "FAILED" : "CANCELED", error ? "Connection error" : "Call canceled");
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
        throw new Error("You already have an active call.");
      }

      setIsBusy(true);
      resetComposer();

      let createdCallId: string | null = null;

      try {
        // Request mic access before the first awaited network call so the browser
        // keeps the permission prompt tied to the original click interaction.
        await ensureRingtoneContext();
        await ensureMicrophoneAccess();

        const configResponse = await fetch("/api/telephony/config");
        if (!configResponse.ok) {
          throw new Error("Could not load telephony settings.");
        }

        const config = (await configResponse.json()) as TelephonyConfig;
        if (!config.enabled) {
          throw new Error("Set up PBX and the WebRTC extension in Settings.");
        }

        const dialed = buildDialedNumber(phone, config.outboundDialPrefix);
        const callResponse = await fetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, phoneDialed: dialed })
        });

        if (!callResponse.ok) {
          const data = (await callResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "Could not create the call log.");
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
          statusLabel: "Connecting SIP"
        });

        const simpleUser = await ensureSipUser(config);
        const current = activeCallRef.current;
        if (current) {
          syncActiveCall({ ...current, status: "dialing", statusLabel: "Dialing" });
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
        if (!activeCallRef.current || activeCallRef.current.answeredAt || ["ended", "failed"].includes(activeCallRef.current.status)) {
          stopRingingTone();
        }
        setIsBusy(false);
      }
    },
    [ensureRingtoneContext, ensureSipUser, resetComposer, stopRingingTone, syncActiveCall]
  );

  const hangup = useCallback(async () => {
    const current = activeCallRef.current;
    if (!current || ["ended", "failed"].includes(current.status)) return;

    setIsBusy(true);
    try {
      await userRef.current?.hangup();
      await markCallFinished("COMPLETED", "Call ended");
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
    const isRinging = Boolean(activeCall && !activeCall.answeredAt && !["ended", "failed"].includes(activeCall.status));

    if (isRinging) {
      void startRingingTone();
      return;
    }

    stopRingingTone();
  }, [activeCall, startRingingTone, stopRingingTone]);

  useEffect(() => {
    return () => {
      stopRingingTone();
      void ringtoneContextRef.current?.close();
      void userRef.current?.disconnect();
    };
  }, [stopRingingTone]);

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
  const isWaitingForAnswer = Boolean(bannerCall && !bannerCall.answeredAt && !showOutcomeEditor);
  const timerLabel = bannerCall?.answeredAt ? "Durada" : "Estat";
  const timerValue = bannerCall?.answeredAt
    ? formatDuration(durationSeconds)
    : isWaitingForAnswer
      ? "ringing..."
      : (bannerCall?.statusLabel ?? "");

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
              <strong>{bannerCall.leadLabel ?? "Active call"}</strong>
              <div className="call-banner__meta">
                <span>{bannerCall.phone}</span>
                <span>{bannerCall.statusLabel}</span>
              </div>
            </div>
            <div className="call-banner__timer">
              <span>{timerLabel}</span>
              <strong>{timerValue}</strong>
            </div>
          </div>

          <div className="call-banner__controls">
            <Link href={`/leads/${bannerCall.leadId}`} className="ghost-button call-banner__link">
              <UserRound size={16} />
              Lead
            </Link>
            <button className="ghost-button icon-button" onClick={toggleMute} disabled={!showLiveControls} title="Mute">
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button className="ghost-button icon-button" onClick={toggleHold} disabled={!showLiveControls || isBusy} title="Hold">
              {isHeld ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button className="danger-button" onClick={hangup} disabled={showOutcomeEditor || isBusy}>
              <PhoneOff size={16} />
              Hang up
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
                Save outcome
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
    throw new Error("useCall must be used within CallProvider.");
  }

  return context;
}
