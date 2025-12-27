// scripts/main.js
import { loadConfig, getConfig } from './config.js';
import { determineCoverageStatus, checkSafetyStop } from './logic.js';
import * as UI from './ui.js';

let currentResultType = null; 

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load Data into Form
    UI.populateFormInputs();

    // 2. Load Config & Date
    await loadConfig();
    const year = new Date().getFullYear();
    document.querySelectorAll('.current-year').forEach(el => el.textContent = year);
    
    window.toggleEmployerField = UI.toggleEmployerField;
    window.clearError = UI.clearError;
    window.nextStep = handleNextStep; 
});

// --- STEP HANDLER ---
function handleNextStep(targetStep) {
    if (!getConfig()) return;

    // VALIDATE STEP 1 (Moving to Step 2)
    if (targetStep === 2) {
        const bmi = document.getElementById('bmi');
        const age = document.getElementById('age');
        const comorbidities = document.querySelectorAll('input[name="comorbidity"]:checked');
        
        let isValid = true;
        
        UI.clearError('bmi-error');
        UI.clearError('age-error');
        UI.clearError('comorbidity-error');

        if (!bmi.value) {
            document.getElementById('bmi-error').classList.remove('u-hidden');
            bmi.classList.add('border-red-500');
            isValid = false;
        }
        if (!age.value) {
            document.getElementById('age-error').classList.remove('u-hidden');
            age.classList.add('border-red-500');
            isValid = false;
        }
        if (comorbidities.length === 0) {
            document.getElementById('comorbidity-error').classList.remove('u-hidden');
            isValid = false;
        }

        if (!isValid) return;

        // Perform Clinical Safety Check immediately after clinical data is entered
        const safetyCheck = checkSafetyStop(parseFloat(bmi.value));
        if (!safetyCheck.safe) {
            UI.showModal(safetyCheck.modalId);
            return;
        }
    }

    // VALIDATE STEP 2 (Moving to Step 3)
    if (targetStep === 3) {
        const medication = document.getElementById('medication');
        const state = document.getElementById('state');
        
        let isValid = true;
        
        UI.clearError('medication-error');
        UI.clearError('state-error');

        if (!medication.value) {
            document.getElementById('medication-error').classList.remove('u-hidden');
            medication.classList.add('border-red-500'); 
            isValid = false;
        }
        if (!state.value) {
            document.getElementById('state-error').classList.remove('u-hidden');
            state.classList.add('border-red-500');
            isValid = false;
        }

        if (!isValid) return;
    }

    UI.transitionToStep(targetStep);
}

// --- FORM SUBMISSION (STEP 3) ---
document.getElementById('clarity-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!getConfig()) return;

    // Validate Step 3 Inputs
    const carrier = document.getElementById('carrier');
    const planSource = document.getElementById('plan-source');
    const employerNameInput = document.getElementById('employer-name'); 
    const lifestyleInput = document.getElementById('lifestyle-program');

    let isValid = true;

    UI.clearError('carrier-error');
    UI.clearError('source-error');

    if (!carrier.value) {
        document.getElementById('carrier-error').classList.remove('u-hidden');
        carrier.classList.add('border-red-500');
        isValid = false;
    }
    if (!planSource.value) {
        document.getElementById('source-error').classList.remove('u-hidden');
        planSource.classList.add('border-red-500');
        isValid = false;
    }

    if (!isValid) return;

    // Gather Data (from all steps)
    const inputData = {
        carrier: carrier.value,
        state: document.getElementById('state').value,
        planSource: planSource.value,
        employerName: employerNameInput ? employerNameInput.value : '',
        bmi: parseFloat(document.getElementById('bmi').value),
        age: parseInt(document.getElementById('age').value),
        comorbidities: Array.from(document.querySelectorAll('input[name="comorbidity"]:checked')).map(cb => cb.value),
        medicationHistory: Array.from(document.querySelectorAll('input[name="med_history"]:checked')).map(cb => cb.value),
        medication: document.getElementById('medication').value,
        lifestyleProgramEnrollment: lifestyleInput ? lifestyleInput.checked : false
    };

    currentResultType = determineCoverageStatus(inputData);

    UI.runLoadingSequence(getConfig(), () => {
        document.getElementById('email-gate').classList.remove('u-hidden');
    });
});

document.getElementById('email-form').addEventListener('submit', (e) => {
    e.preventDefault();
    UI.displayResult(currentResultType);
});