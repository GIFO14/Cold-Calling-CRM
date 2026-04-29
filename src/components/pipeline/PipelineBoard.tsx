"use client";

import { GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { displayLeadName } from "@/lib/leads/normalize";
import { formatCurrencyFromCents, getEffectiveDealValueCents } from "@/lib/money";

type Stage = {
  id: string;
  name: string;
  color: string;
  leads: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string | null;
    company: string | null;
    phone: string | null;
    email: string | null;
    stageId: string | null;
    dealValueOverrideCents: number | null;
  }>;
};

export function PipelineBoard({
  stages,
  canManageStages = false,
  defaultDealValueCents
}: {
  stages: Stage[];
  canManageStages?: boolean;
  defaultDealValueCents: number;
}) {
  const router = useRouter();
  const [orderedStages, setOrderedStages] = useState(stages);
  const [draggingStageId, setDraggingStageId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#0f766e");
  const [isReorderingStages, setIsReorderingStages] = useState(false);
  const [busyStageId, setBusyStageId] = useState<string | null>(null);
  const [isCreatingStage, setIsCreatingStage] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);

  useEffect(() => {
    setOrderedStages(stages);
  }, [stages]);

  useEffect(() => {
    if (!isCreateOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIsCreateOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isCreateOpen]);

  function refreshView() {
    router.refresh();
  }

  async function onLeadDrop(leadId: string, stageId: string) {
    const response = await fetch(`/api/leads/${leadId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId })
    });
    if (response.ok) refreshView();
  }

  async function persistStageOrder(nextStages: Stage[], previousStages: Stage[]) {
    setIsReorderingStages(true);
    try {
      const response = await fetch("/api/pipeline/stages/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: nextStages.map((stage) => stage.id) })
      });

      if (!response.ok) {
        setOrderedStages(previousStages);
        return;
      }

      refreshView();
    } finally {
      setIsReorderingStages(false);
      setDraggingStageId(null);
      setDragOverStageId(null);
    }
  }

  function moveStage(sourceId: string, targetId: string) {
    if (sourceId === targetId || !canManageStages || isReorderingStages) return;

    const previousStages = orderedStages;
    const sourceIndex = previousStages.findIndex((stage) => stage.id === sourceId);
    const targetIndex = previousStages.findIndex((stage) => stage.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const nextStages = [...previousStages];
    const [movedStage] = nextStages.splice(sourceIndex, 1);
    nextStages.splice(targetIndex, 0, movedStage);
    setOrderedStages(nextStages);
    void persistStageOrder(nextStages, previousStages);
  }

  function openCreateModal() {
    setNewStageName("");
    setNewStageColor("#0f766e");
    setIsCreateOpen(true);
  }

  async function createStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newStageName.trim();
    if (!name) return;

    setIsCreatingStage(true);
    try {
      const response = await fetch("/api/pipeline/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: newStageColor })
      });

      if (!response.ok) return;

      const { stage } = (await response.json()) as { stage: Omit<Stage, "leads"> };
      setOrderedStages((currentStages) => [...currentStages, { ...stage, leads: [] }]);
      setNewStageName("");
      setNewStageColor("#0f766e");
      setIsCreateOpen(false);
      refreshView();
    } finally {
      setIsCreatingStage(false);
    }
  }

  function startRenamingStage(stage: Stage) {
    setEditingStageId(stage.id);
    setEditingStageName(stage.name);
  }

  async function saveStageName(stageId: string) {
    const name = editingStageName.trim();
    if (!name) return;

    const previousStages = orderedStages;
    const nextStages = previousStages.map((stage) =>
      stage.id === stageId ? { ...stage, name } : stage
    );

    setBusyStageId(stageId);
    setOrderedStages(nextStages);
    try {
      const response = await fetch(`/api/pipeline/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });

      if (!response.ok) {
        setOrderedStages(previousStages);
        return;
      }

      setEditingStageId(null);
      setEditingStageName("");
      refreshView();
    } finally {
      setBusyStageId(null);
    }
  }

  async function deleteStage(stage: Stage) {
    const message =
      stage.leads.length > 0
        ? `Delete "${stage.name}"? The ${stage.leads.length} lead${stage.leads.length === 1 ? "" : "s"} in this stage will be left without a stage.`
        : `Delete "${stage.name}"?`;

    if (!window.confirm(message)) return;

    const previousStages = orderedStages;
    setBusyStageId(stage.id);
    setOrderedStages(previousStages.filter((item) => item.id !== stage.id));
    try {
      const response = await fetch(`/api/pipeline/stages/${stage.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        setOrderedStages(previousStages);
        return;
      }

      if (editingStageId === stage.id) {
        setEditingStageId(null);
        setEditingStageName("");
      }

      refreshView();
    } finally {
      setBusyStageId(null);
    }
  }

  return (
    <>
      {canManageStages ? (
        <div className="pipeline-toolbar">
          <button type="button" className="ghost-button" onClick={openCreateModal}>
            <Plus size={16} />
            New stage
          </button>
        </div>
      ) : null}

      <div className="kanban">
        {orderedStages.map((stage) => {
          const stageValueCents = stage.leads.reduce(
            (sum, lead) => sum + getEffectiveDealValueCents(lead.dealValueOverrideCents, defaultDealValueCents),
            0
          );

          const isBeingDragged = draggingStageId === stage.id;
          const isLeadDropTarget = Boolean(draggingLeadId) && dragOverStageId === stage.id;
          const isStageDropTarget =
            Boolean(draggingStageId) && draggingStageId !== stage.id && dragOverStageId === stage.id;

          return (
            <section
              key={stage.id}
              className={`kanban-column${isBeingDragged ? " is-dragging" : ""}${
                isLeadDropTarget ? " is-drag-over-lead" : ""
              }${isStageDropTarget ? " is-drag-over-stage" : ""}`}
              onDragOver={(event) => {
                if (draggingLeadId || draggingStageId) event.preventDefault();
              }}
              onDragEnter={() => {
                if (draggingStageId && draggingStageId !== stage.id) {
                  setDragOverStageId(stage.id);
                } else if (draggingLeadId) {
                  setDragOverStageId(stage.id);
                }
              }}
              onDragLeave={(event) => {
                const related = event.relatedTarget as Node | null;
                if (related && event.currentTarget.contains(related)) return;
                setDragOverStageId((current) => (current === stage.id ? null : current));
              }}
              onDrop={(event) => {
                event.preventDefault();
                const dragType = event.dataTransfer.getData("dragType");

                if (dragType === "stage") {
                  const sourceId = event.dataTransfer.getData("stageId") || draggingStageId;
                  if (sourceId) moveStage(sourceId, stage.id);
                  setDragOverStageId(null);
                  return;
                }

                const leadId = event.dataTransfer.getData("leadId");
                if (leadId) void onLeadDrop(leadId, stage.id);
                setDragOverStageId(null);
                setDraggingLeadId(null);
              }}
              style={{ borderTop: `2px solid ${stage.color}` }}
            >
              <div className="kanban-column-header">
                {editingStageId === stage.id ? (
                  <form
                    className="stage-inline-edit"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveStageName(stage.id);
                    }}
                  >
                    <input
                      value={editingStageName}
                      onChange={(event) => setEditingStageName(event.target.value)}
                      disabled={busyStageId === stage.id}
                      autoFocus
                    />
                    <div className="stage-inline-edit-actions">
                      <button className="button" disabled={busyStageId === stage.id || !editingStageName.trim()}>
                        Save
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          setEditingStageId(null);
                          setEditingStageName("");
                        }}
                        disabled={busyStageId === stage.id}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="kanban-column-title">
                      {canManageStages ? (
                        <span
                          className="stage-drag-handle"
                          draggable={!isReorderingStages}
                          role="button"
                          tabIndex={0}
                          title="Drag stage"
                          aria-label={`Drag ${stage.name} to reorder`}
                          aria-disabled={isReorderingStages}
                          onDragStart={(event) => {
                            setDraggingStageId(stage.id);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("dragType", "stage");
                            event.dataTransfer.setData("stageId", stage.id);
                          }}
                          onDragEnd={() => {
                            setDraggingStageId(null);
                            setDragOverStageId(null);
                          }}
                        >
                          <GripVertical size={14} />
                        </span>
                      ) : null}
                      <span className="kanban-stage-name">{stage.name}</span>
                      {canManageStages ? (
                        <div className="stage-column-actions">
                          <button
                            type="button"
                            className="icon-button-ghost"
                            onClick={() => startRenamingStage(stage)}
                            aria-label={`Rename ${stage.name}`}
                            disabled={busyStageId === stage.id}
                            title="Rename stage"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="icon-button-ghost icon-button-ghost-danger"
                            onClick={() => void deleteStage(stage)}
                            aria-label={`Delete ${stage.name}`}
                            disabled={busyStageId === stage.id}
                            title="Delete stage"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="kanban-column-meta">
                      <span>{stage.leads.length} {stage.leads.length === 1 ? "lead" : "leads"}</span>
                      <span className="dot-separator" aria-hidden>·</span>
                      <span>{formatCurrencyFromCents(stageValueCents)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="kanban-column-body">
                {stage.leads.length === 0 ? (
                  <div className="kanban-empty" aria-hidden>
                    <span>Drag a lead here</span>
                  </div>
                ) : (
                  stage.leads.map((lead) => (
                    <article
                      key={lead.id}
                      className={`lead-card${draggingLeadId === lead.id ? " is-dragging" : ""}`}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("dragType", "lead");
                        event.dataTransfer.setData("leadId", lead.id);
                        setDraggingLeadId(lead.id);
                      }}
                      onDragEnd={() => {
                        setDraggingLeadId(null);
                        setDragOverStageId(null);
                      }}
                    >
                      <Link href={`/leads/${lead.id}`} className="lead-card-title">
                        {displayLeadName(lead)}
                      </Link>
                      {lead.company ? <small className="muted">{lead.company}</small> : null}
                      <small>{lead.phone ?? lead.email ?? "No contact info"}</small>
                      <small className="muted lead-card-value">
                        {formatCurrencyFromCents(
                          getEffectiveDealValueCents(lead.dealValueOverrideCents, defaultDealValueCents)
                        )}
                      </small>
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {isCreateOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-stage-title"
          onClick={() => {
            if (!isCreatingStage) setIsCreateOpen(false);
          }}
        >
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 id="create-stage-title">New stage</h3>
              <button
                type="button"
                className="icon-button-ghost"
                onClick={() => setIsCreateOpen(false)}
                disabled={isCreatingStage}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <form className="modal-body grid" onSubmit={(event) => void createStage(event)}>
              <div className="field">
                <label htmlFor="new-stage-name">Name</label>
                <input
                  id="new-stage-name"
                  name="name"
                  placeholder="For example: Proposal sent"
                  value={newStageName}
                  onChange={(event) => setNewStageName(event.target.value)}
                  disabled={isCreatingStage}
                  autoFocus
                />
              </div>
              <div className="field">
                <label htmlFor="new-stage-color">Color</label>
                <input
                  id="new-stage-color"
                  aria-label="Stage color"
                  name="color"
                  type="color"
                  value={newStageColor}
                  onChange={(event) => setNewStageColor(event.target.value)}
                  disabled={isCreatingStage}
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isCreatingStage}
                >
                  Cancel
                </button>
                <button className="button" disabled={isCreatingStage || !newStageName.trim()}>
                  {isCreatingStage ? "Creating..." : "Create stage"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
