// main.js
import { loadConfig, getConfig } from './config.js';
import { determineCoverageStatus, checkSafetyStop } from './logic.js';
import * as UI from './ui.js';

let currentResultType = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    
    // Expose UI functions to global scope so HTML onclick="..." still works
    // (Ideally, you would add event listeners here instead, but this keeps your HTML compatible)
    window.toggleEmployerField = UI.toggleEmployerField;
    window.clearError = UI.clearError;
    window.nextStep = handleNextStep; 
});

// --- STEP HANDLER ---
function handleNextStep(step) {
    if (!getConfig()) return;

    if (step === 2) {
        // validate step 1
        const medication = document.getElementById('medication');
        const bmi = document.getElementById('bmi');
        const comorbidities = document.querySelectorAll('input[name="comorbidity"]:checked');
        
        let isValid = true;
        
        // Reset errors
        UI.clearError('medication-error');
        UI.clearError('bmi-error');
        UI.clearError('comorbidity-error');

        if (!medication.value) {
            document.getElementById('medication-error').classList.remove('hidden');
            medication.classList.add('border-red-500');
            isValid = false;
        }
        if (!bmi.value) {
            document.getElementById('bmi-error').classList.remove('hidden');
            bmi.classList.add('border-red-500');
            isValid = false;
        }
        if (comorbidities.length === 0) {
            document.getElementById('comorbidity-error').classList.remove('hidden');
            isValid = false;
        }

        if (!isValid) return;

        // Safety Stop Check
        const safetyCheck = checkSafetyStop(parseFloat(bmi.value));
        if (!safetyCheck.safe) {
            UI.showModal(safetyCheck.modalId);
            return;
        }
    }

    UI.transitionToStep(step);
}

// --- FORM SUBMISSION ---
document.getElementById('clarity-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!getConfig()) return;

    // Validate Step 2 Inputs
    const carrier = document.getElementById('carrier');
    const state = document.getElementById('state');
    const planSource = document.getElementById('plan-source');
    let isValid = true;

    if (!carrier.value) {
        document.getElementById('carrier-error').classList.remove('hidden');
        carrier.classList.add('border-red-500');
        isValid = false;
    }
    if (!state.value) {
        document.getElementById('state-error').classList.remove('hidden');
        state.classList.add('border-red-500');
        isValid = false;
    }
    if (!planSource.value) {
        document.getElementById('source-error').classList.remove('hidden');
        planSource.classList.add('border-red-500');
        isValid = false;
    }

    if (!isValid) return;

    // Gather Data for Logic Engine
    const inputData = {
        carrier: carrier.value,
        state: state.value,
        bmi: parseFloat(document.getElementById('bmi').value),
        comorbidities: Array.from(document.querySelectorAll('input[name="comorbidity"]:checked')).map(cb => cb.value)
    };

    // Run Logic
    currentResultType = determineCoverageStatus(inputData);

    // Trigger Animation & Reveal
    UI.runLoadingSequence(getConfig(), () => {
        document.getElementById('email-gate').classList.remove('hidden');
    });
});

// --- EMAIL GATE UNLOCK ---
document.getElementById('email-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    // In a real app, you would POST the sensitiveData here
    // const sensitiveData = { ... };
    
    UI.displayResult(currentResultType);
});