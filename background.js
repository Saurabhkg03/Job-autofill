// Background Service Worker: Groq orchestration, chunking, strict validation, and tab-scoped side panel behavior

let pinnedSidePanelTabId = null;

chrome.sidePanel
  .setOptions({
    path: "popup.html",
    enabled: false
  })
  .catch((error) => console.error("[Background] Failed to initialize default side panel state:", error));

if (chrome.storage?.session?.setAccessLevel) {
  chrome.storage.session
    .setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })
    .catch((error) => console.error("[Background] Failed to expose session storage:", error));
}

const HARDCODED_GROQ_API_KEY = "";
const LLM_MODEL = "llama-3.3-70b-versatile";
const MAX_FIELDS_PER_CHUNK = 40;
const MAX_RETRIES = 5;
const DEBUGGER_PROTOCOL_VERSION = "1.3";

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) {
    return;
  }

  try {
    if (pinnedSidePanelTabId && pinnedSidePanelTabId !== tab.id) {
      await setSidePanelEnabled(pinnedSidePanelTabId, false);
    }

    pinnedSidePanelTabId = tab.id;
    await setSidePanelEnabled(tab.id, true);
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error("[Background] Failed to open side panel for clicked tab:", error);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === pinnedSidePanelTabId) {
    pinnedSidePanelTabId = null;
  }
});

async function setSidePanelEnabled(tabId, enabled) {
  await chrome.sidePanel.setOptions({
    tabId,
    path: "popup.html",
    enabled
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "BROWSER_INPUT") {
    handleBrowserInput(request, sender)
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.error("[Background] Browser input failed:", error);
        sendResponse({ ok: false, error: error.message || "Browser input failed." });
      });
    return true;
  }

  if (request.action !== "CALL_GROQ_LLM") {
    return false;
  }

  chrome.storage.local.get(["userProfile", "groqApiKey"], async (data) => {
    const apiKey = data.groqApiKey || HARDCODED_GROQ_API_KEY;
    if (!apiKey) {
      sendResponse({ error: "API Key missing. Please configure it in settings." });
      return;
    }

    try {
      const profileText = await loadProfileText(data.userProfile);
      const result = await analyzeFormWithAI({
        apiKey,
        profileText,
        formFields: Array.isArray(request.fields) ? request.fields : []
      });
      sendResponse(result);
    } catch (error) {
      console.error("[Background] Groq request failed:", error);
      sendResponse({ error: error.message || "Unknown Groq error." });
    }
  });

  return true;
});

async function handleBrowserInput(request, sender) {
  const tabId = sender?.tab?.id;
  if (!tabId) {
    throw new Error("No sender tab available for browser input.");
  }

  const target = { tabId };
  await withDebugger(target, async () => {
    if (request.op === "click") {
      await dispatchMouseClick(target, request.x, request.y);
      return;
    }

    if (request.op === "wheel") {
      await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
        type: "mouseWheel",
        x: Number(request.x) || 0,
        y: Number(request.y) || 0,
        deltaX: Number(request.deltaX) || 0,
        deltaY: Number(request.deltaY) || 0
      });
      return;
    }

    if (request.op === "typeText") {
      await dispatchTextInput(target, request.text || "");
      return;
    }

    if (request.op === "key") {
      await dispatchKey(target, request.key || "Enter", request.code || request.key || "Enter");
      return;
    }

    throw new Error(`Unsupported browser input op: ${request.op}`);
  });

  return { ok: true };
}

async function withDebugger(target, callback) {
  let attachedHere = false;

  try {
    await chrome.debugger.attach(target, DEBUGGER_PROTOCOL_VERSION);
    attachedHere = true;
  } catch (error) {
    const message = String(error?.message || error);
    if (/Another debugger is already attached|Debugger is already attached/i.test(message)) {
      throw new Error("Chrome debugger input is already in use by another tool.");
    }
    throw error;
  }

  try {
    return await callback();
  } finally {
    if (attachedHere) {
      try {
        await chrome.debugger.detach(target);
      } catch (error) {
        console.warn("[Background] Failed to detach debugger:", error);
      }
    }
  }
}

async function dispatchMouseClick(target, x, y) {
  const px = Number(x);
  const py = Number(y);
  if (!Number.isFinite(px) || !Number.isFinite(py)) {
    throw new Error("Invalid browser click coordinates.");
  }

  await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: px,
    y: py,
    button: "none",
    clickCount: 0
  });
  await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: px,
    y: py,
    button: "left",
    clickCount: 1
  });
  await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: px,
    y: py,
    button: "left",
    clickCount: 1
  });
}

async function dispatchTextInput(target, text) {
  await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "a",
    code: "KeyA",
    windowsVirtualKeyCode: 65,
    modifiers: 2
  });
  await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "a",
    code: "KeyA",
    windowsVirtualKeyCode: 65,
    modifiers: 2
  });
  await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "Backspace",
    code: "Backspace",
    windowsVirtualKeyCode: 8
  });
  await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Backspace",
    code: "Backspace",
    windowsVirtualKeyCode: 8
  });

  if (text) {
    await chrome.debugger.sendCommand(target, "Input.insertText", { text: String(text) });
  }
}

async function dispatchKey(target, key, code) {
  await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key,
    code,
    windowsVirtualKeyCode: keyToVirtualKeyCode(key)
  });
  await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    windowsVirtualKeyCode: keyToVirtualKeyCode(key)
  });
}

function keyToVirtualKeyCode(key) {
  const lookup = {
    Enter: 13,
    Tab: 9,
    ArrowDown: 40,
    ArrowUp: 38,
    Escape: 27,
    Backspace: 8
  };
  return lookup[key] || 0;
}

async function loadProfileText(storedProfileText) {
  if (typeof storedProfileText === "string" && storedProfileText.trim()) {
    return storedProfileText;
  }

  try {
    const response = await fetch(chrome.runtime.getURL("JobAutofill_Profile.json"));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.warn("[Background] Failed to load bundled JobAutofill_Profile.json fallback.", error);
    return "{}";
  }
}

async function analyzeFormWithAI({ apiKey, profileText, formFields }) {
  if (!formFields.length) {
    return { reasoning: {}, mapping: {}, expand: [] };
  }

  const profile = normalizeProfileForLLM(parseProfile(profileText));
  const fieldIndex = new Map(formFields.map((field) => [field.id, field]));
  const aggregate = {
    reasoning: {},
    mapping: {},
    expand: []
  };
  const expansionMap = new Map();
  const deterministic = buildDeterministicMappings(profile, formFields);

  Object.assign(aggregate.reasoning, deterministic.reasoning);
  Object.assign(aggregate.mapping, deterministic.mapping);

  const unresolvedFields = formFields.filter((field) => !(field.id in deterministic.mapping));
  const chunks = createFieldChunks(unresolvedFields, MAX_FIELDS_PER_CHUNK);

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    if (!chunk.length) {
      continue;
    }
    const parsedResponse = await requestGroqChunk({
      apiKey,
      profile,
      fields: chunk,
      chunkIndex: index + 1,
      chunkCount: chunks.length
    });

    if (parsedResponse.reasoning && typeof parsedResponse.reasoning === "object") {
      Object.assign(aggregate.reasoning, parsedResponse.reasoning);
    }

    const rawMapping =
      parsedResponse.mapping && typeof parsedResponse.mapping === "object"
        ? parsedResponse.mapping
        : {};

    for (const [fieldId, rawValue] of Object.entries(rawMapping)) {
      const field = fieldIndex.get(fieldId);
      if (!field) {
        continue;
      }

      const coercedValue = coerceFieldValue(field, rawValue);
      if (coercedValue !== undefined) {
        aggregate.mapping[fieldId] = coercedValue;
      }
    }

    if (Array.isArray(parsedResponse.expand)) {
      for (const action of parsedResponse.expand) {
        if (!action || typeof action.id !== "string") {
          continue;
        }

        const times = Math.max(0, Number.parseInt(action.times, 10) || 0);
        if (!times) {
          continue;
        }

        expansionMap.set(action.id, Math.max(times, expansionMap.get(action.id) || 0));
      }
    }
  }

  aggregate.expand = Array.from(expansionMap.entries()).map(([id, times]) => ({ id, times }));
  return aggregate;
}

function buildDeterministicMappings(profile, fields) {
  const mapping = {};
  const reasoning = {};

  fields.forEach((field) => {
    const resolved = resolveDeterministicField(profile, field);
    if (resolved === undefined) {
      return;
    }

    mapping[field.id] = resolved.value;
    reasoning[field.id] = resolved.reason;
  });

  return { mapping, reasoning };
}

function resolveDeterministicField(profile, field) {
  const personal = profile.personal_information || {};
  const additional = profile.additional_information || {};
  const workPrefs = profile.work_preferences || {};

  const haystack = normalizeText([field.l, ...(field.ctx || []), field.ph, field.id].filter(Boolean).join(" "));
  const optionValues = parseOptions(field.o);

  if (/\b(first name|given name)\b/.test(haystack) && personal.name) {
    return { value: personal.name, reason: "Mapped from personal_information.name" };
  }
  if (/\b(last name|surname|family name)\b/.test(haystack) && personal.surname) {
    return { value: personal.surname, reason: "Mapped from personal_information.surname" };
  }
  if (/\bmiddle name\b/.test(haystack) && personal.middle_name) {
    return { value: personal.middle_name, reason: "Mapped from personal_information.middle_name" };
  }
  if (/\bfull name\b|\bname\b/.test(haystack) && !/\b(first|last|middle|mother|father|company|institution|project)\b/.test(haystack)) {
    const fullName = [personal.name, personal.middle_name, personal.surname].filter(Boolean).join(" ").trim();
    if (fullName) {
      return { value: fullName, reason: "Mapped from personal_information name components" };
    }
  }
  if (/\bemail\b/.test(haystack) && personal.email) {
    return { value: personal.email, reason: "Mapped from personal_information.email" };
  }
  if (/\bmobile\b|\bphone\b|\bcontact\b/.test(haystack) && personal.phone) {
    return { value: personal.phone, reason: "Mapped from personal_information.phone" };
  }
  if (/\bgender\b/.test(haystack)) {
    const gender = personal.gender || additional.gender_identity;
    const matched = matchValueToOptions(gender, optionValues);
    if (matched) {
      return { value: matched, reason: "Mapped from personal_information.gender" };
    }
  }
  if (/\bdate of birth\b|\bdob\b|\bbirth\b/.test(haystack) && personal.date_of_birth) {
    return {
      value: formatProfileDateForField(personal.date_of_birth, field),
      reason: "Mapped from personal_information.date_of_birth"
    };
  }
  if (/\baddress\b/.test(haystack) && personal.address) {
    return { value: personal.address, reason: "Mapped from personal_information.address" };
  }
  if (/\bcity\b/.test(haystack) && personal.city) {
    const matched = matchValueToOptions(personal.city, optionValues) || personal.city;
    return { value: matched, reason: "Mapped from personal_information.city" };
  }
  if (/\bstate\b|\bprovince\b|\bregion\b/.test(haystack) && personal.state) {
    const matched = matchValueToOptions(personal.state, optionValues) || personal.state;
    return { value: matched, reason: "Mapped from personal_information.state" };
  }
  if (/\bcountry\b/.test(haystack) && personal.country) {
    const matched = matchValueToOptions(personal.country, optionValues) || personal.country;
    return { value: matched, reason: "Mapped from personal_information.country" };
  }
  if (/\b(zip|postal)\b/.test(haystack) && personal.zip_code) {
    return { value: personal.zip_code, reason: "Mapped from personal_information.zip_code" };
  }
  if (/\blinkedin\b/.test(haystack) && personal.linkedin) {
    return { value: personal.linkedin, reason: "Mapped from personal_information.linkedin" };
  }
  if (/\bgithub\b/.test(haystack) && personal.github) {
    return { value: personal.github, reason: "Mapped from personal_information.github" };
  }
  if (/\bwebsite\b|\bportfolio\b/.test(haystack) && personal.website) {
    return { value: personal.website, reason: "Mapped from personal_information.website" };
  }
  if (/\brelocat/.test(haystack) && workPrefs.open_to_relocation) {
    const matched = matchValueToOptions(workPrefs.open_to_relocation, optionValues) || workPrefs.open_to_relocation;
    return { value: matched, reason: "Mapped from work_preferences.open_to_relocation" };
  }

  return undefined;
}

function parseProfile(profileText) {
  try {
    const parsed = typeof profileText === "string" ? JSON.parse(profileText) : profileText;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("[Background] Failed to parse profile JSON, using empty profile.", error);
    return {};
  }
}

function normalizeProfileForLLM(profile) {
  const cleaned = pruneEmptyValues(profile);
  return normalizeDateObjects(cleaned || {}) || {};
}

function pruneEmptyValues(value) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    const cleanedArray = value.map(pruneEmptyValues).filter((item) => item !== undefined);
    return cleanedArray.length ? cleanedArray : undefined;
  }

  if (typeof value === "object") {
    const result = {};
    let hasEntries = false;
    for (const [key, nestedValue] of Object.entries(value)) {
      const cleanedValue = pruneEmptyValues(nestedValue);
      if (cleanedValue !== undefined) {
        result[key] = cleanedValue;
        hasEntries = true;
      }
    }
    return hasEntries ? result : undefined;
  }

  return value;
}

function normalizeDateObjects(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeDateObjects);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (looksLikeLegacyDateObject(value)) {
    const normalized = datePartsToIso(value);
    return normalized || value;
  }

  const result = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    result[key] = normalizeDateObjects(nestedValue);
  }
  return result;
}

function looksLikeLegacyDateObject(value) {
  const keys = Object.keys(value);
  return keys.includes("year") && (keys.includes("month") || keys.includes("month_name") || keys.includes("day"));
}

function datePartsToIso(value) {
  const year = String(value.year || "").trim();
  if (!year || year.toLowerCase() === "present") {
    return "Present";
  }

  const month = clampDatePart(value.month || monthNameToNumber(value.month_name) || "01", 1, 12);
  const day = clampDatePart(value.day || "01", 1, 31);
  return `${year.padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function clampDatePart(value, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return min;
  }
  return Math.min(max, Math.max(min, parsed));
}

function monthNameToNumber(value) {
  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december"
  ];
  const normalized = String(value || "").trim().toLowerCase();
  const index = monthNames.findIndex(
    (month) => month === normalized || month.startsWith(normalized.slice(0, 3))
  );
  return index >= 0 ? index + 1 : null;
}

function createFieldChunks(fields, size) {
  const chunks = [];
  for (let index = 0; index < fields.length; index += size) {
    chunks.push(fields.slice(index, index + size));
  }
  return chunks;
}

async function requestGroqChunk({ apiKey, profile, fields, chunkIndex, chunkCount }) {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({ profile, fields, chunkIndex, chunkCount });
  const requestBody = {
    model: LLM_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  };

  const response = await fetchWithRetry(apiKey, requestBody);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  try {
    return JSON.parse(content);
  } catch (error) {
    console.error("[Background] Raw invalid LLM JSON:", content);
    throw new Error("AI returned invalid JSON.");
  }
}

function buildSystemPrompt() {
  return [
    "You are an expert ATS autofill mapper.",
    "Output valid JSON only.",
    'Always return an object with exactly these top-level keys: "reasoning", "mapping", and optional "expand".',
    'The "reasoning" object must explain the exact profile path used for each mapped field id.',
    "Never hallucinate or infer data that is not explicitly present in the candidate profile.",
    "If a field cannot be supported by the profile, omit it from mapping.",
    "If a field includes options, prefer the exact option value when it is provided, otherwise use the exact visible label.",
    'For booleans, return only true or false.',
    'For "date_group" fields, return an object like {"year":"2024","month":"03","day":"01","monthName":"March"} and omit unknown subparts.',
    'For native date inputs, return YYYY-MM-DD. For month inputs, return YYYY-MM.',
    "For file fields, never fabricate a local path and do not include them in mapping.",
    "If a field represents an Add/Expand button and the candidate has multiple entries for that section, return it in expand with the exact field id and number of clicks required."
  ].join("\n");
}

function buildUserPrompt({ profile, fields, chunkIndex, chunkCount }) {
  const today = new Date().toISOString().slice(0, 10);
  const profileCounts = buildProfileCounts(profile);

  return [
    `Current date: ${today}`,
    `Chunk: ${chunkIndex} of ${chunkCount}`,
    "",
    "<CandidateProfile>",
    JSON.stringify(profile, null, 2),
    "</CandidateProfile>",
    "",
    "<ProfileCounts>",
    JSON.stringify(profileCounts, null, 2),
    "</ProfileCounts>",
    "",
    "<Instructions>",
    "- Use the field label plus the surrounding context (ctx) to disambiguate education/work/application sections.",
    "- If an option set is present, use the exact provided value when possible.",
    "- For split dates, map the full logical date once to the date_group field.",
    "- Preserve acronyms, legal status values, school names, and employer names exactly.",
    "- If a date end value is Present, use the current date only when the field explicitly needs an end date value.",
    "</Instructions>",
    "",
    "<Fields>",
    JSON.stringify(fields, null, 2),
    "</Fields>"
  ].join("\n");
}

function buildProfileCounts(profile) {
  const counts = {};
  for (const [key, value] of Object.entries(profile || {})) {
    if (Array.isArray(value)) {
      counts[key] = value.length;
    }
  }
  return counts;
}

async function fetchWithRetry(apiKey, requestBody) {
  let response;
  let lastErrorText = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (response.ok) {
      return response;
    }

    lastErrorText = await response.text();

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const waitMs = extractRetryDelay(lastErrorText);
      console.warn(`[Background] Rate limited. Retrying in ${waitMs}ms (${attempt}/${MAX_RETRIES}).`);
      await sleep(waitMs);
      continue;
    }

    if ((response.status === 413 || response.status === 422) && attempt < MAX_RETRIES) {
      await sleep(500 * attempt);
      continue;
    }

    break;
  }

  throw new Error(`Groq API Error ${response?.status || "unknown"}: ${lastErrorText}`);
}

function extractRetryDelay(errorText) {
  try {
    const parsed = JSON.parse(errorText);
    const match = String(parsed?.error?.message || "").match(/try again in ([\d.]+)s/i);
    if (match) {
      return Math.ceil(Number.parseFloat(match[1]) * 1000) + 500;
    }
  } catch (error) {
    console.warn("[Background] Failed to parse retry delay.", error);
  }
  return 5000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function coerceFieldValue(field, rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return undefined;
  }

  if (field.t === "file") {
    return undefined;
  }

  if (field.t === "checkbox" || field.t === "switch" || field.t === "boolean") {
    return parseBoolean(rawValue);
  }

  if (field.t === "radio") {
    return coerceEnumeratedValue(field.o, rawValue);
  }

  if (field.t === "select") {
    return coerceEnumeratedValue(field.o, rawValue);
  }

  if (field.t === "date_group") {
    return normalizeDateGroupValue(rawValue);
  }

  if (field.t === "date") {
    return normalizeDateInputValue(rawValue, "date");
  }

  if (field.t === "date_text") {
    return normalizeDateInputValue(rawValue, "date_text", field.fmt);
  }

  if (field.t === "month") {
    return normalizeDateInputValue(rawValue, "month");
  }

  if (field.t === "number" || field.kind === "number") {
    const numeric = Number.parseFloat(String(rawValue).replace(/[^\d.-]/g, ""));
    return Number.isFinite(numeric) ? String(rawValue).trim() : undefined;
  }

  if (field.t === "email") {
    const value = String(rawValue).trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : undefined;
  }

  if (Array.isArray(rawValue)) {
    const joined = rawValue
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join(", ");
    return joined || undefined;
  }

  const textValue = String(rawValue).trim();
  return textValue || undefined;
}

function parseBoolean(value) {
  if (value === true || value === false) {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "yes", "y", "1", "checked"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "n", "0", "unchecked"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function coerceEnumeratedValue(optionSource, rawValue) {
  const value = String(rawValue).trim();
  if (!value) {
    return undefined;
  }

  const options = parseOptions(optionSource);
  if (!options.length) {
    return value;
  }

  const normalizedValue = normalizeText(value);
  const exactValue = options.find((option) => normalizeText(option.value) === normalizedValue);
  if (exactValue) {
    return exactValue.value;
  }

  const exactLabel = options.find((option) => normalizeText(option.label) === normalizedValue);
  if (exactLabel) {
    return exactLabel.value;
  }

  const fuzzy = options.find(
    (option) =>
      normalizeText(option.label).includes(normalizedValue) ||
      normalizedValue.includes(normalizeText(option.label))
  );
  return fuzzy ? fuzzy.value : undefined;
}

function matchValueToOptions(value, options) {
  if (!value) {
    return undefined;
  }

  if (!options?.length) {
    return String(value).trim();
  }

  const normalizedValue = normalizeText(value);
  const exact = options.find(
    (option) =>
      normalizeText(option.value) === normalizedValue ||
      normalizeText(option.label) === normalizedValue
  );
  if (exact) {
    return exact.value;
  }

  const partial = options.find(
    (option) =>
      normalizeText(option.value).includes(normalizedValue) ||
      normalizedValue.includes(normalizeText(option.value)) ||
      normalizeText(option.label).includes(normalizedValue) ||
      normalizedValue.includes(normalizeText(option.label))
  );
  return partial ? partial.value : undefined;
}

function formatProfileDateForField(isoDate, field) {
  const parsed = parseLooseDate(isoDate);
  if (!parsed?.year) {
    return isoDate;
  }

  if (field.t === "date") {
    return `${parsed.year}-${parsed.month || "01"}-${parsed.day || "01"}`;
  }
  if (field.t === "month") {
    return `${parsed.year}-${parsed.month || "01"}`;
  }
  if (field.t === "date_text") {
    return formatTextDate(parsed, field.fmt);
  }
  return `${parsed.year}-${parsed.month || "01"}-${parsed.day || "01"}`;
}

function formatTextDate(parsed, formatHint) {
  const monthNumber = Number.parseInt(parsed.month || "1", 10);
  const shortMonth = monthNumberToName(monthNumber)?.slice(0, 3) || "Jan";
  const longMonth = monthNumberToName(monthNumber) || "January";
  const day = String(Number.parseInt(parsed.day || "1", 10)).padStart(2, "0");

  switch (formatHint) {
    case "DD/MM/YYYY":
      return `${day}/${parsed.month || "01"}/${parsed.year}`;
    case "MMM DD, YYYY":
      return `${shortMonth} ${day}, ${parsed.year}`;
    case "DD MMM YYYY":
    default:
      return `${day} ${shortMonth} ${parsed.year}`;
  }
}

function parseOptions(optionSource) {
  if (Array.isArray(optionSource)) {
    return optionSource
      .map((option) => {
        if (typeof option === "string") {
          const [value, label] = option.split(":");
          return { value: value || option, label: label || value || option };
        }
        if (option && typeof option === "object") {
          return {
            value: String(option.value ?? option.id ?? option.label ?? "").trim(),
            label: String(option.label ?? option.text ?? option.value ?? "").trim()
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  if (typeof optionSource === "string") {
    return optionSource
      .split("|")
      .map((entry) => {
        const [value, label] = entry.split(":");
        if (!value) {
          return null;
        }
        return {
          value: value.trim(),
          label: String(label || value).trim()
        };
      })
      .filter(Boolean);
  }

  return [];
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeDateGroupValue(rawValue) {
  if (typeof rawValue === "string") {
    const parsed = parseLooseDate(rawValue);
    return parsed || undefined;
  }

  if (!rawValue || typeof rawValue !== "object") {
    return undefined;
  }

  const monthNumber =
    clampOptionalDatePart(rawValue.month, 1, 12) ||
    clampOptionalDatePart(monthNameToNumber(rawValue.monthName), 1, 12);
  const dayNumber = clampOptionalDatePart(rawValue.day, 1, 31);
  const yearText = normalizeYear(rawValue.year);

  if (!monthNumber && !dayNumber && !yearText) {
    return undefined;
  }

  return {
    year: yearText || undefined,
    month: monthNumber ? String(monthNumber).padStart(2, "0") : undefined,
    day: dayNumber ? String(dayNumber).padStart(2, "0") : undefined,
    monthName: monthNumber ? monthNumberToName(monthNumber) : undefined
  };
}

function clampOptionalDatePart(value, min, max) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.min(max, Math.max(min, parsed));
}

function normalizeYear(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  const match = text.match(/\d{4}/);
  return match ? match[0] : "";
}

function parseLooseDate(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const isoMatch = text.match(/(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?/);
  if (isoMatch) {
    return {
      year: isoMatch[1],
      month: isoMatch[2].padStart(2, "0"),
      day: (isoMatch[3] || "01").padStart(2, "0"),
      monthName: monthNumberToName(Number.parseInt(isoMatch[2], 10))
    };
  }

  const numericDayMonthYearMatch = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  if (numericDayMonthYearMatch) {
    return {
      year: numericDayMonthYearMatch[3],
      month: numericDayMonthYearMatch[2].padStart(2, "0"),
      day: numericDayMonthYearMatch[1].padStart(2, "0"),
      monthName: monthNumberToName(Number.parseInt(numericDayMonthYearMatch[2], 10))
    };
  }

  const dayMonthYearMatch = text.match(
    /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{4})\b/i
  );
  if (dayMonthYearMatch) {
    const month = monthNameToNumber(dayMonthYearMatch[2]);
    return {
      year: dayMonthYearMatch[3],
      month: String(month).padStart(2, "0"),
      day: dayMonthYearMatch[1].padStart(2, "0"),
      monthName: monthNumberToName(month)
    };
  }

  const monthNameMatch = text.match(
    /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{4})/i
  );
  if (monthNameMatch) {
    const month = monthNameToNumber(monthNameMatch[1]);
    return {
      year: monthNameMatch[2],
      month: String(month).padStart(2, "0"),
      day: "01",
      monthName: monthNumberToName(month)
    };
  }

  const yearOnlyMatch = text.match(/\b(\d{4})\b/);
  if (yearOnlyMatch) {
    return { year: yearOnlyMatch[1] };
  }

  return null;
}

function monthNumberToName(value) {
  return [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ][Number.parseInt(String(value), 10)] || undefined;
}

function normalizeDateInputValue(rawValue, mode, formatHint) {
  const parsed = typeof rawValue === "object" ? normalizeDateGroupValue(rawValue) : parseLooseDate(rawValue);
  if (!parsed) {
    return undefined;
  }

  const year = parsed.year;
  const month = parsed.month || "01";
  const day = parsed.day || "01";

  if (!year) {
    return undefined;
  }

  if (mode === "month") {
    return `${year}-${month}`;
  }

  if (mode === "date_text") {
    return formatTextDate({ year, month, day }, formatHint);
  }

  return `${year}-${month}-${day}`;
}
