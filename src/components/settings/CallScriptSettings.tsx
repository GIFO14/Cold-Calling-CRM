type FormAction = (formData: FormData) => void | Promise<void>;

type BranchChoice = {
  id: string;
  label: string;
  position: number;
  targetType: "STEP" | "OBJECTION" | "TERMINAL";
  targetStepId: string | null;
  targetObjectionId: string | null;
  terminalLabel: string | null;
};

type ScriptResponse = {
  id: string;
  label: string | null;
  text: string;
  position: number;
};

type ScriptObjection = {
  id: string;
  label: string;
  position: number;
  responses: ScriptResponse[];
  choices: BranchChoice[];
};

type ScriptStep = {
  id: string;
  title: string;
  text: string;
  position: number;
  advanceTargetType: "STEP" | "OBJECTION" | "TERMINAL" | null;
  advanceTargetStepId: string | null;
  advanceTargetObjectionId: string | null;
  advanceTerminalLabel: string | null;
  choices: BranchChoice[];
};

type ScriptConfig = {
  id: string;
  name: string;
  steps: ScriptStep[];
  objections: ScriptObjection[];
};

export function CallScriptSettings({
  script,
  languageLabel,
  saveScriptAction,
  saveStepAction,
  createStepAction,
  deleteStepAction,
  saveStepChoiceAction,
  createStepChoiceAction,
  deleteStepChoiceAction,
  saveObjectionAction,
  createObjectionAction,
  deleteObjectionAction,
  saveResponseAction,
  createResponseAction,
  deleteResponseAction,
  saveObjectionChoiceAction,
  createObjectionChoiceAction,
  deleteObjectionChoiceAction
}: {
  script: ScriptConfig;
  languageLabel: string;
  saveScriptAction: FormAction;
  saveStepAction: FormAction;
  createStepAction: FormAction;
  deleteStepAction: FormAction;
  saveStepChoiceAction: FormAction;
  createStepChoiceAction: FormAction;
  deleteStepChoiceAction: FormAction;
  saveObjectionAction: FormAction;
  createObjectionAction: FormAction;
  deleteObjectionAction: FormAction;
  saveResponseAction: FormAction;
  createResponseAction: FormAction;
  deleteResponseAction: FormAction;
  saveObjectionChoiceAction: FormAction;
  createObjectionChoiceAction: FormAction;
  deleteObjectionChoiceAction: FormAction;
}) {
  const nextStepPosition = (script.steps.at(-1)?.position ?? 0) + 1;
  const nextObjectionPosition = (script.objections.at(-1)?.position ?? 0) + 1;

  return (
    <div className="grid">
      <section className="panel">
        <h2>Call script</h2>
        <form action={saveScriptAction} className="grid">
          <input type="hidden" name="scriptId" value={script.id} />
          <div className="field">
            <label>Language</label>
            <input value={languageLabel} disabled readOnly />
          </div>
          <div className="field">
            <label>Script name</label>
            <input name="name" defaultValue={script.name} required />
          </div>
          <button className="button">Save script</button>
        </form>
      </section>

      <section className="panel">
        <h2>Steps</h2>
        <div className="grid">
          {script.steps.map((step) => (
            <form key={step.id} action={saveStepAction} className="grid" style={{ paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>
              <input type="hidden" name="id" value={step.id} />
              <div className="grid grid-2">
                <div className="field">
                  <label>Position</label>
                  <input name="position" type="number" min="1" defaultValue={step.position} required />
                </div>
                <div className="field">
                  <label>Title</label>
                  <input name="title" defaultValue={step.title} required />
                </div>
              </div>
              <div className="field">
                <label>Text to say</label>
                <textarea name="text" defaultValue={step.text} required />
              </div>
              <div className="grid grid-2">
                <div className="field">
                  <label>Advance target type</label>
                  <select name="advanceTargetType" defaultValue={step.advanceTargetType ?? ""}>
                    <option value="">Linear by order</option>
                    <option value="STEP">Step</option>
                    <option value="OBJECTION">Objection</option>
                    <option value="TERMINAL">Terminal</option>
                  </select>
                </div>
                <div className="field">
                  <label>Advance target step</label>
                  <select name="advanceTargetStepId" defaultValue={step.advanceTargetStepId ?? ""}>
                    <option value="">-</option>
                    {script.steps.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.position}. {option.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-2">
                <div className="field">
                  <label>Advance target objection</label>
                  <select name="advanceTargetObjectionId" defaultValue={step.advanceTargetObjectionId ?? ""}>
                    <option value="">-</option>
                    {script.objections.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.position}. {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Advance terminal label</label>
                  <input name="advanceTerminalLabel" defaultValue={step.advanceTerminalLabel ?? ""} placeholder="Optional" />
                </div>
              </div>
              <div className="toolbar" style={{ marginBottom: 0 }}>
                <button className="button">Save step</button>
              </div>
            </form>
          ))}

          {script.steps.map((step) => (
            <details key={`${step.id}-choices`} className="objection-details">
              <summary>Choices for {step.title}</summary>
              <div className="objection-details__body">
                <div className="grid">
                  {step.choices.map((choice) => (
                    <form
                      key={choice.id}
                      action={saveStepChoiceAction}
                      className="grid"
                      style={{ padding: 14, border: "1px solid var(--line)", borderRadius: 12, background: "#fbfcfc" }}
                    >
                      <input type="hidden" name="id" value={choice.id} />
                      <div className="grid grid-2">
                        <div className="field">
                          <label>Button label</label>
                          <input name="label" defaultValue={choice.label} required />
                        </div>
                        <div className="field">
                          <label>Position</label>
                          <input name="position" type="number" min="1" defaultValue={choice.position} required />
                        </div>
                      </div>
                      <div className="grid grid-2">
                        <div className="field">
                          <label>Target type</label>
                          <select name="targetType" defaultValue={choice.targetType}>
                            <option value="STEP">Step</option>
                            <option value="OBJECTION">Objection</option>
                            <option value="TERMINAL">Terminal</option>
                          </select>
                        </div>
                        <div className="field">
                          <label>Target step</label>
                          <select name="targetStepId" defaultValue={choice.targetStepId ?? ""}>
                            <option value="">-</option>
                            {script.steps.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.position}. {option.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-2">
                        <div className="field">
                          <label>Target objection</label>
                          <select name="targetObjectionId" defaultValue={choice.targetObjectionId ?? ""}>
                            <option value="">-</option>
                            {script.objections.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.position}. {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label>Terminal label</label>
                          <input name="terminalLabel" defaultValue={choice.terminalLabel ?? ""} placeholder="Optional" />
                        </div>
                      </div>
                      <div className="toolbar" style={{ marginBottom: 0 }}>
                        <button className="button">Save choice</button>
                        <button className="ghost-button" formAction={deleteStepChoiceAction}>
                          Delete choice
                        </button>
                      </div>
                    </form>
                  ))}

                  <details className="objection-details">
                    <summary>Add choice</summary>
                    <div className="objection-details__body">
                      <form action={createStepChoiceAction} className="grid">
                        <input type="hidden" name="stepId" value={step.id} />
                        <div className="grid grid-2">
                          <div className="field">
                            <label>Button label</label>
                            <input name="label" required />
                          </div>
                          <div className="field">
                            <label>Position</label>
                            <input name="position" type="number" min="1" defaultValue={(step.choices.at(-1)?.position ?? 0) + 1} required />
                          </div>
                        </div>
                        <div className="grid grid-2">
                          <div className="field">
                            <label>Target type</label>
                            <select name="targetType" defaultValue="STEP">
                              <option value="STEP">Step</option>
                              <option value="OBJECTION">Objection</option>
                              <option value="TERMINAL">Terminal</option>
                            </select>
                          </div>
                          <div className="field">
                            <label>Target step</label>
                            <select name="targetStepId" defaultValue="">
                              <option value="">-</option>
                              {script.steps.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.position}. {option.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-2">
                          <div className="field">
                            <label>Target objection</label>
                            <select name="targetObjectionId" defaultValue="">
                              <option value="">-</option>
                              {script.objections.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.position}. {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label>Terminal label</label>
                            <input name="terminalLabel" placeholder="Optional" />
                          </div>
                        </div>
                        <button className="button">Add choice</button>
                      </form>
                    </div>
                  </details>
                </div>
              </div>
            </details>
          ))}

          <details className="objection-details">
            <summary>Add step</summary>
            <div className="objection-details__body">
              <form action={createStepAction} className="grid">
                <input type="hidden" name="scriptId" value={script.id} />
                <div className="grid grid-2">
                  <div className="field">
                    <label>Position</label>
                    <input name="position" type="number" min="1" defaultValue={nextStepPosition} required />
                  </div>
                  <div className="field">
                    <label>Title</label>
                    <input name="title" required />
                  </div>
                </div>
                <div className="field">
                  <label>Text to say</label>
                  <textarea name="text" required />
                </div>
                <div className="grid grid-2">
                  <div className="field">
                    <label>Advance target type</label>
                    <select name="advanceTargetType" defaultValue="">
                      <option value="">Linear by order</option>
                      <option value="STEP">Step</option>
                      <option value="OBJECTION">Objection</option>
                      <option value="TERMINAL">Terminal</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Advance target step</label>
                    <select name="advanceTargetStepId" defaultValue="">
                      <option value="">-</option>
                      {script.steps.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.position}. {option.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-2">
                  <div className="field">
                    <label>Advance target objection</label>
                    <select name="advanceTargetObjectionId" defaultValue="">
                      <option value="">-</option>
                      {script.objections.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.position}. {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Advance terminal label</label>
                    <input name="advanceTerminalLabel" placeholder="Optional" />
                  </div>
                </div>
                <button className="button">Add step</button>
              </form>
            </div>
          </details>

          <div className="grid">
            {script.steps.map((step) => (
              <form key={`${step.id}-delete`} action={deleteStepAction}>
                <input type="hidden" name="id" value={step.id} />
                <button className="danger-button">Delete {step.title}</button>
              </form>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Objections and response variants</h2>
        <div className="grid">
          {script.objections.map((objection) => (
            <details key={objection.id} className="objection-details" open>
              <summary>
                {objection.position}. {objection.label}
              </summary>
              <div className="objection-details__body">
                <div className="grid">
                  <form action={saveObjectionAction} className="grid">
                    <input type="hidden" name="id" value={objection.id} />
                    <div className="grid grid-2">
                      <div className="field">
                        <label>Position</label>
                        <input name="position" type="number" min="1" defaultValue={objection.position} required />
                      </div>
                      <div className="field">
                        <label>Objection label</label>
                        <input name="label" defaultValue={objection.label} required />
                      </div>
                    </div>
                    <div className="toolbar" style={{ marginBottom: 0 }}>
                      <button className="button">Save objection</button>
                    </div>
                  </form>

                  <div className="grid">
                    {objection.responses.map((response) => (
                      <form
                        key={response.id}
                        action={saveResponseAction}
                        className="grid"
                        style={{ padding: 14, border: "1px solid var(--line)", borderRadius: 12, background: "#fbfcfc" }}
                      >
                        <input type="hidden" name="id" value={response.id} />
                        <div className="grid grid-2">
                          <div className="field">
                            <label>Position</label>
                            <input name="position" type="number" min="1" defaultValue={response.position} required />
                          </div>
                          <div className="field">
                            <label>Variant label</label>
                            <input name="label" defaultValue={response.label ?? ""} placeholder="Optional" />
                          </div>
                        </div>
                        <div className="field">
                          <label>Response text</label>
                          <textarea name="text" defaultValue={response.text} required />
                        </div>
                        <div className="toolbar" style={{ marginBottom: 0 }}>
                          <button className="button">Save response</button>
                        </div>
                      </form>
                    ))}
                  </div>

                  <details className="objection-details">
                    <summary>Add response variant</summary>
                    <div className="objection-details__body">
                      <form action={createResponseAction} className="grid">
                        <input type="hidden" name="objectionId" value={objection.id} />
                        <div className="grid grid-2">
                          <div className="field">
                            <label>Position</label>
                            <input
                              name="position"
type="number"
                              min="1"
                              defaultValue={(objection.responses.at(-1)?.position ?? 0) + 1}
                              required
                            />
                          </div>
                          <div className="field">
                            <label>Variant label</label>
                            <input name="label" placeholder="Optional" />
                          </div>
                        </div>
                        <div className="field">
                          <label>Response text</label>
                          <textarea name="text" required />
                        </div>
                        <button className="button">Add response</button>
                      </form>
                    </div>
                  </details>

                  <details className="objection-details">
                    <summary>Choice buttons after this objection</summary>
                    <div className="objection-details__body">
                      <div className="grid">
                        {objection.choices.map((choice) => (
                          <form
                            key={choice.id}
                            action={saveObjectionChoiceAction}
                            className="grid"
                            style={{ padding: 14, border: "1px solid var(--line)", borderRadius: 12, background: "#fbfcfc" }}
                          >
                            <input type="hidden" name="id" value={choice.id} />
                            <div className="grid grid-2">
                              <div className="field">
                                <label>Button label</label>
                                <input name="label" defaultValue={choice.label} required />
                              </div>
                              <div className="field">
                                <label>Position</label>
                                <input name="position" type="number" min="1" defaultValue={choice.position} required />
                              </div>
                            </div>
                            <div className="grid grid-2">
                              <div className="field">
                                <label>Target type</label>
                                <select name="targetType" defaultValue={choice.targetType}>
                                  <option value="STEP">Step</option>
                                  <option value="OBJECTION">Objection</option>
                                  <option value="TERMINAL">Terminal</option>
                                </select>
                              </div>
                              <div className="field">
                                <label>Target step</label>
                                <select name="targetStepId" defaultValue={choice.targetStepId ?? ""}>
                                  <option value="">-</option>
                                  {script.steps.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.position}. {option.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-2">
                              <div className="field">
                                <label>Target objection</label>
                                <select name="targetObjectionId" defaultValue={choice.targetObjectionId ?? ""}>
                                  <option value="">-</option>
                                  {script.objections.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.position}. {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="field">
                                <label>Terminal label</label>
                                <input name="terminalLabel" defaultValue={choice.terminalLabel ?? ""} placeholder="Optional" />
                              </div>
                            </div>
                            <div className="toolbar" style={{ marginBottom: 0 }}>
                              <button className="button">Save choice</button>
                              <button className="ghost-button" formAction={deleteObjectionChoiceAction}>
                                Delete choice
                              </button>
                            </div>
                          </form>
                        ))}

                        <details className="objection-details">
                          <summary>Add choice</summary>
                          <div className="objection-details__body">
                            <form action={createObjectionChoiceAction} className="grid">
                              <input type="hidden" name="objectionId" value={objection.id} />
                              <div className="grid grid-2">
                                <div className="field">
                                  <label>Button label</label>
                                  <input name="label" required />
                                </div>
                                <div className="field">
                                  <label>Position</label>
                                  <input
                                    name="position"
                                    type="number"
                                    min="1"
                                    defaultValue={(objection.choices.at(-1)?.position ?? 0) + 1}
                                    required
                                  />
                                </div>
                              </div>
                              <div className="grid grid-2">
                                <div className="field">
                                  <label>Target type</label>
                                  <select name="targetType" defaultValue="STEP">
                                    <option value="STEP">Step</option>
                                    <option value="OBJECTION">Objection</option>
                                    <option value="TERMINAL">Terminal</option>
                                  </select>
                                </div>
                                <div className="field">
                                  <label>Target step</label>
                                  <select name="targetStepId" defaultValue="">
                                    <option value="">-</option>
                                    {script.steps.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.position}. {option.title}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="grid grid-2">
                                <div className="field">
                                  <label>Target objection</label>
                                  <select name="targetObjectionId" defaultValue="">
                                    <option value="">-</option>
                                    {script.objections.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.position}. {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="field">
                                  <label>Terminal label</label>
                                  <input name="terminalLabel" placeholder="Optional" />
                                </div>
                              </div>
                              <button className="button">Add choice</button>
                            </form>
                          </div>
                        </details>
                      </div>
                    </div>
                  </details>

                  <div className="toolbar" style={{ marginBottom: 0 }}>
                    <form action={deleteObjectionAction}>
                      <input type="hidden" name="id" value={objection.id} />
                      <button className="danger-button">Delete objection</button>
                    </form>
                    {objection.responses.map((response) => (
                      <form key={`${response.id}-delete`} action={deleteResponseAction}>
                        <input type="hidden" name="id" value={response.id} />
                        <button className="ghost-button">Delete {response.label || `response ${response.position}`}</button>
                      </form>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          ))}

          <details className="objection-details">
            <summary>Add objection</summary>
            <div className="objection-details__body">
              <form action={createObjectionAction} className="grid">
                <input type="hidden" name="scriptId" value={script.id} />
                <div className="grid grid-2">
                  <div className="field">
                    <label>Position</label>
                    <input name="position" type="number" min="1" defaultValue={nextObjectionPosition} required />
                  </div>
                  <div className="field">
                    <label>Objection label</label>
                    <input name="label" required />
                  </div>
                </div>
                <button className="button">Add objection</button>
              </form>
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}
