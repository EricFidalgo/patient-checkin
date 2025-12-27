// scripts/main.js
import { loadConfig, getConfig } from './config.js';
import { determineCoverageStatus, checkSafetyStop } from './logic.js';
import * as UI from './ui.js';

let currentResultType = null; // Will now store an object: { status: '...', reason: '...' }

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    const year = new Date().getFullYear();
    document.querySelectorAll('.current-year').forEach(el => el.textContent = year);
    
    // Expose UI functions to global scope so HTML onclick="..." works
    window.toggleEmployerField = UI.toggleEmployerField;
    window.clearError = UI.clearError;
    window.nextStep = handleNextStep; 
});

// --- STEP HANDLER ---
function handleNextStep(step) {
    if (!getConfig()) return;

    if (step === 2) {
        // validate step 1 inputs
        const medication = document.getElementById('medication');
        const bmi = document.getElementById('bmi');
        const age = document.getElementById('age');
        const comorbidities = document.querySelectorAll('input[name="comorbidity"]:checked');
        
        let isValid = true;
        
        // Reset errors
        UI.clearError('medication-error');
        UI.clearError('bmi-error');
        UI.clearError('age-error');
        UI.clearError('comorbidity-error');

        if (!medication.value) {
            document.getElementById('medication-error').classList.remove('u-hidden');
            medication.classList.add('border-red-500'); 
            isValid = false;
        }
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
    // Retrieve medication from Step 1
    const medication = document.getElementById('medication');

    let isValid = true;

    // Reset errors first
    UI.clearError('carrier-error');
    UI.clearError('state-error');
    UI.clearError('source-error');

    if (!carrier.value) {
        document.getElementById('carrier-error').classList.remove('u-hidden');
        carrier.classList.add('border-red-500');
        isValid = false;
    }
    if (!state.value) {
        document.getElementById('state-error').classList.remove('u-hidden');
        state.classList.add('border-red-500');
        isValid = false;
    }
    if (!planSource.value) {
        document.getElementById('source-error').classList.remove('u-hidden');
        planSource.classList.add('border-red-500');
        isValid = false;
    }

    if (!isValid) return;

    // Gather Data for Logic Engine
    const inputData = {
        carrier: carrier.value,
        state: state.value,
        bmi: parseFloat(document.getElementById('bmi').value),
        age: parseInt(document.getElementById('age').value),
        // Collect checkboxes from Step 1
        comorbidities: Array.from(document.querySelectorAll('input[name="comorbidity"]:checked')).map(cb => cb.value),
        medicationHistory: Array.from(document.querySelectorAll('input[name="med_history"]:checked')).map(cb => cb.value),
        medication: medication.value 
    };

    // Run Logic (Returns object {status, reason})
    currentResultType = determineCoverageStatus(inputData);

    // Trigger Animation & Reveal
    UI.runLoadingSequence(getConfig(), () => {
        document.getElementById('email-gate').classList.remove('u-hidden');
    });
});

// --- EMAIL GATE UNLOCK ---
document.getElementById('email-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Pass the full result object (status + reason) to the UI
    UI.displayResult(currentResultType);
});