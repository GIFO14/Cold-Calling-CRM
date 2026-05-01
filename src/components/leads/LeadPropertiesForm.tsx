"use client";

import { Plus, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { renderEnrichedField } from "@/components/leads/EnrichedFieldValue";
import {
  getNativeImportLeadField,
  mergeLeadFieldDefinitions,
  NATIVE_IMPORT_LEAD_FIELDS,
  splitKnownLeadFieldValues,
  type NativeImportLeadFieldType
} from "@/lib/leads/native-import-fields";
import { extractFaviconUrl } from "@/lib/leads/enriched-field-helpers";
import { displayLeadName } from "@/lib/leads/normalize";
import {
  formatCurrencyFromCents,
  formatCurrencyInputFromCents,
  getEffectiveDealValueCents,
  parseCurrencyInputToCents
} from "@/lib/money";

type CustomFieldType = NativeImportLeadFieldType;

type LeadProperties = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  company: string | null;
  jobTitle: string | null;
  phone: string | null;
  phoneInvalid: boolean;
  phoneOptOut: boolean;
  email: string | null;
  emailInvalid: boolean;
  emailOptOut: boolean;
  website: string | null;
  linkedinUrl: string | null;
  source: string | null;
  testing: boolean;
  nextFollowUpAt: string | null;
  dealValueOverrideCents: number | null;
  ownerName: string | null;
  customFields: Record<string, unknown>;
};

type CustomFieldDefinition = {
  key: string;
  label: string;
  type: CustomFieldType;
};

type CustomFieldRow = {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  value: string | boolean;
  removable: boolean;
};

type NativeFieldRow = {
  key: string;
  label: string;
  type: CustomFieldType;
  multiline?: boolean;
  value: string | boolean;
};

function valueOrDash(value?: string | null) {
  return value?.trim() || "-";
}

function renderExternalValue(value?: string | null) {
  const text = value?.trim();
  if (!text) return "-";
  if (!/^https?:\/\//i.test(text)) return text;

  const favicon = extractFaviconUrl(text);

  return (
    <a href={text} target="_blank" rel="noreferrer">
      {favicon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="favicon" src={favicon} alt="" width={14} height={14} />
      ) : null}
      <span>{text}</span>
    </a>
  );
}

function humanizeKey(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toNullableString(value: FormDataEntryValue | null) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function formatCustomValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function inputValue(value: unknown, type: CustomFieldType) {
  if (type === "BOOLEAN") return Boolean(value);
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function parseCustomValue(row: CustomFieldRow) {
  return parseFieldValue(row.type, row.value);
}

function parseFieldValue(type: CustomFieldType, value: string | boolean) {
  if (type === "BOOLEAN") return Boolean(value);
  const textValue = String(value).trim();
  if (type === "NUMBER" && textValue !== "") {
    const parsed = Number(textValue);
    return Number.isFinite(parsed) ? parsed : textValue;
  }
  return textValue;
}

function hasDisplayValue(value: unknown, type: CustomFieldType) {
  if (type === "BOOLEAN") return Boolean(value);
  return !(value === null || value === undefined || String(value).trim() === "");
}

function buildNativeRows(customFields: Record<string, unknown>) {
  return NATIVE_IMPORT_LEAD_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    multiline: field.multiline,
    value: inputValue(customFields[field.key], field.type)
  }));
}

function buildCustomRows(definitions: CustomFieldDefinition[], customFields: Record<string, unknown>) {
  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const rows: CustomFieldRow[] = [];
  const used = new Set<string>();

  for (const definition of definitions) {
    rows.push({
      id: definition.key,
      key: definition.key,
      label: definition.label,
      type: definition.type,
      value: inputValue(customFields[definition.key], definition.type),
      removable: false
    });
    used.add(definition.key);
  }

  for (const [key, value] of Object.entries(customFields)) {
    if (used.has(key)) continue;
    const definition = definitionByKey.get(key);
    const type = definition?.type ?? "TEXT";
    rows.push({
      id: key,
      key,
      label: definition?.label ?? humanizeKey(key),
      type,
      value: inputValue(value, type),
      removable: true
    });
  }

  return rows;
}

function renderFieldInput(
  row: { type: CustomFieldType; multiline?: boolean; value: string | boolean },
  onChange: (value: string | boolean) => void
) {
  if (row.type === "BOOLEAN") {
    return (
      <label className="inline-checkbox">
        <input type="checkbox" checked={Boolean(row.value)} onChange={(event) => onChange(event.target.checked)} />
        Active
      </label>
    );
  }

  if (row.multiline) {
    return <textarea value={String(row.value)} onChange={(event) => onChange(event.target.value)} />;
  }

  return (
    <input
      type={row.type === "NUMBER" ? "number" : row.type === "DATE" ? "date" : row.type === "URL" ? "url" : "text"}
      value={String(row.value)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function parseRowValue(row: Pick<CustomFieldRow, "type" | "value"> | Pick<NativeFieldRow, "type" | "value">) {
  return parseFieldValue(row.type, row.value);
}

export function LeadPropertiesForm({
  lead,
  customFieldDefinitions,
  defaultDealValueCents
}: {
  lead: LeadProperties;
  customFieldDefinitions: CustomFieldDefinition[];
  defaultDealValueCents: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mergedFieldDefinitions = useMemo(() => mergeLeadFieldDefinitions(customFieldDefinitions), [customFieldDefinitions]);
  const otherCustomFieldDefinitions = useMemo(
    () => mergedFieldDefinitions.filter((field) => !getNativeImportLeadField(field.key)),
    [mergedFieldDefinitions]
  );
  const { nativeFieldValues, remainingCustomFields } = useMemo(() => splitKnownLeadFieldValues(lead.customFields), [lead.customFields]);

  // Keys that are surfaced elsewhere (callouts, collapsible) and should be hidden from the generic list.
  const HIDDEN_IN_GRID = new Set(["pain_point_oneliner", "competitor_context", "objection_prep", "opening_line", "best_call_window"]);

  const nativeFieldEntries = useMemo(
    () =>
      NATIVE_IMPORT_LEAD_FIELDS.filter(
        (field) => !HIDDEN_IN_GRID.has(field.key) && hasDisplayValue(nativeFieldValues[field.key], field.type)
      ).map((field) => ({
        ...field,
        value: nativeFieldValues[field.key]
      })),
    [nativeFieldValues]
  );
  const customFieldEntries = useMemo(
    () => Object.entries(remainingCustomFields).filter(([, value]) => hasDisplayValue(value, "TEXT")),
    [remainingCustomFields]
  );
  const painPointValue = typeof nativeFieldValues.pain_point_oneliner === "string" ? nativeFieldValues.pain_point_oneliner.trim() : "";
  const competitorValue = typeof nativeFieldValues.competitor_context === "string" ? nativeFieldValues.competitor_context.trim() : "";
  const objectionValue = typeof nativeFieldValues.objection_prep === "string" ? nativeFieldValues.objection_prep.trim() : "";
  const [nativeRows, setNativeRows] = useState(() => buildNativeRows(nativeFieldValues));
  const [customRows, setCustomRows] = useState(() => buildCustomRows(otherCustomFieldDefinitions, remainingCustomFields));

  function resetForm() {
    setNativeRows(buildNativeRows(nativeFieldValues));
    setCustomRows(buildCustomRows(otherCustomFieldDefinitions, remainingCustomFields));
    setError(null);
    setEditing(false);
  }

  function updateNativeRow(key: string, value: string | boolean) {
    setNativeRows((rows) => rows.map((row) => (row.key === key ? { ...row, value } : row)));
  }

  function updateCustomRow(id: string, patch: Partial<CustomFieldRow>) {
    setCustomRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeCustomRow(id: string) {
    setCustomRows((rows) => rows.filter((row) => row.id !== id));
  }

  function addCustomRow() {
    const id = `new-${Date.now()}`;
    setCustomRows((rows) => [
      ...rows,
      { id, key: "", label: "", type: "TEXT", value: "", removable: true }
    ]);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const firstName = toNullableString(formData.get("firstName"));
    const lastName = toNullableString(formData.get("lastName"));
    const explicitFullName = toNullableString(formData.get("fullName"));
    const fallbackFullName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;
    const dealValueOverrideCents = parseCurrencyInputToCents(formData.get("dealValueOverride"));
    const customFields: Record<string, unknown> = {};

    for (const row of nativeRows) {
      const value = parseRowValue(row);
      if (row.type !== "BOOLEAN" && value === "") continue;
      customFields[row.key] = value;
    }

    for (const row of customRows) {
      const key = row.key.trim();
      if (!key || getNativeImportLeadField(key)) continue;
      const value = parseCustomValue(row);
      if (row.type !== "BOOLEAN" && value === "") continue;
      customFields[key] = value;
    }

    const response = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        fullName: explicitFullName ?? fallbackFullName,
        company: toNullableString(formData.get("company")),
        jobTitle: toNullableString(formData.get("jobTitle")),
        phone: toNullableString(formData.get("phone")),
        phoneInvalid: formData.get("phoneInvalid") === "on",
        phoneOptOut: formData.get("phoneOptOut") === "on",
        email: toNullableString(formData.get("email")),
        emailInvalid: formData.get("emailInvalid") === "on",
        emailOptOut: formData.get("emailOptOut") === "on",
        testing: formData.get("testing") === "on",
        website: toNullableString(formData.get("website")),
        linkedinUrl: toNullableString(formData.get("linkedinUrl")),
        source: toNullableString(formData.get("source")),
        nextFollowUpAt: toNullableString(formData.get("nextFollowUpAt")),
        dealValueOverrideCents,
        customFields
      })
    });

    setLoading(false);
    if (!response.ok) {
      setError("Could not save the properties.");
      return;
    }

    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    const effectiveDealValueCents = getEffectiveDealValueCents(lead.dealValueOverrideCents, defaultDealValueCents);

    return (
      <section className="panel grid">
        <div className="section-title-row">
          <h2>Lead details</h2>
          <button className="ghost-button" type="button" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
        <div className="grid grid-2">
          <div><span className="muted">Name</span><br />{valueOrDash(displayLeadName(lead))}</div>
          <div><span className="muted">Company</span><br />{valueOrDash(lead.company)}</div>
          <div><span className="muted">Job title</span><br />{valueOrDash(lead.jobTitle)}</div>
          <div><span className="muted">Phone</span><br />{valueOrDash(lead.phone)}</div>
          <div><span className="muted">Email</span><br />{valueOrDash(lead.email)}</div>
          <div><span className="muted">Website</span><br />{renderExternalValue(lead.website)}</div>
          <div><span className="muted">LinkedIn</span><br />{valueOrDash(lead.linkedinUrl)}</div>
          <div><span className="muted">Source</span><br />{valueOrDash(lead.source)}</div>
          <div><span className="muted">Owner</span><br />{valueOrDash(lead.ownerName)}</div>
          <div><span className="muted">Follow-up</span><br />{valueOrDash(lead.nextFollowUpAt)}</div>
          <div>
            <span className="muted">Deal value</span>
            <br />
            {formatCurrencyFromCents(effectiveDealValueCents)}
            <br />
            <small className="muted">
              {lead.dealValueOverrideCents === null ? "Default value from settings" : "Lead-specific value"}
            </small>
          </div>
        </div>
        <div className="toolbar">
          {lead.phoneInvalid ? <span className="badge">Phone invalid</span> : null}
          {lead.phoneOptOut ? <span className="badge">Phone opt-out</span> : null}
          {lead.emailInvalid ? <span className="badge">Email invalid</span> : null}
          {lead.emailOptOut ? <span className="badge">Email opt-out</span> : null}
          {lead.testing ? <span className="badge">Testing</span> : null}
        </div>
        {lead.testing ? <p className="muted">This lead is excluded from dashboard and pipeline metrics.</p> : null}
        {painPointValue || competitorValue ? (
          <div className="grid" style={{ gap: 8 }}>
            {painPointValue ? (
              <div className="callout callout--pain">
                <span className="callout__label">Pain point</span>
                <span>{painPointValue}</span>
              </div>
            ) : null}
            {competitorValue ? (
              <div className="callout callout--competitor">
                <span className="callout__label">Competitors / context</span>
                <span>{competitorValue}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        <h3>Enriched fields</h3>
        <div className="grid grid-2">
          {nativeFieldEntries.map((field) => (
            <div key={field.key} style={field.multiline ? { gridColumn: "1 / -1" } : undefined}>
              <span className="muted">{field.label}</span>
              <br />
              {renderEnrichedField(field.key, field.value, field.type)}
            </div>
          ))}
          {!nativeFieldEntries.length ? <p className="muted">No enriched data.</p> : null}
        </div>
        {objectionValue ? (
          <details className="objection-details">
            <summary>Objection prep</summary>
            <div className="objection-details__body">{objectionValue}</div>
          </details>
        ) : null}
        <h3>Other custom fields</h3>
        <div className="grid grid-2">
          {customFieldEntries.map(([key, value]) => (
            <div key={key}>
              <span className="muted">{otherCustomFieldDefinitions.find((field) => field.key === key)?.label ?? humanizeKey(key)}</span>
              <br />
              {formatCustomValue(value)}
            </div>
          ))}
          {!customFieldEntries.length ? <p className="muted">No other custom fields.</p> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <form onSubmit={onSubmit} className="grid">
        <div className="section-title-row">
          <h2>Edit lead details</h2>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button className="button" disabled={loading}>
              <Save size={16} />
              Save
            </button>
            <button className="ghost-button" type="button" onClick={resetForm} disabled={loading}>
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div className="grid grid-2">
          <div className="field">
            <label>First name</label>
            <input name="firstName" defaultValue={lead.firstName ?? ""} />
          </div>
          <div className="field">
            <label>Last name</label>
            <input name="lastName" defaultValue={lead.lastName ?? ""} />
          </div>
          <div className="field">
            <label>Full name</label>
            <input name="fullName" defaultValue={lead.fullName ?? ""} />
          </div>
          <div className="field">
            <label>Company</label>
            <input name="company" defaultValue={lead.company ?? ""} />
          </div>
          <div className="field">
            <label>Job title</label>
            <input name="jobTitle" defaultValue={lead.jobTitle ?? ""} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input name="phone" defaultValue={lead.phone ?? ""} />
          </div>
          <div className="field">
            <label>Email</label>
            <input name="email" type="email" defaultValue={lead.email ?? ""} />
          </div>
          <div className="field">
            <label>Website</label>
            <input name="website" type="url" defaultValue={lead.website ?? ""} />
          </div>
          <div className="field">
            <label>LinkedIn</label>
            <input name="linkedinUrl" type="url" defaultValue={lead.linkedinUrl ?? ""} />
          </div>
          <div className="field">
            <label>Source</label>
            <input name="source" defaultValue={lead.source ?? ""} />
          </div>
          <div className="field">
            <label>Next follow-up</label>
            <input name="nextFollowUpAt" type="datetime-local" defaultValue={lead.nextFollowUpAt ?? ""} />
          </div>
          <div className="field">
            <label>Deal value</label>
            <input
              name="dealValueOverride"
              type="number"
              min="0"
              step="0.01"
              defaultValue={formatCurrencyInputFromCents(lead.dealValueOverrideCents)}
              placeholder={formatCurrencyInputFromCents(defaultDealValueCents)}
            />
            <small className="muted">
              Leave blank to use the default deal size of {formatCurrencyFromCents(defaultDealValueCents)}.
            </small>
          </div>
        </div>
        <div className="checkbox-grid">
          <label><input type="checkbox" name="phoneInvalid" defaultChecked={lead.phoneInvalid} /> Phone invalid</label>
          <label><input type="checkbox" name="phoneOptOut" defaultChecked={lead.phoneOptOut} /> Phone opt-out</label>
          <label><input type="checkbox" name="emailInvalid" defaultChecked={lead.emailInvalid} /> Email invalid</label>
          <label><input type="checkbox" name="emailOptOut" defaultChecked={lead.emailOptOut} /> Email opt-out</label>
          <label><input type="checkbox" name="testing" defaultChecked={lead.testing} /> Testing</label>
        </div>
        <div className="section-title-row">
          <h3>Enriched fields</h3>
        </div>
        <div className="grid grid-2">
          {nativeRows.map((row) => (
            <div className="field" key={row.key} style={row.multiline ? { gridColumn: "1 / -1" } : undefined}>
              <label>{row.label}</label>
              {renderFieldInput(row, (value) => updateNativeRow(row.key, value))}
            </div>
          ))}
        </div>
        <div className="section-title-row">
          <h3>Other custom fields</h3>
          <button className="ghost-button" type="button" onClick={addCustomRow}>
            <Plus size={16} />
            Add field
          </button>
        </div>
        <div className="grid">
          {customRows.map((row) => (
            <div className="custom-field-row" key={row.id}>
              <div className="field">
                <label>Field</label>
                <input
                  value={row.removable ? row.key : row.label}
                  disabled={!row.removable}
                  onChange={(event) => updateCustomRow(row.id, { key: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Value</label>
                {renderFieldInput({ type: row.type, value: row.value }, (value) => updateCustomRow(row.id, { value }))}
              </div>
              <button
                className="ghost-button icon-button"
                type="button"
                aria-label="Delete custom field"
                onClick={() => removeCustomRow(row.id)}
                disabled={!row.removable}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {!customRows.length ? <p className="muted">No other custom fields.</p> : null}
        </div>
      </form>
    </section>
  );
}
