// scripts/ui.js
import { getConfig } from './config.js';
import { formData } from './formData.js'; 

export function populateFormInputs() {
    // Helper to create options
    const createOptions = (selectId, dataArray) => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const placeholder = select.firstElementChild;
        select.innerHTML = '';
        select.appendChild(placeholder);

        dataArray.forEach(item => {
            const opt = document.createElement('option');
            if (typeof item === 'string') {
                opt.value = item;
                opt.textContent = item;
            } else {
                opt.value = item.value;
                opt.textContent = item.label;
            }
            select.appendChild(opt);
        });
    };

    // Helper to create checkboxes
    const createCheckboxes = (containerId, dataArray, inputName) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = ''; // Clear existing

        dataArray.forEach(item => {
            const label = document.createElement('label');
            label.className = 'c-check-card';
            
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = inputName;
            input.value = item.value;

            // --- NEW: Add Exclusivity Logic ---
            input.addEventListener('change', function() {
                const allChecks = container.querySelectorAll(`input[name="${inputName}"]`);
                
                if (this.value === 'none' && this.checked) {
                    // If "None" is checked, uncheck everything else
                    allChecks.forEach(cb => {
                        if (cb !== this) cb.checked = false;
                    });
                } else if (this.value !== 'none' && this.checked) {
                    // If any other option is checked, uncheck "None"
                    allChecks.forEach(cb => {
                        if (cb.value === 'none') cb.checked = false;
                    });
                }
            });
            // ----------------------------------

            label.appendChild(input);
            label.appendChild(document.createTextNode(' ' + item.label));
            container.appendChild(label);
        });
    };

    createOptions('medication', formData.medications);
    createOptions('plan-source', formData.planSources);
    createOptions('carrier', formData.carriers);

    createCheckboxes('med-history-grid', formData.medicationHistory, 'med_history');
    createCheckboxes('comorbidity-grid', formData.comorbidities, 'comorbidity');

    initZipCodeListener();
}

function initZipCodeListener() {
    const zipInput = document.getElementById('zip-code');
    const stateInput = document.getElementById('state'); // The hidden field
    const stateBadge = document.getElementById('state-badge');
    const errorMsg = document.getElementById('zip-error');
    const errorText = document.getElementById('zip-error-text');

    if (!zipInput) return;

    zipInput.addEventListener('input', async function() {
        // 1. Clean input (numbers only)
        this.value = this.value.replace(/[^0-9]/g, '');
        const zip = this.value;

        // Reset UI if user is typing
        if (zip.length < 5) {
            stateInput.value = '';
            stateBadge.classList.add('u-hidden');
            zipInput.classList.remove('border-red-500', 'border-green-500');
            errorMsg.classList.add('u-hidden');
            return;
        }

        // 2. Fetch State when 5 digits reached
        try {
            const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
            
            if (!response.ok) throw new Error('Invalid Zip');

            const data = await response.json();
            const stateAbbr = data.places[0]['state abbreviation'];

            // 3. Update Hidden State Field & UI
            stateInput.value = stateAbbr; // This feeds the backend logic
            
            // Show the resolved state to the user
            stateBadge.textContent = stateAbbr;
            stateBadge.classList.remove('u-hidden');
            
            // Visual Success
            zipInput.classList.remove('border-red-500');
            zipInput.classList.add('border-green-500'); // Optional: Add a green border style in CSS
            errorMsg.classList.add('u-hidden');

        } catch (error) {
            // Handle Invalid Zip
            stateInput.value = '';
            stateBadge.classList.add('u-hidden');
            zipInput.classList.add('border-red-500');
            errorText.textContent = "Invalid Zip Code";
            errorMsg.classList.remove('u-hidden');
        }
    });
}

export function toggleCarrierField() {
    const carrier = document.getElementById('carrier').value;
    const otherField = document.getElementById('other-carrier-field');
    
    // Clear error style if they change selection
    document.getElementById('carrier').classList.remove('border-red-500');
    document.getElementById('carrier-error').classList.add('u-hidden');

    if (carrier === 'Other') {
        otherField.classList.remove('u-hidden');
    } else {
        otherField.classList.add('u-hidden');
        // Clear value if they switch away so we don't submit bad data
        const otherInput = document.getElementById('other-carrier-name');
        if(otherInput) otherInput.value = ''; 
    }
}

export function toggleEmployerField() {
    const source = document.getElementById('plan-source').value;
    const employerField = document.getElementById('employer-field');
    const sourceError = document.getElementById('source-error');
    
    sourceError.classList.add('u-hidden');
    document.getElementById('plan-source').classList.remove('border-red-500');

    if (source === 'employer') {
        employerField.classList.remove('u-hidden');
    } else {
        employerField.classList.add('u-hidden');
    }
}

export function clearError(elementId) {
    const el = document.getElementById(elementId);
    if(el) el.classList.add('u-hidden');
    
    const inputMap = {
        'medication-error': 'medication',
        'bmi-error': 'bmi',
        'age-error': 'age',
        'carrier-error': 'carrier',
        'state-error': 'state',
        'source-error': 'plan-source',
        'comorbidity-error': null 
    };
    
    if (inputMap[elementId]) {
        const inputEl = document.getElementById(inputMap[elementId]);
        if(inputEl) inputEl.classList.remove('border-red-500');
    }
}

export function transitionToStep(step) {
    // Hide all steps
    document.querySelectorAll('[data-js="step"]').forEach(el => el.classList.add('u-hidden'));
    
    // Show target step
    document.getElementById(`step-${step}`).classList.remove('u-hidden');
    
    // Update Progress Bar (3 steps total)
    const progress = document.getElementById('progress');
    if(progress) progress.style.width = `${(step / 3) * 100}%`;

    const header = document.getElementById('form-header');
    if (header) header.scrollIntoView({ behavior: 'smooth' });
}

export function runLoadingSequence(config, onComplete) {
    const loadingState = document.getElementById('loading-state');
    const loadingText = document.getElementById('loading-text');
    const loadingBar = document.getElementById('loading-bar');
    
    document.getElementById('form-container').classList.add('u-hidden');
    loadingState.classList.remove('u-hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const animSettings = config.ui_settings.loading_animation;

    animSettings.steps.forEach(step => {
        setTimeout(() => { loadingBar.style.width = `${step.percent}%`; }, step.time_ms);
    });
    
    animSettings.text_updates.forEach(update => {
        setTimeout(() => { loadingText.textContent = update.text; }, update.time_ms);
    });

    const totalTime = Math.max(...animSettings.steps.map(s => s.time_ms)) + 500;
    
    setTimeout(() => {
        loadingState.classList.add('u-hidden');
        onComplete();
    }, totalTime);
}

export function displayResult(resultData) {
    const resultType = resultData.status || resultData;
    const reasonText = resultData.reason || "Standard clinical criteria applied.";

    document.getElementById('email-gate').classList.add('u-hidden');
    document.getElementById('results-container').classList.remove('u-hidden');

    const resultIds = {
        'green': 'result-green',
        'yellow': 'result-yellow',
        'red': 'result-red'
    };
    
    Object.values(resultIds).forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('u-hidden');
    });
    
    const targetId = resultIds[resultType] || 'result-red';
    const targetEl = document.getElementById(targetId);
    targetEl.classList.remove('u-hidden');

    const reasonEl = targetEl.querySelector('.js-reason-text');
    if (reasonEl) {
        reasonEl.textContent = reasonText;
        reasonEl.classList.remove('u-hidden'); 
    }

    const config = getConfig();
    if (config && config.pricing_intelligence) {
        if (resultType === 'green') {
            const priceBox = targetEl.querySelector('.c-price-box');
            let warningEl = targetEl.querySelector('.js-acc-warning');
            if (!warningEl) {
                warningEl = document.createElement('p');
                warningEl.className = 't-xs u-text-error u-mt-sm js-acc-warning';
                priceBox.after(warningEl);
            }
            warningEl.textContent = config.pricing_intelligence.savings_card_warning;
        }

        if (resultType === 'red') {
            const priceBox = targetEl.querySelector('.c-price-box');
            let warningEl = targetEl.querySelector('.js-reg-warning');
            if (!warningEl) {
                warningEl = document.createElement('p');
                warningEl.className = 't-xs u-text-warning u-mt-sm js-reg-warning';
                priceBox.after(warningEl);
            }
            warningEl.textContent = config.pricing_intelligence.compounding_warning;
        }
    }
}

export function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('u-hidden');
    }
}

export function updateMemberIdHelper() {
    const carrierSelect = document.getElementById('carrier');
    const helperText = document.getElementById('member-id-helper-text'); // We will add this ID to HTML
    const selectedCarrier = carrierSelect.value;
    const config = getConfig();

    // Default message if no carrier selected or no specific rule exists
    const defaultMsg = "Providing your Member ID allows our partner pharmacies to manually verify your 2025 benefits.";

    if (!config || !config.coverage_engine_config || !selectedCarrier || selectedCarrier === 'Other') {
        helperText.textContent = defaultMsg;
        return;
    }

    const carrierRules = config.coverage_engine_config[selectedCarrier];

    // If the carrier has specific help text in the JSON, use it.
    if (carrierRules && carrierRules.member_id_validation && carrierRules.member_id_validation.help_text) {
        // highlight the text to make it noticeable
        helperText.innerHTML = `<span class="u-text-primary t-semi">Format Hint:</span> ${carrierRules.member_id_validation.help_text}`;
    } else {
        helperText.textContent = defaultMsg;
    }
}