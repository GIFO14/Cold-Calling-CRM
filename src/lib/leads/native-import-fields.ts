export type NativeImportLeadFieldType = "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "URL";

export const NATIVE_IMPORT_LEAD_FIELD_KEYS = [
  "sector",
  "geo_context",
  "signal_type",
  "phone_source",
  "signal_detail",
  "signals_found",
  "company_summary",
  "priority_breakdown",
  "person_role_summary",
  "all_research_sources",
  "icp_score",
  "signal_date",
  "mida_empresa",
  "priority_tier",
  "signal_source",
  "priority_score",
  "lead_capture_setup",
  "company_data_source",
  "research_confidence",
  "lead_capture_evidence",
  "irresistible_offer",
  "opening_line",
  "best_call_window",
  "pain_point_oneliner",
  "objection_prep",
  "competitor_context"
] as const;

export type NativeImportLeadFieldKey = (typeof NATIVE_IMPORT_LEAD_FIELD_KEYS)[number];

export type NativeImportLeadFieldDefinition = {
  key: NativeImportLeadFieldKey;
  label: string;
  type: NativeImportLeadFieldType;
  aliases?: string[];
  multiline?: boolean;
};

export const NATIVE_IMPORT_LEAD_FIELDS: readonly NativeImportLeadFieldDefinition[] = [
  { key: "sector", label: "Sector", type: "TEXT" },
  { key: "geo_context", label: "Geographic context", type: "TEXT", aliases: ["geo context", "geography", "region"] },
  { key: "signal_type", label: "Signal type", type: "TEXT", aliases: ["signal type"] },
  { key: "phone_source", label: "Phone source", type: "TEXT", aliases: ["phone source"] },
  { key: "signal_detail", label: "Signal detail", type: "TEXT", aliases: ["signal detail"], multiline: true },
  { key: "signals_found", label: "Signals found", type: "TEXT", aliases: ["signals found"], multiline: true },
  { key: "company_summary", label: "Company summary", type: "TEXT", aliases: ["company summary"], multiline: true },
  { key: "priority_breakdown", label: "Priority breakdown", type: "TEXT", aliases: ["priority breakdown"], multiline: true },
  { key: "person_role_summary", label: "Role summary", type: "TEXT", aliases: ["person role summary"], multiline: true },
  { key: "all_research_sources", label: "Research sources", type: "TEXT", aliases: ["all research sources"], multiline: true },
  { key: "icp_score", label: "ICP score", type: "NUMBER", aliases: ["icp score"] },
  { key: "signal_date", label: "Signal date", type: "TEXT", aliases: ["signal date", "signal year"] },
  { key: "mida_empresa", label: "Company size", type: "TEXT", aliases: ["mida empresa", "company size"] },
  { key: "priority_tier", label: "Priority tier", type: "TEXT", aliases: ["priority tier"] },
  { key: "signal_source", label: "Signal source", type: "URL", aliases: ["signal source"] },
  { key: "priority_score", label: "Priority score", type: "NUMBER", aliases: ["priority score"] },
  { key: "lead_capture_setup", label: "Lead capture setup", type: "TEXT", aliases: ["lead capture setup"], multiline: true },
  { key: "company_data_source", label: "Company data source", type: "URL", aliases: ["company data source"] },
  { key: "research_confidence", label: "Research confidence", type: "TEXT", aliases: ["research confidence"] },
  { key: "lead_capture_evidence", label: "Lead capture evidence", type: "TEXT", aliases: ["lead capture evidence"], multiline: true },
  { key: "irresistible_offer", label: "Irresistible offer", type: "TEXT", aliases: ["irresistible offer"], multiline: true },
  { key: "opening_line", label: "Opening line", type: "TEXT", aliases: ["opening line", "hook"], multiline: true },
  { key: "best_call_window", label: "Best time to call", type: "TEXT", aliases: ["best call window", "call window"] },
  { key: "pain_point_oneliner", label: "Pain point (one-liner)", type: "TEXT", aliases: ["pain point", "pain"], multiline: true },
  { key: "objection_prep", label: "Objection prep", type: "TEXT", aliases: ["objection prep", "objections"], multiline: true },
  { key: "competitor_context", label: "Competitors / context", type: "TEXT", aliases: ["competitor context", "competitors"], multiline: true }
];

const NATIVE_IMPORT_FIELD_KEY_SET = new Set<string>(NATIVE_IMPORT_LEAD_FIELDS.map((field) => field.key));

export function isNativeImportLeadFieldKey(value: string): value is NativeImportLeadFieldKey {
  return NATIVE_IMPORT_FIELD_KEY_SET.has(value);
}

export function getNativeImportLeadField(key: string) {
  return NATIVE_IMPORT_LEAD_FIELDS.find((field) => field.key === key);
}

export function splitKnownLeadFieldValues(customFields: Record<string, unknown>) {
  const nativeFieldValues: Record<string, unknown> = {};
  const remainingCustomFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(customFields)) {
    if (isNativeImportLeadFieldKey(key)) {
      nativeFieldValues[key] = value;
      continue;
    }
    remainingCustomFields[key] = value;
  }

  return { nativeFieldValues, remainingCustomFields };
}

export function mergeLeadFieldDefinitions<T extends { key: string; label: string; type: NativeImportLeadFieldType }>(
  definitions: T[]
) {
  const merged = new Map<string, { key: string; label: string; type: NativeImportLeadFieldType }>();

  for (const field of NATIVE_IMPORT_LEAD_FIELDS) {
    merged.set(field.key, { key: field.key, label: field.label, type: field.type });
  }

  for (const definition of definitions) {
    if (isNativeImportLeadFieldKey(definition.key)) continue;
    merged.set(definition.key, definition);
  }

  return Array.from(merged.values());
}
