"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type LeadNote = {
  id: string;
  body: string;
  createdAt: string;
  userName: string | null;
};

export function NoteForm({
  leadId,
  notes
}: {
  leadId: string;
  notes: LeadNote[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setLoading(true);
    const response = await fetch(`/api/leads/${leadId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    setLoading(false);
    if (response.ok) {
      setBody("");
      router.refresh();
    }
  }

  return (
    <div className="grid">
      {notes.length ? (
        <div className="timeline">
          {notes.map((note) => (
            <div key={note.id} className="timeline-item">
              <div className="muted" style={{ marginBottom: 6 }}>
                {note.createdAt} {note.userName ? `· ${note.userName}` : ""}
              </div>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{note.body}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="field">
        <label>New note</label>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} />
      </div>
      <button className="button" onClick={submit} disabled={loading || !body.trim()}>
        Add note
      </button>
    </div>
  );
}
