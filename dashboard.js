document.addEventListener('DOMContentLoaded', () => {
    let userProfile = {};
    let activeSection = null; // Tracks active tab within Visual Editor
    let hasUnsavedChanges = false;

    document.body.addEventListener('input', () => { hasUnsavedChanges = true; });
    document.body.addEventListener('change', () => { hasUnsavedChanges = true; });

    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    const STATIC_SECTIONS = ['personal_information', 'statutory_and_legal', 'job_preferences', 'education_history'];

    // Helper to convert "YYYY-MM" from HTML <input type="month"> into ATS-friendly parts
    function parseDateForATS(dateString, isCurrent = false) {
        if (isCurrent || !dateString) {
            return { month: "", month_name: "", year: "Present" };
        }
        const [year, month, day] = dateString.split('-');
        const dateObj = new Date(year, parseInt(month) - 1);
        const monthName = dateObj.toLocaleString('default', { month: 'long' }); // "March"
        
        return { month: parseInt(month).toString(), month_name: monthName, year: year, day: day || "" };
    }

    function formatDateForInput(dateObj) {
        if (!dateObj || typeof dateObj !== 'object' || dateObj.year === 'Present' || !dateObj.year) return '';
        const monthStr = String(dateObj.month || "1").padStart(2, '0');
        const dayStr = String(dateObj.day || "01").padStart(2, '0');
        return `${dateObj.year}-${monthStr}-${dayStr}`;
    }

    // Elements
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view-panel');
    const sectionTabsContainer = document.getElementById('section-tabs');
    const dynamicForm = document.getElementById('dynamic-form');
    const jsonTextarea = document.getElementById('json-textarea');
    const btnSaveGlobal = document.getElementById('btn-save-global');
    const toastMessage = document.getElementById('toast-message');
    
    const btnImport = document.getElementById('btn-import');
    const importFile = document.getElementById('import-file');
    const btnExport = document.getElementById('btn-export');

    // 1. Loading Data
    chrome.storage.local.get(['userProfile'], (result) => {
        if (result.userProfile) {
            try {
                userProfile = JSON.parse(result.userProfile);
            } catch (e) {
                userProfile = {};
            }
        }
        
        // Ensure static sections exist
        STATIC_SECTIONS.forEach(sec => {
            if (!userProfile[sec]) {
                userProfile[sec] = {};
            }
        });

        initJSONEditor();
        buildFormUI();
    });

    // 2. Main Navigation (Visual vs JSON)
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.dataset.view;
            
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (targetView === 'form-view') {
                try {
                    userProfile = JSON.parse(jsonTextarea.value);
                    buildFormUI();
                } catch (e) {
                    alert("Invalid JSON format. Please fix errors before switching views.");
                    return;
                }
            } 
            else if (targetView === 'json-view') {
                syncFormToProfile();
                initJSONEditor();
            }

            views.forEach(v => v.classList.remove('active'));
            document.getElementById(targetView).classList.add('active');
        });
    });

    // 3. UI Construction Helper for Tabs
    function formatTitle(key) {
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    function buildFormUI() {
        // Hide all static sections and the dynamic form first
        document.querySelectorAll('.static-form-section').forEach(el => el.classList.add('hidden'));
        dynamicForm.classList.add('hidden');
        dynamicForm.innerHTML = '';
        sectionTabsContainer.innerHTML = '';

        const rootKeys = Object.keys(userProfile);
        if (rootKeys.length === 0) {
            dynamicForm.classList.remove('hidden');
            dynamicForm.innerHTML = `
                <div class="empty-state">
                    <h2>No Profile Data Found</h2>
                    <p>Import a JSON profile or start adding sections manually.</p>
                    <button class="btn-primary mt-4" id="btn-empty-import" style="margin-top: 16px;">Import JSON</button>
                </div>
            `;
            document.getElementById('btn-empty-import').addEventListener('click', () => {
                document.getElementById('import-file').click();
            });
            return;
        }

        if (!activeSection || !rootKeys.includes(activeSection)) {
            activeSection = rootKeys[0];
        }

        // Build Inner Tabs
        rootKeys.forEach(key => {
            const btn = document.createElement('button');
            btn.className = `section-tab-btn ${key === activeSection ? 'active' : ''}`;
            btn.textContent = formatTitle(key);
            btn.addEventListener('click', () => {
                syncFormToProfile();
                activeSection = key;
                buildFormUI();
            });
            sectionTabsContainer.appendChild(btn);
        });

        // Build Content for Active Tab
        if (STATIC_SECTIONS.includes(activeSection)) {
            const staticEl = document.getElementById(`static-${activeSection}`);
            if (staticEl) staticEl.classList.remove('hidden');
            populateStaticForm(activeSection, userProfile[activeSection]);
        } else {
            dynamicForm.classList.remove('hidden');
            const sectionData = userProfile[activeSection];
            
            if (Array.isArray(sectionData)) {
                buildArrayUI(activeSection, sectionData);
            } else if (typeof sectionData === 'object' && sectionData !== null) {
                buildObjectUI(activeSection, sectionData);
            } else {
                // Primitive at root? Unlikely but supported
                const grid = document.createElement('div');
                grid.className = 'form-grid form-group';
                grid.dataset.isRootPrimitive = "true";
                grid.appendChild(createTextInput(activeSection, sectionData));
                dynamicForm.appendChild(grid);
            }

            appendCustomFieldAdder();
        }
    }

    function populateStaticForm(section, data) {
        if (!data) return;
        if (section === 'personal_information') {
            const fullName = data.full_name || data.name || '';
            let fName = data.first_name || '';
            let lName = data.last_name || '';
            if (!fName && !lName && fullName) {
                const parts = fullName.split(' ');
                fName = parts[0];
                lName = parts.slice(1).join(' ');
            }

            document.getElementById('first_name').value = fName;
            document.getElementById('middle_name').value = data.middle_name || '';
            document.getElementById('last_name').value = lName;
            document.getElementById('fathers_name').value = data.fathers_name || '';
            document.getElementById('mothers_name').value = data.mothers_name || '';
            document.getElementById('gender').value = data.gender || '';
            document.getElementById('nationality').value = data.nationality || '';
            
            if (data.birth_date) {
                if (typeof data.birth_date === 'string') {
                    document.getElementById('birth_date').value = data.birth_date;
                } else {
                    document.getElementById('birth_date').value = formatDateForInput(data.birth_date);
                }
            }

            document.getElementById('phone_country_code').value = data.phone_country_code || '+91';
            document.getElementById('phone_number').value = data.phone_number || data.phone || '';
            document.getElementById('alternate_phone').value = data.alternate_phone || '';
            document.getElementById('email').value = data.email || '';
            document.getElementById('alternate_email').value = data.alternate_email || '';
            
            if (data.location && typeof data.location === 'object') {
                document.getElementById('country').value = data.location.country || 'India';
                document.getElementById('state').value = data.location.state || '';
                document.getElementById('city').value = data.location.city || '';
                document.getElementById('postal_code').value = data.location.postal_code || '';
                document.getElementById('full_address').value = data.location.full_address || '';
            } else if (typeof data.location === 'string') {
                document.getElementById('full_address').value = data.location;
            }
            
            if (data.links) {
                document.getElementById('linkedin').value = data.links.linkedin || '';
                document.getElementById('github').value = data.links.github || '';
                document.getElementById('twitter').value = data.links.twitter || '';
                document.getElementById('website').value = data.links.website || '';
            } else {
                document.getElementById('linkedin').value = data.linkedin || '';
                document.getElementById('github').value = data.github || '';
                document.getElementById('twitter').value = data.twitter || '';
                document.getElementById('website').value = data.website || '';
            }
        } else if (section === 'statutory_and_legal') {
            document.getElementById('pan_number').value = data.pan_number || '';
            document.getElementById('aadhaar_number').value = data.aadhaar_number || '';
            if (data.requires_sponsorship) document.getElementById('sponsorship_status').value = data.requires_sponsorship;
        } else if (section === 'job_preferences') {
            if (data.notice_period_days) document.getElementById('notice_period').value = data.notice_period_days;
            document.getElementById('expected_ctc').value = data.expected_ctc_lpa || '';
            document.getElementById('current_ctc').value = data.current_ctc_lpa || '';
            if (data.willing_to_relocate) document.getElementById('relocate_status').value = data.willing_to_relocate;
        } else if (section === 'education_history') {
            if (data.has_active_backlogs) document.getElementById('active_backlogs').value = data.has_active_backlogs;
            if (data.undergraduate) {
                document.getElementById('ug_institution').value = data.undergraduate.institution || '';
                document.getElementById('ug_branch').value = data.undergraduate.specialization || '';
                document.getElementById('ug_score').value = data.undergraduate.score || '';
                if (data.undergraduate.start_date) document.getElementById('ug_start_date').value = formatDateForInput(data.undergraduate.start_date);
                if (data.undergraduate.end_date) document.getElementById('ug_end_date').value = formatDateForInput(data.undergraduate.end_date);
            }
            if (data.twelfth_standard) {
                if (data.twelfth_standard.board) document.getElementById('hsc_board').value = data.twelfth_standard.board;
                document.getElementById('hsc_score').value = data.twelfth_standard.score || '';
                if (data.twelfth_standard.start_date) document.getElementById('hsc_start_date').value = formatDateForInput(data.twelfth_standard.start_date);
                if (data.twelfth_standard.end_date) document.getElementById('hsc_end_date').value = formatDateForInput(data.twelfth_standard.end_date);
            }
            if (data.tenth_standard) {
                if (data.tenth_standard.board) document.getElementById('ssc_board').value = data.tenth_standard.board;
                document.getElementById('ssc_score').value = data.tenth_standard.score || '';
                if (data.tenth_standard.start_date) document.getElementById('ssc_start_date').value = formatDateForInput(data.tenth_standard.start_date);
                if (data.tenth_standard.end_date) document.getElementById('ssc_end_date').value = formatDateForInput(data.tenth_standard.end_date);
            }
        }
    }

    function buildObjectUI(parentKey, obj) {
        const group = document.createElement('div');
        group.className = 'form-group';
        
        const header = document.createElement('div');
        header.className = 'form-group-header';
        
        const title = document.createElement('h3');
        title.textContent = formatTitle(parentKey) + " Fields";

        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn-outline';
        btnEdit.style.fontSize = '0.85rem';
        btnEdit.style.padding = '6px 12px';
        btnEdit.innerHTML = '✏️ Edit Labels';

        let isEditMode = false;
        btnEdit.addEventListener('click', () => {
            if (isEditMode) {
                let hasError = false;
                group.querySelectorAll('.key-edit-input').forEach(input => {
                    if (input.value.trim() === '') {
                        hasError = true;
                        input.style.borderBottomColor = 'var(--danger)';
                        input.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    } else {
                        input.style.borderBottomColor = '';
                        input.style.backgroundColor = '';
                    }
                });
                if (hasError) {
                    alert('Label names cannot be empty.');
                    return;
                }
            }
            
            isEditMode = !isEditMode;
            
            if (!isEditMode) {
                btnEdit.classList.remove('btn-success');
                btnEdit.classList.add('btn-outline');
                // Leaving edit mode -> Update keys immediately
                group.querySelectorAll('.input-wrapper').forEach(wrapper => {
                    const label = wrapper.querySelector('.field-label');
                    const keyInput = wrapper.querySelector('.key-edit-input');
                    const valInput = wrapper.querySelector('.value-input');
                    
                    if(keyInput && keyInput.value.trim() !== '') {
                        const newKey = keyInput.value.trim().replace(/ /g, '_');
                        valInput.dataset.key = newKey;
                        label.textContent = formatTitle(newKey);
                    }
                    
                    label.classList.remove('hidden');
                    keyInput.classList.add('hidden');
                });
            } else {
                btnEdit.classList.add('btn-success');
                btnEdit.classList.remove('btn-outline');
                // Entering edit mode -> Reveal key inputs
                group.querySelectorAll('.input-wrapper').forEach(wrapper => {
                    const label = wrapper.querySelector('.field-label');
                    const keyInput = wrapper.querySelector('.key-edit-input');
                    if (label && keyInput) {
                        label.classList.add('hidden');
                        keyInput.classList.remove('hidden');
                    }
                });
            }
            btnEdit.innerHTML = isEditMode ? '✅ Done Editing' : '✏️ Edit Labels';
        });

        header.appendChild(title);
        header.appendChild(btnEdit);
        group.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'form-grid';
        grid.dataset.parentKey = parentKey;

        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null) {
                grid.appendChild(createTextareaInput(key, value));
            } else {
                grid.appendChild(createTextInput(key, value));
            }
        }
        
        group.appendChild(grid);
        dynamicForm.appendChild(group);
    }

    function buildArrayUI(parentKey, arr) {
        const container = document.createElement('div');
        container.className = 'array-container';
        container.dataset.parentKey = parentKey;

        arr.forEach((item, index) => {
            const block = document.createElement('div');
            block.className = 'array-block form-group';
            block.dataset.arrayIndex = index;

            const header = document.createElement('div');
            header.className = 'array-block-header';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';

            const btnEdit = document.createElement('button');
            btnEdit.className = 'btn-outline';
            btnEdit.style.fontSize = '0.75rem';
            btnEdit.style.padding = '4px 8px';
            btnEdit.innerHTML = '✏️ Edit Labels';

            let isEditMode = false;
            btnEdit.addEventListener('click', () => {
                if (isEditMode) {
                    let hasError = false;
                    block.querySelectorAll('.key-edit-input').forEach(input => {
                        if (input.value.trim() === '') {
                            hasError = true;
                            input.style.borderBottomColor = 'var(--danger)';
                            input.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                        } else {
                            input.style.borderBottomColor = '';
                            input.style.backgroundColor = '';
                        }
                    });
                    if (hasError) {
                        alert('Label names cannot be empty.');
                        return;
                    }
                }
                
                isEditMode = !isEditMode;
                if (!isEditMode) {
                    btnEdit.classList.remove('btn-success');
                    btnEdit.classList.add('btn-outline');
                    block.querySelectorAll('.input-wrapper').forEach(wrapper => {
                        const label = wrapper.querySelector('.field-label');
                        const keyInput = wrapper.querySelector('.key-edit-input');
                        const valInput = wrapper.querySelector('.value-input');
                        if (keyInput && valInput && keyInput.value.trim() !== '') {
                            const newKey = keyInput.value.trim().replace(/ /g, '_');
                            valInput.dataset.key = newKey;
                            label.textContent = formatTitle(newKey);
                            label.classList.remove('hidden');
                            keyInput.classList.add('hidden');
                        }
                    });
                } else {
                    btnEdit.classList.add('btn-success');
                    btnEdit.classList.remove('btn-outline');
                    block.querySelectorAll('.input-wrapper').forEach(wrapper => {
                        const label = wrapper.querySelector('.field-label');
                        const keyInput = wrapper.querySelector('.key-edit-input');
                        if(label && keyInput) {
                            label.classList.add('hidden');
                            keyInput.classList.remove('hidden');
                        }
                    });
                }
                btnEdit.innerHTML = isEditMode ? '✅ Done Editing' : '✏️ Edit Labels';
            });
            
            const btnRemove = document.createElement('button');
            btnRemove.className = 'btn-remove-array';
            btnRemove.innerHTML = `[-] Remove Item`;
            btnRemove.addEventListener('click', () => {
                if(confirm("Remove this entry?")) {
                    arr.splice(index, 1);
                    syncFormToProfile(true); 
                    userProfile[activeSection] = arr; 
                    buildFormUI(); 
                }
            });

            header.appendChild(btnEdit);
            block.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'form-grid';
            
            if (typeof item === 'object' && item !== null) {
                for (const [k, v] of Object.entries(item)) {
                    if (k.includes('date')) {
                        grid.appendChild(createDateInput(k, v));
                    } else if (typeof v === 'object' && v !== null) {
                        grid.appendChild(createTextareaInput(k, v));
                    } else {
                        grid.appendChild(createTextInput(k, v));
                    }
                }
            } else {
                grid.appendChild(createTextInput("Value", item));
            }
            
            block.appendChild(grid);

            const bottomActions = document.createElement('div');
            bottomActions.style.display = 'flex';
            bottomActions.style.justifyContent = 'flex-end';
            bottomActions.style.marginTop = '24px';
            bottomActions.style.borderTop = '1px solid var(--border)';
            bottomActions.style.paddingTop = '16px';
            bottomActions.appendChild(btnRemove);

            block.appendChild(bottomActions);
            
            container.appendChild(block);
        });

        const btnAdd = document.createElement('button');
        btnAdd.className = 'btn-add-array';
        btnAdd.innerHTML = `[+] Add ${formatTitle(parentKey).replace(/s$/, '')}`;
        btnAdd.addEventListener('click', () => {
            syncFormToProfile();
            
            let template;
            if (arr.length > 0 && typeof arr[0] === 'object') {
                // Copy structure of existing item
                template = Object.fromEntries(Object.keys(arr[0]).map(k => [k, ""]));
            } else {
                // Fallback for empty arrays (create a generic key/value pair so it doesn't crash)
                template = { "title": "", "description": "" };
            }
            
            userProfile[parentKey].push(template);
            buildFormUI();
        });

        container.appendChild(btnAdd);
        dynamicForm.appendChild(container);
    }

    function createTextInput(key, value) {
        const wrapper = document.createElement('div');
        wrapper.className = 'input-wrapper';
        if (value && value.toString().length > 60) wrapper.style.gridColumn = "1 / -1";
        
        const label = document.createElement('label');
        label.className = 'field-label';
        label.textContent = formatTitle(key);
        
        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.className = 'key-edit-input hidden';
        keyInput.value = key;
        keyInput.placeholder = 'Field Name';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'value-input';
        input.value = typeof value === 'object' ? JSON.stringify(value) : value;
        input.dataset.key = key;

        wrapper.appendChild(label);
        wrapper.appendChild(keyInput);
        wrapper.appendChild(input);
        return wrapper;
    }

    function createDateInput(key, valueObj) {
        const wrapper = document.createElement('div');
        wrapper.className = 'input-wrapper';
        
        const label = document.createElement('label');
        label.className = 'field-label';
        label.textContent = formatTitle(key);
        
        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.className = 'key-edit-input hidden';
        keyInput.value = key;
        
        const input = document.createElement('input');
        input.type = 'date';
        input.className = 'value-input date-input';
        input.value = formatDateForInput(valueObj);
        input.dataset.key = key;

        wrapper.appendChild(label);
        wrapper.appendChild(keyInput);
        wrapper.appendChild(input);
        return wrapper;
    }

    function createTextareaInput(key, value) {
        const wrapper = document.createElement('div');
        wrapper.className = 'input-wrapper';
        wrapper.style.gridColumn = "1 / -1";
        
        const label = document.createElement('label');
        label.className = 'field-label';
        label.textContent = formatTitle(key) + " (JSON)";

        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.className = 'key-edit-input hidden';
        keyInput.value = key;
        keyInput.placeholder = 'Field Name';
        
        const ta = document.createElement('textarea');
        ta.className = 'value-input';
        ta.value = JSON.stringify(value, null, 2);
        ta.dataset.key = key;

        wrapper.appendChild(label);
        wrapper.appendChild(keyInput);
        wrapper.appendChild(ta);
        return wrapper;
    }

    function appendCustomFieldAdder() {
        const adder = document.createElement('div');
        adder.className = 'add-field-container';
        adder.style.marginTop = '48px';
        
        adder.innerHTML = `
            <h3>Add Custom Context Field to ${formatTitle(activeSection)}</h3>
            <div class="add-field-controls">
                <input type="text" id="new-field-key" placeholder="Field Name (e.g., specific_hobby)">
                <input type="text" id="new-field-value" placeholder="Field Value (e.g., reading books)">
                <button id="btn-add-field" class="btn-secondary">Add Field</button>
            </div>
        `;
        
        dynamicForm.appendChild(adder);
        
        adder.querySelector('#btn-add-field').addEventListener('click', () => {
            const keyName = document.getElementById('new-field-key').value.trim().replace(/ /g, '_').toLowerCase();
            const valueContent = document.getElementById('new-field-value').value.trim();
            if (!keyName) return;

            syncFormToProfile();
            
            const targetSection = userProfile[activeSection];
            
            if (Array.isArray(targetSection)) {
                if(targetSection.length > 0 && typeof targetSection[0] === 'object') {
                    targetSection.forEach(t => t[keyName] = valueContent || "New content here...");
                } else {
                    alert("You cannot add custom sub-fields to a simple text list (like Certifications). Convert them to objects in the JSON Editor first, or add items using the [+] button above.");
                    return;
                }
            } else if (typeof targetSection === 'object' && targetSection !== null) {
                if (targetSection[keyName]) {
                    alert("Field already exists!");
                    return;
                }
                targetSection[keyName] = valueContent || "New content here...";
            } else {
                alert("Cannot add fields to a primitive root value.");
                return;
            }

            buildFormUI();
            
            requestAnimationFrame(() => {
                document.querySelector('.main-content').scrollTo({
                    top: dynamicForm.scrollHeight,
                    behavior: 'smooth'
                });
            });
        });
    }

    // Sync UI to Profile State
    function syncFormToProfile(skipCurrentArrayRemoveEvent = false) {
        if (!activeSection) return;
        
        const val = (id) => document.getElementById(id) ? document.getElementById(id).value.trim() : '';

        // Safely merge existing data to prevent wiping custom fields
        const currentData = userProfile[activeSection] || {};

        if (activeSection === 'personal_information') {
            userProfile[activeSection] = {
                ...currentData, // Preserves custom fields
                first_name: val('first_name'),
                middle_name: val('middle_name'),
                last_name: val('last_name'),
                full_name: `${val('first_name')} ${val('middle_name')} ${val('last_name')}`.replace(/\s+/g, ' ').trim(),
                fathers_name: val('fathers_name'),
                mothers_name: val('mothers_name'),
                gender: val('gender'),
                nationality: val('nationality'),
                birth_date: parseDateForATS(val('birth_date')),
                phone_country_code: val('phone_country_code') || "+91",
                phone_number: val('phone_number'),
                alternate_phone: val('alternate_phone'),
                email: val('email'),
                alternate_email: val('alternate_email'),
                location: {
                    ...(currentData.location || {}),
                    country: val('country') || "India",
                    state: val('state'),
                    city: val('city'),
                    postal_code: val('postal_code'),
                    full_address: val('full_address') 
                },
                links: {
                    ...(currentData.links || {}),
                    linkedin: val('linkedin'),
                    github: val('github'),
                    twitter: val('twitter'),
                    website: val('website')
                }
            };
            return;
        } else if (activeSection === 'statutory_and_legal') {
            userProfile[activeSection] = {
                ...currentData,
                pan_number: val('pan_number').toUpperCase(),
                aadhaar_number: val('aadhaar_number').replace(/\s/g, ''),
                requires_sponsorship: val('sponsorship_status') || "No",
                authorized_to_work_in_country: "Yes"
            };
            return;
        } else if (activeSection === 'job_preferences') {
            userProfile[activeSection] = {
                ...currentData,
                notice_period_days: val('notice_period'),
                expected_ctc_lpa: val('expected_ctc'),
                current_ctc_lpa: val('current_ctc') || "0",
                willing_to_relocate: val('relocate_status') || "Yes"
            };
            return;
        } else if (activeSection === 'education_history') {
            userProfile[activeSection] = {
                ...currentData,
                has_active_backlogs: val('active_backlogs') || "No",
                undergraduate: {
                    ...(currentData.undergraduate || {}),
                    degree: "Bachelor of Engineering",
                    specialization: val('ug_branch'),
                    institution: val('ug_institution'),
                    score_type: val('ug_score').includes('.') && parseFloat(val('ug_score')) <= 10 ? "CGPA" : "Percentage",
                    score: val('ug_score'),
                    start_date: parseDateForATS(val('ug_start_date')),
                    end_date: parseDateForATS(val('ug_end_date'))
                },
                twelfth_standard: {
                    ...(currentData.twelfth_standard || {}),
                    board: val('hsc_board'),
                    score_type: "Percentage",
                    score: val('hsc_score'),
                    start_date: parseDateForATS(val('hsc_start_date')),
                    end_date: parseDateForATS(val('hsc_end_date'))
                },
                tenth_standard: {
                    ...(currentData.tenth_standard || {}),
                    board: val('ssc_board') || "State Board",
                    score_type: "Percentage",
                    score: val('ssc_score'),
                    start_date: parseDateForATS(val('ssc_start_date')),
                    end_date: parseDateForATS(val('ssc_end_date'))
                }
            };
            return;
        }

        const sectionData = userProfile[activeSection];

        if (Array.isArray(sectionData) && !skipCurrentArrayRemoveEvent) {
             const newArr = [];
             const blocks = dynamicForm.querySelectorAll('.array-block');
             blocks.forEach(block => {
                 const newObj = {};
                 const inputs = block.querySelectorAll('.value-input');
                 inputs.forEach(input => {
                     const isGenericArrValue = input.dataset.key === "Value" && inputs.length === 1;
                     if(isGenericArrValue) {
                          newArr.push(input.value);
                          return;
                     }
                     
                     if (input.tagName === 'TEXTAREA') {
                         try { newObj[input.dataset.key] = JSON.parse(input.value); } 
                         catch(e) { newObj[input.dataset.key] = input.value; }
                     } else if (input.type === 'date') {
                         newObj[input.dataset.key] = parseDateForATS(input.value);
                     } else {
                         newObj[input.dataset.key] = input.value;
                     }
                 });
                 if (Object.keys(newObj).length > 0) newArr.push(newObj);
             });
             userProfile[activeSection] = newArr;
        } else if (typeof sectionData === 'object' && sectionData !== null) {
             const grid = dynamicForm.querySelector('.form-grid');
             if(grid) {
                 const newObj = {};
                 const inputs = grid.querySelectorAll('.value-input');
                 inputs.forEach(input => {
                     if (input.tagName === 'TEXTAREA') {
                         try { newObj[input.dataset.key] = JSON.parse(input.value); } 
                         catch(e) { newObj[input.dataset.key] = input.value; }
                     } else {
                         newObj[input.dataset.key] = input.value;
                     }
                 });
                 userProfile[activeSection] = newObj;
             }
        }
    }

    function initJSONEditor() {
        jsonTextarea.value = JSON.stringify(userProfile, null, 2);
    }

    // 4. Save and Import/Export globally
    let toastTimeout;
    btnSaveGlobal.addEventListener('click', () => {
        const activeNavBtn = document.querySelector('.nav-btn.active');
        if (activeNavBtn.dataset.view === 'form-view') syncFormToProfile();
        else {
            try { userProfile = JSON.parse(jsonTextarea.value); } 
            catch(e) { alert("Invalid JSON format. Cannot save."); return; }
        }

        chrome.storage.local.set({ userProfile: JSON.stringify(userProfile) }, () => {
            hasUnsavedChanges = false;
            const originalText = "Save Changes";
            btnSaveGlobal.innerText = "✅ Profile Saved & AI Optimized!";
            btnSaveGlobal.style.backgroundColor = "#10b981"; // Success green
            
            toastMessage.classList.add('show');
            toastMessage.classList.remove('hidden');
            
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                btnSaveGlobal.innerText = originalText;
                btnSaveGlobal.style.backgroundColor = "";
                toastMessage.classList.remove('show');
            }, 3000);
        });
    });

    btnExport.addEventListener('click', () => {
        syncFormToProfile();
        const dataStr = JSON.stringify(userProfile, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = "JobAutofill_Profile.json";
        a.click();
        URL.revokeObjectURL(url);
    });

    btnImport.addEventListener('click', () => { importFile.click(); });
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const newData = JSON.parse(event.target.result);
                if(typeof newData !== 'object') throw new Error("Not an object");
                userProfile = newData;
                activeSection = Object.keys(userProfile)[0];
                initJSONEditor();
                buildFormUI();
                document.querySelector('.nav-btn[data-view="form-view"]').click();
            } catch(err) {
                alert("Import failed: Invalid JSON file.");
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });
});
