// Advanced script to bypass React/Angular UI protections and map complex inputs

// Global abort flag for stopping autofill mid-run
let autofillAborted = false;
let skipCurrentField = false;
let currentSettings = { autoskip: true, highlight: true };
let isAutofilling = false;

// Emulates human interaction to safely fill inputs and comboboxes
async function triggerReactChange(element, value) {
    const isDropdown = element.tagName === 'SELECT' || 
                       element.getAttribute('role') === 'combobox' || 
                       element.getAttribute('aria-haspopup') || 
                       (element.nextElementSibling && element.nextElementSibling.tagName === 'BUTTON');

    if (isDropdown) {
        // Dropdown Workflow: Open -> Wait/Read from Server -> Select -> Collapse
        element.focus();
        
        // Only click ONE element to expand. If we click both the input and the sibling chevron button, it opens and instantly closes!
        if (element.nextElementSibling && element.nextElementSibling.tagName === 'BUTTON') {
            simulateClick(element.nextElementSibling);
        } else {
            simulateClick(element);
        }

        // Give framework time to fetch & open the dropdown
        for (let i=0; i<2; i++) {
             if (skipCurrentField || autofillAborted) return;
             await new Promise(r => setTimeout(r, 100));
        }

        let optionClicked = clickDropdownOption(value);
        
        if (!optionClicked) {
            // Options might still be fetching from server, poll for a bit
            optionClicked = await pollForDropdownOption(value, 3000);
        }

        if (!optionClicked) {
            console.warn('Could not find dropdown option matching: ', value, ' collapsing dropdown.');
            // Collapse it back since we didn't find anything
            if (element.nextElementSibling && element.nextElementSibling.tagName === 'BUTTON') {
                simulateClick(element.nextElementSibling);
            } else {
                simulateClick(element);
            }
        } else {
            await new Promise(r => setTimeout(r, 200)); // wait for click to register
        }

        element.dispatchEvent(new Event('blur', { bubbles: true }));

    } else {
        // Standard Input Workflow: Just paste the proper answer!
        simulateKeystrokes(element, value);
    }
}

// Add this helper function to content.js
function simulateKeystrokes(element, text) {
    element.focus();
    
    // React 16+ value setter override
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;

    if (element.tagName === 'TEXTAREA') {
        if (nativeTextAreaValueSetter) nativeTextAreaValueSetter.call(element, text);
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
            '[role="option"], li[role="option"], [data-automation-id="promptOption"], .select2-results__option, .fd-list__item'
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
    
    console.warn(`[Autofill]   ✗ No matching option found for: "${fullValue.substring(0, 50)}"`);
    return false;
}

// Helper to safely convert strings to regex patterns
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clickDropdownOption(value) {
    if (!value || value.toString().length < 1) return false;
    const lowerValueStr = value.toString().toLowerCase().trim();
    
    // Broadened selector to catch more custom dropdowns
    let items = Array.from(document.querySelectorAll(
        '[role="option"], li[role="option"], [data-automation-id="promptOption"], .fd-list__item, .sapMSelectListItem, .select2-results__option'
    ));
    
    let bestMatch = null;
    let bestScore = -1;

    // Word boundary regex: matches "India" but NOT "Indian" or "Indiana"
    const exactWordRegex = new RegExp(`\\b${escapeRegExp(lowerValueStr)}\\b`);

    for (let item of items) {
        let text = item.innerText ? item.innerText.trim().toLowerCase() : '';
        if (text.length < 2 || text === 'no selection') continue;

        let currentScore = 0;

        // 1. EXACT MATCH (Score: 100) - Instant Return
        if (text === lowerValueStr) {
            simulateClick(item);
            return true;
        }
        
        // 2. STARTS WITH EXACT WORD (Score: 90)
        // Matches: "India (Republic of)"
        else if (text.startsWith(lowerValueStr) && exactWordRegex.test(text)) {
            currentScore = 90;
        }
        
        // 3. CONTAINS EXACT WORD ANYWHERE (Score: 80)
        // Matches: "Republic of India"
        else if (exactWordRegex.test(text)) {
            currentScore = 80;
        }
        
        // 4. STARTS WITH SUBSTRING (Score: 70)
        // Matches: "Indiana" (if search is "India")
        else if (text.startsWith(lowerValueStr)) {
            currentScore = 70;
        }
        
        // 5. INCLUDES SUBSTRING (Score: < 60)
        // Matches: "British Indian Ocean Territory"
        // We subtract the length difference so closer matches win.
        // "India" (5) vs "British Indian Ocean Territory" (32) = huge penalty!
        else if (text.includes(lowerValueStr)) {
            currentScore = 60 - (text.length - lowerValueStr.length);
        }

        // 6. FUZZY MATCH (Multiple words) (Score: < 50)
        else {
            const valueWords = lowerValueStr.split(/\s+/).filter(w => w.length > 2);
            if (valueWords.length > 1) {
                const matchCount = valueWords.filter(w => text.includes(w)).length;
                const scorePercentage = matchCount / valueWords.length;
                if (scorePercentage > 0.5) {
                    currentScore = 40 + (scorePercentage * 10); // Max 50
                }
            }
        }

        // Keep track of the highest scoring item
        if (currentScore > bestScore) {
            bestScore = currentScore;
            bestMatch = item;
        }
    }

    // After evaluating ALL items, click the one with the highest score
    if (bestMatch && bestScore > 0) {
        console.log(`[Autofill] Selected "${bestMatch.innerText.trim()}" with score: ${bestScore}`);
        
        // Ensure it is in view before clicking (fixes bugs in virtualized lists)
        if (bestMatch.scrollIntoView) bestMatch.scrollIntoView({ block: 'nearest' });
        
        simulateClick(bestMatch);
        return true;
    }
    
    return false;
}

// Scrape fields with high token efficiency
function extractFormSchema() {
    // Collect inputs even if they are inside Web Components' Shadow DOMs
    function getAllInputs(rootElement) {
        const result = [];
        const selector = 'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not(:disabled):not([readonly]), ' +
                         'select:not(:disabled), textarea:not(:disabled):not([readonly]), ' +
                         'button:not(:disabled), [role="button"]:not(:disabled), ' +
                         '[role="checkbox"], [role="radio"], [role="combobox"], [role="listbox"], [role="switch"]';
        
        function traverse(node) {
            // Check current node
            if (node.matches && node.matches(selector)) {
                result.push(node);
            }
            // Traverse shadow root
            if (node.shadowRoot) {
                Array.from(node.shadowRoot.children).forEach(traverse);
            }
            // Traverse child nodes
            Array.from(node.children).forEach(traverse);
        }
        
        traverse(rootElement);
        return result;
    }

    const inputs = getAllInputs(document.body);
    let fields = [];
    let radioGroups = {};
    
    inputs.forEach((el, index) => {
        // Skip elements we already filled in previous passes
        if (el.getAttribute('data-ai-filled') === 'true') return;

        // Auto-skip filled fields if setting is enabled
        if (currentSettings.autoskip) {
            let hasValue = false;
            if (el.tagName === 'SELECT') {
                if (el.value && el.value.trim() !== '' && el.selectedIndex > 0) hasValue = true;
            } else if (el.type === 'checkbox' || el.type === 'radio') {
                // Ignore for radios and checkboxes to let AI decide
            } else if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.type === 'button') {
                // Don't skip buttons
            } else {
                if (el.value && el.value.trim() !== '') hasValue = true;
            }
            if (hasValue) return;
        }

        // Skip visually hidden elements
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || el.opacity === '0') return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0 && el.type !== 'radio') return;

        // Try to get the semantic label smartly
        let labelText = el.getAttribute('aria-label') || el.placeholder || '';
        
        if (!labelText && el.id) {
            const labelEl = document.querySelector(`label[for="${el.id}"]`);
            if (labelEl) labelText = labelEl.innerText;
        }
        
        if (!labelText && el.getAttribute('aria-labelledby')) {
            const labelEl = document.getElementById(el.getAttribute('aria-labelledby'));
            if (labelEl) labelText = labelEl.innerText;
        }

        // Advanced Fallback: Traversal up and left to find the closest <label>
        if (!labelText) {
            let current = el;
            while (current && current !== document.body && !labelText) {
                // Check if there is a wrapper label
                if (current.tagName === 'LABEL' && current.innerText.trim()) {
                    labelText = current.innerText;
                    break;
                }
                
                // Check preceding siblings
                let prev = current.previousElementSibling;
                while (prev && !labelText) {
                    if (prev.tagName === 'LABEL' && prev.innerText.trim()) {
                        labelText = prev.innerText;
                    } else {
                        // Look for a label inside the previous sibling
                        let nestedLabel = prev.querySelector('label');
                        if (nestedLabel && nestedLabel.innerText.trim()) {
                            labelText = nestedLabel.innerText;
                        } else if (prev.classList && prev.classList.contains('fd-form-label')) {
                            // SAP specific label class fallback
                            labelText = prev.innerText;
                        }
                    }
                    prev = prev.previousElementSibling;
                }

                current = current.parentElement;
            }
        }

        // Final fallback to name attribute
        if (!labelText) {
            labelText = el.name || '';
        }

        // Minify label text to save tokens
        labelText = (labelText || '').replace(/\s+/g, ' ').trim().substring(0, 60);
        
        if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.type === 'button') {
            const btnText = (el.textContent || labelText || '').toLowerCase().trim();
            const autoId = el.getAttribute('data-automation-id') || '';
            // Only collect buttons that look like they expand form sections
            if (btnText.includes('add') || autoId === 'add-button' || autoId === 'addMore') {
                // Find the parent section heading for context
                let sectionName = '';
                let parent = el.parentElement;
                for (let depth = 0; depth < 15 && parent; depth++) {
                    const heading = parent.querySelector('h2, h3, h4');
                    if (heading) {
                        sectionName = heading.textContent.trim().substring(0, 50);
                        break;
                    }
                    parent = parent.parentElement;
                }

                let uniqueId = el.id || `btn_add_${index}`;
                uniqueId = `ai_btn_${index}_${uniqueId}`.replace(/[^a-zA-Z0-9_]/g, '_');
                el.setAttribute('data-ai-id', uniqueId);
                fields.push({
                    id: uniqueId,
                    t: 'button',
                    l: `Add Button for section: "${sectionName || 'Unknown'}" (click to add another entry)`
                });
            }
            return;
        }

        if (el.type === 'radio') {
            const name = el.name || `unnamed_radio_${index}`;
            if (!radioGroups[name]) radioGroups[name] = { n: name, o: [] };
            
            el.setAttribute('data-ai-radio-name', name);

            let optVal = el.value || el.id || '';
            let optLabel = labelText || optVal;
            // Compact mapping for radio: value:Label
            radioGroups[name].o.push(`${optVal}:${optLabel}`);
            return;
        }

        let uniqueId = el.name || el.id || `field_${index}`;
        uniqueId = `ai_${index}_${uniqueId}`.replace(/[^a-zA-Z0-9_]/g, '_');
        el.setAttribute('data-ai-id', uniqueId);

        let isCombobox = false;
        if (el.getAttribute('role') === 'combobox' || el.hasAttribute('aria-haspopup') || (el.className && el.className.toString().toLowerCase().includes('combo'))) {
            isCombobox = true;
        }

        let fieldData = {
            id: uniqueId,
            t: el.type || el.tagName.toLowerCase(),
            l: labelText + (isCombobox ? ' (Combobox)' : '')
        };

        if (el.tagName === 'SELECT') {
            // Compress options to string: "value1:Label1|value2:Label2"
            let optionsStr = Array.from(el.options)
                .filter(o => o.value && o.value.trim() !== '' && !o.disabled)
                .map(o => `${o.value}:${o.innerText.trim().substring(0, 30)}`)
                .join('|');
            
            // Limit massive dropdowns to save context length
            if (optionsStr.length > 800) optionsStr = optionsStr.substring(0, 800) + '...';
            
            fieldData.o = optionsStr;
        }

        fields.push(fieldData);
    });

    // Append collected radio groups
    Object.values(radioGroups).forEach(rg => {
        fields.push({
            id: rg.n,
            t: 'radio',
            o: rg.o.join('|')
        });
    });

    return fields;
}

// Process the AI's response and inject it into the DOM
async function injectDataIntoForm(aiMapping) {
    let filledCount = 0;

    function findElementByAiId(rootNode, aiId) {
        if (rootNode.getAttribute && rootNode.getAttribute('data-ai-id') === aiId) return rootNode;
        let found = null;
        if (rootNode.shadowRoot) {
            for (const child of rootNode.shadowRoot.children) {
                found = findElementByAiId(child, aiId);
                if (found) return found;
            }
        }
        for (const child of rootNode.children) {
            found = findElementByAiId(child, aiId);
            if (found) return found;
        }
        return null;
    }
    
    function findRadiosByAiName(rootNode, name) {
        let results = [];
        if (rootNode.getAttribute && rootNode.getAttribute('data-ai-radio-name') === name) results.push(rootNode);
        if (rootNode.shadowRoot) {
            for (const child of rootNode.shadowRoot.children) {
                results.push(...findRadiosByAiName(child, name));
            }
        }
        for (const child of rootNode.children) {
            results.push(...findRadiosByAiName(child, name));
        }
        return results;
    }
    
    const mappingEntries = Object.entries(aiMapping);
    const totalFields = mappingEntries.length;
    let currentFieldIdx = 0;

    for (const [key, mappedValue] of mappingEntries) {
        if (autofillAborted) break;
        skipCurrentField = false;
        currentFieldIdx++;
        const pct = Math.min(100, (currentFieldIdx / totalFields) * 100);
        
        if (mappedValue === null || mappedValue === undefined || mappedValue === "") continue;

        let el = findElementByAiId(document.body, key);
        let fieldName = el ? (el.getAttribute('aria-label') || el.name || el.placeholder || key) : key;
        
        chrome.runtime.sendMessage({ action: "UPDATE_PROGRESS", log: `Filling: ${fieldName.substring(0, 30)}`, pct: pct });

        if (!el) {
            // Check if it's a radio group
            const radios = findRadiosByAiName(document.body, key);
            if (radios.length > 0) {
                 const targetRadio = radios.find(r => r.value === mappedValue || r.id === mappedValue);
                 if (targetRadio && !targetRadio.checked) {
                     targetRadio.click();
                     filledCount++;
                 }
                 radios.forEach(r => r.setAttribute('data-ai-filled', 'true'));
            }
            continue;
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
                let targetOption = Array.from(el.options).find(opt => opt.value === mappedValue);
                if (targetOption) {
                    await triggerReactChange(el, targetOption.value);
                    filledCount++;
                } else {
                    // Fallback to fuzzy text match if AI hallucinates value
                    let fallbackOpt = Array.from(el.options).find(opt => opt.innerText.toLowerCase().includes(mappedValue.toString().toLowerCase()));
                    if (fallbackOpt) {
                         await triggerReactChange(el, fallbackOpt.value);
                         filledCount++;
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
    
    return filledCount;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "CHECK_STATUS") {
        sendResponse({ isRunning: isAutofilling });
        return true;
    }

    if (request.action === "SKIP_CURRENT_FIELD") {
        skipCurrentField = true;
        console.log('[Job Autofill Agent] ⏭️ Skip signal received.');
        return;
    }

    if (request.action === "STOP_AUTOFILL") {
        autofillAborted = true;
        skipCurrentField = true;
        console.log('[Job Autofill Agent] ⛔ Abort signal received.');
        return;
    }

    if (request.action === "START_AUTOFILL") {
        if (request.settings) {
            currentSettings.autoskip = request.settings.autoskip !== undefined ? request.settings.autoskip : true;
            currentSettings.highlight = request.settings.highlight !== undefined ? request.settings.highlight : true;
        }

        // Reset all abort/skip flags for a clean run
        autofillAborted = false;
        skipCurrentField = false;

        // --- KEY FIX: Strip all previous ai-filled markers so every field is treated as fresh ---
        // This is critical for "re-run after refresh" — without this, autoskip silently skips
        // browser-restored values and the waterfall exits immediately with 0 fields.
        document.querySelectorAll('[data-ai-filled]').forEach(el => el.removeAttribute('data-ai-filled'));
        document.querySelectorAll('[data-ai-id]').forEach(el => el.removeAttribute('data-ai-id'));
        document.querySelectorAll('[data-ai-radio-name]').forEach(el => el.removeAttribute('data-ai-radio-name'));

        // Broadcast completion via sendMessage instead of the fragile MV3 sendResponse port.
        // The popup listens for AUTOFILL_COMPLETE to update its UI.
        function broadcast(data) {
            chrome.runtime.sendMessage({ action: "AUTOFILL_COMPLETE", ...data });
        }

        function findElementByAiIdGlobal(rootNode, aiId) {
            if (rootNode.getAttribute && rootNode.getAttribute('data-ai-id') === aiId) return rootNode;
            let found = null;
            if (rootNode.shadowRoot) {
                for (const child of rootNode.shadowRoot.children) {
                    found = findElementByAiIdGlobal(child, aiId);
                    if (found) return found;
                }
            }
            for (const child of rootNode.children) {
                found = findElementByAiIdGlobal(child, aiId);
                if (found) return found;
            }
            return null;
        }
        
        async function runAutofill() {
            let totalFilled = 0;
            let passCount = 0;
            const maxPasses = 4; // Prevent infinite loops on dynamic forms
            let previousUnfilledCount = -1;
            let collectedExpansions = []; // Store expansion button requests

            console.log(`[Job Autofill Agent] === Phase 1: Waterfall Filling ===`);
            chrome.runtime.sendMessage({ action: "UPDATE_PROGRESS", log: "🔍 Starting Waterfall field detection..." });

            // WATERFALL LOOP: Handle cascading dropdowns (e.g., Country -> State)
            while (passCount < maxPasses) {
                if (autofillAborted) break;
                passCount++;
                console.log(`[Job Autofill Agent] --- Waterfall Pass ${passCount} ---`);
                
                // 1. Extract fields. `extractFormSchema` already skips items with 'data-ai-filled="true"'
                const allCurrentFields = extractFormSchema();
                const inputFields = allCurrentFields.filter(f => f.t !== 'button');
                
                // Collect buttons only on the first pass
                if (passCount === 1) {
                    const buttonCount = allCurrentFields.length - inputFields.length;
                    console.log(`[Job Autofill Agent] Found ${inputFields.length} inputs and ${buttonCount} expansion buttons.`);
                }

                if (inputFields.length === 0 || inputFields.length === previousUnfilledCount) {
                    if (passCount === 1) {
                        chrome.runtime.sendMessage({ action: "UPDATE_PROGRESS", log: "✅ No empty fields found. (Autoskip is ON)" });
                        // Explicitly artificial delay so UI doesn't just flash instantly
                        await new Promise(r => setTimeout(r, 1000));
                    }
                    console.log("[Job Autofill Agent] No new input fields detected. Waterfall complete.");
                    break; 
                }
                previousUnfilledCount = inputFields.length;

                // 2. Send to LLM
                chrome.runtime.sendMessage({ action: "UPDATE_PROGRESS", log: `🧠 Pass ${passCount}: Sending ${inputFields.length} fields to AI...` });
                const response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ action: "CALL_GROQ_LLM", fields: inputFields }, resolve);
                });

                if (autofillAborted) { broadcast({ stopped: true }); return; }
                if (response.error) { broadcast({ success: false, error: response.error }); return; }

                // Store expansions if the AI requests them (usually happens on pass 1)
                if (response.expand && response.expand.length > 0) {
                    collectedExpansions = response.expand;
                }

                // 3. Inject and wait for dynamic UI updates
                if (response.mapping && Object.keys(response.mapping).length > 0) {
                    console.log(`[Job Autofill Agent] Pass ${passCount}: Mapping ${Object.keys(response.mapping).length} fields...`);
                    const filled = await injectDataIntoForm(response.mapping);
                    totalFilled += filled;
                    console.log(`[Job Autofill Agent] Pass ${passCount}: Filled ${filled} fields.`);
                    
                    // Crucial wait for React/Workday to render new cascading fields
                    await new Promise(r => setTimeout(r, 800)); 
                } else {
                    break; // AI didn't map anything, move on
                }
            }

            // --- Phase 2: Expansions ---
            if (autofillAborted) { 
                console.log(`[Job Autofill Agent] ⛔ Stopped before expansions. ${totalFilled} fields filled.`);
                broadcast({ stopped: true, filledCount: totalFilled }); 
                return; 
            }

            if (collectedExpansions.length > 0) {
                console.log(`[Job Autofill Agent] === Phase 2: Expansion requests ===`, collectedExpansions);
                chrome.runtime.sendMessage({ action: "UPDATE_PROGRESS", log: "➕ Expanding dynamic form sections..." });
                
                for (const expandItem of collectedExpansions) {
                    if (autofillAborted) break;
                    
                    const clickTimes = Math.min(expandItem.times || 1, 5);
                    let btn = document.querySelector(`[data-ai-id="${expandItem.id}"]`);
                    if (!btn) btn = findElementByAiIdGlobal(document.body, expandItem.id);
                    
                    if (btn) {
                        for (let i = 0; i < clickTimes; i++) {
                            if (autofillAborted) break;
                            console.log(`[Job Autofill Agent] Clicking "${expandItem.id}" (${i + 1}/${clickTimes})`);
                            simulateClick(btn);
                            await new Promise(r => setTimeout(r, 750));
                        }
                    } else {
                        console.warn(`[Job Autofill Agent] Could not find expand button: ${expandItem.id}`);
                    }
                }

                if (autofillAborted) { broadcast({ stopped: true, filledCount: totalFilled }); return; }
                
                // Wait for DOM to settle
                await new Promise(r => setTimeout(r, 1200));

                // --- Phase 3: Final Fill Pass ---
                console.log(`[Job Autofill Agent] === Phase 3: Filling expanded fields ===`);
                chrome.runtime.sendMessage({ action: "UPDATE_PROGRESS", log: "🔍 Scanning newly expanded fields..." });
                
                const finalFields = extractFormSchema().filter(f => f.t !== 'button'); 
                
                if (finalFields.length > 0) {
                    const finalResponse = await new Promise((resolve) => {
                        chrome.runtime.sendMessage({ action: "CALL_GROQ_LLM", fields: finalFields }, resolve);
                    });

                    if (!autofillAborted && finalResponse.mapping && Object.keys(finalResponse.mapping).length > 0) {
                        const finalFilled = await injectDataIntoForm(finalResponse.mapping);
                        totalFilled += finalFilled;
                    }
                }
            }

            console.log(`[Job Autofill Agent] ✅ Done. Total fields filled: ${totalFilled}`);
            isAutofilling = false;
            broadcast({ success: true, filledCount: totalFilled });
        }

        isAutofilling = true;
        runAutofill();
        // No need to return true — we no longer use sendResponse
        sendResponse({ ack: true }); // immediate ack so popup knows message was received
    }
});

// Auto-fill on page load if "Refresh & Fill" was used
window.addEventListener('load', () => {
    setTimeout(() => {
        chrome.storage.local.get(['pendingAutofill'], (data) => {
            if (data.pendingAutofill) {
                chrome.storage.local.remove('pendingAutofill');
                console.log('[Job Autofill Agent] Pending autofill detected — starting automatically...');
                // Trigger the autofill flow
                chrome.runtime.sendMessage({ action: "CALL_GROQ_LLM", fields: [] }); // Dummy to wake background
                // Actually run via the same message handler
                const event = new CustomEvent('startAutofill');
                window.dispatchEvent(event);
            }
        });
    }, 2000); // Wait 2s for page to stabilize
});

// Listen for the auto-fill trigger from Refresh & Fill
window.addEventListener('startAutofill', async () => {
    autofillAborted = false;
    
    // Load settings from storage if available
    const data = await new Promise(r => chrome.storage.local.get(['settingAutoskip', 'settingHighlight'], r));
    currentSettings.autoskip = data.settingAutoskip !== undefined ? data.settingAutoskip : true;
    currentSettings.highlight = data.settingHighlight !== undefined ? data.settingHighlight : true;

    console.log('[Job Autofill Agent] === AUTO-FILL triggered by Refresh & Fill ===');
    
    isAutofilling = true;
    runAutofill();
});