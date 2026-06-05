// Advanced content script for resilient ATS form extraction and framework-safe filling.

const CHANNEL_PREFIX = "AI_JOB_AUTOFILL";
const START_CHANNEL = `${CHANNEL_PREFIX}:START`;
const STOP_CHANNEL = `${CHANNEL_PREFIX}:STOP`;
const SKIP_CHANNEL = `${CHANNEL_PREFIX}:SKIP`;
const REGISTER_CHANNEL = `${CHANNEL_PREFIX}:REGISTER`;
const RESULT_CHANNEL = `${CHANNEL_PREFIX}:RESULT`;
const OPTION_SELECTORS = [
  '[role="option"]',
  'li[role="option"]',
  '[role="listbox"] [aria-selected]',
  '[data-automation-id="promptOption"]',
  '.fd-list__item',
  '.select2-results__option',
  '.sapMSelectListItem',
  '.mantine-Select-item',
  '.react-select__option',
  '[class*="__option"]',
  '.react-datepicker__day:not(.react-datepicker__day--outside-month):not(.react-datepicker__day--disabled)'
].join(", ");

let autofillAborted = false;
let skipCurrentField = false;
let isAutofilling = false;
let currentSettings = { autoskip: true, highlight: true, autoContinue: false };
let containerKeySequence = 0;
let masterRunState = null;
const sessionStorageArea = chrome.storage.session || chrome.storage.local;

const isTopFrame = (() => {
  try {
    return window === window.top;
  } catch (error) {
    return false;
  }
})();

// Emulates human interaction to safely fill inputs and comboboxes
async function triggerReactChange(element, value) {
    // Detect if this is a custom dropdown/combobox (not a native SELECT)
    const isCustomDropdown = (element.tagName !== 'SELECT') && (
        element.getAttribute('role') === 'combobox' || 
        element.getAttribute('aria-haspopup') || 
        (element.nextElementSibling && element.nextElementSibling.tagName === 'BUTTON')
    );

    if (isCustomDropdown) {
        // Dropdown Workflow: Open -> Wait/Read from Server -> Select -> Collapse
        element.focus();
        
        // Only click ONE element to expand. If we click both the input and the sibling chevron button, it opens and instantly closes!
        if (element.nextElementSibling && element.nextElementSibling.tagName === 'BUTTON') {
            simulateClick(element.nextElementSibling);
        } else {
            simulateClick(element);
        }

  if (request.action === "SKIP_CURRENT_FIELD") {
    skipCurrentField = true;
    broadcastFrameCommand(SKIP_CHANNEL, {});
    sendResponse({ ok: true });
    return false;
  }

  if (request.action === "STOP_AUTOFILL") {
    autofillAborted = true;
    skipCurrentField = true;
    broadcastFrameCommand(STOP_CHANNEL, {});
    if (isTopFrame) {
      finalizeMasterRun({ stopped: true });
    }
    sendResponse({ ok: true });
    return false;
  }

  if (request.action === "START_AUTOFILL") {
    if (!isTopFrame) {
      sendResponse({ started: false });
      return false;
    }

    startMasterAutofill(request.settings || {}).catch((error) => {
      console.error("[Autofill] Failed to start master run:", error);
      emitRuntimeMessage({
        action: "AUTOFILL_COMPLETE",
        error: error.message || "Failed to start autofill."
      });
      clearMasterRunState();
    });

    sendResponse({ started: true });
    return false;
  }

    } else {
        // Standard Input/Select Workflow: Just set the proper answer!
        simulateValueChange(element, value);
    }
    return;
  }

  if (message.channel === STOP_CHANNEL) {
    autofillAborted = true;
    skipCurrentField = true;
    broadcastFrameCommand(STOP_CHANNEL, {});
    return;
  }

  if (message.channel === SKIP_CHANNEL) {
    skipCurrentField = true;
    broadcastFrameCommand(SKIP_CHANNEL, {});
    return;
  }

  if (!isTopFrame || !masterRunState || message.runId !== masterRunState.runId) {
    return;
  }

  if (message.channel === REGISTER_CHANNEL) {
    masterRunState.registered.add(message.framePath);
    masterRunState.lastRegistrationAt = Date.now();
    scheduleMasterFinalize();
    return;
  }

  if (message.channel === RESULT_CHANNEL) {
    masterRunState.results.set(message.framePath, message.result || {});
    scheduleMasterFinalize();
  }
});

if (isTopFrame) {
  const boot = () => {
    setTimeout(() => {
      maybeResumePendingAutofill().catch((error) => {
        console.error("[Autofill] Failed to resume pending flow:", error);
      });
    }, 900);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}

// Optimized helper to fill values and trigger framework-level change detection
function simulateValueChange(element, text) {
    element.focus();
    
    // React 16+ value setter overrides
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;

    if (element.tagName === 'TEXTAREA') {
        if (nativeTextAreaValueSetter) nativeTextAreaValueSetter.call(element, text);
        else element.value = text;
    } else if (element.tagName === 'SELECT') {
        if (nativeSelectValueSetter) nativeSelectValueSetter.call(element, text);
        else element.value = text;
    } else {
        if (nativeInputValueSetter) nativeInputValueSetter.call(element, text);
        else element.value = text;
    }

    // Dispatch full suite of standard events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Simulate keyboard interaction for strict listeners (like Greenhouse)
    const keyEventParams = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
    element.dispatchEvent(new KeyboardEvent('keydown', keyEventParams));
    element.dispatchEvent(new KeyboardEvent('keypress', keyEventParams));
    element.dispatchEvent(new KeyboardEvent('keyup', keyEventParams));
    
    element.blur();
    element.dispatchEvent(new Event('blur', { bubbles: true }));
}

async function pollForDropdownOption(value, timeoutMs = 4000) {
    const start = Date.now();
    
    while (Date.now() - start < timeoutMs) {
        if (skipCurrentField || autofillAborted) return false;
        
        // Re-query items every tick to catch dynamically loaded portal elements
        let items = Array.from(document.querySelectorAll(
            '[role="option"], li[role="option"], [data-automation-id="promptOption"], .select2-results__option, .fd-list__item, .v-list-item, .ant-select-item, .mat-option, .dropdown-item'
        ));
        
        // Don't enforce strict visibility checks immediately; some frameworks use opacity or transforms
        for (let item of items) {
            let text = item.innerText ? item.innerText.trim().toLowerCase() : '';
            if (text.includes(value.toString().toLowerCase().trim())) {
                // Force into view before clicking to bypass virtual list bounds
                if (item.scrollIntoView) {
                    item.scrollIntoView({ block: 'nearest' });
                }
                simulateClick(item);
                return true;
            }
        }
        
        // Wait a short tick before polling the DOM again
        await new Promise(r => setTimeout(r, 200));
    }
    
    return false;
}

function simulateClick(el) {
    el.focus && el.focus();
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

// Simulates real typing using execCommand — triggers React/Workday internal search handlers
function simulateTyping(element, text) {
    element.focus();
    // Select all existing text and delete it first
    element.select && element.select();
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    // Insert the new text — this goes through the browser's native input pipeline
    // and triggers React's onChange/onInput handlers properly
    document.execCommand('insertText', false, text);
}

// Search-and-select workflow for combobox/multiselect fields
async function searchAndSelectOption(element, fullValue) {
    console.log(`[Autofill] searchAndSelectOption: "${fullValue.substring(0, 50)}"`);
    
    // Strategy: Try progressively shorter search terms
    // [full text] → [first 3 words] → [first 2 words] → [first word]
    const words = fullValue.trim().split(/\s+/);
    const searchTerms = [fullValue.trim()];
    if (words.length > 3) searchTerms.push(words.slice(0, 3).join(' '));
    if (words.length > 2) searchTerms.push(words.slice(0, 2).join(' '));
    if (words.length > 1) searchTerms.push(words[0]);
    // De-duplicate
    const uniqueTerms = [...new Set(searchTerms)];
    
    for (const searchTerm of uniqueTerms) {
        if (skipCurrentField || autofillAborted) return false;
        console.log(`[Autofill]   Trying search term: "${searchTerm}"`);
        
        // Type the search term using real typing simulation
        element.focus();
        await new Promise(r => setTimeout(r, 50));
        if (skipCurrentField) return false;
        simulateTyping(element, searchTerm);
        
        // Wait for Workday to search and render dropdown options (short wait, then poll)
        await new Promise(r => setTimeout(r, 150));
        
        if (skipCurrentField || autofillAborted) return false;
        // Try to find and click a matching option
        let optionClicked = clickDropdownOption(fullValue);
        if (!optionClicked) {
            // Poll a bit longer — server-side search might be slow
            optionClicked = await pollForDropdownOption(fullValue, 2500);
        }
        
        if (optionClicked) {
            console.log(`[Autofill]   ✓ Selected option for: "${fullValue.substring(0, 50)}"`);
            await new Promise(r => setTimeout(r, 200));
            return true;
        }
    }

    try {
      frame.contentWindow.postMessage(
        {
          ...payload,
          framePath: `${parentPath}>f${index}`
        },
        "*"
      );
    } catch (error) {
      console.warn("[Autofill] Failed to postMessage to child frame:", error);
    }
  });
}

function postToTop(payload) {
  if (isTopFrame) {
    return;
  }

  try {
    window.top.postMessage(payload, "*");
  } catch (error) {
    console.warn("[Autofill] Failed to post result to top frame:", error);
  }
}

function clickDropdownOption(value) {
    if (!value || value.toString().length < 1) return false;
    const lowerValueStr = value.toString().toLowerCase().trim();
    
    // Broadened selector to catch more custom dropdowns
    let items = Array.from(document.querySelectorAll(
        '[role="option"], li[role="option"], [data-automation-id="promptOption"], .fd-list__item, .sapMSelectListItem, .select2-results__option, .v-list-item, .ant-select-item, .mat-option, .dropdown-item'
    ));
    
    let bestMatch = null;
    let bestScore = -1;

    // Pre-compile regexes for efficiency
    const escapedValue = escapeRegExp(lowerValueStr);
    const exactWordRegex = new RegExp(`^${escapedValue}$`, 'i');
    const startWordRegex = new RegExp(`^${escapedValue}\\b`, 'i');
    const containsWordRegex = new RegExp(`\\b${escapedValue}\\b`, 'i');
    const fuzzyRegex = new RegExp(lowerValueStr.split('').map(c => escapeRegExp(c)).join('.*'), 'i');

    for (let item of items) {
        let text = (item.innerText || item.textContent || '').trim();
        if (text.length < 1 || /no selection/i.test(text)) continue;

  masterRunState.finalizeTimer = setTimeout(() => {
    if (!masterRunState) {
      return;
    }

        // 1. REGEX EXACT MATCH (Score: 100)
        if (exactWordRegex.test(text)) {
            simulateClick(item);
            return true;
        }
        
        // 2. REGEX STARTS WITH WORD (Score: 90)
        else if (startWordRegex.test(text)) {
            currentScore = 90;
        }
        
        // 3. REGEX CONTAINS WORD BOUNDARY (Score: 80)
        else if (containsWordRegex.test(text)) {
            currentScore = 80;
        }
        
        // 4. SUBSTRING INCLUDES (Score: 70 - penalty for length diff)
        else if (text.toLowerCase().includes(lowerValueStr)) {
            currentScore = 70 - Math.min(20, text.length - lowerValueStr.length);
        }
        
        // 5. FUZZY REGEX MATCH (Score: 40)
        else if (fuzzyRegex.test(text)) {
            currentScore = 40;
        }

      totalFilled += await injectDataIntoForm(response?.mapping || {}, framePath);

      if (Array.isArray(response?.expand) && response.expand.length) {
        for (const expansion of response.expand) {
          if (autofillAborted) {
            break;
          }

          const clicked = await triggerExpansionButton(expansion.id, expansion.times);
          if (clicked) {
            emitProgress(`Expanded ${expansion.id} x${expansion.times}`, "log-success", undefined, framePath);
          }
        }
      }

      await sleep(300);
    }

    const requiredRemaining = countRequiredGaps();
    return {
      success: !autofillAborted,
      filledCount: totalFilled,
      requiredRemaining
    };
  } finally {
    isAutofilling = false;
  }
}

function extractFormSchema() {
  const elements = collectInteractiveElements();
  const records = [];
  const radioGroups = new Map();

  elements.forEach((element, index) => {
    const record = createFieldRecord(element, index);
    if (!record) {
      return;
    }

    if (record.t === "radio") {
      if (!radioGroups.has(record.groupName)) {
        radioGroups.set(record.groupName, {
          id: record.groupName,
          t: "radio",
          l: record.l,
          ctx: record.ctx,
          req: record.req,
          o: []
        });
      }

      radioGroups.get(record.groupName).o.push(
        `${record.optionValue}:${record.optionLabel || record.optionValue}`
      );
      return;
    }

    records.push(record);
  });

  const dateGroups = buildDateGroups(records);
  const consumedDateIds = new Set(dateGroups.flatMap((group) => group.parts.map((part) => part.id)));
  const fields = [];

  for (const record of records) {
    if (consumedDateIds.has(record.id)) {
      continue;
    }
    fields.push(compactField(record));
  }

  dateGroups.forEach((group) => fields.push(group));
  radioGroups.forEach((group) => fields.push(group));

  return fields.sort((a, b) => (a.order || 0) - (b.order || 0)).map(stripOrder);
}

function collectInteractiveElements() {
  const selector = [
    'input:not([type="hidden"]):not([type="submit"]):not([disabled])',
    "select:not([disabled])",
    "textarea:not([disabled])",
    'button:not([disabled])',
    '[role="button"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[role="combobox"]',
    '[contenteditable="true"]'
  ].join(", ");

  const results = [];
  const seen = new Set();

  traverseOpenDom(document.body || document.documentElement, (node) => {
    if (!node.matches || !node.matches(selector)) {
      return;
    }

    // After evaluating ALL items, click the one with the highest score
    if (bestMatch && bestScore > 0) {
        console.log(`[Autofill] Regex Match: "${bestMatch.innerText.trim()}" (Score: ${bestScore})`);
        if (bestMatch.scrollIntoView) bestMatch.scrollIntoView({ block: 'nearest' });
        simulateClick(bestMatch);
        return true;
    }

    seen.add(node);
    results.push(node);
  });

  return results;
}

function traverseOpenDom(root, visitor) {
  if (!root) {
    return;
  }

  visitor(root);

  if (root.shadowRoot) {
    Array.from(root.shadowRoot.children).forEach((child) => traverseOpenDom(child, visitor));
  }

  Array.from(root.children || []).forEach((child) => traverseOpenDom(child, visitor));
}

function createFieldRecord(element, index) {
  if (!isElementEligible(element)) {
    return null;
  }

  const type = detectFieldType(element);
  const label = resolveFieldLabel(element);
  const context = resolveFieldContext(element);
  const required = isRequiredField(element);
  const baseId = element.name || element.id || `${type}_${index}`;
  const id = `ai_${index}_${sanitizeToken(baseId)}`;

  element.setAttribute("data-ai-id", id);

  if (type === "button") {
    const buttonText = normalizeText(label || element.textContent || "");
    if (!/(add|another|more|insert)/.test(buttonText)) {
      return null;
    }

    return {
      id,
      t: "button",
      l: label || "Add section",
      ctx: context,
      req: false,
      order: index
    };
  }

  if (type === "radio") {
    const groupName = sanitizeToken(element.name || `radio_${index}`);
    const groupLabel = resolveRadioGroupLabel(element) || label || groupName;
    element.setAttribute("data-ai-radio-name", groupName);
    return {
      id,
      t: "radio",
      l: groupLabel,
      ctx: context,
      req: required,
      order: index,
      groupName,
      optionValue: element.value || element.id || label || `option_${index}`,
      optionLabel: label || element.value || element.id || `option_${index}`
    };
  }

  const record = {
    id,
    t: type,
    l: label || element.placeholder || element.name || element.id || type,
    ctx: context,
    ph: truncateText(element.getAttribute("placeholder") || "", 80),
    req: required,
    order: index
  };

  if (type === "file") {
    element.setAttribute("data-ai-file-id", id);
    return record;
  }

  if (type === "select") {
    const options = Array.from(element.options || [])
      .filter((option) => !option.disabled && normalizeText(option.value || option.textContent))
      .map((option) => ({
        value: truncateText(option.value || option.textContent || "", 80),
        label: truncateText(option.textContent || option.value || "", 80)
      }))
      .slice(0, 40);
    if (options.length) {
      record.o = options;
    }
  }

  if (type === "combobox") {
    record.o = extractInlineComboboxHints(element);
  }

  if (type === "date_text") {
    record.fmt = inferTextDateFormat(element);
  }

  const dateMeta = inferDateMeta(element, record.l, context, type);
  if (dateMeta) {
    record.dateMeta = dateMeta;
  }

  return record;
}

function isElementEligible(element) {
  if (!element || element.getAttribute("data-ai-filled") === "true") {
    return false;
  }

  if (element.matches?.("[readonly], [aria-disabled='true']")) {
    return false;
  }

  if (currentSettings.autoskip && elementHasValue(element) && !isBooleanElement(element)) {
    return false;
  }

  if (!isElementVisible(element)) {
    return false;
  }

  return true;
}

function elementHasValue(element) {
  if (!element) {
    return false;
  }

  if (element.type === "checkbox" || element.type === "radio") {
    return false;
  }

        // Advanced Fallback: Regex-driven traversal to find the closest label-like text
        if (!labelText) {
            let current = el;
            let depth = 0;
            const labelRegex = /[a-z0-9]{2,}/i; // At least 2 alphanumeric chars
            const noiseRegex = /^(click|select|enter|type|add|remove|delete|edit|save|cancel)$/i;

            while (current && current !== document.body && !labelText && depth < 5) {
                // Check preceding siblings
                let prev = current.previousElementSibling;
                while (prev && !labelText) {
                    const text = (prev.innerText || prev.textContent || '').trim();
                    
                    // Use regex to validate if this text "looks" like a label
                    if (labelRegex.test(text) && !noiseRegex.test(text) && text.length < 80) {
                        // High confidence: It's a <label> or has label-like classes
                        if (prev.tagName === 'LABEL' || /label|title|caption|header|name/i.test(prev.className)) {
                            labelText = text;
                        } 
                        // Medium confidence: It's a sibling with text (like in a table or grid)
                        else if (text.length > 2) {
                            labelText = text;
                        }
                    }
                    prev = prev.previousElementSibling;
                }
                
                // If still no label, check parent's direct text nodes using regex
                if (!labelText && current.parentElement) {
                    const parentNodes = Array.from(current.parentElement.childNodes);
                    for (const node of parentNodes) {
                        if (node.nodeType === Node.TEXT_NODE) {
                            const text = node.textContent.trim();
                            if (labelRegex.test(text) && text.length > 2 && text.length < 80) {
                                labelText = text;
                                break;
                            }
                        }
                    }
                }

                current = current.parentElement;
                depth++;
            }
        }

  if (element.isContentEditable) {
    return Boolean(normalizeText(element.textContent));
  }

  return Boolean(String(element.value || "").trim());
}

function isBooleanElement(element) {
  const role = element.getAttribute("role");
  return (
    element.type === "checkbox" ||
    element.type === "radio" ||
    role === "checkbox" ||
    role === "radio" ||
    role === "switch"
  );
}

function isElementVisible(element) {
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number.parseFloat(style.opacity) === 0) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

function detectFieldType(element) {
  const role = element.getAttribute("role");
  const inputType = String(element.type || "").toLowerCase();
  const combinedText = normalizeText(
    [
      element.id,
      element.name,
      element.className,
      element.getAttribute("placeholder"),
      element.getAttribute("aria-label")
    ].join(" ")
  );

  if (inputType === "file") {
    return "file";
  }
  if (inputType === "checkbox" || role === "checkbox") {
    return "checkbox";
  }
  if (inputType === "radio" || role === "radio") {
    return "radio";
  }
  if (role === "switch") {
    return "switch";
  }
  if (element.tagName === "SELECT") {
    return "select";
  }
  if (role === "combobox" || element.getAttribute("aria-haspopup") === "listbox") {
    return "combobox";
  }
  if (inputType === "date") {
    return "date";
  }
  if (inputType === "month") {
    return "month";
  }
  if (
    inputType === "text" &&
    /(dateofbirth|dob|birth|date)/.test(combinedText) &&
    (/\b(datepicker|react-datepicker|calendar)\b/.test(combinedText) ||
      Boolean(element.closest(".react-datepicker-wrapper, [class*='datepicker'], [class*='calendar']")))
  ) {
    return "date_text";
  }
  if (["number", "range"].includes(inputType)) {
    return "number";
  }
  if (["email", "tel"].includes(inputType)) {
    return inputType;
  }
  if (element.tagName === "TEXTAREA" || element.isContentEditable) {
    return "textarea";
  }
  if (element.tagName === "BUTTON" || role === "button") {
    return "button";
  }
  return "text";
}

function resolveFieldLabel(element) {
  const candidates = [];
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) candidates.push(ariaLabel);

  const labels = element.labels ? Array.from(element.labels).map((label) => label.textContent) : [];
  candidates.push(...labels);

  const ariaLabelledBy = element.getAttribute("aria-labelledby");
  if (ariaLabelledBy) {
    ariaLabelledBy.split(/\s+/).forEach((id) => {
      const labelEl = document.getElementById(id);
      if (labelEl?.textContent) {
        candidates.push(labelEl.textContent);
      }
    });
  }

  if (element.id) {
    const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (label?.textContent) {
      candidates.push(label.textContent);
    }
  }

  const wrapperLabel = element.closest("label");
  if (wrapperLabel?.textContent) {
    candidates.push(wrapperLabel.textContent);
  }

  const nearbyText = collectNearbyLabelText(element);
  candidates.push(...nearbyText);

  candidates.push(element.getAttribute("placeholder"));
  candidates.push(element.name);
  candidates.push(element.id);

  return truncateText(
    candidates
      .map((value) => String(value || "").replace(/\s+/g, " ").trim())
      .find(Boolean) || "",
    110
  );
}

function collectNearbyLabelText(element) {
  const results = [];

  let sibling = element.previousElementSibling;
  for (let depth = 0; sibling && depth < 3; depth += 1) {
    const text = truncateText(sibling.textContent || "", 100);
    if (text) {
      results.push(text);
      break;
    }
    sibling = sibling.previousElementSibling;
  }

  let parent = element.parentElement;
  for (let depth = 0; parent && depth < 3; depth += 1) {
    const candidate = parent.querySelector("label, legend, [role='heading'], h1, h2, h3, h4, h5");
    if (candidate?.textContent) {
      results.push(candidate.textContent);
      break;
    }
    parent = parent.parentElement;
  }

  return results;
}

function resolveFieldContext(element) {
  const context = new Set();

  const describedBy = element.getAttribute("aria-describedby");
  if (describedBy) {
    describedBy.split(/\s+/).forEach((id) => {
      const node = document.getElementById(id);
      const text = truncateText(node?.textContent || "", 120);
      if (text) {
        context.add(text);
      }
    });
  }

  let current = element.parentElement;
  for (let depth = 0; current && depth < 6; depth += 1) {
    const heading = current.querySelector("legend, h1, h2, h3, h4, h5, [role='heading']");
    const text = truncateText(heading?.textContent || "", 120);
    if (text) {
      context.add(text);
    }
    current = current.parentElement;
  }

  const region = element.closest("section, article, form, fieldset, [role='group']");
  const regionLabel =
    region?.getAttribute?.("aria-label") ||
    region?.getAttribute?.("data-automation-id") ||
    region?.getAttribute?.("data-testid");
  if (regionLabel) {
    context.add(truncateText(regionLabel, 80));
  }

  return Array.from(context).slice(0, 4);
}

function resolveRadioGroupLabel(element) {
  const candidates = [];
  const row = element.closest(".row, fieldset, [role='radiogroup'], [role='group'], .form-group");
  if (row) {
    const directLabel = row.querySelector("legend, .form-label, label, .col-form-label, [role='heading']");
    if (directLabel?.textContent) {
      candidates.push(directLabel.textContent);
    }
  }

  let current = element.parentElement;
  for (let depth = 0; current && depth < 4; depth += 1) {
    const siblingText = current.previousElementSibling?.textContent;
    if (siblingText) {
      candidates.push(siblingText);
    }
    current = current.parentElement;
  }

  return truncateText(
    candidates
      .map((value) => String(value || "").replace(/\s+/g, " ").trim())
      .find(Boolean) || "",
    110
  );
}

function isRequiredField(element) {
  return (
    element.required ||
    element.getAttribute("aria-required") === "true" ||
    element.closest?.("[aria-required='true']")
  );
}

function extractInlineComboboxHints(element) {
  const hints = [];
  const listboxId = element.getAttribute("aria-controls") || element.getAttribute("aria-owns");
  if (listboxId) {
    const listbox = document.getElementById(listboxId);
    if (listbox) {
      Array.from(listbox.querySelectorAll("[role='option']")).slice(0, 15).forEach((option) => {
        const text = truncateText(option.textContent || "", 80);
        if (text) {
          hints.push({ value: text, label: text });
        }
      });
    }
  }
  return hints.length ? hints : undefined;
}

        try {
            if (el.type === 'checkbox' || el.getAttribute('role') === 'checkbox') {
                const shouldCheck = (mappedValue.toString().toLowerCase() === 'true' || mappedValue === 'yes' || mappedValue === true);
                
                // Check both native state and ARIA state
                const isCurrentlyChecked = el.checked || el.getAttribute('aria-checked') === 'true';
                
                if (isCurrentlyChecked !== shouldCheck) {
                    if (el.type === 'checkbox') {
                        // Handle native checkbox
                        el.checked = shouldCheck;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        // Try to click the wrapper if the framework relies on it
                        if (el.parentElement) el.parentElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    } else {
                        // Handle custom ARIA checkbox div/span
                        simulateClick(el); 
                    }
                    filledCount++;
                    await new Promise(r => setTimeout(r, 50));
                }
            } 
            else if (el.tagName === 'SELECT') {
                const lowerMappedValue = mappedValue.toString().toLowerCase().trim();
                let targetOption = Array.from(el.options).find(opt => 
                    opt.value.toLowerCase() === lowerMappedValue || 
                    opt.innerText.toLowerCase().trim() === lowerMappedValue
                );

                if (targetOption) {
                    await triggerReactChange(el, targetOption.value);
                    filledCount++;
                } else {
                    // Fuzzy text match fallback
                    let fallbackOpt = Array.from(el.options).find(opt => 
                        opt.innerText.toLowerCase().includes(lowerMappedValue) ||
                        lowerMappedValue.includes(opt.innerText.toLowerCase().trim())
                    );
                    if (fallbackOpt) {
                         await triggerReactChange(el, fallbackOpt.value);
                         filledCount++;
                    } else {
                        console.warn(`[Autofill] No option found for "${fieldName}" with value "${mappedValue}"`);
                    }
                }
            } 
            else {
                // Check if this is a Workday multiselect/combobox search input
                const isMultiselect = el.closest('[data-uxi-widget-type="multiselect"]') || 
                                      el.getAttribute('data-uxi-widget-type') === 'selectinput';
                const isCombobox = el.getAttribute('role') === 'combobox' || 
                                   el.getAttribute('aria-haspopup') === 'listbox' ||
                                   el.closest('[role="combobox"]');
                
                if (isMultiselect || isCombobox) {
                    // Multiselect/Combobox workflow: type to search → select from dropdown
                    const selected = await searchAndSelectOption(el, mappedValue.toString());
                    if (selected) {
                        filledCount++;
                    } else {
                        // Fallback: just set the text value directly
                        console.warn(`[Autofill] Falling back to direct value set for combobox "${key}"`);
                        await triggerReactChange(el, mappedValue.toString());
                        filledCount++;
                    }
                    el.dispatchEvent(new Event('blur', { bubbles: true }));
                } else {
                    // Standard text input
                    await triggerReactChange(el, mappedValue.toString());
                    filledCount++;
                }
            }
            
            if (skipCurrentField) {
                 chrome.runtime.sendMessage({ action: "UPDATE_PROGRESS", log: `Skipped: ${fieldName}`, statusClass: "log-error", pct: pct });
                 continue; // intentionally jump to next field
            }
            
            // Visual feedback
            if (currentSettings.highlight && el.style) {
                el.style.border = '2px solid #4f46e5';
                el.style.backgroundColor = '#eef2ff';
                el.style.transition = 'all 0.3s';
            }
            el.setAttribute('data-ai-filled', 'true');
            chrome.runtime.sendMessage({ action: "UPDATE_PROGRESS", log: `✓ Done: ${fieldName.substring(0, 30)}`, statusClass: "log-success", pct: pct });
        } catch (e) {
            console.error(`Autofill Error on field [${key}]:`, e);
            chrome.runtime.sendMessage({ action: "UPDATE_PROGRESS", log: `✗ Error: ${fieldName.substring(0, 30)}`, statusClass: "log-error", pct: pct });
        }
    }
    current = current.parentElement;
  }

  return `group_fallback_${containerKeySequence += 1}`;
}

function buildDateGroups(records) {
  const groups = new Map();

  records.forEach((record) => {
    if (!record.dateMeta || record.t === "date" || record.t === "month") {
      return;
    }

    const key = `${record.dateMeta.containerKey}|${normalizeText(record.dateMeta.groupLabel)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(record);
  });

  const dateGroups = [];
  let groupIndex = 0;

  groups.forEach((groupRecords) => {
    const uniqueParts = new Set(groupRecords.map((record) => record.dateMeta.part));
    if (groupRecords.length < 2 || uniqueParts.size < 2) {
      return;
    }

    groupIndex += 1;
    const groupId = `ai_date_group_${groupIndex}_${sanitizeToken(groupRecords[0].dateMeta.groupLabel)}`;
    const mergedContext = new Set();
    groupRecords.forEach((record) => {
      record.ctx.forEach((item) => mergedContext.add(item));
      const element = findElementByAiId(record.id);
      if (element) {
        element.setAttribute("data-ai-date-group", groupId);
        element.setAttribute("data-ai-date-part", record.dateMeta.part);
      }
    });

    dateGroups.push({
      id: groupId,
      t: "date_group",
      l: truncateText(groupRecords[0].dateMeta.groupLabel, 110),
      ctx: Array.from(mergedContext).slice(0, 4),
      req: groupRecords.some((record) => record.req),
      parts: groupRecords.map((record) => ({
        id: record.id,
        part: record.dateMeta.part,
        t: record.t,
        o: record.o
      })),
      order: Math.min(...groupRecords.map((record) => record.order))
    });
  });

  return dateGroups;
}

function compactField(record) {
  const field = {
    id: record.id,
    t: record.t,
    l: record.l,
    ctx: record.ctx,
    req: record.req,
    order: record.order
  };

  if (record.ph) {
    field.ph = record.ph;
  }
  if (record.o) {
    field.o = record.o;
  }
  if (record.fmt) {
    field.fmt = record.fmt;
  }

  return field;
}

function inferTextDateFormat(element) {
  const placeholder = String(element.getAttribute("placeholder") || "").trim();
  const currentValue = String(element.value || "").trim();
  const sample = placeholder || currentValue;

  if (/\b\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\b/.test(sample)) {
    return "DD MMM YYYY";
  }
  if (/\b[A-Za-z]{3,}\s+\d{1,2},\s+\d{4}\b/.test(sample)) {
    return "MMM DD, YYYY";
  }
  if (/\b\d{2}\/\d{2}\/\d{4}\b/.test(sample)) {
    return "DD/MM/YYYY";
  }
  return "DD MMM YYYY";
}

function stripOrder(field) {
  const { order, ...rest } = field;
  return rest;
}

async function injectDataIntoForm(mapping, framePath) {
  let filledCount = 0;
  const entries = Object.entries(mapping || {});

  for (let index = 0; index < entries.length; index += 1) {
    if (autofillAborted) {
      break;
    }

    skipCurrentField = false;

    const [fieldId, mappedValue] = entries[index];
    if (mappedValue === null || mappedValue === undefined || mappedValue === "") {
      continue;
    }

    const progressPct = Math.min(100, ((index + 1) / entries.length) * 100);
    emitProgress(`Filling ${fieldId}`, "", progressPct, framePath);

    if (await fillDateGroup(fieldId, mappedValue)) {
      filledCount += 1;
      continue;
    }

    const radioElements = findRadiosByGroup(fieldId);
    if (radioElements.length) {
      const target = radioElements.find(
        (element) =>
          normalizeText(element.value) === normalizeText(mappedValue) ||
          normalizeText(element.id) === normalizeText(mappedValue)
      );
      if (target && !target.checked) {
        await browserClickElement(target);
        markElementFilled(target);
        filledCount += 1;
      }
      continue;
    }

    const element = findElementByAiId(fieldId);
    if (!element) {
      continue;
    }

    const didFill = await fillElement(element, mappedValue);
    if (didFill) {
      filledCount += 1;
      emitProgress(`Filled ${element.name || element.id || fieldId}`, "log-success", progressPct, framePath);
    }
  }

  return filledCount;
}

async function fillDateGroup(groupId, mappedValue) {
  const parts = findDateGroupParts(groupId);
  if (!parts.length) {
    return false;
  }

  const normalized = normalizeDateGroupValue(mappedValue);
  if (!normalized) {
    return false;
  }

  for (const { element, part } of parts) {
    if (!element) {
      continue;
    }

    if (part === "month") {
      const monthValue = chooseMonthInputValue(element, normalized);
      if (monthValue) {
        await fillElement(element, monthValue);
      }
      continue;
    }

    if (part === "day" && normalized.day) {
      await fillElement(element, normalized.day);
      continue;
    }

    if (part === "year" && normalized.year) {
      await fillElement(element, normalized.year);
      continue;
    }

    if (part === "month_year" && normalized.year && normalized.month) {
      await fillElement(element, `${normalized.year}-${normalized.month}`);
      continue;
    }

    if (part === "full" && normalized.year) {
      const iso = `${normalized.year}-${normalized.month || "01"}-${normalized.day || "01"}`;
      await fillElement(element, iso);
    }
  }

  return true;
}

function findDateGroupParts(groupId) {
  const results = [];
  traverseOpenDom(document.body || document.documentElement, (node) => {
    if (node.getAttribute?.("data-ai-date-group") === groupId) {
      results.push({
        element: node,
        part: node.getAttribute("data-ai-date-part") || "full"
      });
    }
  });
  return results;
}

function normalizeDateGroupValue(value) {
  if (typeof value === "string") {
    return parseLooseDate(value);
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const year = String(value.year || "").match(/\d{4}/)?.[0] || "";
  const month =
    String(value.month || "").padStart(2, "0") ||
    String(monthNameToNumber(value.monthName) || "").padStart(2, "0");
  const day = String(value.day || "").padStart(2, "0");

  return {
    year: year || undefined,
    month: month && month !== "00" ? month : undefined,
    day: day && day !== "00" ? day : undefined,
    monthName: month && month !== "00" ? monthNumberToName(Number.parseInt(month, 10)) : undefined
  };
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
    const monthNumber = monthNameToNumber(dayMonthYearMatch[2]);
    return {
      year: dayMonthYearMatch[3],
      month: String(monthNumber).padStart(2, "0"),
      day: dayMonthYearMatch[1].padStart(2, "0"),
      monthName: monthNumberToName(monthNumber)
    };
  }

  const monthMatch = text.match(
    /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{4})/i
  );
  if (monthMatch) {
    const monthNumber = monthNameToNumber(monthMatch[1]);
    return {
      year: monthMatch[2],
      month: String(monthNumber).padStart(2, "0"),
      day: "01",
      monthName: monthNumberToName(monthNumber)
    };
  }

  const yearOnly = text.match(/\b(\d{4})\b/);
  if (yearOnly) {
    return { year: yearOnly[1] };
  }

  return null;
}

function chooseMonthInputValue(element, normalized) {
  if (!normalized.month && !normalized.monthName) {
    return "";
  }

  if (element.tagName === "SELECT") {
    const byValue = Array.from(element.options).find(
      (option) => normalizeText(option.value) === normalizeText(normalized.month)
    );
    if (byValue) {
      return byValue.value;
    }

    const byLabel = Array.from(element.options).find(
      (option) =>
        normalizeText(option.textContent) === normalizeText(normalized.monthName) ||
        normalizeText(option.textContent).startsWith(normalizeText(normalized.monthName || ""))
    );
    if (byLabel) {
      return byLabel.value;
    }
  }

  return normalized.monthName || normalized.month;
}

async function fillElement(element, mappedValue) {
  if (skipCurrentField || autofillAborted) {
    return false;
  }

  const type = detectFieldType(element);

  if (type === "checkbox" || type === "switch") {
    return fillCheckbox(element, mappedValue);
  }

  if (type === "select") {
    return fillSelect(element, mappedValue);
  }

  if (type === "combobox") {
    return fillCombobox(element, mappedValue);
  }

  if (type === "date_text") {
    return fillDateTextControl(element, mappedValue);
  }

  if (element.isContentEditable) {
    setContentEditableValue(element, String(mappedValue));
    markElementFilled(element);
    return true;
  }

  if (type === "date" || type === "month") {
    setNativeValue(element, String(mappedValue));
    dispatchFormEvents(element);
    markElementFilled(element);
    return true;
  }

  setNativeValue(element, String(mappedValue));
  dispatchFormEvents(element);
  markElementFilled(element);
  return true;
}

async function fillCheckbox(element, mappedValue) {
  const shouldCheck = ["true", "yes", "1"].includes(normalizeText(mappedValue)) || mappedValue === true;
  const isChecked = element.checked || element.getAttribute("aria-checked") === "true";
  if (shouldCheck !== isChecked) {
    await browserClickElement(element);
  }
  markElementFilled(element);
  return true;
}

function fillSelect(element, mappedValue) {
  const normalizedTarget = normalizeText(mappedValue);
  const option = Array.from(element.options).find(
    (candidate) =>
      normalizeText(candidate.value) === normalizedTarget ||
      normalizeText(candidate.textContent) === normalizedTarget ||
      normalizeText(candidate.textContent).includes(normalizedTarget)
  );

  if (!option) {
    return false;
  }

  setNativeValue(element, option.value);
  element.value = option.value;
  dispatchFormEvents(element);
  markElementFilled(element);
  return true;
}

async function fillDateTextControl(element, mappedValue) {
  const parsed = normalizeDateGroupValue(mappedValue);
  if (!parsed?.year) {
    setNativeValue(element, String(mappedValue));
    dispatchFormEvents(element);
    markElementFilled(element);
    return true;
  }

  const opened = await openInteractiveList(element);
  if (opened && findVisibleDatePicker()) {
    const selectedByPicker = await fillVisibleDatePicker(parsed);
    if (selectedByPicker) {
      markElementFilled(element);
      return true;
    }
  }

  const textValue = formatDateForVisibleText(parsed, element);
  setNativeValue(element, textValue);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: textValue, inputType: "insertText" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", code: "Enter" }));
  element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter", code: "Enter" }));
  safeBlur(element);
  markElementFilled(element);
  return true;
}

async function fillVisibleDatePicker(parsed) {
  const picker = findVisibleDatePicker();
  if (!picker) {
    return false;
  }

  const monthNumber = Number.parseInt(parsed.month || "1", 10);
  const dayNumber = Number.parseInt(parsed.day || "1", 10);

  const monthSelect = picker.querySelector(".react-datepicker__month-select, select[aria-label*='month' i], select[class*='month' i]");
  const yearSelect = picker.querySelector(".react-datepicker__year-select, select[aria-label*='year' i], select[class*='year' i]");

  if (monthSelect) {
    const monthIndex = String(Math.max(0, monthNumber - 1));
    await setSelectLikeUser(monthSelect, monthIndex);
    await sleep(140);
  }

  if (yearSelect) {
    await setSelectLikeUser(yearSelect, String(parsed.year));
    await sleep(160);
  }

  const day = findDatePickerDay(picker, dayNumber);
  if (!day) {
    return false;
  }

  await clickOptionLikeUser(day);
  await sleep(180);
  return true;
}

function findVisibleDatePicker() {
  return queryOpenDom(".react-datepicker, .ui-datepicker, [class*='datepicker'], [class*='calendar']").find((picker) =>
    isElementVisible(picker)
  );
}

function queryOpenDom(selector) {
  const matches = [];
  traverseOpenDom(document.body || document.documentElement, (node) => {
    if (node.matches?.(selector)) {
      matches.push(node);
    }
  });
  return matches;
}

async function setSelectLikeUser(select, desiredValue) {
  if (!select) {
    return false;
  }

  await browserClickElement(select);
  const desired = normalizeText(desiredValue);
  const option = Array.from(select.options || []).find(
    (candidate) =>
      normalizeText(candidate.value) === desired ||
      normalizeText(candidate.textContent) === desired ||
      normalizeText(candidate.textContent).startsWith(desired)
  );

  if (!option) {
    return false;
  }

  setNativeValue(select, option.value);
  select.value = option.value;
  dispatchValueEvents(select);
  await browserKey("Enter", "Enter");
  return true;
}

function findDatePickerDay(picker, dayNumber) {
  const dayText = String(dayNumber);
  const selector = [
    ".react-datepicker__day:not(.react-datepicker__day--outside-month):not(.react-datepicker__day--disabled)",
    ".ui-datepicker-calendar td:not(.ui-datepicker-other-month) a",
    "button:not([disabled])",
    "[role='gridcell']:not([aria-disabled='true'])"
  ].join(", ");

  return Array.from(picker.querySelectorAll(selector)).find((day) => normalizeText(day.textContent) === dayText);
}

function formatDateForVisibleText(parsed, element) {
  const sample = String(element.getAttribute("placeholder") || element.value || "").trim();
  const day = String(Number.parseInt(parsed.day || "1", 10)).padStart(2, "0");
  const month = parsed.month || "01";
  const shortMonth = monthNumberToName(Number.parseInt(month, 10)).slice(0, 3);

  if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(sample)) {
    return `${day}/${month}/${parsed.year}`;
  }
  if (/[A-Za-z]{3,}\s+\d{1,2},\s+\d{4}/.test(sample)) {
    return `${shortMonth} ${day}, ${parsed.year}`;
  }
  return `${day} ${shortMonth} ${parsed.year}`;
}

async function fillCombobox(element, mappedValue) {
  const targetText = String(mappedValue).trim();
  if (!targetText) {
    return false;
  }

  await openInteractiveList(element);

  const immediateOption = await waitForDropdownOption(targetText, 900);
  if (immediateOption) {
    await clickOptionLikeUser(immediateOption);
    markElementFilled(element);
    return true;
  }

  await browserTypeIntoElement(element, targetText);

  const option = await waitForDropdownOption(targetText, 4500);
  if (option) {
    await clickOptionLikeUser(option);
    await sleep(150);
    markElementFilled(element);
    return true;
  }

  if (await selectComboboxWithKeyboard(element, targetText)) {
    markElementFilled(element);
    return true;
  }

  setNativeValue(element, targetText);
  dispatchFormEvents(element);
  markElementFilled(element);
  return true;
}

async function openInteractiveList(element) {
  const targets = getClickableOpenTargets(element);
  for (const target of targets) {
    await browserClickElement(target);
    await sleep(180);
    if (collectDropdownOptions().length || document.querySelector(".react-datepicker, [role='listbox'], [class*='menu']")) {
      return true;
    }
  }

  safeFocus(element);
  await browserKey("ArrowDown", "ArrowDown");
  await sleep(180);
  return collectDropdownOptions().length > 0;
}

function getClickableOpenTargets(element) {
  const targets = [];
  const push = (candidate) => {
    if (candidate && !targets.includes(candidate) && isElementVisible(candidate)) {
      targets.push(candidate);
    }
  };

  push(element);
  push(element.closest("[role='combobox']"));
  push(element.closest(".react-select__control, [class*='__control'], .css-13cymwt-control, .css-t3ipsp-control, .css-16xfy0z-control"));
  push(element.closest(".react-datepicker-wrapper"));
  push(element.nextElementSibling?.tagName === "BUTTON" ? element.nextElementSibling : null);
  push(element.parentElement?.querySelector("button, [aria-hidden='true'], [class*='indicator']"));

  return targets;
}

async function waitForDropdownOption(targetText, timeoutMs) {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let settled = false;
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    const interval = setInterval(check, 180);

    function finish(result) {
      if (settled) {
        return;
      }
      settled = true;
      clearInterval(interval);
      observer.disconnect();
      resolve(result);
    }

    function check() {
      if (skipCurrentField || autofillAborted) {
        finish(null);
        return;
      }

      const options = collectDropdownOptions();
      const match = scoreBestOption(options, targetText);
      if (match) {
        finish(match);
        return;
      }

      advanceDropdownScroll();
      nudgeDropdownWithBrowserWheel();

      if (Date.now() - startedAt > timeoutMs) {
        finish(null);
      }
    }

    check();
  });
}

function collectDropdownOptions() {
  const options = [];
  traverseOpenDom(document.body || document.documentElement, (node) => {
    if (!node.matches || !node.matches(OPTION_SELECTORS)) {
      return;
    }

    if (!isElementVisible(node)) {
      return;
    }

    options.push(node);
  });
  return options;
}

function advanceDropdownScroll() {
  const scrollHosts = queryOpenDom(
    [
      '[role="listbox"]',
      '[class*="menu"]',
      '[class*="MenuList"]',
      '.select2-results__options',
      '.react-datepicker__month-dropdown',
      '.react-datepicker__year-dropdown'
    ].join(", ")
  ).filter((node) => {
    const style = window.getComputedStyle(node);
    return /(auto|scroll)/.test(`${style.overflowY} ${style.overflow}`) || node.scrollHeight > node.clientHeight;
  });

  scrollHosts.forEach((host) => {
    host.scrollTop = Math.min(host.scrollTop + Math.max(80, host.clientHeight * 0.65), host.scrollHeight);
  });
}

let lastBrowserWheelAt = 0;

function nudgeDropdownWithBrowserWheel() {
  if (Date.now() - lastBrowserWheelAt < 420) {
    return;
  }

  const host = queryOpenDom(
    [
      '[role="listbox"]',
      '[class*="menu"]',
      '[class*="MenuList"]',
      '.select2-results__options',
      '.react-datepicker__month-dropdown',
      '.react-datepicker__year-dropdown'
    ].join(", ")
  ).find((node) => isElementVisible(node));

  if (!host) {
    return;
  }

  lastBrowserWheelAt = Date.now();
  browserWheelElement(host, 220).catch((error) => {
    console.debug("[Autofill] Browser wheel fallback skipped.", error);
  });
}

function scoreBestOption(options, targetText) {
  const normalizedTarget = normalizeText(targetText);
  let bestScore = 0;
  let bestOption = null;

  options.forEach((option) => {
    const text = normalizeText(option.textContent || option.innerText || "");
    if (!text) {
      return;
    }

    let score = 0;
    if (text === normalizedTarget) {
      score = 100;
    } else if (text.startsWith(normalizedTarget)) {
      score = 92;
    } else if (text.includes(normalizedTarget)) {
      score = 84 - Math.abs(text.length - normalizedTarget.length);
    } else {
      const words = normalizedTarget.split(/\s+/).filter(Boolean);
      const matches = words.filter((word) => text.includes(word)).length;
      if (matches) {
        score = matches * 10;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestOption = option;
    }
  });

  return bestScore >= 20 ? bestOption : null;
}

async function clickOptionLikeUser(option) {
  option.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  await sleep(60);
  await browserClickElement(option);
  await sleep(80);
}

async function selectComboboxWithKeyboard(element, targetText) {
  element.focus?.();
  await browserTypeIntoElement(element, targetText);
  await sleep(180);
  await browserKey("ArrowDown", "ArrowDown");
  await sleep(80);
  await browserKey("Enter", "Enter");
  await sleep(180);

  const valueText = normalizeText(element.value || element.closest("[class*='container']")?.textContent || "");
  return valueText.includes(normalizeText(targetText));
}

async function browserTypeIntoElement(element, text) {
  const clicked = await browserClickElement(element);
  await sleep(80);

  if (clicked && await sendBrowserInput({ op: "typeText", text })) {
    await sleep(120);
    return true;
  }

  typeIntoElement(element, text);
  return false;
}

async function browserClickElement(element) {
  if (!element || !isElementVisible(element)) {
    return false;
  }

  element.scrollIntoView?.({ block: "center", inline: "center" });
  await sleep(80);

  const point = getBrowserClickPoint(element);
  if (!point) {
    simulateClick(element);
    return false;
  }

  const ok = await sendBrowserInput({ op: "click", x: point.x, y: point.y });
  if (!ok) {
    simulateClick(element);
  }
  return ok;
}

async function browserWheelElement(element, deltaY) {
  if (!element || !isElementVisible(element)) {
    return false;
  }

  const point = getBrowserClickPoint(element);
  if (!point) {
    return false;
  }

  return sendBrowserInput({ op: "wheel", x: point.x, y: point.y, deltaY });
}

async function browserKey(key, code) {
  const ok = await sendBrowserInput({ op: "key", key, code });
  if (!ok) {
    const active = document.activeElement;
    active?.dispatchEvent?.(new KeyboardEvent("keydown", { bubbles: true, key, code }));
    active?.dispatchEvent?.(new KeyboardEvent("keyup", { bubbles: true, key, code }));
  }
  return ok;
}

function getBrowserClickPoint(element) {
  let rect = element.getBoundingClientRect();
  let x = rect.left + rect.width / 2;
  let y = rect.top + rect.height / 2;

  try {
    let currentWindow = window;
    while (currentWindow !== currentWindow.top) {
      const frame = currentWindow.frameElement;
      if (!frame) {
        break;
      }
      const frameRect = frame.getBoundingClientRect();
      x += frameRect.left;
      y += frameRect.top;
      currentWindow = currentWindow.parent;
    }
  } catch (error) {
    console.warn("[Autofill] Could not adjust frame coordinates for browser click.", error);
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const viewport = getBrowserViewportSize();
  return {
    x: Math.max(1, Math.min(viewport.width - 1, x)),
    y: Math.max(1, Math.min(viewport.height - 1, y))
  };
}

function getBrowserViewportSize() {
  try {
    return {
      width: Math.max(2, Number(window.top.innerWidth) || window.innerWidth || 2),
      height: Math.max(2, Number(window.top.innerHeight) || window.innerHeight || 2)
    };
  } catch (error) {
    return {
      width: Math.max(2, window.innerWidth || 2),
      height: Math.max(2, window.innerHeight || 2)
    };
  }
}

async function sendBrowserInput(payload) {
  try {
    const response = await sendRuntimeRequest({ action: "BROWSER_INPUT", ...payload });
    return Boolean(response?.ok);
  } catch (error) {
    console.warn("[Autofill] Browser-level input unavailable, falling back to DOM events.", error);
    return false;
  }
}

function typeIntoElement(element, text) {
  safeFocus(element);
  setNativeValue(element, "");
  dispatchFormEvents(element, { includeChange: false });

  setNativeValue(element, text);
  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      data: text,
      inputType: "insertText"
    })
  );
  element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
  element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "ArrowDown" }));
}

function setNativeValue(element, value) {
  if (!element) {
    return false;
  }

  const nextValue = String(value ?? "");
  const descriptor = findValueSetterDescriptor(element);

  if (descriptor?.set) {
    try {
      descriptor.set.call(element, nextValue);
      return true;
    } catch (error) {
      console.debug("[Autofill] Native value setter rejected this element; falling back.", error);
    }
  }

  try {
    if ("value" in element) {
      element.value = nextValue;
      return true;
    }
  } catch (error) {
    console.debug("[Autofill] Direct value assignment rejected this element; falling back.", error);
  }

  try {
    element.setAttribute?.("value", nextValue);
    return true;
  } catch (error) {
    console.warn("[Autofill] Could not set value for element.", error);
    return false;
  }
}

function findValueSetterDescriptor(element) {
  let prototype = Object.getPrototypeOf(element);
  while (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor?.set) {
      return descriptor;
    }
    prototype = Object.getPrototypeOf(prototype);
  }
  return null;
}

function setContentEditableValue(element, value) {
  safeFocus(element);
  element.textContent = value;
  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  safeBlur(element);
}

function dispatchFormEvents(element, options = {}) {
  const { includeChange = true } = options;
  safeFocus(element);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  if (includeChange) {
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
  element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
  element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Tab" }));
  safeBlur(element);
  element.dispatchEvent(new Event("blur", { bubbles: true }));
}

function dispatchValueEvents(element) {
  safeFocus(element);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function safeFocus(element) {
  try {
    element?.focus?.({ preventScroll: true });
  } catch (error) {
    try {
      element?.focus?.();
    } catch (_) {
      // Some custom elements expose borrowed native methods that throw Illegal invocation.
    }
  }
}

function safeBlur(element) {
  try {
    element?.blur?.();
  } catch (_) {
    // Keep autofill moving if a framework proxies blur incorrectly.
  }
}

function simulateClick(element) {
  if (!element) {
    return;
  }

  element.focus?.();
  const pointerInit = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true };
  const mouseInit = { bubbles: true, cancelable: true, view: window };

  if (window.PointerEvent) {
    element.dispatchEvent(new PointerEvent("pointerover", pointerInit));
    element.dispatchEvent(new PointerEvent("pointerenter", pointerInit));
    element.dispatchEvent(new PointerEvent("pointerdown", pointerInit));
  }

  element.dispatchEvent(new MouseEvent("mouseover", mouseInit));
  element.dispatchEvent(new MouseEvent("mousemove", mouseInit));
  element.dispatchEvent(new MouseEvent("mousedown", mouseInit));
  element.dispatchEvent(new MouseEvent("mouseup", mouseInit));

  if (window.PointerEvent) {
    element.dispatchEvent(new PointerEvent("pointerup", pointerInit));
  }

  element.dispatchEvent(new MouseEvent("click", mouseInit));
}

function markElementFilled(element) {
  element.setAttribute("data-ai-filled", "true");

  if (currentSettings.highlight) {
    const originalOutline = element.style.outline;
    const originalBoxShadow = element.style.boxShadow;
    element.style.outline = "2px solid rgba(16, 185, 129, 0.9)";
    element.style.boxShadow = "0 0 0 3px rgba(16, 185, 129, 0.18)";
    setTimeout(() => {
      element.style.outline = originalOutline;
      element.style.boxShadow = originalBoxShadow;
    }, 2200);
  }
}

function clearAiMarkers() {
  traverseOpenDom(document.body || document.documentElement, (node) => {
    if (!node.removeAttribute) {
      return;
    }

    [
      "data-ai-filled",
      "data-ai-id",
      "data-ai-radio-name",
      "data-ai-date-group",
      "data-ai-date-part"
    ].forEach((attribute) => node.removeAttribute(attribute));
  });
}

function findElementByAiId(fieldId) {
  let found = null;
  traverseOpenDom(document.body || document.documentElement, (node) => {
    if (!found && node.getAttribute?.("data-ai-id") === fieldId) {
      found = node;
    }
  });
  return found;
}

function findRadiosByGroup(groupName) {
  const radios = [];
  traverseOpenDom(document.body || document.documentElement, (node) => {
    if (node.getAttribute?.("data-ai-radio-name") === groupName) {
      radios.push(node);
    }
  });
  return radios;
}

async function triggerExpansionButton(fieldId, times) {
  const button = findElementByAiId(fieldId);
  if (!button) {
    return false;
  }

  const clickTimes = Math.max(0, Number.parseInt(times, 10) || 0);
  for (let index = 0; index < clickTimes; index += 1) {
    if (autofillAborted) {
      break;
    }
    await browserClickElement(button);
    await sleep(280);
  }

  return clickTimes > 0;
}

function decorateFileInputs(profile) {
  const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));

  fileInputs.forEach((input) => {
    if (input.dataset.aiFilePrompt === "true" || !isElementVisible(input)) {
      return;
    }

    input.dataset.aiFilePrompt = "true";
    const label = resolveFieldLabel(input);
    const context = resolveFieldContext(input);
    const fileKind = inferFileKind(label, context);
    const asset = resolveProfileAsset(profile, fileKind);

    const prompt = document.createElement("div");
    prompt.className = "ai-file-prompt";
    prompt.style.marginTop = "8px";
    prompt.style.display = "flex";
    prompt.style.alignItems = "center";
    prompt.style.gap = "10px";
    prompt.style.padding = "10px 12px";
    prompt.style.border = "1px solid rgba(59, 130, 246, 0.35)";
    prompt.style.borderRadius = "10px";
    prompt.style.background = "rgba(15, 23, 42, 0.92)";
    prompt.style.color = "#e2e8f0";
    prompt.style.fontSize = "12px";
    prompt.style.boxShadow = "0 10px 24px rgba(15, 23, 42, 0.24)";

    const text = document.createElement("span");
    text.textContent =
      asset
        ? `Click to download your default ${fileKind === "cover_letter" ? "cover letter" : "resume"} for this field.`
        : `Add a downloadable ${fileKind === "cover_letter" ? "cover letter" : "resume"} URL or text asset to your profile to use one-click download here.`;

    prompt.appendChild(text);

    if (asset) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = fileKind === "cover_letter" ? "Download Cover Letter" : "Download Resume";
      button.style.border = "none";
      button.style.borderRadius = "999px";
      button.style.padding = "8px 12px";
      button.style.cursor = "pointer";
      button.style.fontWeight = "600";
      button.style.background = "#38bdf8";
      button.style.color = "#082f49";
      button.addEventListener("click", () => downloadProfileAsset(asset));
      prompt.appendChild(button);
    }

    input.insertAdjacentElement("afterend", prompt);
  });
}

function inferFileKind(label, context) {
  const haystack = normalizeText([label, ...(context || [])].join(" "));
  if (haystack.includes("cover")) {
    return "cover_letter";
  }
  return "resume";
}

function resolveProfileAsset(profile, kind) {
  const candidates =
    kind === "cover_letter"
      ? [
          profile?.additional_information?.cover_letter_file,
          profile?.additional_information?.cover_letter_url,
          profile?.documents?.cover_letter,
          profile?.documents?.coverLetter,
          profile?.additional_information?.cover_letter
        ]
      : [
          profile?.additional_information?.resume_cv,
          profile?.additional_information?.resume_url,
          profile?.documents?.resume,
          profile?.documents?.resumeUrl,
          profile?.resume,
          profile?.resume_url
        ];

  return candidates.find(Boolean) || null;
}

function downloadProfileAsset(asset) {
  if (!asset) {
    return;
  }

  if (typeof asset === "string") {
    if (/^https?:\/\//i.test(asset) || asset.startsWith("data:")) {
      const link = document.createElement("a");
      link.href = asset;
      link.download = inferDownloadName(asset);
      link.target = "_blank";
      link.click();
      return;
    }

    const blob = new Blob([asset], { type: "text/plain;charset=utf-8" });
    triggerBlobDownload(blob, "resume.txt");
    return;
  }

  if (typeof asset === "object") {
    if (asset.url) {
      const link = document.createElement("a");
      link.href = asset.url;
      link.download = asset.name || inferDownloadName(asset.url);
      link.target = "_blank";
      link.click();
      return;
    }

    if (asset.content) {
      const blob = new Blob([asset.content], { type: asset.mimeType || "application/octet-stream" });
      triggerBlobDownload(blob, asset.name || "document.txt");
    }
  }
}

function triggerBlobDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function inferDownloadName(value) {
  const urlBits = String(value || "").split("/");
  return urlBits[urlBits.length - 1] || "document";
}

function countRequiredGaps() {
  const requiredElements = collectInteractiveElements().filter((element) => isRequiredField(element));
  let gaps = 0;
  const radioGroups = new Set();

  requiredElements.forEach((element) => {
    if (!isElementVisible(element)) {
      return;
    }

    if (element.type === "radio") {
      const group = element.name || element.getAttribute("data-ai-radio-name") || element.id;
      if (!radioGroups.has(group)) {
        radioGroups.add(group);
        const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(element.name)}"]`);
        const checked = Array.from(radios).some((radio) => radio.checked);
        if (!checked) {
          gaps += 1;
        }
      }
      return;
    }

    if (element.type === "checkbox") {
      if (!element.checked) {
        gaps += 1;
      }
      return;
    }

    if (element.type === "file") {
      return;
    }

    if (element.tagName === "SELECT") {
      if (!String(element.value || "").trim()) {
        gaps += 1;
      }
      return;
    }

    if (!String(element.value || element.textContent || "").trim()) {
      gaps += 1;
    }
  });

  return gaps;
}

async function maybeAutoContinue() {
  if (!isTopFrame) {
    return false;
  }

  const remaining = countRequiredGaps();
  if (remaining > 0) {
    emitProgress(`Auto-Continue skipped: ${remaining} required field(s) still empty.`, "log-error");
    await clearPendingAutoContinue();
    return false;
  }

  const nextButton = findNextButton();
  if (!nextButton) {
    await clearPendingAutoContinue();
    return false;
  }

  emitProgress("Auto-Continue clicked Next.", "log-success");
  await writeFlowCheckpoint({
    active: true,
    origin: location.origin,
    lastUrl: location.href,
    updatedAt: Date.now(),
    settings: currentSettings
  });
  await browserClickElement(nextButton);
  return true;
}

function findNextButton() {
  const candidates = Array.from(
    document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]')
  ).filter((element) => isElementVisible(element));

  return candidates.find((element) => {
    const text = normalizeText(element.textContent || element.value || element.getAttribute("aria-label") || "");
    if (!text) {
      return false;
    }

    const looksNext = /(next|continue|review|save and continue|proceed)/.test(text);
    const looksFinalSubmit = /(submit|apply now|finish application|done)/.test(text);
    return looksNext && !looksFinalSubmit;
  });
}

async function maybeResumePendingAutofill() {
  const localData = await storageGet(chrome.storage.local, [
    "pendingAutofill",
    "settingAutoskip",
    "settingHighlight",
    "settingAutoContinue"
  ]);
  const sessionData = await storageGet(sessionStorageArea, ["autoContinueState"]);

  if (localData.pendingAutofill) {
    await storageRemove(chrome.storage.local, ["pendingAutofill"]);
    await startMasterAutofill({
      autoskip: localData.settingAutoskip,
      highlight: localData.settingHighlight,
      autoContinue: localData.settingAutoContinue
    });
    return;
  }

  const state = sessionData.autoContinueState;
  if (
    state?.active &&
    state.origin === location.origin &&
    state.lastUrl !== location.href &&
    Date.now() - (state.updatedAt || 0) < 30 * 60 * 1000
  ) {
    emitProgress("Detected multi-step application. Resuming autofill...");
    await writeFlowCheckpoint({
      ...state,
      lastUrl: location.href,
      updatedAt: Date.now()
    });
    await startMasterAutofill(state.settings || {});
  }
}

async function recordApplicationStep(filledCount, requiredRemaining) {
  const { applicationFlowHistory } = await storageGet(sessionStorageArea, ["applicationFlowHistory"]);
  const history = Array.isArray(applicationFlowHistory) ? applicationFlowHistory : [];
  history.push({
    origin: location.origin,
    url: location.href,
    title: document.title,
    filledCount,
    requiredRemaining,
    timestamp: Date.now()
  });

  while (history.length > 20) {
    history.shift();
  }

  await storageSet(sessionStorageArea, { applicationFlowHistory: history });
}

async function writeFlowCheckpoint(state) {
  await storageSet(sessionStorageArea, { autoContinueState: state });
}

async function clearPendingAutoContinue() {
  await storageSet(sessionStorageArea, {
    autoContinueState: {
      active: false,
      origin: location.origin,
      lastUrl: location.href,
      updatedAt: Date.now(),
      settings: currentSettings
    }
  });
}

async function loadSettings(override = {}) {
  const stored = await storageGet(chrome.storage.local, [
    "settingAutoskip",
    "settingHighlight",
    "settingAutoContinue"
  ]);

  return {
    autoskip: override.autoskip ?? stored.settingAutoskip ?? true,
    highlight: override.highlight ?? stored.settingHighlight ?? true,
    autoContinue: override.autoContinue ?? stored.settingAutoContinue ?? false
  };
}

async function loadProfile() {
  const stored = await storageGet(chrome.storage.local, ["userProfile"]);
  let profile = {};
  try {
    profile = stored.userProfile ? JSON.parse(stored.userProfile) : {};
  } catch (error) {
    console.warn("[Autofill] Failed to parse user profile.", error);
  }
  return { profile };
}

function emitProgress(log, statusClass = "", pct, framePath = "top") {
  const prefix = framePath && framePath !== "top" ? `[${framePath}] ` : "";
  emitRuntimeMessage({
    action: "UPDATE_PROGRESS",
    log: `${prefix}${log}`,
    statusClass,
    pct
  });
}

function emitRuntimeMessage(payload) {
  try {
    chrome.runtime.sendMessage(payload, () => {
      void chrome.runtime.lastError;
    });
  } catch (error) {
    console.warn("[Autofill] Failed to send runtime message:", error);
  }
}

function sendRuntimeRequest(payload) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(payload, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(response);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function storageGet(area, keys) {
  return new Promise((resolve) => area.get(keys, resolve));
}

function storageSet(area, values) {
  return new Promise((resolve) => area.set(values, resolve));
}

function storageRemove(area, keys) {
  return new Promise((resolve) => area.remove(keys, resolve));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeToken(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || "field";
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function truncateText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function monthNameToNumber(value) {
  const months = [
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
  const normalized = normalizeText(value);
  const index = months.findIndex(
    (month) => month === normalized || month.startsWith(normalized.slice(0, 3))
  );
  return index >= 0 ? index + 1 : null;
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
  ][value] || "";
}
