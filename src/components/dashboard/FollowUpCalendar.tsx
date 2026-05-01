"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { startTransition, useEffect, useState } from "react";

type FollowUpItem = {
  leadId: string;
  leadLabel: string;
  company: string | null;
  ownerName: string | null;
  phone: string | null;
  nextFollowUpAt: Date | string;
};

type CalendarItem = Omit<FollowUpItem, "nextFollowUpAt"> & {
  nextFollowUpAt: Date;
};

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function normalizeItems(items: FollowUpItem[]) {
  return items.map((item) => ({
    ...item,
    nextFollowUpAt:
      item.nextFollowUpAt instanceof Date ? item.nextFollowUpAt : new Date(item.nextFollowUpAt)
  }));
}

export function FollowUpCalendar({ items }: { items: FollowUpItem[] }) {
  const router = useRouter();
  const [calendarItems, setCalendarItems] = useState(() => normalizeItems(items));
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCalendarItems(normalizeItems(items));
  }, [items]);

  if (!calendarItems.length) {
    return <p className="muted">No calls scheduled this week.</p>;
  }

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const startHour = Math.min(8, ...calendarItems.map((item) => item.nextFollowUpAt.getHours()));
  const endHour = Math.max(19, ...calendarItems.map((item) => item.nextFollowUpAt.getHours()));
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const itemsByCell = new Map<string, CalendarItem[]>();

  for (const item of calendarItems) {
    const key = `${format(item.nextFollowUpAt, "yyyy-MM-dd")}-${item.nextFollowUpAt.getHours()}`;
    const bucket = itemsByCell.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      itemsByCell.set(key, [item]);
    }
  }

  async function moveLead(leadId: string, targetDay: Date, targetHour: number) {
    if (savingLeadId) return;

    const item = calendarItems.find((entry) => entry.leadId === leadId);
    if (!item) return;

    const nextFollowUpAt = new Date(targetDay);
    nextFollowUpAt.setHours(targetHour, item.nextFollowUpAt.getMinutes(), 0, 0);

    if (
      isSameDay(item.nextFollowUpAt, nextFollowUpAt) &&
      item.nextFollowUpAt.getHours() === nextFollowUpAt.getHours()
    ) {
      return;
    }

    const previousItems = calendarItems;
    setError(null);
    setSavingLeadId(leadId);
    setCalendarItems((currentItems) =>
      currentItems.map((entry) =>
        entry.leadId === leadId
          ? {
              ...entry,
              nextFollowUpAt
            }
          : entry
      )
    );

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextFollowUpAt: nextFollowUpAt.toISOString() })
      });

      if (!response.ok) {
        setCalendarItems(previousItems);
        setError("No s'ha pogut moure el lead al calendari.");
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setCalendarItems(previousItems);
      setError("No s'ha pogut moure el lead al calendari.");
    } finally {
      setSavingLeadId(null);
      setDraggingLeadId(null);
      setDragOverKey(null);
    }
  }

  return (
    <div className="follow-up-calendar">
      <div className="follow-up-calendar__grid">
        <div className="follow-up-calendar__corner">Hour</div>
        {days.map((day) => (
          <div key={day.toISOString()} className="follow-up-calendar__day-header">
            <strong>{format(day, "EEE")}</strong>
            <span>{format(day, "dd/MM")}</span>
          </div>
        ))}
        {hours.map((hour) => (
          <FragmentRow
            key={hour}
            hour={hour}
            days={days}
            itemsByCell={itemsByCell}
            draggingLeadId={draggingLeadId}
            dragOverKey={dragOverKey}
            savingLeadId={savingLeadId}
            onDragStart={(leadId) => {
              if (savingLeadId) return;
              setError(null);
              setDraggingLeadId(leadId);
            }}
            onDragEnd={() => {
              setDraggingLeadId(null);
              setDragOverKey(null);
            }}
            onDragOverCell={(key) => {
              if (!draggingLeadId || savingLeadId) return;
              setDragOverKey(key);
            }}
            onDragLeaveCell={(key) => {
              if (dragOverKey === key) setDragOverKey(null);
            }}
            onDropCell={(leadId, day, nextHour) => void moveLead(leadId, day, nextHour)}
          />
        ))}
      </div>
      {error ? (
        <p className="error" role="alert" style={{ margin: "12px 0 0" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FragmentRow({
  hour,
  days,
  itemsByCell,
  draggingLeadId,
  dragOverKey,
  savingLeadId,
  onDragStart,
  onDragEnd,
  onDragOverCell,
  onDragLeaveCell,
  onDropCell
}: {
  hour: number;
  days: Date[];
  itemsByCell: Map<string, CalendarItem[]>;
  draggingLeadId: string | null;
  dragOverKey: string | null;
  savingLeadId: string | null;
  onDragStart: (leadId: string) => void;
  onDragEnd: () => void;
  onDragOverCell: (key: string) => void;
  onDragLeaveCell: (key: string) => void;
  onDropCell: (leadId: string, day: Date, hour: number) => void;
}) {
  return (
    <>
      <div className="follow-up-calendar__hour">{formatHourLabel(hour)}</div>
      {days.map((day) => {
        const key = `${format(day, "yyyy-MM-dd")}-${hour}`;
        const entries = (itemsByCell.get(key) ?? []).sort(
          (a, b) => a.nextFollowUpAt.getTime() - b.nextFollowUpAt.getTime()
        );

        return (
          <div
            key={key}
            className={`follow-up-calendar__cell${dragOverKey === key ? " is-drag-over" : ""}`}
            onDragOver={(event) => {
              if (!draggingLeadId || savingLeadId) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              onDragOverCell(key);
            }}
            onDragEnter={() => {
              if (!draggingLeadId || savingLeadId) return;
              onDragOverCell(key);
            }}
            onDragLeave={(event) => {
              const related = event.relatedTarget as Node | null;
              if (related && event.currentTarget.contains(related)) return;
              onDragLeaveCell(key);
            }}
            onDrop={(event) => {
              if (!draggingLeadId || savingLeadId) return;
              event.preventDefault();
              const leadId = event.dataTransfer.getData("leadId") || draggingLeadId;
              if (!leadId) return;
              onDropCell(leadId, day, hour);
            }}
          >
            {entries.map((item) => (
              <Link
                key={item.leadId}
                href={`/leads/${item.leadId}`}
                className={`follow-up-calendar__item${draggingLeadId === item.leadId ? " is-dragging" : ""}${
                  savingLeadId === item.leadId ? " is-saving" : ""
                }`}
                draggable={!savingLeadId}
                title={`Moure ${item.leadLabel} a un altre dia o hora`}
                aria-disabled={Boolean(savingLeadId)}
                onDragStart={(event) => {
                  onDragStart(item.leadId);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("leadId", item.leadId);
                }}
                onDragEnd={onDragEnd}
              >
                <span>{item.leadLabel}</span>
                <strong>{format(item.nextFollowUpAt, "HH:mm")}</strong>
              </Link>
            ))}
          </div>
        );
      })}
    </>
  );
}
