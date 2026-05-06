document.addEventListener('DOMContentLoaded', () => {
    // Structured Profile Data (Based on Auto Jobs Applier Agent schema)
    const saurabhDataObj = {
      "personal_information": {
        "prefix": "Mr",
        "name": "Saurabh",
        "middle_name": "Khushal",
        "surname": "Gaikwad",
        "fathers_name": "Khushal Ramrao Gaikwad",
        "mothers_name": "Vidya Khushal Gaikwad",
        "date_of_birth": "03/06/2003",
        "gender": "Male",
        "nationality": "Indian",
        "country": "India",
        "state": "Maharashtra",
        "city": "Buldhana",
        "address": "Purnamay Near Hanuman Temple Rajeshwar Nagar Sagwan Area",
        "zip_code": "443001",
        "phone_prefix": "+91",
        "phone": "9922228569",
        "alternate_phone": "9921750021",
        "email": "saurabhkg36@gmail.com",
        "alternate_email": "iamsaurabh363@gmail.com",
        "github": "https://github.com/Saurabhkg03",
        "linkedin": "https://www.linkedin.com/in/saurabh-gaikwad-605a70228/",
        "twitter": "https://x.com/saurabh_exe",
        "website": "https://yourwebsite.com",
        "aadhar_no": "992627018945",
        "pan_no": "EBAPG9329F"
      },
      "education_details": [
        {
          "education_level": "Bachelor's Degree",
          "institution": "Shri Sant Gajanan Maharaj College of Engineering, Shegaon",
          "field_of_study": "Electronics and Telecommunication Engineering",
          "final_evaluation_grade": "6.83 SGPA (62.22%)",
          "start_date": "15/07/2022",
          "year_of_completion": "2026",
          "enrollment_number": "223120368"
        },
        {
          "education_level": "12th Standard",
          "institution": "Rajarshi Shahu Junior College",
          "year_of_completion": "2021",
          "final_evaluation_grade": "93.67%"
        },
        {
          "education_level": "10th Standard",
          "institution": "Prabodhan Vidyalaya Buldana",
          "year_of_completion": "2019",
          "final_evaluation_grade": "90.80%"
        }
      ],
      "experience_details": [
        {
          "position": "DevOps & Automation Intern",
          "company": "Apexa iQ",
          "employment_period": "03/2025 - Present",
          "location": "India",
          "key_responsibilities": [
            "Used Python, Selenium, Docker, Pytest, Kubernetes"
          ],
          "skills_acquired": ["Python", "Selenium", "Docker", "Pytest", "Kubernetes"]
        },
        {
          "position": "Project Intern",
          "company": "Kirdak Group Sambhajinagar",
          "employment_period": "07/2024 - 08/2024",
          "location": "India",
          "key_responsibilities": [
            "Reduced pulsar coil rejection rates by 20%"
          ]
        },
        {
          "position": "AI & ML Intern",
          "company": "OneSmarter Inc, USA",
          "employment_period": "04/2023 - 02/2024",
          "location": "USA (Remote)",
          "key_responsibilities": [
            "Led team of 4",
            "Built AI Homepage Extension",
            "Built Amazon Scraper"
          ]
        }
      ],
      "projects": [
        {
          "name": "Saraav - Edtech Platform",
          "description": "Full-stack platform for SGBAU students (React.js, TypeScript, Firebase)."
        },
        {
          "name": "Solar Panels Detection from ISRO Dataset",
          "description": "Tensorflow, CNN, U-Net, QGIS."
        },
        {
          "name": "Amazon Reviews Scraper & Data Analysis",
          "description": "Docker, Splash JS, Flask, ChatGPT API."
        },
        {
          "name": "AI Homepage Chrome Extension",
          "description": "Javascript, CSS, HTML, Chrome APIs."
        }
      ],
      "technical_skills": {
        "Languages": ["Python", "C", "C++", "HTML", "CSS", "SQL"],
        "Frameworks_Libraries": ["FastAPI", "TensorFlow", "React.js", "TypeScript", "Tailwind CSS"],
        "DevOps_Cloud": ["Docker", "Kubernetes", "GitHub Actions", "Firebase"],
        "Tools": ["Git", "Github", "Postman", "QGIS", "Jupyter Notebooks", "Figma"]
      },
      "achievements": [
        {
          "name": "Patent Published",
          "description": "System for Mapping of Flood and Early Warning Configuration by Means of a UAV (Pub. No. 202523064402 A)."
        },
        {
          "name": "2nd Prize Avishkar Competition",
          "description": "University level competition"
        }
      ],
      "certifications": [
        "NPTEL Deep Learning (IIT Ropar)",
        "Google Cloud Data Analytics",
        "NPTEL Machine Learning (IIT Madras)",
        "AWS Academy ML Foundations",
        "Google Cloud Computing Foundations",
        "NSTI IOT Training"
      ],
      "languages": [
        { "language": "English", "proficiency": "Fluent" },
        { "language": "Hindi", "proficiency": "Fluent" },
        { "language": "Marathi", "proficiency": "Native" }
      ],
      "additional_information": {
        "current_salary": "0",
        "expected_salary": "6 lakh",
        "notice_period": "0",
        "earliest_available_date": "01/05/2026",
        "cover_letter": "Maximum is 7000 characters",
        "gender_identity": "Male",
        "sexual_orientation": "Heterosexual / Straight",
        "veteran_status": "I am not a protected veteran",
        "race_ethnicity": "Asian (Not Hispanic or Latino)",
        "disability_status": "No, I do not have a disability",
        "resume_cv": ""
      },
      "work_preferences": {
        "remote_work": "Yes",
        "in_person_work": "Yes",
        "open_to_relocation": "Yes",
        "willing_to_complete_assessments": "Yes",
        "willing_to_undergo_drug_tests": "Yes",
        "willing_to_undergo_background_checks": "Yes"
      }
    };

    const saurabhData = JSON.stringify(saurabhDataObj, null, 2);

    // DOM Elements
    const tabs = { action: document.getElementById('tab-action'), profile: document.getElementById('tab-profile'), settings: document.getElementById('tab-settings') };
    const views = { action: document.getElementById('view-action'), profile: document.getElementById('view-profile'), settings: document.getElementById('view-settings') };
    const inputs = { apiKey: document.getElementById('api-key') };
    const settingAutoskip = document.getElementById('setting-autoskip');
    const settingHighlight = document.getElementById('setting-highlight');
    const settingShowGuide = document.getElementById('setting-show-guide');
    const statusMsg = document.getElementById('status-message');
    const infoNotification = document.getElementById('info-notification');
    const btnCloseInfo = document.getElementById('btn-close-info');
    const setupGuide = document.getElementById('setup-guide');
    const btnCloseGuide = document.getElementById('btn-close-guide');
    const btnOpenDashboardAction = document.getElementById('btn-open-dashboard-action');
    const apiKeyModal = document.getElementById('api-key-modal');
    const modalApiKeyInput = document.getElementById('modal-api-key');
    const btnSaveModalApiKey = document.getElementById('btn-save-modal-api-key');
    const btnCloseModal = document.getElementById('btn-close-modal');

    // Tab Switching
    function switchTab(tabName) {
        Object.keys(tabs).forEach(key => {
            if (key === tabName) {
                tabs[key].classList.add('active');
                views[key].classList.remove('hidden');
            } else {
                tabs[key].classList.remove('active');
                views[key].classList.add('hidden');
            }
        });
    }

    tabs.action.addEventListener('click', () => switchTab('action'));
    tabs.profile.addEventListener('click', () => switchTab('profile'));
    tabs.settings.addEventListener('click', () => switchTab('settings'));

    // Initialize Data
    chrome.storage.local.get(['userProfile', 'groqApiKey', 'settingAutoskip', 'settingHighlight', 'settingShowGuide', 'hideInfoNotification'], (result) => {
        if (result.userProfile) {
            renderProfileData(result.userProfile);
        } else {
            renderProfileData(saurabhData);
            chrome.storage.local.set({ userProfile: saurabhData });
        }
        if (result.groqApiKey) {
            inputs.apiKey.value = result.groqApiKey;
        } else {
            if (apiKeyModal) apiKeyModal.classList.remove('hidden');
        }
        
        if (result.settingAutoskip !== undefined) settingAutoskip.checked = result.settingAutoskip;
        if (result.settingHighlight !== undefined) settingHighlight.checked = result.settingHighlight;
        
        // Setup Guide Logic
        if (result.settingShowGuide !== undefined) {
            settingShowGuide.checked = result.settingShowGuide;
        } else {
            settingShowGuide.checked = true; // Default to true
        }
        
        if (!settingShowGuide.checked && setupGuide) {
            setupGuide.classList.add('hidden');
        }

        if (result.hideInfoNotification && infoNotification) infoNotification.classList.add('hidden');
    });

    // Listen for storage changes from the dashboard
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.userProfile) {
            renderProfileData(changes.userProfile.newValue);
        }
    });

    if (btnCloseInfo) {
        btnCloseInfo.addEventListener('click', () => {
            infoNotification.classList.add('hidden');
            chrome.storage.local.set({ hideInfoNotification: true });
        });
    }

    if (btnCloseGuide && setupGuide) {
        btnCloseGuide.addEventListener('click', () => {
            setupGuide.classList.add('hidden');
            settingShowGuide.checked = false;
            chrome.storage.local.set({ settingShowGuide: false });
        });
    }

    if (btnOpenDashboardAction) {
        btnOpenDashboardAction.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
        });
    }

    if (btnSaveModalApiKey) {
        btnSaveModalApiKey.addEventListener('click', () => {
            const key = modalApiKeyInput.value.trim();
            if (key) {
                chrome.storage.local.set({ groqApiKey: key }, () => {
                    inputs.apiKey.value = key;
                    apiKeyModal.classList.add('hidden');
                });
            } else {
                modalApiKeyInput.style.borderColor = "var(--error)";
            }
        });
    }

    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            apiKeyModal.classList.add('hidden');
        });
    }

    const btnGetGroqKey = document.getElementById('btn-get-groq-key');
    if (btnGetGroqKey) {
        btnGetGroqKey.addEventListener('click', () => {
            chrome.tabs.create({ url: "https://console.groq.com/keys" });
        });
    }

    // Function to render profile JSON
    function renderProfileData(data) {
        const container = document.getElementById('profile-fields-container');
        if (!container) return;
        container.innerHTML = '';
        
        let parsed = {};
        try {
            parsed = typeof data === 'string' ? JSON.parse(data) : data;
        } catch (e) {
            container.innerHTML = '<div style="color:var(--error); padding: 10px;">Invalid JSON Profile Data</div>';
            return;
        }

        const createRow = (label, value) => {
            if (value === null || value === undefined || value === '') return null;
            if (typeof value === 'object') return null;
            
            const row = document.createElement('div');
            row.className = 'field-row';
            
            const labelEl = document.createElement('div');
            labelEl.className = 'field-label';
            labelEl.textContent = label.replace(/_/g, ' ');
            
            const valEl = document.createElement('div');
            valEl.className = 'field-value';
            valEl.textContent = value;
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'btn-copy';
            copyBtn.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`;
            copyBtn.title = "Copy to clipboard";
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(value.toString());
                const originalSvg = copyBtn.innerHTML;
                copyBtn.innerHTML = `<svg fill="none" stroke="var(--success)" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
                setTimeout(() => { copyBtn.innerHTML = originalSvg; }, 1500);
            });
            
            row.appendChild(labelEl);
            row.appendChild(valEl);
            row.appendChild(copyBtn);
            return row;
        };

        const renderSection = (title, obj) => {
            if (!obj || (typeof obj === 'object' && Object.keys(obj).length === 0)) return;
            
            const titleEl = document.createElement('div');
            titleEl.className = 'field-section-title';
            titleEl.textContent = title.replace(/_/g, ' ');
            container.appendChild(titleEl);
            
            if (Array.isArray(obj)) {
                obj.forEach((item, index) => {
                    if (typeof item === 'string') {
                        const row = createRow(`Item ${index+1}`, item);
                        if (row) container.appendChild(row);
                    } else if (typeof item === 'object') {
                        const itemTitle = document.createElement('div');
                        itemTitle.style.fontWeight = '600';
                        itemTitle.style.fontSize = '0.8rem';
                        itemTitle.style.marginTop = '6px';
                        itemTitle.style.color = 'var(--primary)';
                        itemTitle.textContent = `#${index + 1}`;
                        container.appendChild(itemTitle);
                        
                        Object.entries(item).forEach(([k, v]) => {
                            if (Array.isArray(v)) {
                                const row = createRow(k, v.join(', '));
                                if(row) container.appendChild(row);
                            } else {
                                const row = createRow(k, v);
                                if (row) container.appendChild(row);
                            }
                        });
                    }
                });
            } else {
                Object.entries(obj).forEach(([k, v]) => {
                    if (Array.isArray(v)) {
                         const row = createRow(k, v.join(', '));
                         if(row) container.appendChild(row);
                    } else if (typeof v !== 'object') {
                        const row = createRow(k, v);
                        if (row) container.appendChild(row);
                    }
                });
            }
        };

        Object.entries(parsed).forEach(([key, value]) => {
            renderSection(key, value);
        });
    }

    document.getElementById('btn-open-dashboard').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    });

    document.getElementById('btn-save-settings').addEventListener('click', () => {
        chrome.storage.local.set({ 
            groqApiKey: inputs.apiKey.value,
            settingAutoskip: settingAutoskip.checked,
            settingHighlight: settingHighlight.checked,
            settingShowGuide: settingShowGuide.checked
        }, () => {
            const btn = document.getElementById('btn-save-settings');
            btn.textContent = "Saved!";
            btn.classList.add('success');
            if (settingShowGuide.checked) {
                setupGuide.classList.remove('hidden');
            } else {
                setupGuide.classList.add('hidden');
            }
            setTimeout(() => { btn.textContent = "Save Settings"; btn.classList.remove('success'); }, 2000);
        });
    });

    // Autofill Action
    const btnAutofill = document.getElementById('btn-autofill');
    const btnStop = document.getElementById('btn-stop');
    const btnSkip = document.getElementById('btn-skip');
    const activeControls = document.getElementById('active-controls');
    const progressWrapper = document.getElementById('progress-wrapper');
    const progressLogs = document.getElementById('progress-logs');
    const progressPercentage = document.getElementById('progress-percentage');
    const progressBarFill = document.getElementById('progress-bar-fill');
    
    const btnRefresh = document.getElementById('btn-refresh');
    const btnRefreshFill = document.getElementById('btn-refresh-fill');
    const refreshRow = document.getElementById('refresh-row');
    
    const autofillIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>`;
    const spinnerIcon = `<svg class="spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" stroke-opacity="0.25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

    function setRunningState(isRunning) {
        if (isRunning) {
            btnAutofill.classList.add('hidden');
            activeControls.classList.remove('hidden');
            progressWrapper.classList.remove('hidden');
            refreshRow.classList.add('hidden');
            // Reset status message and clear logs for fresh run
            statusMsg.classList.add('hidden');
            statusMsg.textContent = '';
            progressLogs.innerHTML = '';
            if (progressBarFill) progressBarFill.style.width = '0%';
            if (progressPercentage) progressPercentage.textContent = '0%';
        } else {
            btnAutofill.classList.remove('hidden');
            activeControls.classList.add('hidden');
            btnAutofill.disabled = false;
            btnAutofill.innerHTML = `${autofillIcon} Autofill This Page`;
            // Close the terminal/logs window after run completes
            progressWrapper.classList.add('hidden');
        }
    }

    // Track whether user manually stopped (so we ignore late AUTOFILL_COMPLETE)
    let userStopped = false;

    // Check if content script is currently running
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "CHECK_STATUS" }, (response) => {
                if (chrome.runtime.lastError) return;
                if (response && response.isRunning) {
                    setRunningState(true);
                    const entry = document.createElement('div');
                    entry.className = 'log-entry';
                    entry.textContent = '🔄 Reconnected to running autofill...';
                    progressLogs.appendChild(entry);
                }
            });
        }
    });

    // Message Listener — handles progress logs AND completion signal
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "UPDATE_PROGRESS") {
            // Make sure the terminal is visible when logs arrive
            if (progressWrapper.classList.contains('hidden')) {
                progressWrapper.classList.remove('hidden');
            }
            const entry = document.createElement('div');
            entry.className = `log-entry ${request.statusClass || ''}`;
            entry.textContent = request.log;
            progressLogs.appendChild(entry);
            progressLogs.scrollTop = progressLogs.scrollHeight;

            if (request.pct !== undefined) {
                if (progressPercentage) progressPercentage.textContent = `${Math.round(request.pct)}%`;
                if (progressBarFill) progressBarFill.style.width = `${request.pct}%`;
            } else if (request.log.includes("Scanning") || request.log.includes("Sending")) {
                if (progressPercentage) progressPercentage.textContent = `...`;
                if (progressBarFill) progressBarFill.style.width = `10%`;
            }
        }

        if (request.action === "AUTOFILL_COMPLETE") {
            // Ignore if user already clicked Stop
            if (userStopped) return;

            setRunningState(false);

            if (request.stopped) {
                statusMsg.textContent = "⛔ Autofill stopped by user.";
                statusMsg.className = "status-msg status-error";
            } else if (request.success) {
                statusMsg.textContent = `✅ Success! Mapped ${request.filledCount} fields.`;
                statusMsg.className = "status-msg status-success";
            } else {
                statusMsg.textContent = request.error || "Autofill encountered an error.";
                statusMsg.className = "status-msg status-error";
            }
            statusMsg.classList.remove('hidden');
        }
    });

    btnSkip.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: "SKIP_CURRENT_FIELD" });
        const entry = document.createElement('div');
        entry.className = `log-entry log-error`;
        entry.textContent = "⏭️ Skipping current field...";
        progressLogs.appendChild(entry);
        progressLogs.scrollTop = progressLogs.scrollHeight;
    });

    // Stop button
    btnStop.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: "STOP_AUTOFILL" });
        userStopped = true;
        setRunningState(false);
        statusMsg.textContent = "⛔ Autofill stopped by user.";
        statusMsg.className = "status-msg status-error";
        statusMsg.classList.remove('hidden');
    });

    // Refresh Page button
    btnRefresh.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.reload(tab.id);
        statusMsg.textContent = "🔄 Page refreshed. Ready to autofill.";
        statusMsg.className = "status-msg status-success";
    });

    // Refresh & Fill button
    btnRefreshFill.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        statusMsg.textContent = "🔄 Refreshing page, will autofill shortly...";
        statusMsg.className = "status-msg";
        statusMsg.classList.remove('hidden');
        
        // Store a flag so content script auto-fills after page loads
        chrome.storage.local.set({ pendingAutofill: true });
        chrome.tabs.reload(tab.id);
    });

    // Main autofill button
    btnAutofill.addEventListener('click', async () => {
        if (!inputs.apiKey.value) {
            if (apiKeyModal) apiKeyModal.classList.remove('hidden');
            return;
        }

        userStopped = false;
        setRunningState(true);
        btnStop.innerHTML = `${spinnerIcon} Stop Autofill`;

        // Immediately show feedback so the UI never looks blank/unresponsive
        const immediateEntry = document.createElement('div');
        immediateEntry.className = 'log-entry';
        immediateEntry.textContent = '⚡ Connecting to page...';
        progressLogs.appendChild(immediateEntry);

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const settings = { autoskip: settingAutoskip.checked, highlight: settingHighlight.checked };

        // Retry sending until content script is ready (handles post-refresh timing)
        const MAX_RETRIES = 5;
        const RETRY_DELAY_MS = 700;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            const result = await new Promise((resolve) => {
                chrome.tabs.sendMessage(tab.id, { action: "START_AUTOFILL", settings }, (res) => {
                    resolve(chrome.runtime.lastError ? null : res);
                });
            });

            if (result === null) {
                // Content script not ready yet
                if (attempt < MAX_RETRIES) {
                    const entry = document.createElement('div');
                    entry.className = 'log-entry';
                    entry.textContent = `⏳ Page not ready, retrying... (${attempt}/${MAX_RETRIES})`;
                    progressLogs.appendChild(entry);
                    progressLogs.scrollTop = progressLogs.scrollHeight;
                    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                    continue;
                }
                // All retries exhausted — give up
                setRunningState(false);
                statusMsg.textContent = "⚠️ Extension not loaded on this page. Please refresh and try again.";
                statusMsg.className = "status-msg status-error";
                statusMsg.classList.remove('hidden');
                refreshRow.classList.remove('hidden');
                return;
            }

            // Got an ack — content script is running. UI stays in running state.
            // setRunningState(false) will be called when AUTOFILL_COMPLETE arrives.
            return;
        }
    });
});
