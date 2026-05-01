"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type LeadFollowUpSchedulerProps = {
  leadId: string;
  nextFollowUpAt: string | null;
  nextFollowUpLabel: string | null;
};

export function LeadFollowUpScheduler({
  leadId,
  nextFollowUpAt,
  nextFollowUpLabel
}: LeadFollowUpSchedulerProps) {
  const router = useRouter();
  const [value, setValue] = useState(nextFollowUpAt ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextValue: string | null) {
    setIsSaving(true);
    setError(null);

    const response = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nextFollowUpAt: nextValue })
    });

    setIsSaving(false);

    if (!response.ok) {
      setError("Could not save the next call.");
      return;
    }

    router.refresh();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save(value.trim() || null);
  }

  async function clearSchedule() {
    setValue("");
    await save(null);
  }

  return (
    <section className="panel follow-up-scheduler">
      <div className="section-title-row">
        <div>
          <h2>Next call</h2>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Schedule when this lead should be called again.
          </p>
        </div>
      </div>
      <form onSubmit={onSubmit} className="grid">
        <div className="field">
          <label>Date and time</label>
          <input
            type="datetime-local"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <div className="follow-up-scheduler__actions">
          <button className="button" disabled={isSaving || !value.trim()}>
            Save next call
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => void clearSchedule()}
            disabled={isSaving || !nextFollowUpAt}
          >
            Clear
          </button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {nextFollowUpLabel ? `Scheduled for ${nextFollowUpLabel}` : "No call scheduled."}
        </p>
        {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
      </form>
    </section>
  );
}
