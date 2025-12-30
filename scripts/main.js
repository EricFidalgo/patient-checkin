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

    const carrierSelect = document.getElementById('carrier');
    if(carrierSelect) {
        // Update the hint whenever the user changes the carrier
        carrierSelect.addEventListener('change', UI.updateMemberIdHelper);
    }
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
        const stateHidden = document.getElementById('state'); 
        const zipInput = document.getElementById('zip-code');
        let isValid = true;
        
        UI.clearError('medication-error');

        // Manually clear zip error
        document.getElementById('zip-error').classList.add('u-hidden');
        if(zipInput) zipInput.classList.remove('border-red-500');

        if (!medication.value) {
            document.getElementById('medication-error').classList.remove('u-hidden');
            medication.classList.add('border-red-500'); 
            isValid = false;
        }
        
        // Validation: Check if the hidden state field was populated
        if (!stateHidden.value) {
            document.getElementById('zip-error').classList.remove('u-hidden');
            if(zipInput) zipInput.classList.add('border-red-500');
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
        zipCode: document.getElementById('zip-code').value,
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

// --- EMAIL FORM LISTENER ---
document.getElementById('email-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const email = document.getElementById('user-email').value.trim();
    const phone = document.getElementById('user-phone').value.trim();
    const firstName = document.getElementById('sign-first-name').value.trim();
    const lastName = document.getElementById('sign-last-name').value.trim();
    const errorEl = document.getElementById('contact-error');

    // 1. Name Validation (Letters only, min 2 characters)
    const nameRegex = /^[a-zA-Z\s-]{2,}$/;
    
    if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
        errorEl.innerHTML = '<span class="material-symbols-outlined c-error-icon">error</span> Please enter a valid first and last name.';
        errorEl.classList.remove('u-hidden');
        return;
    }

    // 2. Contact Presence Check
    if (!email && !phone) {
        errorEl.textContent = "Please provide an email or phone number.";
        errorEl.classList.remove('u-hidden');
        return;
    }

    // 3. Phone Format Validation (if provided)
    if (phone) {
        const phoneRegex = /^(\+?\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
        if (!phoneRegex.test(phone)) {
            errorEl.innerHTML = '<span class="material-symbols-outlined c-error-icon">error</span> Please enter a valid phone number.';
            errorEl.classList.remove('u-hidden');
            return;
        }
    }

    errorEl.classList.add('u-hidden');

    if (currentInputData && currentResultType) {
        // Map data to currentInputData for export
        currentInputData.firstName = firstName;
        currentInputData.lastName = lastName;
        currentInputData.fullName = `${firstName} ${lastName}`;
        currentInputData.email = email || "Not Provided";
        currentInputData.phone = phone || "Not Provided";
        
        currentInputData.signatureTimestamp = new Date().toISOString();
        currentInputData.signatureType = "Electronic (Typed Name)";
        currentInputData.tcpaConsent = !!phone; 

        exportDataToTextFile(currentInputData, currentInputData.email, currentResultType);
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