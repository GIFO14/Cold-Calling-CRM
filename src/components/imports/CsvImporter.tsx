"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { PRESET_LEAD_FIELDS, getPresetLeadFieldLabel, makeCustomKey, type CsvColumnMapping, type PresetLeadField } from "@/lib/csv/mapping";

type Preview = {
  filename: string;
  headers: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
  mapping: CsvColumnMapping[];
};

type RestorableCsvColumnMapping = Extract<CsvColumnMapping, { mode: "preset" | "custom" }>;
type EditableCsvColumnMapping = CsvColumnMapping & {
  previousMapping?: RestorableCsvColumnMapping;
};

function makeDefaultCustomMapping(column: string): RestorableCsvColumnMapping {
  return {
    column,
    mode: "custom",
    customKey: makeCustomKey(column),
    customLabel: column.trim() || "Camp personalitzat"
  };
}

function getRestorableMapping(mapping: EditableCsvColumnMapping): RestorableCsvColumnMapping {
  if (mapping.mode === "ignore") {
    return mapping.previousMapping ?? makeDefaultCustomMapping(mapping.column);
  }

  if (mapping.mode === "custom") {
    return {
      column: mapping.column,
      mode: "custom",
      customKey: mapping.customKey,
      customLabel: mapping.customLabel
    };
  }

  return {
    column: mapping.column,
    mode: "preset",
    field: mapping.field
  };
}

function toEditableMapping(mapping: CsvColumnMapping): EditableCsvColumnMapping {
  if (mapping.mode === "ignore") return mapping;
  return { ...mapping, previousMapping: mapping };
}

function toSubmittedMapping(mapping: EditableCsvColumnMapping): CsvColumnMapping {
  if (mapping.mode === "ignore") {
    return {
      column: mapping.column,
      mode: "ignore"
    };
  }

  if (mapping.mode === "custom") {
    return {
      column: mapping.column,
      mode: "custom",
      customKey: mapping.customKey,
      customLabel: mapping.customLabel
    };
  }

  return {
    column: mapping.column,
    mode: "preset",
    field: mapping.field
  };
}

export function CsvImporter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<EditableCsvColumnMapping[]>([]);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"muted" | "error">("muted");
  const [loading, setLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  async function handleSelectedFile(nextFile: File) {
    if (!nextFile.name.toLowerCase().endsWith(".csv")) {
      setMessageTone("error");
      setMessage("Només pots importar fitxers CSV.");
      return;
    }

    setFile(nextFile);
    await previewFile(nextFile);
  }

  async function previewFile(nextFile: File) {
    setLoading(true);
    setMessageTone("muted");
    setMessage("");
    const formData = new FormData();
    formData.append("file", nextFile);
    const response = await fetch("/api/imports/preview", { method: "POST", body: formData });
    setLoading(false);

    if (!response.ok) {
      setMessageTone("error");
      setMessage("No s'ha pogut llegir el CSV.");
      return;
    }

    const data = (await response.json()) as Preview;
    setPreview(data);
    setMapping(data.mapping.map(toEditableMapping));
  }

  function updateMapping(index: number, value: string) {
    setMapping((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const currentChoice = getRestorableMapping(item);
        if (value === "custom") {
          const nextChoice: RestorableCsvColumnMapping = {
            column: item.column,
            mode: "custom",
            customKey:
              currentChoice.mode === "custom" ? currentChoice.customKey : makeCustomKey(item.column),
            customLabel: currentChoice.mode === "custom" ? currentChoice.customLabel : item.column.trim() || "Camp personalitzat"
          };
          return item.mode === "ignore" ? { ...item, previousMapping: nextChoice } : { ...nextChoice, previousMapping: nextChoice };
        }
        const nextChoice: RestorableCsvColumnMapping = { column: item.column, mode: "preset", field: value as PresetLeadField };
        return item.mode === "ignore" ? { ...item, previousMapping: nextChoice } : { ...nextChoice, previousMapping: nextChoice };
      })
    );
  }

  function updateImportEnabled(index: number, checked: boolean) {
    setMapping((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const currentChoice = getRestorableMapping(item);
        if (!checked) {
          return {
            column: item.column,
            mode: "ignore",
            previousMapping: currentChoice
          };
        }
        return {
          ...currentChoice,
          previousMapping: currentChoice
        };
      })
    );
  }

  async function runImport() {
    if (!file) return;
    setLoading(true);
    setMessageTone("muted");
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mapping", JSON.stringify(mapping.map(toSubmittedMapping)));

    const response = await fetch("/api/imports", { method: "POST", body: formData });
    setLoading(false);
    if (!response.ok) {
      setMessageTone("error");
      setMessage("La importació ha fallat.");
      return;
    }
    const data = await response.json();
    setMessage(
      `Import complet: ${data.importBatch.createdRows} creats, ${data.importBatch.updatedRows} actualitzats, ${data.importBatch.errorRows} errors.`
    );
  }

  return (
    <section className="panel grid">
      <div className="toolbar">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(event) => {
            const nextFile = event.target.files?.[0];
            if (!nextFile) return;
            void handleSelectedFile(nextFile);
            event.target.value = "";
          }}
        />
        <div
          className={`dropzone${isDragOver ? " is-drag-over" : ""}${loading ? " is-disabled" : ""}`}
          role="button"
          tabIndex={loading ? -1 : 0}
          aria-disabled={loading}
          onClick={() => {
            if (loading) return;
            inputRef.current?.click();
          }}
          onKeyDown={(event) => {
            if (loading) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            if (loading) return;
            setIsDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (loading) return;
            event.dataTransfer.dropEffect = "copy";
            setIsDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setIsDragOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragOver(false);
            if (loading) return;
            const nextFile = event.dataTransfer.files?.[0];
            if (!nextFile) return;
            void handleSelectedFile(nextFile);
          }}
        >
          <Upload size={17} />
          <div className="dropzone-copy">
            <strong>Arrossega aquí el CSV</strong>
            <span>o fes clic per seleccionar-lo</span>
          </div>
        </div>
        {file ? <span className="badge">{file.name}</span> : null}
        {preview ? <span className="muted">{preview.totalRows} files detectades</span> : null}
      </div>
      {message ? <p className={messageTone}>{message}</p> : null}
      {preview ? (
        <>
          <p className="muted table-note">Desmarca una columna per ignorar-la i evitar que es crei com a custom field.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Columna CSV</th>
                  <th>Importar</th>
                  <th>Importar com</th>
                </tr>
              </thead>
              <tbody>
                {mapping.map((item, index) => (
                  <tr key={`${item.column}-${index}`} className={`import-mapping-row${item.mode === "ignore" ? " is-ignored" : ""}`}>
                    <td>{item.column}</td>
                    <td>
                      <label className="inline-checkbox import-mapping-control">
                        <input
                          type="checkbox"
                          checked={item.mode !== "ignore"}
                          onChange={(event) => updateImportEnabled(index, event.target.checked)}
                        />
                        <span>{item.mode === "ignore" ? "No" : "Sí"}</span>
                      </label>
                    </td>
                    <td>
                      <select
                        className="import-mapping-select"
                        value={(() => {
                          const activeMapping = getRestorableMapping(item);
                          return activeMapping.mode === "preset" ? activeMapping.field : activeMapping.mode;
                        })()}
                        onChange={(event) => updateMapping(index, event.target.value)}
                        disabled={item.mode === "ignore"}
                      >
                        <option value="custom">Camp personalitzat</option>
                        {PRESET_LEAD_FIELDS.map((field) => (
                          <option key={field} value={field}>
                            {getPresetLeadFieldLabel(field)}
                          </option>
                        ))}
                      </select>
                      {item.mode === "ignore" ? <span className="badge">Ignorada</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {preview.headers.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.previewRows.map((row, index) => (
                  <tr key={index}>
                    {preview.headers.map((header) => (
                      <td key={header}>{row[header]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="button" onClick={runImport} disabled={loading}>
            Importar leads
          </button>
        </>
      ) : null}
    </section>
  );
}
