"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NoteForm({ leadId }: { leadId: string }) {
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
      <div className="field">
        <label>Nova nota</label>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} />
      </div>
      <button className="button" onClick={submit} disabled={loading || !body.trim()}>
        Afegir nota
      </button>
    </div>
  );
}
