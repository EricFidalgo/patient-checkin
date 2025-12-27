// scripts/ui.js
import { getConfig } from './config.js';
import { formData } from './formData.js'; // Import the new data

export function populateFormInputs() {
    // Helper to create options
    const createOptions = (selectId, dataArray) => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        // Keep the first "placeholder" option (index 0)
        const placeholder = select.firstElementChild;
        select.innerHTML = '';
        select.appendChild(placeholder);

        dataArray.forEach(item => {
            const opt = document.createElement('option');
            // Handle simple array of strings (like states) vs objects
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

            label.appendChild(input);
            label.appendChild(document.createTextNode(' ' + item.label));
            container.appendChild(label);
        });
    };

    // Execute Population
    createOptions('medication', formData.medications);
    createOptions('plan-source', formData.planSources);
    createOptions('carrier', formData.carriers);
    createOptions('state', formData.states);

    createCheckboxes('med-history-grid', formData.medicationHistory, 'med_history');
    createCheckboxes('comorbidity-grid', formData.comorbidities, 'comorbidity');
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
    document.querySelectorAll('[data-js="step"]').forEach(el => el.classList.add('u-hidden'));
    document.getElementById(`step-${step}`).classList.remove('u-hidden');
    
    const progress = document.getElementById('progress');
    if(progress) progress.style.width = `${(step / 2) * 100}%`;

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