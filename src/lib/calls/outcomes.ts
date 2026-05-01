export const CALL_OUTCOME_VALUES = [
  "NO_ANSWER",
  "HUNG_UP_BEFORE_ANSWER",
  "BUSY",
  "WRONG_NUMBER",
  "INTERESTED",
  "CALL_BACK",
  "NOT_INTERESTED",
  "MEETING_BOOKED",
  "DO_NOT_CALL",
  "OTHER"
] as const;

export type CallOutcomeValue = (typeof CALL_OUTCOME_VALUES)[number];

const CALL_OUTCOME_LABELS: Record<CallOutcomeValue, string> = {
  NO_ANSWER: "No answer",
  HUNG_UP_BEFORE_ANSWER: "Hung up before answer",
  BUSY: "Busy",
  WRONG_NUMBER: "Wrong number",
  INTERESTED: "Interested",
  CALL_BACK: "Call back",
  NOT_INTERESTED: "Not interested",
  MEETING_BOOKED: "Meeting booked",
  DO_NOT_CALL: "Do not call",
  OTHER: "Other"
};

export function formatCallOutcome(outcome: string | null | undefined) {
  if (!outcome) return "-";

  if (outcome in CALL_OUTCOME_LABELS) {
    return CALL_OUTCOME_LABELS[outcome as CallOutcomeValue];
  }

  return outcome
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
