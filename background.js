// Background Service Worker: Handles the heavy lifting with Groq API

// Allow users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

const HARDCODED_GROQ_API_KEY = ""; // Replace with your Groq API key to hardcode it

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "CALL_GROQ_LLM") {

        chrome.storage.local.get(['userProfile', 'groqApiKey'], async (data) => {
            const apiKey = data.groqApiKey || HARDCODED_GROQ_API_KEY;
            if (!apiKey) {
                sendResponse({ error: "API Key missing. Please configure in settings or hardcode it in background.js." });
                return;
            }

            try {
                const llmResult = await analyzeFormWithAI(apiKey, data.userProfile, request.fields);
                console.log('[Background] Raw LLM result:', llmResult);
                // Forward the parsed JSON directly — it will have either "actions" or "mapping" as a top-level key
                sendResponse(llmResult);
            } catch (error) {
                console.error("LLM API Error:", error);
                sendResponse({ error: error.message });
            }
        });

        return true;
    }
});

async function analyzeFormWithAI(apiKey, profileText, formFields) {
    const systemPrompt = `You are a highly intelligent, expert AI job application autofill assistant using Evidence-Based Extraction (EBE).
You must analyze each form field's label and extract the EXACT answer directly from the candidate's profile data.

Rules:
1. OUTPUT JSON ONLY. No markdown, no prose.
2. CHAIN OF THOUGHT: Your response MUST always contain a "reasoning" object BEFORE the "mapping" object. For every field you map, provide the exact path/key from the profile where you found the data. This forces you to ground your response.
3. ANTI-HALLUCINATION: You are STRICTLY FORBIDDEN from guessing, inferring, or making up information. If the exact required information is not found in the profile, you MUST omit the key from the mapping entirely.
4. MAPPING OBJECT: Your response MUST contain a "mapping" object. Keys must exactly match the provided field 'id'.
5. FORMATTING IS CRITICAL: If a field requests a specific format (e.g. "MM/DD/YYYY" or "YYYY"), transform the extracted data to strictly match that format without altering the core value.
6. DROPDOWNS: If options are provided (value:Label), output ONLY the exactly matching "value".
7. For checkboxes, use boolean true/false.
8. EXPANSION BUTTONS: Some fields in the schema have t="button" with a label like 'Add Button for section: "Work Experience"'.
   - A <DataCounts> section is provided listing exactly how many items exist per category. Use those counts EXACTLY as the "times" value.
   - ONLY expand sections listed in <DataCounts> that have count > 0. Omit the "expand" key if no expansion is needed.
9. MULTISELECT/COMBOBOX: Output the FULL OFFICIAL NAME of the item (school, certification, degree, field of study, etc.) exactly as it appears in the profile.
10. DATES: If a field asks for a date (From, To, Start Date, End Date, etc.):
   - If no format is explicitly requested in the label, DEFAULT to "MM/YYYY" (e.g., "04/2023").
   - NEVER output date ranges like "03/2025 - Present". Extract only the single relevant month/year.
   - If the field is an "End Date" or "To" field and the profile says "Present", output the CURRENT date (e.g. use "04/2026").
   - If the field requires a specific day (e.g. MM/DD/YYYY) but the profile only has month and year, default to the 1st of the month (e.g. "04/01/2023").

Output EXACTLY AND ONLY valid JSON. The "reasoning" and "mapping" keys are ALWAYS required.
Example:
{
  "reasoning": {
    "ai_0_firstName": "Found in personal_information.firstName",
    "ai_btn_8_add": "Expanding Work Experience based on DataCounts"
  },
  "mapping": {
    "ai_0_firstName": "Saurabh"
  },
  "expand": [
    {"id": "ai_btn_8_add", "times": 3}
  ]
}`;

    // Pre-compute entry counts from the profile to help the LLM
    let dataCounts = '';
    let cleanedProfileText = profileText;

    try {
        const profile = JSON.parse(profileText);
        
        // Strip out empty fields, arrays, and objects recursively to save LLM tokens
        function removeEmptyFields(obj) {
            if (obj === null || obj === undefined) return undefined;
            if (typeof obj === 'string') {
                return obj.trim() === '' ? undefined : obj;
            }
            if (Array.isArray(obj)) {
                const cleanedArr = obj.map(removeEmptyFields).filter(v => v !== undefined);
                return cleanedArr.length > 0 ? cleanedArr : undefined;
            }
            if (typeof obj === 'object') {
                const newObj = {};
                let hasKeys = false;
                for (const [key, value] of Object.entries(obj)) {
                    const cleanedVal = removeEmptyFields(value);
                    if (cleanedVal !== undefined) {
                        newObj[key] = cleanedVal;
                        hasKeys = true;
                    }
                }
                return hasKeys ? newObj : undefined;
            }
            return obj; // keep numbers, booleans, etc.
        }

        const cleanedProfile = removeEmptyFields(profile) || {};
        cleanedProfileText = JSON.stringify(cleanedProfile, null, 2);

        const counts = [];
        if (cleanedProfile.experience_details) counts.push(`Work Experience: ${cleanedProfile.experience_details.length}`);
        if (cleanedProfile.education_details) counts.push(`Education: ${cleanedProfile.education_details.length}`);
        if (cleanedProfile.certifications) counts.push(`Certifications: ${cleanedProfile.certifications.length}`);
        if (cleanedProfile.projects) counts.push(`Projects: ${cleanedProfile.projects.length}`);
        
        // Count websites: github + any website
        let websiteCount = 0;
        if (cleanedProfile.personal_information?.github) websiteCount++;
        if (cleanedProfile.personal_information?.website && cleanedProfile.personal_information.website !== 'https://yourwebsite.com') websiteCount++;
        if (websiteCount > 0) counts.push(`Websites: ${websiteCount}`);
        
        dataCounts = counts.join(', ');
    } catch(e) { 
        dataCounts = 'Could not parse counts'; 
    }

    const contextRules = `
CRITICAL MAPPING RULES:
- If a form asks for "Start Month", use the "month_name" (e.g., "March") or "month" (e.g., "03") depending on the dropdown options provided in the schema.
- If a form asks for "First Name" and "Last Name" separately, split them. If it asks for "Name", use "full_name".
- If asked about Sponsorship, explicitly use the data in the <LegalAuthorization> block.
- For Checkboxes (Boolean), strictly map "Yes" to true and "No" to false.
- ANTI-HALLUCINATION ENFORCEMENT: Never invent data! If it is not in the JSON profile below, omit it!
`;

    const userPrompt = `
${contextRules}

<CandidateProfile>
${cleanedProfileText}
</CandidateProfile>

<DataCounts>
${dataCounts}
</DataCounts>

<FormFieldsToFill>
${JSON.stringify(formFields)}
</FormFieldsToFill>`;

    const requestBody = JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 0.0, // Strict, deterministic output
        response_format: { type: "json_object" }
    });

    const MAX_RETRIES = 5;
    let response;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: requestBody
        });

        if (response.ok) break; // success — exit retry loop

        const errText = await response.text();

        if (response.status === 429 && attempt < MAX_RETRIES) {
            // Parse the suggested retry delay from the error message, e.g. "try again in 3.67s"
            let waitMs = 5000; // default fallback: 5 s
            try {
                const errObj = JSON.parse(errText);
                const msgMatch = (errObj?.error?.message || '').match(/try again in ([\d.]+)s/i);
                if (msgMatch) {
                    // Use the suggested time + a 500 ms buffer to stay safe
                    waitMs = Math.ceil(parseFloat(msgMatch[1]) * 1000) + 500;
                }
            } catch (_) { /* ignore JSON parse errors */ }

            console.warn(`[Background] Rate limited (429). Waiting ${waitMs}ms before retry ${attempt}/${MAX_RETRIES - 1}…`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
            continue;
        }

        // Non-recoverable error
        throw new Error(`API Error ${response.status}: ${errText}`);
    }

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error ${response.status} after ${MAX_RETRIES} retries: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    try {
        return JSON.parse(content);
    } catch (e) {
        console.error("Raw LLM Output:", content);
        throw new Error("AI generated an invalid response format.");
    }
}