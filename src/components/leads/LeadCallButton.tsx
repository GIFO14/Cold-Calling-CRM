"use client";

import { Phone, PhoneOff } from "lucide-react";
import { useState } from "react";
import { useCall } from "@/components/telephony/CallProvider";

export function LeadCallButton({
  leadId,
  leadLabel,
  phone,
  disabled
}: {
  leadId: string;
  leadLabel?: string;
  phone: string | null;
  disabled?: boolean;
}) {
  const { activeCall, isBusy, startCall, hangup } = useCall();
  const [status, setStatus] = useState("Preparat");

  const isCurrentLead = activeCall?.leadId === leadId;
  const hasAnotherActiveCall = Boolean(activeCall && activeCall.leadId !== leadId);
  const hasOngoingCall = Boolean(activeCall && !["ended", "failed"].includes(activeCall.status));
  const showCallButton = !hasOngoingCall;
  const showHangupButton = hasOngoingCall && isCurrentLead;
  const liveStatus = isCurrentLead ? activeCall?.statusLabel : hasAnotherActiveCall ? "Una altra trucada activa" : status;

  async function handleStartCall() {
    if (!phone) return;

    try {
      setStatus("Connectant");
      await startCall({ leadId, leadLabel, phone });
      setStatus("Trucant");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error de trucada");
    }
  }

  async function handleHangup() {
    await hangup();
    setStatus("Trucada finalitzada");
  }

  return (
    <div className="grid" style={{ gap: 8 }}>
      {showCallButton || showHangupButton ? (
        <div className="toolbar" style={{ marginBottom: 0 }}>
          {showCallButton ? (
            <button className="button" onClick={handleStartCall} disabled={!phone || disabled || isBusy || hasAnotherActiveCall || isCurrentLead}>
              <Phone size={16} />
              Call
            </button>
          ) : null}
          {showHangupButton ? (
            <button className="danger-button" onClick={handleHangup} disabled={!isCurrentLead || !activeCall || isBusy}>
              <PhoneOff size={16} />
              Penjar
            </button>
          ) : null}
        </div>
      ) : null}
      <small className="muted">{disabled ? "Trucada bloquejada per estat del telèfon" : liveStatus}</small>
    </div>
  );
}
