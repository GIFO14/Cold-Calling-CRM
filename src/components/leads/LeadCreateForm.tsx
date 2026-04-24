"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCurrencyFromCents, formatCurrencyInputFromCents, parseCurrencyInputToCents } from "@/lib/money";

export function LeadCreateForm({
  stages,
  defaultDealValueCents
}: {
  stages: { id: string; name: string }[];
  defaultDealValueCents: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const dealValueOverrideCents = parseCurrencyInputToCents(formData.get("dealValueOverride"));
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        company: formData.get("company"),
        jobTitle: formData.get("jobTitle"),
        phone: formData.get("phone"),
        email: formData.get("email"),
        source: formData.get("source"),
        stageId: formData.get("stageId"),
        dealValueOverrideCents
      })
    });
    setLoading(false);
    if (response.ok) {
      setOpen(false);
      router.refresh();
      event.currentTarget.reset();
    }
  }

  if (!open) {
    return (
      <button className="button" onClick={() => setOpen(true)}>
        <Plus size={17} />
        Nou lead
      </button>
    );
  }

  return (
    <section className="panel" style={{ marginBottom: 18 }}>
      <form onSubmit={onSubmit} className="grid grid-3">
        <div className="field">
          <label>Nom</label>
          <input name="firstName" />
        </div>
        <div className="field">
          <label>Cognom</label>
          <input name="lastName" />
        </div>
        <div className="field">
          <label>Empresa</label>
          <input name="company" />
        </div>
        <div className="field">
          <label>Càrrec</label>
          <input name="jobTitle" />
        </div>
        <div className="field">
          <label>Telèfon</label>
          <input name="phone" />
        </div>
        <div className="field">
          <label>Email</label>
          <input name="email" type="email" />
        </div>
        <div className="field">
          <label>Origen</label>
          <input name="source" />
        </div>
        <div className="field">
          <label>Stage</label>
          <select name="stageId">
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Valor deal</label>
          <input
            name="dealValueOverride"
            type="number"
            min="0"
            step="0.01"
            placeholder={formatCurrencyInputFromCents(defaultDealValueCents)}
          />
          <small className="muted">
            Si el deixes buit, s&apos;aplicarà el ticket mitjà de {formatCurrencyFromCents(defaultDealValueCents)}.
          </small>
        </div>
        <div className="toolbar" style={{ alignSelf: "end", marginBottom: 0 }}>
          <button className="button" disabled={loading}>
            Crear
          </button>
          <button className="ghost-button" type="button" onClick={() => setOpen(false)}>
            Cancel·lar
          </button>
        </div>
      </form>
    </section>
  );
}
