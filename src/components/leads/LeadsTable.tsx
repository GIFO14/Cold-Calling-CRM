"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LeadBadges } from "@/components/leads/LeadBadges";
import { LeadCallButton } from "@/components/leads/LeadCallButton";
import { LeadStageSelect } from "@/components/leads/LeadStageSelect";
import { displayLeadName } from "@/lib/leads/normalize";

type StageOption = {
  id: string;
  name: string;
};

type LeadListItem = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  company: string | null;
  jobTitle: string | null;
  phone: string | null;
  email: string | null;
  stageId: string | null;
  phoneInvalid: boolean;
  phoneOptOut: boolean;
  emailOptOut: boolean;
  customFields?: unknown;
};

function normalizeCustomFields(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function LeadsTable({
  leads,
  stages
}: {
  leads: LeadListItem[];
  stages: StageOption[];
}) {
  const router = useRouter();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStageId, setBulkStageId] = useState(stages[0]?.id ?? "");
  const [loadingAction, setLoadingAction] = useState<"stage" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allLeadIds = leads.map((lead) => lead.id);
  const allSelected = leads.length > 0 && selectedIds.length === leads.length;
  const hasSelection = selectedIds.length > 0;
  const partiallySelected = hasSelection && !allSelected;

  useEffect(() => {
    const nextLeadIds = leads.map((lead) => lead.id);
    setSelectedIds((current) => current.filter((id) => nextLeadIds.includes(id)));
  }, [leads]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = partiallySelected;
  }, [partiallySelected]);

  useEffect(() => {
    if (!stages.some((stage) => stage.id === bulkStageId)) {
      setBulkStageId(stages[0]?.id ?? "");
    }
  }, [bulkStageId, stages]);

  function toggleLead(leadId: string) {
    setSelectedIds((current) =>
      current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId]
    );
  }

  function toggleAll() {
    setSelectedIds((current) => (current.length === leads.length ? [] : allLeadIds));
  }

  async function changeStageForSelection() {
    if (!hasSelection || !bulkStageId) return;

    setLoadingAction("stage");
    setError(null);

    const response = await fetch("/api/leads/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, stageId: bulkStageId })
    });

    setLoadingAction(null);

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Could not update the leads.");
      return;
    }

    setSelectedIds([]);
    router.refresh();
  }

  async function deleteSelection() {
    if (!hasSelection) return;
    if (!window.confirm(`Delete ${selectedIds.length} lead${selectedIds.length > 1 ? "s" : ""}?`)) {
      return;
    }

    setLoadingAction("delete");
    setError(null);

    const response = await fetch("/api/leads/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds })
    });

    setLoadingAction(null);

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Could not delete the leads.");
      return;
    }

    setSelectedIds([]);
    router.refresh();
  }

  return (
    <>
      {hasSelection ? (
        <div className="bulk-actions">
          <strong className="bulk-actions__summary">
            {selectedIds.length} lead{selectedIds.length > 1 ? "s" : ""} selected
          </strong>
          <div className="bulk-actions__controls">
            <div className="field">
              <label>Change stage</label>
              <select value={bulkStageId} onChange={(event) => setBulkStageId(event.target.value)} disabled={loadingAction !== null}>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="button" type="button" onClick={changeStageForSelection} disabled={loadingAction !== null || !bulkStageId}>
              Apply
            </button>
            <button className="danger-button" type="button" onClick={deleteSelection} disabled={loadingAction !== null}>
              Delete
            </button>
            <button className="ghost-button" type="button" onClick={() => setSelectedIds([])} disabled={loadingAction !== null}>
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="error bulk-actions__error">{error}</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="checkbox-cell">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label="Select all leads"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </th>
              <th>Lead</th>
              <th>Contact</th>
              <th>Stage</th>
              <th>Flags</th>
              <th>Call</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No leads match these filters.
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const isSelected = selectedIds.includes(lead.id);

                return (
                  <tr key={lead.id} className={isSelected ? "is-selected" : undefined}>
                    <td className="checkbox-cell">
                      <input
                        type="checkbox"
                        aria-label={`Select ${displayLeadName(lead)}`}
                        checked={isSelected}
                        onChange={() => toggleLead(lead.id)}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <Link href={`/leads/${lead.id}`}>
                          <strong>{displayLeadName(lead)}</strong>
                        </Link>
                        <LeadBadges
                          customFields={normalizeCustomFields(lead.customFields)}
                          jobTitle={lead.jobTitle}
                          compact
                          responsive
                        />
                      </div>
                      <div className="muted">
                        {lead.company} {lead.jobTitle ? `· ${lead.jobTitle}` : ""}
                      </div>
                    </td>
                    <td>
                      <div>{lead.phone ?? "No phone"}</div>
                      <div className="muted">{lead.email}</div>
                    </td>
                    <td>
                      <LeadStageSelect leadId={lead.id} stageId={lead.stageId} stages={stages} />
                    </td>
                    <td>
                      <div className="toolbar" style={{ marginBottom: 0 }}>
                        {lead.phoneInvalid ? <span className="badge">Phone invalid</span> : null}
                        {lead.phoneOptOut ? <span className="badge">Phone opt-out</span> : null}
                        {lead.emailOptOut ? <span className="badge">Email opt-out</span> : null}
                      </div>
                    </td>
                    <td>
                      <LeadCallButton
                        leadId={lead.id}
                        leadLabel={displayLeadName(lead)}
                        phone={lead.phone}
                        disabled={lead.phoneInvalid || lead.phoneOptOut}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
