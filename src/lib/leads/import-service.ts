import { CustomFieldType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CORE_LEAD_FIELDS, CsvColumnMapping, getCsvValue } from "@/lib/csv/mapping";
import { getNativeImportLeadField, isNativeImportLeadFieldKey } from "@/lib/leads/native-import-fields";
import { normalizeEmail, normalizePhone, parseBooleanLike } from "@/lib/leads/normalize";

type ImportLeadsInput = {
  filename: string;
  rows: Record<string, string>[];
  mapping: CsvColumnMapping[];
  userId: string;
};

type WritablePresetField = (typeof CORE_LEAD_FIELDS)[number];

function isWritablePresetField(field: string): field is WritablePresetField {
  return CORE_LEAD_FIELDS.includes(field as WritablePresetField);
}

function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseNativeImportValue(fieldKey: string, value: string) {
  const definition = getNativeImportLeadField(fieldKey);
  if (!definition) return value;

  if (definition.type === "BOOLEAN") return parseBooleanLike(value);

  if (definition.type === "NUMBER") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }

  if (definition.type === "DATE") {
    return parseDate(value)?.toISOString() ?? value;
  }

  return value;
}

function buildLeadData(row: Record<string, string>, mapping: CsvColumnMapping[]) {
  const lead: Record<string, string | boolean | Date | null> = {};
  const customFields: Record<string, unknown> = {};

  for (const item of mapping) {
    if (item.mode === "ignore") continue;
    const value = getCsvValue(row, item.column);
    if (!value) continue;

    if (item.mode === "custom") {
      customFields[item.customKey] = isNativeImportLeadFieldKey(item.customKey)
        ? parseNativeImportValue(item.customKey, value)
        : value;
      continue;
    }

    if (isNativeImportLeadFieldKey(item.field)) {
      customFields[item.field] = parseNativeImportValue(item.field, value);
      continue;
    }

    if (!isWritablePresetField(item.field)) continue;

    if (item.field === "phoneInvalid" || item.field === "phoneOptOut" || item.field === "emailInvalid" || item.field === "emailOptOut") {
      lead[item.field] = parseBooleanLike(value);
    } else if (item.field === "nextFollowUpAt") {
      lead[item.field] = parseDate(value);
    } else {
      lead[item.field] = value;
    }
  }

  if (lead.email && typeof lead.email === "string") {
    lead.emailNormalized = normalizeEmail(lead.email);
  }
  if (lead.phone && typeof lead.phone === "string") {
    lead.phoneNormalized = normalizePhone(lead.phone);
  }
  if (!lead.fullName && (lead.firstName || lead.lastName)) {
    lead.fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  }

  return { lead, customFields };
}

async function getDefaultStageId() {
  const stage = await prisma.pipelineStage.findFirst({
    where: { active: true },
    orderBy: { position: "asc" },
    select: { id: true }
  });
  return stage?.id ?? null;
}

async function ensureCustomFieldDefinitions(mapping: CsvColumnMapping[], importId: string) {
  const definitions = new Map<string, { label: string; type: CustomFieldType }>();

  for (const item of mapping) {
    if (item.mode === "custom") {
      const nativeField = getNativeImportLeadField(item.customKey);
      definitions.set(item.customKey, {
        label: nativeField?.label ?? item.customLabel,
        type: nativeField?.type ?? "TEXT"
      });
      continue;
    }

    if (item.mode === "preset" && isNativeImportLeadFieldKey(item.field)) {
      const nativeField = getNativeImportLeadField(item.field);
      if (!nativeField) continue;
      definitions.set(nativeField.key, { label: nativeField.label, type: nativeField.type });
    }
  }

  for (const [key, definition] of definitions) {
    await prisma.customFieldDefinition.upsert({
      where: { key },
      update: { label: definition.label, type: definition.type },
      create: {
        key,
        label: definition.label,
        type: definition.type,
        createdFromImportId: importId
      }
    });
  }
}

function mergeExistingLead(
  existing: { customFields: Prisma.JsonValue } & Record<string, unknown>,
  incoming: Record<string, string | boolean | Date | null>,
  incomingCustomFields: Record<string, unknown>
) {
  const update: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null || value === "") continue;
    if (existing[key] === undefined || existing[key] === null || existing[key] === "") {
      update[key] = value;
    }
  }

  const currentCustomFields =
    existing.customFields && typeof existing.customFields === "object" && !Array.isArray(existing.customFields)
      ? (existing.customFields as Record<string, unknown>)
      : {};
  const mergedCustomFields = { ...currentCustomFields };
  let customChanged = false;

  for (const [key, value] of Object.entries(incomingCustomFields)) {
    if (mergedCustomFields[key] === undefined || mergedCustomFields[key] === "") {
      mergedCustomFields[key] = value;
      customChanged = true;
    }
  }

  if (customChanged) {
    update.customFields = mergedCustomFields as Prisma.InputJsonValue;
  }

  return update;
}

export async function importLeads({ filename, rows, mapping, userId }: ImportLeadsInput) {
  const importBatch = await prisma.importBatch.create({
    data: {
      filename,
      totalRows: rows.length,
      status: "PROCESSING",
      mappingJson: mapping as unknown as Prisma.InputJsonValue,
      createdById: userId
    }
  });

  await ensureCustomFieldDefinitions(mapping, importBatch.id);
  const stageId = await getDefaultStageId();

  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;
  let errorRows = 0;

  for (const [index, row] of rows.entries()) {
    try {
      const { lead, customFields } = buildLeadData(row, mapping);
      const phoneNormalized = typeof lead.phoneNormalized === "string" ? lead.phoneNormalized : null;
      const emailNormalized = typeof lead.emailNormalized === "string" ? lead.emailNormalized : null;

      if (!phoneNormalized && !emailNormalized && !lead.fullName && !lead.company) {
        skippedRows += 1;
        continue;
      }

      const duplicateConditions = [
        phoneNormalized ? { phoneNormalized } : null,
        emailNormalized ? { emailNormalized } : null
      ].filter(Boolean) as Array<{ phoneNormalized?: string; emailNormalized?: string }>;

      const existing = duplicateConditions.length
        ? await prisma.lead.findFirst({ where: { OR: duplicateConditions } })
        : null;

      if (existing) {
        const update = mergeExistingLead(existing, lead, customFields);
        if (Object.keys(update).length) {
          await prisma.lead.update({
            where: { id: existing.id },
            data: update
          });
        }

        await prisma.leadActivity.create({
          data: {
            leadId: existing.id,
            userId,
            type: "IMPORT_UPDATED",
            title: "Lead updated from import",
            body: filename,
            metadata: { importBatchId: importBatch.id, rowNumber: index + 2 }
          }
        });
        updatedRows += 1;
      } else {
        const created = await prisma.lead.create({
          data: {
            ...lead,
            stageId,
            ownerId: userId,
            customFields: customFields as Prisma.InputJsonValue,
            phoneInvalid: Boolean(lead.phoneInvalid),
            phoneOptOut: Boolean(lead.phoneOptOut),
            emailInvalid: Boolean(lead.emailInvalid),
            emailOptOut: Boolean(lead.emailOptOut)
          }
        });

        await prisma.leadActivity.create({
          data: {
            leadId: created.id,
            userId,
            type: "IMPORT_CREATED",
            title: "Lead created from import",
            body: filename,
            metadata: { importBatchId: importBatch.id, rowNumber: index + 2 }
          }
        });
        createdRows += 1;
      }
    } catch (error) {
      errorRows += 1;
      await prisma.importRowError.create({
        data: {
          importBatchId: importBatch.id,
          rowNumber: index + 2,
          rawRow: row,
          message: error instanceof Error ? error.message : "Unknown error"
        }
      });
    }
  }

  return prisma.importBatch.update({
    where: { id: importBatch.id },
    data: {
      status: "COMPLETED",
      createdRows,
      updatedRows,
      skippedRows,
      errorRows,
      completedAt: new Date()
    },
    include: { errors: true }
  });
}
