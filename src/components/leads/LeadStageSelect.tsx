"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LeadStageSelect({
  leadId,
  stageId,
  stages
}: {
  leadId: string;
  stageId: string | null;
  stages: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(stageId ?? "");

  async function change(nextValue: string) {
    setValue(nextValue);
    await fetch(`/api/leads/${leadId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: nextValue })
    });
    router.refresh();
  }

  return (
    <select value={value} onChange={(event) => change(event.target.value)}>
      <option value="" disabled>
        No stage
      </option>
      {stages.map((stage) => (
        <option key={stage.id} value={stage.id}>
          {stage.name}
        </option>
      ))}
    </select>
  );
}
