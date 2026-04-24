import { NATIVE_IMPORT_LEAD_FIELDS, type NativeImportLeadFieldKey } from "@/lib/leads/native-import-fields";

export const CORE_LEAD_FIELDS = [
  "firstName",
  "lastName",
  "fullName",
  "company",
  "jobTitle",
  "phone",
  "phoneInvalid",
  "phoneOptOut",
  "email",
  "emailInvalid",
  "emailOptOut",
  "website",
  "linkedinUrl",
  "source",
  "nextFollowUpAt"
] as const;

type CoreLeadField = (typeof CORE_LEAD_FIELDS)[number];

export type PresetLeadField = CoreLeadField | NativeImportLeadFieldKey;

export const PRESET_LEAD_FIELDS: PresetLeadField[] = [
  ...CORE_LEAD_FIELDS,
  ...NATIVE_IMPORT_LEAD_FIELDS.map((field) => field.key)
];

export type CsvColumnMapping =
  | {
      column: string;
      mode: "preset";
      field: PresetLeadField;
    }
  | {
      column: string;
      mode: "custom";
      customKey: string;
      customLabel: string;
    }
  | {
      column: string;
      mode: "ignore";
    };

const coreFieldLabels: Record<CoreLeadField, string> = {
  firstName: "Nom",
  lastName: "Cognom",
  fullName: "Nom complet",
  company: "Empresa",
  jobTitle: "Càrrec",
  phone: "Telèfon",
  phoneInvalid: "Telèfon invàlid",
  phoneOptOut: "No trucar",
  email: "Email",
  emailInvalid: "Email invàlid",
  emailOptOut: "Baixa d'email",
  website: "Web",
  linkedinUrl: "LinkedIn",
  source: "Origen",
  nextFollowUpAt: "Proper seguiment"
};

const coreAliases: Record<CoreLeadField, string[]> = {
  firstName: ["first name", "firstname", "nom", "nombre", "given name"],
  lastName: ["last name", "lastname", "cognom", "apellido", "surname"],
  fullName: ["name", "full name", "nom complet", "nombre completo", "contact"],
  company: ["company", "empresa", "account", "organization", "organització"],
  jobTitle: ["title", "job title", "cargo", "position", "role", "lloc"],
  phone: ["phone", "mobile", "telephone", "tel", "telefono", "telèfon", "telefon", "móvil"],
  phoneInvalid: ["phone invalid", "invalid phone", "telèfon invalid", "telefon invalid"],
  phoneOptOut: ["phone opt out", "phone opt-out", "do not call", "dnc", "no trucar"],
  email: ["email", "mail", "correo", "correu", "e-mail"],
  emailInvalid: ["email invalid", "invalid email", "correu invalid"],
  emailOptOut: ["email opt out", "email opt-out", "unsubscribe", "unsubscribed", "baixa email"],
  website: ["website", "web", "site", "url"],
  linkedinUrl: ["linkedin", "linkedin url", "linkedin profile"],
  source: ["source", "origen", "lead source"],
  nextFollowUpAt: ["follow up", "next follow up", "seguiment", "proper seguiment"]
};

const nativeImportAliases = Object.fromEntries(
  NATIVE_IMPORT_LEAD_FIELDS.map((field) => [field.key, [field.key, field.label, ...(field.aliases ?? [])]])
) as Record<NativeImportLeadFieldKey, string[]>;

const aliases: Record<PresetLeadField, string[]> = {
  ...coreAliases,
  ...nativeImportAliases
};

const nativeImportLabels = Object.fromEntries(
  NATIVE_IMPORT_LEAD_FIELDS.map((field) => [field.key, field.label])
) as Record<NativeImportLeadFieldKey, string>;

const presetFieldLabels: Record<PresetLeadField, string> = {
  ...coreFieldLabels,
  ...nativeImportLabels
};

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function makeCustomKey(header: string) {
  const key = normalizeHeader(header)
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return key || "custom_field";
}

export function getPresetLeadFieldLabel(field: PresetLeadField) {
  return presetFieldLabels[field] ?? field;
}

export function inferCsvMapping(headers: string[]): CsvColumnMapping[] {
  const usedPresetFields = new Set<PresetLeadField>();

  return headers.map((column) => {
    const normalized = normalizeHeader(column);
    const preset = PRESET_LEAD_FIELDS.find((field) => {
      if (usedPresetFields.has(field)) return false;
      return aliases[field].some((alias) => normalizeHeader(alias) === normalized);
    });

    if (preset) {
      usedPresetFields.add(preset);
      return { column, mode: "preset", field: preset };
    }

    return {
      column,
      mode: "custom",
      customKey: makeCustomKey(column),
      customLabel: column.trim() || "Camp personalitzat"
    };
  });
}

export function getCsvValue(row: Record<string, unknown>, column: string) {
  const value = row[column];
  if (value === undefined || value === null) return "";
  return String(value).trim();
}
