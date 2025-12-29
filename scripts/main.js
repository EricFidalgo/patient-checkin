// scripts/main.js
import { loadConfig, getConfig } from './config.js';
import { determineCoverageStatus, checkSafetyStop, validateMemberID } from './logic.js';
import * as UI from './ui.js';
import { exportDataToTextFile } from './fileExport.js';

let currentResultType = null; 
let currentInputData = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    UI.populateFormInputs();
    await loadConfig();
    const year = new Date().getFullYear();
    document.querySelectorAll('.current-year').forEach(el => el.textContent = year);
    setupInputConstraints();

    window.toggleEmployerField = UI.toggleEmployerField;
    window.toggleCarrierField = UI.toggleCarrierField;
    window.clearError = UI.clearError;
    window.nextStep = handleNextStep; 
});

// --- INPUT CONSTRAINTS ---
function setupInputConstraints() {
    const ageInput = document.getElementById('age');
    const bmiInput = document.getElementById('bmi');
    const memberIdInput = document.getElementById('member-id');
    const invalidChars = ['e', 'E', '+', '-'];

    // 1. Block "e", "+", "-" on Keydown (Works for Desktop)
    const blockKeys = (e, extraBlocked = []) => {
        if (invalidChars.includes(e.key) || extraBlocked.includes(e.key)) {
            e.preventDefault();
        }
    };

    if (ageInput) {
        // Desktop Prevention
        ageInput.addEventListener('keydown', (e) => blockKeys(e, ['.'])); // Block Dot
        
        // Mobile/Paste Prevention (The iOS Fix)
        ageInput.addEventListener('input', function() {
            // Strictly replace anything that is NOT a number 0-9
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    if (bmiInput) {
        // Desktop Prevention
        bmiInput.addEventListener('keydown', (e) => blockKeys(e));

        // Mobile/Paste Prevention (The iOS Fix)
        bmiInput.addEventListener('input', function() {
            // 1. Allow only numbers and dots
            let val = this.value.replace(/[^0-9.]/g, '');
            
            // 2. Prevent double decimals (e.g. "31.5.5")
            const parts = val.split('.');
            if (parts.length > 2) {
                // Keep the first part and the first decimal, join the rest
                val = parts[0] + '.' + parts.slice(1).join('');
            }
            this.value = val;
        });

        // Format to 1 decimal on blur (e.g. "31" -> "31.0")
        bmiInput.addEventListener('change', function() {
            if (this.value) {
                this.value = parseFloat(this.value).toFixed(1);
            }
        });
    }
    
    if (memberIdInput) {
        // Clean Member ID (Uppercase + No Special Chars)
        memberIdInput.addEventListener('input', function() {
             this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
             this.classList.remove('border-red-500');
             const existingErr = document.getElementById('member-id-error');
             if (existingErr) existingErr.classList.add('u-hidden');
        });
    }
}
// --- STEP HANDLER ---
function handleNextStep(targetStep) {
    if (!getConfig()) return;

    if (targetStep === 2) {
        const bmi = document.getElementById('bmi');
        const age = document.getElementById('age');
        
        // --- NEW: Grab the Radio Buttons ---
        const conditionGate = document.querySelector('input[name="gate_conditions"]:checked');
        const medGate = document.querySelector('input[name="gate_meds"]:checked');
        
        // Get the hidden checkboxes (for safety check)
        const comorbidities = document.querySelectorAll('input[name="comorbidity"]:checked');
        const medHistory = document.querySelectorAll('input[name="med_history"]:checked');

        let isValid = true;
        
        // Clear Errors
        UI.clearError('bmi-error');
        UI.clearError('age-error');
        UI.clearError('comorbidity-error');
        UI.clearError('med-history-error');

        // 1. Validate Age & BMI
        if (!bmi.value) {
            document.getElementById('bmi-error').classList.remove('u-hidden');
            bmi.classList.add('border-red-500');
            isValid = false;
        }
        if (!age.value || parseInt(age.value) < 18) {
            document.getElementById('age-error').classList.remove('u-hidden');
            age.classList.add('border-red-500');
            isValid = false;
        }

        // 2. Validate "Conditions" Gate (Yes/No)
        if (!conditionGate) {
            // If they didn't click Yes or No, show error
            document.getElementById('comorbidity-error').classList.remove('u-hidden');
            isValid = false;
        } else if (conditionGate.value === 'yes' && comorbidities.length === 0) {
            // If they clicked "Yes" but didn't pick a condition
            document.getElementById('comorbidity-error').classList.remove('u-hidden');
            isValid = false;
        }

        // 3. Validate "Medication History" Gate (Yes/No)
        if (!medGate) {
            document.getElementById('med-history-error').classList.remove('u-hidden');
            isValid = false;
        } else if (medGate.value === 'yes' && medHistory.length === 0) {
            document.getElementById('med-history-error').classList.remove('u-hidden');
            isValid = false;
        }

        if (!isValid) return;

        // 4. Safety Stop Check
        const safetyCheck = checkSafetyStop(parseFloat(bmi.value));
        if (!safetyCheck.safe) {
            UI.showModal(safetyCheck.modalId);
            return;
        }
    }

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

    const carrier = document.getElementById('carrier');
    const planSource = document.getElementById('plan-source');
    const employerNameInput = document.getElementById('employer-name'); 
    
    // [FIX] Get the Radio Gate from Step 1 to check user intent
    const medGate = document.querySelector('input[name="gate_meds"]:checked');
    const medHistoryChecks = document.querySelectorAll('input[name="med_history"]:checked');
    
    const lifestyleInput = document.getElementById('lifestyle-program');
    const memberIdInput = document.getElementById('member-id');

    let isValid = true;

    // 1. Reset Errors
    UI.clearError('carrier-error');
    UI.clearError('source-error');
    UI.clearError('employer-error');
    UI.clearError('med-history-error');

    // 2. Validate Carrier
    if (!carrier.value) {
        document.getElementById('carrier-error').classList.remove('u-hidden');
        carrier.classList.add('border-red-500');
        isValid = false;
    }

    // 3. Validate Plan Source
    if (!planSource.value) {
        document.getElementById('source-error').classList.remove('u-hidden');
        planSource.classList.add('border-red-500');
        isValid = false;
    }

    // 4. Validate Employer Name (CONDITIONAL)
    if (planSource.value === 'employer') {
        if (!employerNameInput.value.trim()) {
            document.getElementById('employer-error').classList.remove('u-hidden');
            employerNameInput.classList.add('border-red-500');
            isValid = false;
        }
    }

    // 5. Validate Medication History ([FIXED] Logic)
    // Only require checkboxes if the user clicked "Yes" in Step 1, or if they somehow bypassed Step 1 (gate is null)
    if ((!medGate || medGate.value === 'yes') && medHistoryChecks.length === 0) {
        const errEl = document.getElementById('med-history-error');
        if (errEl) {
            errEl.classList.remove('u-hidden');
        }
        // If we fail here, we must probably alert the user they missed something in Step 1
        // But simply setting isValid = false stops the form.
        isValid = false; 
    }

    // --- MEMBER ID VALIDATION ---
    const existingErr = document.getElementById('member-id-error');
    if (existingErr) existingErr.classList.add('u-hidden');
    memberIdInput.classList.remove('border-red-500');

    const idValidation = validateMemberID(carrier.value, memberIdInput.value);
    
    if (!idValidation.valid) {
        isValid = false;
        memberIdInput.classList.add('border-red-500');
        
        let errDiv = document.getElementById('member-id-error');
        if (!errDiv) {
            errDiv = document.createElement('div');
            errDiv.id = 'member-id-error';
            errDiv.className = 'c-error-msg u-mt-sm';
            errDiv.innerHTML = '<span class="material-symbols-outlined c-error-icon">error</span> <span id="member-id-msg"></span>';
            memberIdInput.parentElement.parentElement.appendChild(errDiv);
        }
        document.getElementById('member-id-msg').textContent = idValidation.msg;
        errDiv.classList.remove('u-hidden');
    }

    if (!isValid) return; // STOP HERE if invalid

    // Gather Data
    currentInputData = {
        carrier: carrier.value,
        carrierSpecificName: (carrier.value === 'Other') 
            ? document.getElementById('other-carrier-name').value 
            : carrier.value,
        state: document.getElementById('state').value,
        planSource: planSource.value,
        employerName: employerNameInput ? employerNameInput.value : '',
        bmi: parseFloat(document.getElementById('bmi').value),
        age: parseInt(document.getElementById('age').value),
        comorbidities: Array.from(document.querySelectorAll('input[name="comorbidity"]:checked')).map(cb => cb.value),
        medicationHistory: Array.from(medHistoryChecks).map(cb => cb.value),
        medication: document.getElementById('medication').value,
        lifestyleProgramEnrollment: lifestyleInput ? lifestyleInput.checked : false
    };
    
    currentResultType = determineCoverageStatus(currentInputData);

    UI.runLoadingSequence(getConfig(), () => {
        document.getElementById('email-gate').classList.remove('u-hidden');
    });
});

document.getElementById('email-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    // 4. GET EMAIL AND TRIGGER DOWNLOAD
    const email = document.getElementById('user-email').value;
    
    if (currentInputData && currentResultType) {
        exportDataToTextFile(currentInputData, email, currentResultType);
    }

    UI.displayResult(currentResultType);
});

// Helper for UI Grid Logic
window.toggleGrid = function(type, isYes) {
    const wrapper = document.getElementById(type === 'conditions' ? 'wrapper-conditions' : 'wrapper-meds');
    const container = document.getElementById(type === 'conditions' ? 'comorbidity-grid' : 'med-history-grid');
    
    const noneCheckbox = container.querySelector('input[value="none"]');
    const allCheckboxes = container.querySelectorAll('input[type="checkbox"]');

    if (isYes) {
        wrapper.classList.remove('u-hidden');
        if (noneCheckbox) noneCheckbox.checked = false;
    } else {
        wrapper.classList.add('u-hidden');
        allCheckboxes.forEach(cb => cb.checked = false);
        if (noneCheckbox) noneCheckbox.checked = true;
    }
};