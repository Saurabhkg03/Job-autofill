document.addEventListener("DOMContentLoaded", async () => {
  const SECTION_SCHEMA = [
    {
      key: "personal_information",
      title: "Personal Information",
      description: "Core identity, contact, and location details used across most ATS screens.",
      type: "object",
      fields: [
        { key: "prefix", label: "Prefix" },
        { key: "name", label: "Full Name", required: true },
        { key: "middle_name", label: "Middle Name" },
        { key: "surname", label: "Surname" },
        { key: "fathers_name", label: "Father's Name" },
        { key: "mothers_name", label: "Mother's Name" },
        { key: "date_of_birth", label: "Date of Birth", type: "date" },
        { key: "gender", label: "Gender" },
        { key: "nationality", label: "Nationality" },
        { key: "country", label: "Country" },
        { key: "state", label: "State / Region" },
        { key: "city", label: "City" },
        { key: "address", label: "Address", type: "textarea", span: 2 },
        { key: "zip_code", label: "ZIP / Postal Code" },
        { key: "phone_prefix", label: "Phone Prefix" },
        { key: "phone", label: "Primary Phone", required: true },
        { key: "alternate_phone", label: "Alternate Phone" },
        { key: "email", label: "Primary Email", type: "email", required: true },
        { key: "alternate_email", label: "Alternate Email", type: "email" },
        { key: "linkedin", label: "LinkedIn", type: "url" },
        { key: "github", label: "GitHub", type: "url" },
        { key: "twitter", label: "Twitter / X", type: "url" },
        { key: "website", label: "Website / Portfolio", type: "url" },
        { key: "aadhar_no", label: "Aadhaar Number" },
        { key: "pan_no", label: "PAN Number" }
      ]
    },
    {
      key: "education_details",
      title: "Education",
      description: "Normalized education entries with ISO dates for start and completion.",
      type: "array",
      addLabel: "Add Education Entry",
      itemTitleKey: "institution",
      fields: [
        { key: "education_level", label: "Education Level", required: true },
        { key: "institution", label: "Institution", required: true },
        { key: "field_of_study", label: "Field of Study" },
        { key: "final_evaluation_grade", label: "Grade / Score" },
        { key: "start_date", label: "Start Date", type: "date" },
        { key: "end_date", label: "End Date", type: "date" },
        { key: "year_of_completion", label: "Year of Completion" },
        { key: "enrollment_number", label: "Enrollment Number" }
      ]
    },
    {
      key: "experience_details",
      title: "Work Experience",
      description: "Experience cards are draggable and retain ATS-friendly chronological structure.",
      type: "array",
      addLabel: "Add Experience",
      itemTitleKey: "position",
      fields: [
        { key: "position", label: "Position", required: true },
        { key: "company", label: "Company", required: true },
        { key: "location", label: "Location" },
        { key: "start_date", label: "Start Date", type: "date" },
        { key: "end_date", label: "End Date", type: "date" },
        { key: "employment_period", label: "Employment Period" },
        { key: "key_responsibilities", label: "Key Responsibilities", type: "list", span: 2 },
        { key: "skills_acquired", label: "Skills Acquired", type: "list", span: 2 }
      ]
    },
    {
      key: "projects",
      title: "Projects",
      description: "Project cards are ideal for ATS project sections and portfolio inserts.",
      type: "array",
      addLabel: "Add Project",
      itemTitleKey: "name",
      fields: [
        { key: "name", label: "Project Name", required: true },
        { key: "description", label: "Description", type: "textarea", span: 2 },
        { key: "start_date", label: "Start Date", type: "date" },
        { key: "end_date", label: "End Date", type: "date" }
      ]
    },
    {
      key: "technical_skills",
      title: "Technical Skills",
      description: "Each bucket is stored as an array and edited one skill per line.",
      type: "object",
      fields: [
        { key: "Languages", label: "Languages", type: "list", span: 2 },
        { key: "Frameworks_Libraries", label: "Frameworks & Libraries", type: "list", span: 2 },
        { key: "DevOps_Cloud", label: "DevOps & Cloud", type: "list", span: 2 },
        { key: "Tools", label: "Tools", type: "list", span: 2 }
      ]
    },
    {
      key: "achievements",
      title: "Achievements",
      description: "Short, scannable outcomes that AI can map into honors and awards fields.",
      type: "array",
      addLabel: "Add Achievement",
      itemTitleKey: "name",
      fields: [
        { key: "name", label: "Achievement Name", required: true },
        { key: "description", label: "Description", type: "textarea", span: 2 }
      ]
    },
    {
      key: "certifications",
      title: "Certifications",
      description: "Supports either simple one-line certification names or richer inferred fields.",
      type: "array",
      addLabel: "Add Certification",
      simpleArray: true,
      simpleLabel: "Certification"
    },
    {
      key: "languages",
      title: "Languages",
      description: "Spoken language fluency for global application forms.",
      type: "array",
      addLabel: "Add Language",
      itemTitleKey: "language",
      fields: [
        { key: "language", label: "Language", required: true },
        { key: "proficiency", label: "Proficiency", required: true }
      ]
    },
    {
      key: "additional_information",
      title: "Additional Information",
      description: "Salary, availability, diversity disclosures, and resume / cover letter assets.",
      type: "object",
      fields: [
        { key: "current_salary", label: "Current Salary" },
        { key: "expected_salary", label: "Expected Salary" },
        { key: "notice_period", label: "Notice Period" },
        { key: "earliest_available_date", label: "Earliest Available Date", type: "date" },
        { key: "resume_cv", label: "Resume Asset URL or Text", type: "textarea", span: 2 },
        { key: "cover_letter", label: "Cover Letter", type: "textarea", span: 2 },
        { key: "cover_letter_url", label: "Cover Letter Asset URL", type: "url", span: 2 },
        { key: "gender_identity", label: "Gender Identity" },
        { key: "sexual_orientation", label: "Sexual Orientation" },
        { key: "veteran_status", label: "Veteran Status" },
        { key: "race_ethnicity", label: "Race / Ethnicity" },
        { key: "disability_status", label: "Disability Status" }
      ]
    },
    {
      key: "work_preferences",
      title: "Work Preferences",
      description: "High-signal ATS toggles stored consistently as Yes / No.",
      type: "object",
      fields: [
        { key: "remote_work", label: "Remote Work", type: "select", options: ["Yes", "No"] },
        { key: "in_person_work", label: "In-Person Work", type: "select", options: ["Yes", "No"] },
        { key: "open_to_relocation", label: "Open to Relocation", type: "select", options: ["Yes", "No"] },
        { key: "willing_to_complete_assessments", label: "Complete Assessments", type: "select", options: ["Yes", "No"] },
        { key: "willing_to_undergo_drug_tests", label: "Drug Tests", type: "select", options: ["Yes", "No"] },
        { key: "willing_to_undergo_background_checks", label: "Background Checks", type: "select", options: ["Yes", "No"] }
      ]
    }
  ];

  const state = {
    profile: {},
    activeView: "visual",
    activeSection: null,
    autoContinue: false,
    saveTimer: null,
    saveState: "saving",
    lastSavedAt: null,
    validationIssues: [],
    jsonError: "",
    dragIndex: null,
    validationTimer: null
  };

  const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
  const visualView = document.getElementById("visual-view");
  const jsonView = document.getElementById("json-view");
  const sectionTabs = document.getElementById("section-tabs");
  const sectionRoot = document.getElementById("section-root");
  const validationRoot = document.getElementById("validation-root");
  const sectionMeta = document.getElementById("section-meta");
  const saveStatus = document.getElementById("save-status");
  const jsonStatus = document.getElementById("json-status");
  const jsonTextarea = document.getElementById("json-textarea");
  const autoContinueToggle = document.getElementById("toggle-auto-continue");
  const importFile = document.getElementById("import-file");

  const schemaMap = new Map(SECTION_SCHEMA.map((section) => [section.key, section]));

  await loadInitialState();
  bindEvents();
  renderAll();

  async function loadInitialState() {
    const storage = await storageGet(["userProfile", "settingAutoContinue"]);
    let loadedProfile = buildDefaultProfile();

    if (storage.userProfile) {
      try {
        loadedProfile = ensureProfileShape(JSON.parse(storage.userProfile));
      } catch (error) {
        console.warn("[Dashboard] Failed to parse stored profile, using defaults.", error);
      }
    }

    state.profile = normalizeProfileDates(loadedProfile);
    state.autoContinue = Boolean(storage.settingAutoContinue);
    state.activeSection = getSectionKeys()[0];
    state.saveState = "saved";
    state.validationIssues = validateProfile(state.profile);
    syncJsonTextarea();
  }

  function bindEvents() {
    navButtons.forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });

    document.getElementById("btn-import").addEventListener("click", () => importFile.click());
    document.getElementById("btn-export").addEventListener("click", exportProfile);
    importFile.addEventListener("change", handleImport);

    autoContinueToggle.addEventListener("change", () => {
      state.autoContinue = autoContinueToggle.checked;
      queueSave();
      updateSaveStatus();
    });

    sectionRoot.addEventListener("input", handleVisualInput);
    sectionRoot.addEventListener("change", handleVisualInput);
    sectionRoot.addEventListener("focusout", handleFieldRename);
    sectionRoot.addEventListener("click", handleSectionClick);
    sectionRoot.addEventListener("dragstart", handleDragStart);
    sectionRoot.addEventListener("dragover", handleDragOver);
    sectionRoot.addEventListener("drop", handleDrop);
    sectionRoot.addEventListener("dragend", () => {
      state.dragIndex = null;
      renderSection();
    });

    jsonTextarea.addEventListener("input", () => {
      try {
        const parsed = JSON.parse(jsonTextarea.value);
        state.profile = ensureProfileShape(normalizeProfileDates(parsed));
        state.jsonError = "";
        state.validationIssues = validateProfile(state.profile);
        state.activeSection = getSectionKeys().includes(state.activeSection)
          ? state.activeSection
          : getSectionKeys()[0];
        jsonStatus.textContent = "JSON is valid. Autosave queued.";
        jsonStatus.className = "pill saving";
        renderSectionTabs();
        renderValidationPanel();
        queueSave();
      } catch (error) {
        state.jsonError = error.message;
        state.saveState = "error";
        updateSaveStatus();
        jsonStatus.textContent = `JSON error: ${error.message}`;
        jsonStatus.className = "pill error";
      }
    });

    window.addEventListener("beforeunload", (event) => {
      if (state.saveState === "saving" || state.saveTimer) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
  }

  function switchView(nextView) {
    if (nextView === "visual" && state.jsonError) {
      jsonStatus.textContent = "Fix JSON before switching back to the visual editor.";
      jsonStatus.className = "pill error";
      return;
    }

    state.activeView = nextView;
    navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === nextView));
    visualView.classList.toggle("active", nextView === "visual");
    jsonView.classList.toggle("active", nextView === "json");

    if (nextView === "json") {
      syncJsonTextarea();
      jsonStatus.textContent = "JSON is in sync.";
      jsonStatus.className = "pill saved";
    } else {
      renderSection();
      renderValidationPanel();
    }
  }

  function renderAll() {
    autoContinueToggle.checked = state.autoContinue;
    renderSectionTabs();
    renderSection();
    renderValidationPanel();
    syncJsonTextarea();
    updateSaveStatus();
  }

  function renderSectionTabs() {
    sectionTabs.innerHTML = "";
    getSectionKeys().forEach((key) => {
      const button = document.createElement("button");
      button.className = `section-tab-btn ${state.activeSection === key ? "active" : ""}`;
      button.textContent = getSectionTitle(key);
      button.addEventListener("click", () => {
        state.activeSection = key;
        renderSectionTabs();
        renderSection();
        renderValidationPanel();
      });
      sectionTabs.appendChild(button);
    });
  }

  function renderSection() {
    const sectionKey = state.activeSection;
    const schema = resolveSchema(sectionKey);
    const sectionValue = getSectionValue(sectionKey);

    sectionRoot.innerHTML = "";
    sectionMeta.textContent = schema.description || "Schema-driven profile editing active.";
    sectionMeta.className = state.validationIssues.some((issue) => issue.path.startsWith(sectionKey))
      ? "pill warning"
      : "pill saved";

    const header = document.createElement("div");
    header.className = "section-header-card";
    header.innerHTML = `
      <div class="section-description">
        <h3>${schema.title}</h3>
        <p>${schema.description || "This section is dynamically generated from the profile schema."}</p>
      </div>
      <div class="array-actions" id="section-actions"></div>
    `;
    sectionRoot.appendChild(header);

    const actionHost = header.querySelector("#section-actions");
    if (schema.type === "array") {
      actionHost.appendChild(createActionButton(schema.addLabel || "Add Item", "add-array-item", sectionKey));
    } else {
      actionHost.appendChild(createActionButton("Add Custom Field", "add-custom-field", sectionKey));
    }

    if (schema.type === "array") {
      renderArraySection(sectionKey, schema, Array.isArray(sectionValue) ? sectionValue : []);
      return;
    }

    renderObjectSection(sectionKey, schema, sectionValue && typeof sectionValue === "object" ? sectionValue : {});
  }

  function renderObjectSection(sectionKey, schema, sectionValue) {
    const fieldGrid = document.createElement("div");
    fieldGrid.className = "field-grid";

    const fields = composeDisplayFields(schema, sectionValue);
    if (!fields.length) {
      const empty = document.createElement("div");
      empty.className = "empty-card";
      empty.textContent = "This section is empty. Use 'Add Custom Field' to start shaping it.";
      sectionRoot.appendChild(empty);
      return;
    }

    fields.forEach((field) => {
      const path = `${sectionKey}.${field.key}`;
      const value = getByPath(state.profile, path);
      fieldGrid.appendChild(createFieldNode(path, field, value, { objectPath: sectionKey, keyEditable: true }));
    });

    sectionRoot.appendChild(fieldGrid);
    refreshValidationState();
  }

  function renderArraySection(sectionKey, schema, items) {
    const list = document.createElement("div");
    list.className = "array-list";
    list.dataset.section = sectionKey;

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-card";
      empty.textContent = "No entries yet. Add one to start building a repeatable ATS-ready section.";
      list.appendChild(empty);
    }

    items.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "array-card";
      card.draggable = true;
      card.dataset.section = sectionKey;
      card.dataset.index = String(index);

      const titleValue = schema.simpleArray
        ? item
        : item?.[schema.itemTitleKey] || item?.name || item?.title || `${schema.title} ${index + 1}`;

      const toolbar = document.createElement("div");
      toolbar.className = "array-toolbar";
      toolbar.innerHTML = `
        <div class="section-empty">
          <span class="drag-handle">Drag</span>
          <strong>${escapeHtml(String(titleValue || `${schema.title} ${index + 1}`))}</strong>
        </div>
        <div class="array-actions">
          <button class="icon-btn" data-action="move-up" data-section="${sectionKey}" data-index="${index}">Up</button>
          <button class="icon-btn" data-action="move-down" data-section="${sectionKey}" data-index="${index}">Down</button>
          <button class="icon-btn" data-action="remove-item" data-section="${sectionKey}" data-index="${index}">Remove</button>
        </div>
      `;
      card.appendChild(toolbar);

      const grid = document.createElement("div");
      grid.className = "field-grid";

      if (schema.simpleArray) {
        grid.appendChild(
          createFieldNode(`${sectionKey}.${index}`, {
            key: String(index),
            label: schema.simpleLabel || "Value",
            type: "text"
          }, item)
        );
      } else {
        const itemFields = composeDisplayFields(schema, item || {});
        itemFields.forEach((field) => {
          grid.appendChild(
            createFieldNode(`${sectionKey}.${index}.${field.key}`, field, item?.[field.key], {
              objectPath: `${sectionKey}.${index}`,
              keyEditable: true
            })
          );
        });
      }

      card.appendChild(grid);
      list.appendChild(card);
    });

    sectionRoot.appendChild(list);
    refreshValidationState();
  }

  function createFieldNode(path, field, value, options = {}) {
    const shell = document.createElement("div");
    shell.className = `field-shell ${field.span === 2 ? "span-2" : ""}`;
    shell.dataset.path = path;

    if (options.keyEditable) {
      const caption = document.createElement("div");
      caption.className = "field-caption";
      caption.textContent = "Field name";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "field-name-input";
      nameInput.value = field.key;
      nameInput.dataset.role = "field-key";
      nameInput.dataset.objectPath = options.objectPath || "";
      nameInput.dataset.currentKey = field.key;
      nameInput.dataset.originalValue = field.key;

      shell.append(caption, nameInput);
    }

    const input = buildInputControl(path, field, value);
    const help = document.createElement("div");
    help.className = "field-help";
    help.textContent = field.hint || "";

    shell.append(input, help);
    return shell;
  }

  function buildInputControl(path, field, value) {
    const inputType = inferFieldType(field, value);
    const control = inputType === "textarea" || inputType === "list" || inputType === "json"
      ? document.createElement("textarea")
      : inputType === "select"
        ? document.createElement("select")
        : document.createElement("input");

    control.dataset.path = path;
    control.dataset.fieldType = inputType;
    control.dataset.required = field.required ? "true" : "false";

    if (control.tagName === "INPUT") {
      control.type = inputType === "date" || inputType === "email" || inputType === "url" ? inputType : "text";
    }

    if (control.tagName === "SELECT") {
      const values = field.options || ["Yes", "No"];
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "Select...";
      control.appendChild(blank);

      values.forEach((option) => {
        const optionNode = document.createElement("option");
        optionNode.value = option;
        optionNode.textContent = option;
        control.appendChild(optionNode);
      });
      control.value = value || "";
      return control;
    }

    if (inputType === "list") {
      control.value = Array.isArray(value) ? value.join("\n") : "";
      control.placeholder = "One item per line";
      return control;
    }

    if (inputType === "json") {
      control.value = value ? JSON.stringify(value, null, 2) : "";
      control.placeholder = "{ }";
      return control;
    }

    control.value = value ?? "";
    return control;
  }

  function handleVisualInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return;
    }

    const path = target.dataset.path;
    if (!path) {
      return;
    }

    const fieldType = target.dataset.fieldType || "text";
    const nextValue = parseFieldValue(fieldType, target.value);
    setByPath(state.profile, path, nextValue);

    queueValidationRefresh();
    queueSave();
  }

  function handleFieldRename(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset.role !== "field-key") {
      return;
    }

    const objectPath = target.dataset.objectPath || "";
    const currentKey = target.dataset.currentKey || "";
    const desiredKey = sanitizeFieldKey(target.value);

    if (!objectPath || !currentKey) {
      return;
    }

    if (!desiredKey) {
      target.value = currentKey;
      return;
    }

    if (desiredKey === currentKey) {
      target.value = desiredKey;
      return;
    }

    const renameResult = renameFieldKey(objectPath, currentKey, desiredKey);
    if (!renameResult.ok) {
      target.value = currentKey;
      state.saveState = "error";
      updateSaveStatus(renameResult.message || "Could not rename field.");
      return;
    }

    state.validationIssues = validateProfile(state.profile);
    renderSectionTabs();
    renderSection();
    renderValidationPanel();
    syncJsonTextarea({ preserveFocusedJson: true });
    queueSave();
  }

  function handleSectionClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const section = button.dataset.section;
    const index = Number.parseInt(button.dataset.index || "-1", 10);

    if (action === "add-array-item") {
      const schema = resolveSchema(section);
      const items = Array.isArray(state.profile[section]) ? [...state.profile[section]] : [];
      items.push(createArrayItemTemplate(schema, items[0]));
      state.profile[section] = items;
    } else if (action === "remove-item") {
      state.profile[section].splice(index, 1);
    } else if (action === "move-up") {
      moveArrayItem(state.profile[section], index, index - 1);
    } else if (action === "move-down") {
      moveArrayItem(state.profile[section], index, index + 1);
    } else if (action === "add-custom-field") {
      const keyName = prompt("New field key");
      if (!keyName) {
        return;
      }
      const sanitized = keyName.trim().replace(/\s+/g, "_");
      if (!sanitized) {
        return;
      }
      if (!state.profile[section] || typeof state.profile[section] !== "object" || Array.isArray(state.profile[section])) {
        state.profile[section] = {};
      }
      if (!(sanitized in state.profile[section])) {
        state.profile[section][sanitized] = "";
      }
    }

    state.validationIssues = validateProfile(state.profile);
    renderSection();
    renderValidationPanel();
    syncJsonTextarea({ preserveFocusedJson: true });
    queueSave();
  }

  function handleDragStart(event) {
    const card = event.target.closest(".array-card");
    if (!card) {
      return;
    }

    state.dragIndex = Number.parseInt(card.dataset.index || "-1", 10);
    card.classList.add("dragging");
  }

  function handleDragOver(event) {
    if (!event.target.closest(".array-card")) {
      return;
    }
    event.preventDefault();
  }

  function handleDrop(event) {
    const card = event.target.closest(".array-card");
    if (!card || state.dragIndex === null) {
      return;
    }

    event.preventDefault();
    const targetIndex = Number.parseInt(card.dataset.index || "-1", 10);
    const section = card.dataset.section;
    if (targetIndex < 0 || !section || targetIndex === state.dragIndex) {
      return;
    }

    moveArrayItem(state.profile[section], state.dragIndex, targetIndex);
    state.dragIndex = null;
    state.validationIssues = validateProfile(state.profile);
    renderSection();
    renderValidationPanel();
    syncJsonTextarea({ preserveFocusedJson: true });
    queueSave();
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      state.profile = ensureProfileShape(normalizeProfileDates(parsed));
      state.activeSection = getSectionKeys()[0];
      state.validationIssues = validateProfile(state.profile);
      state.jsonError = "";
      renderAll();
      queueSave(true);
    } catch (error) {
      state.saveState = "error";
      updateSaveStatus(`Import failed: ${error.message}`);
    } finally {
      importFile.value = "";
    }
  }

  function exportProfile() {
    const blob = new Blob([JSON.stringify(state.profile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "JobAutofill_Profile.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderValidationPanel() {
    const issues = state.validationIssues.filter((issue) => issue.path.startsWith(state.activeSection));
    validationRoot.innerHTML = "";

    if (!issues.length) {
      const ok = document.createElement("div");
      ok.className = "validation-item";
      ok.textContent = "No validation issues in the active section.";
      validationRoot.appendChild(ok);
      return;
    }

    issues.slice(0, 10).forEach((issue) => {
      const node = document.createElement("div");
      node.className = "validation-item";
      node.textContent = `${issue.label}: ${issue.message}`;
      validationRoot.appendChild(node);
    });
  }

  function refreshValidationState() {
    const issuesByPath = new Map(state.validationIssues.map((issue) => [issue.path, issue.message]));
    sectionRoot.querySelectorAll(".field-shell").forEach((shell) => {
      const path = shell.dataset.path;
      const help = shell.querySelector(".field-help");
      if (path && issuesByPath.has(path)) {
        shell.classList.add("invalid");
        if (help) {
          help.textContent = issuesByPath.get(path);
        }
      } else {
        shell.classList.remove("invalid");
        if (help) {
          help.textContent = "";
        }
      }
    });
  }

  function queueSave(immediate = false) {
    if (state.jsonError) {
      return;
    }

    state.saveState = "saving";
    updateSaveStatus();
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(persistState, immediate ? 0 : 700);
  }

  function queueValidationRefresh() {
    clearTimeout(state.validationTimer);
    state.validationTimer = setTimeout(() => {
      state.validationIssues = validateProfile(state.profile);
      renderValidationPanel();
      refreshValidationState();
      syncJsonTextarea({ preserveFocusedJson: true });
    }, 120);
  }

  async function persistState() {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
    clearTimeout(state.validationTimer);
    state.validationTimer = null;

    if (state.jsonError) {
      return;
    }

    state.validationIssues = validateProfile(state.profile);
    await storageSet({
      userProfile: JSON.stringify(state.profile),
      settingAutoContinue: state.autoContinue
    });

    state.lastSavedAt = new Date();
    state.saveState = "saved";
    updateSaveStatus();
    renderValidationPanel();
    refreshValidationState();
    syncJsonTextarea({ preserveFocusedJson: true });
  }

  function updateSaveStatus(customMessage = "") {
    if (customMessage) {
      saveStatus.textContent = customMessage;
      saveStatus.className = "pill error";
      return;
    }

    if (state.saveState === "error") {
      saveStatus.textContent = state.jsonError || "Fix the current error before saving.";
      saveStatus.className = "pill error";
      return;
    }

    if (state.saveState === "saving") {
      saveStatus.textContent = "Autosaving profile...";
      saveStatus.className = "pill saving";
      return;
    }

    const suffix = state.lastSavedAt
      ? `Last saved at ${state.lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "Profile synced.";
    saveStatus.textContent = suffix;
    saveStatus.className = state.validationIssues.length ? "pill warning" : "pill saved";
  }

  function syncJsonTextarea(options = {}) {
    if (options.preserveFocusedJson && document.activeElement === jsonTextarea) {
      return;
    }
    jsonTextarea.value = JSON.stringify(state.profile, null, 2);
  }

  function resolveSchema(sectionKey) {
    return schemaMap.get(sectionKey) || inferSchema(sectionKey, state.profile[sectionKey]);
  }

  function getSectionKeys() {
    const known = SECTION_SCHEMA.map((section) => section.key);
    const actual = Object.keys(state.profile || {});
    return [...new Set([...known, ...actual])];
  }

  function getSectionValue(sectionKey) {
    if (!(sectionKey in state.profile)) {
      const schema = schemaMap.get(sectionKey);
      state.profile[sectionKey] = schema?.type === "array" ? [] : {};
    }
    return state.profile[sectionKey];
  }

  function getSectionTitle(sectionKey) {
    return resolveSchema(sectionKey).title || prettifyKey(sectionKey);
  }

  function buildDefaultProfile() {
    const profile = {};
    SECTION_SCHEMA.forEach((section) => {
      profile[section.key] = section.type === "array" ? [] : {};
    });
    return profile;
  }

  function ensureProfileShape(profile) {
    const merged = { ...buildDefaultProfile(), ...(profile || {}) };
    SECTION_SCHEMA.forEach((section) => {
      if (!(section.key in merged)) {
        merged[section.key] = section.type === "array" ? [] : {};
      }
    });
    return merged;
  }

  function inferSchema(sectionKey, value) {
    if (Array.isArray(value)) {
      const isSimpleArray = value.every((item) => item === null || ["string", "number", "boolean"].includes(typeof item));
      return {
        key: sectionKey,
        title: prettifyKey(sectionKey),
        description: "Inferred from the current profile data.",
        type: "array",
        simpleArray: isSimpleArray,
        simpleLabel: prettifyKey(sectionKey).replace(/s$/, ""),
        addLabel: `Add ${prettifyKey(sectionKey).replace(/s$/, "")}`,
        fields: !isSimpleArray ? inferObjectFields(value[0] || {}) : undefined
      };
    }

    return {
      key: sectionKey,
      title: prettifyKey(sectionKey),
      description: "Inferred from the current profile data.",
      type: "object",
      fields: inferObjectFields(value || {})
    };
  }

  function inferObjectFields(obj) {
    return Object.keys(obj || {}).map((key) => {
      const value = obj[key];
      return {
        key,
        label: prettifyKey(key),
        type: inferFieldType({}, value)
      };
    });
  }

  function composeDisplayFields(schema, sectionValue) {
    const actualObject = sectionValue && typeof sectionValue === "object" && !Array.isArray(sectionValue)
      ? sectionValue
      : {};
    const actualKeys = Object.keys(actualObject);
    const used = new Set();
    const fields = [];

    if (schema.fields?.length) {
      schema.fields.forEach((field) => {
        const matchedKey = actualKeys.find((key) => normalizeKey(key) === normalizeKey(field.key)) || field.key;
        if (actualKeys.includes(matchedKey) || matchedKey === field.key) {
          fields.push({
            ...field,
            key: matchedKey,
            label: prettifyKey(matchedKey)
          });
          used.add(matchedKey);
        }
      });
    }

    actualKeys.forEach((key) => {
      if (!used.has(key)) {
        fields.push({
          key,
          label: prettifyKey(key),
          type: inferFieldType({}, actualObject[key])
        });
      }
    });

    return dedupeFields(fields);
  }

  function dedupeFields(fields) {
    const seen = new Set();
    return fields.filter((field) => {
      const marker = normalizeKey(field.key);
      if (seen.has(marker)) {
        return false;
      }
      seen.add(marker);
      return true;
    });
  }

  function inferFieldType(field, value) {
    if (field.type) {
      return field.type;
    }
    if (Array.isArray(value)) {
      return "list";
    }
    if (value && typeof value === "object") {
      return "json";
    }
    if (typeof value === "string" && looksLikeIsoDate(value)) {
      return "date";
    }
    return "text";
  }

  function createArrayItemTemplate(schema, existingItem) {
    if (schema.simpleArray) {
      return "";
    }

    const template = {};
    const fields = schema.fields?.length ? schema.fields : inferObjectFields(existingItem || {});
    fields.forEach((field) => {
      template[field.key] = defaultFieldValue(field.type || "text");
    });
    return template;
  }

  function defaultFieldValue(type) {
    if (type === "list") {
      return [];
    }
    if (type === "json") {
      return {};
    }
    return "";
  }

  function parseFieldValue(fieldType, rawValue) {
    if (fieldType === "list") {
      return rawValue
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (fieldType === "json") {
      try {
        return rawValue.trim() ? JSON.parse(rawValue) : {};
      } catch (error) {
        return rawValue;
      }
    }

    if (fieldType === "date") {
      return normalizeDateString(rawValue);
    }

    return rawValue;
  }

  function validateProfile(profile) {
    const issues = [];

    SECTION_SCHEMA.forEach((section) => {
      const value = profile[section.key];
      if (section.type === "object") {
        const fields = section.fields || [];
        fields.forEach((field) => {
          validateField(`${section.key}.${field.key}`, field, getByPath(profile, `${section.key}.${field.key}`), issues);
        });
      } else if (section.type === "array") {
        if (!Array.isArray(value)) {
          return;
        }
        value.forEach((item, index) => {
          if (section.simpleArray) {
            validateField(`${section.key}.${index}`, { label: section.simpleLabel, required: false }, item, issues);
            return;
          }
          const itemFields = section.fields || inferObjectFields(item || {});
          itemFields.forEach((field) => {
            validateField(`${section.key}.${index}.${field.key}`, field, item?.[field.key], issues);
          });
        });
      }
    });

    return issues;
  }

  function validateField(path, field, value, issues) {
    const label = field.label || prettifyKey(field.key || path.split(".").slice(-1)[0]);
    const type = field.type || inferFieldType(field, value);

    if (field.required && isEmptyValue(value)) {
      issues.push({ path, label, message: "This field is required for reliable ATS autofill." });
      return;
    }

    if (!value) {
      return;
    }

    if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
      issues.push({ path, label, message: "Use a valid email address." });
    }

    if (type === "url" && String(value).trim()) {
      try {
        new URL(String(value));
      } catch (error) {
        issues.push({ path, label, message: "Use a fully qualified URL, including https://." });
      }
    }

    if (type === "date" && !looksLikeIsoDate(String(value))) {
      issues.push({ path, label, message: "Dates must be stored as YYYY-MM-DD." });
    }
  }

  function collectProfileMetrics(value) {
    const metrics = { filledLeafCount: 0, arrayItemCount: 0 };
    walkProfile(value, metrics);
    return metrics;
  }

  function renameFieldKey(objectPath, currentKey, desiredKey) {
    const container = getByPath(state.profile, objectPath);
    if (!container || typeof container !== "object" || Array.isArray(container)) {
      return { ok: false, message: "Field container not found." };
    }

    if (!(currentKey in container)) {
      return { ok: false, message: "Original field was not found." };
    }

    if (desiredKey in container && desiredKey !== currentKey) {
      return { ok: false, message: "A field with that name already exists." };
    }

    const entries = Object.entries(container);
    const renamed = {};
    entries.forEach(([key, value]) => {
      renamed[key === currentKey ? desiredKey : key] = value;
    });

    setByPath(state.profile, objectPath, renamed);
    return { ok: true };
  }

  function walkProfile(value, metrics) {
    if (Array.isArray(value)) {
      metrics.arrayItemCount += value.length;
      value.forEach((item) => walkProfile(item, metrics));
      return;
    }

    if (value && typeof value === "object") {
      Object.values(value).forEach((nested) => walkProfile(nested, metrics));
      return;
    }

    if (!isEmptyValue(value)) {
      metrics.filledLeafCount += 1;
    }
  }

  function moveArrayItem(array, fromIndex, toIndex) {
    if (!Array.isArray(array) || fromIndex < 0 || toIndex < 0 || toIndex >= array.length) {
      return;
    }
    const [moved] = array.splice(fromIndex, 1);
    array.splice(toIndex, 0, moved);
  }

  function getByPath(obj, path) {
    return path.split(".").reduce((current, segment) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      return current[isFiniteSegment(segment) ? Number(segment) : segment];
    }, obj);
  }

  function setByPath(obj, path, value) {
    const segments = path.split(".");
    let current = obj;

    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = isFiniteSegment(segments[index]) ? Number(segments[index]) : segments[index];
      const nextSegment = segments[index + 1];

      if (current[segment] === undefined) {
        current[segment] = isFiniteSegment(nextSegment) ? [] : {};
      }

      current = current[segment];
    }

    const last = segments[segments.length - 1];
    current[isFiniteSegment(last) ? Number(last) : last] = value;
  }

  function isFiniteSegment(value) {
    return /^\d+$/.test(value);
  }

  function normalizeProfileDates(value, key = "") {
    if (Array.isArray(value)) {
      return value.map((item) => normalizeProfileDates(item, key));
    }

    if (value && typeof value === "object") {
      if (looksLikeLegacyDateObject(value)) {
        return legacyDateObjectToIso(value);
      }

      const output = {};
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        output[nestedKey] = normalizeProfileDates(nestedValue, nestedKey);
      });
      return output;
    }

    if (typeof value === "string" && /date|dob|available/i.test(key)) {
      return normalizeDateString(value);
    }

    return value;
  }

  function normalizeDateString(value) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }

    if (looksLikeIsoDate(text)) {
      return text.slice(0, 10);
    }

    const ddmmyyyy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    const yyyymmdd = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (yyyymmdd) {
      const [, year, month, day] = yyyymmdd;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    return text;
  }

  function looksLikeIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  }

  function looksLikeLegacyDateObject(value) {
    return Boolean(value && typeof value === "object" && "year" in value && ("month" in value || "month_name" in value || "day" in value));
  }

  function legacyDateObjectToIso(value) {
    const year = String(value.year || "").match(/\d{4}/)?.[0] || "";
    if (!year || /^present$/i.test(String(value.year || ""))) {
      return "";
    }

    const month = String(value.month || monthNameToNumber(value.month_name) || 1).padStart(2, "0");
    const day = String(value.day || 1).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function monthNameToNumber(value) {
    const months = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12
    };
    return months[String(value || "").trim().toLowerCase()] || "";
  }

  function isEmptyValue(value) {
    return (
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    );
  }

  function prettifyKey(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function sanitizeFieldKey(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\w]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function normalizeKey(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase();
  }

  function createActionButton(text, action, section) {
    const button = document.createElement("button");
    button.className = "icon-btn";
    button.dataset.action = action;
    button.dataset.section = section;
    button.textContent = text;
    return button;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function storageSet(values) {
    return new Promise((resolve) => chrome.storage.local.set(values, resolve));
  }
});
