const currencyFormatter = new Intl.NumberFormat("ca-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const compactCurrencyFormatter = new Intl.NumberFormat("ca-ES", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

function normalizeCurrencyInput(value: string) {
  const sanitized = value.replace(/[^\d,.-]/g, "").replace(/\s+/g, "");
  const lastComma = sanitized.lastIndexOf(",");
  const lastDot = sanitized.lastIndexOf(".");

  if (lastComma === -1 && lastDot === -1) return sanitized;

  const decimalIndex = Math.max(lastComma, lastDot);
  const integerPart = sanitized.slice(0, decimalIndex).replace(/[.,]/g, "");
  const decimalPart = sanitized.slice(decimalIndex + 1).replace(/[.,]/g, "");
  return `${integerPart}.${decimalPart}`;
}

export function parseCurrencyInputToCents(value: FormDataEntryValue | string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const normalized = normalizeCurrencyInput(trimmed);
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return Math.round(parsed * 100);
}

export function formatCurrencyFromCents(value: number | null | undefined) {
  return currencyFormatter.format((value ?? 0) / 100);
}

export function formatCompactCurrencyFromCents(value: number | null | undefined) {
  return compactCurrencyFormatter.format((value ?? 0) / 100);
}

export function formatCurrencyInputFromCents(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return (value / 100).toFixed(2);
}

export function getEffectiveDealValueCents(
  dealValueOverrideCents: number | null | undefined,
  defaultDealValueCents: number | null | undefined
) {
  return dealValueOverrideCents ?? defaultDealValueCents ?? 0;
}
