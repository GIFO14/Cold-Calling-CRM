export function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

export function normalizePhone(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const leadingPlus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;
  return `${leadingPlus}${digits}`;
}

export function parseBooleanLike(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["true", "1", "yes", "y", "si", "sí", "x"].includes(normalized);
}

export function displayLeadName(lead: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  company?: string | null;
}) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
  return name || lead.fullName || lead.company || "Unnamed lead";
}
