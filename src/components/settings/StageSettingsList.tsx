"use client";

import { GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Stage = {
  id: string;
  name: string;
  color: string;
  isWon: boolean;
  isLost: boolean;
  active: boolean;
};

type StageAction = (formData: FormData) => void | Promise<void>;

export function StageSettingsList({
  stages,
  saveStageAction,
  createStageAction
}: {
  stages: Stage[];
  saveStageAction: StageAction;
  createStageAction: StageAction;
}) {
  const router = useRouter();
  const [orderedStages, setOrderedStages] = useState(stages);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => {
    setOrderedStages(stages);
  }, [stages]);

  async function persistOrder(nextStages: Stage[], previousStages: Stage[]) {
    setIsReordering(true);
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

      router.refresh();
    } finally {
      setIsReordering(false);
      setDraggingId(null);
      setDragOverId(null);
    }
  }

  function moveStage(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;

    const previousStages = orderedStages;
    const sourceIndex = previousStages.findIndex((stage) => stage.id === sourceId);
    const targetIndex = previousStages.findIndex((stage) => stage.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const nextStages = [...previousStages];
    const [movedStage] = nextStages.splice(sourceIndex, 1);
    nextStages.splice(targetIndex, 0, movedStage);
    setOrderedStages(nextStages);
    void persistOrder(nextStages, previousStages);
  }

  return (
    <div className="grid">
      {orderedStages.map((stage) => (
        <form
          key={stage.id}
          action={saveStageAction}
          className={`stage-settings-row${dragOverId === stage.id ? " is-drag-over" : ""}`}
          onDragOver={(event) => event.preventDefault()}
          onDragEnter={() => {
            if (draggingId && draggingId !== stage.id) setDragOverId(stage.id);
          }}
          onDrop={(event) => {
            event.preventDefault();
            const sourceId = event.dataTransfer.getData("stageId") || draggingId;
            if (sourceId) moveStage(sourceId, stage.id);
          }}
        >
          <input type="hidden" name="id" value={stage.id} />
          <div className="field">
            <label>Ordre</label>
            <span
              className="drag-handle"
              draggable={!isReordering}
              role="button"
              tabIndex={0}
              title="Arrossegar per ordenar"
              aria-label={`Arrossegar ${stage.name} per ordenar`}
              aria-disabled={isReordering}
              onDragStart={(event) => {
                setDraggingId(stage.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("stageId", stage.id);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDragOverId(null);
              }}
            >
              <GripVertical size={18} />
            </span>
          </div>
          <div className="field">
            <label>Nom</label>
            <input name="name" defaultValue={stage.name} required />
          </div>
          <div className="field">
            <label>Color</label>
            <input name="color" type="color" defaultValue={stage.color} required />
          </div>
          <label style={{ alignSelf: "end" }}>
            <input type="checkbox" name="isWon" defaultChecked={stage.isWon} /> Guanyat
          </label>
          <label style={{ alignSelf: "end" }}>
            <input type="checkbox" name="isLost" defaultChecked={stage.isLost} /> Perdut
          </label>
          <label>
            <input type="checkbox" name="active" defaultChecked={stage.active} /> Actiu
          </label>
          <button className="ghost-button">Guardar estat</button>
        </form>
      ))}
      <form action={createStageAction} className="grid grid-3">
        <div className="field">
          <label>Nou estat</label>
          <input name="name" placeholder="Nom de l'estat" />
        </div>
        <div className="field">
          <label>Color</label>
          <input name="color" type="color" defaultValue="#0f766e" />
        </div>
        <button className="button" style={{ alignSelf: "end" }}>
          Afegir estat
        </button>
      </form>
    </div>
  );
}
