import Papa from "papaparse";

export type ParsedCsv = {
  rows: Record<string, string>[];
  headers: string[];
};

export function parseCsvText(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });

  if (result.errors.length) {
    const first = result.errors[0];
    throw new Error(`CSV error on row ${first.row ?? "unknown"}: ${first.message}`);
  }

  const headers = result.meta.fields?.filter(Boolean) ?? [];
  return {
    rows: result.data,
    headers
  };
}
