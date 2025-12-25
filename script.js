let currentResultType = null;

// --- UI TOGGLE (NEW) ---
function toggleEmployerField() {
    const source = document.getElementById('plan-source').value;
    const employerField = document.getElementById('employer-field');
    const sourceError = document.getElementById('source-error');
    
    // Clear error when user interacts
    sourceError.classList.add('hidden');
    document.getElementById('plan-source').classList.remove('border-red-500');

    if (source === 'employer') {
        employerField.classList.remove('hidden');
    } else {
        employerField.classList.add('hidden');
    }
}

function nextStep(step) {
    // STEP 1 VALIDATION & SAFETY STOP
    if (step === 2) {
        let isValid = true;
        const medication = document.getElementById('medication');
        const bmi = document.getElementById('bmi');
        const comorbidities = document.querySelectorAll('input[name="comorbidity"]:checked');

        medication.classList.remove('border-red-500');
        bmi.classList.remove('border-red-500');
        document.getElementById('medication-error').classList.add('hidden');
        document.getElementById('bmi-error').classList.add('hidden');
        document.getElementById('comorbidity-error').classList.add('hidden');

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

        // --- THE SAFETY STOP LOGIC (Immediate Check) ---
        if (parseFloat(bmi.value) < 27) {
            document.getElementById('safety-stop-modal').classList.remove('hidden');
            return; // STOP execution here
        }
    }

    // Execute Transition (Only handling steps 1 and 2 now)
    document.querySelectorAll('.step-transition').forEach(el => el.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');
    
    // Update progress bar (Now out of 2 steps)
    document.getElementById('progress').style.width = `${(step / 2) * 100}%`;
}

function clearError(elementId) {
    document.getElementById(elementId).classList.add('hidden');
    if(elementId === 'medication-error') document.getElementById('medication').classList.remove('border-red-500');
    if(elementId === 'bmi-error') document.getElementById('bmi').classList.remove('border-red-500');
    if(elementId === 'carrier-error') document.getElementById('carrier').classList.remove('border-red-500');
    if(elementId === 'state-error') document.getElementById('state').classList.remove('border-red-500');
}

// --- LOGIC ENGINE ---
function determineCoverageStatus() {
    const carrier = document.getElementById('carrier').value;
    const bmi = parseFloat(document.getElementById('bmi').value);
    
    // Get Checked Comorbidities
    const comorbidityCheckboxes = document.querySelectorAll('input[name="comorbidity"]:checked');
    const hasComorbidities = Array.from(comorbidityCheckboxes).some(cb => cb.value !== 'none');

    // Rule 1: Hard Red (Medicare)
    if (carrier === 'Medicare') {
        return 'red';
    }

    // Rule 2: Force Yellow (Strict PAs)
    if (['UnitedHealthcare', 'Cigna'].includes(carrier)) {
        return 'yellow';
    }

    // Rule 3: The Grey Light (BMI 27-29 + No Comorbidities)
    // Note: Step 1 validator already blocks BMI < 27
    if (bmi < 30 && !hasComorbidities) {
        return 'grey'; 
    }

    // Rule 4: Green Light (High Probability)
    return 'green';
}

// --- SUBMISSION & ANIMATION ---
document.getElementById('clarity-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    let isValid = true;
    
    // 1. Validate Carrier
    const carrier = document.getElementById('carrier');
    if (!carrier.value) {
        document.getElementById('carrier-error').classList.remove('hidden');
        carrier.classList.add('border-red-500');
        isValid = false;
    }

    // 2. Validate State (NEW STRICT CHECK)
    const state = document.getElementById('state');
    if (!state.value) {
        document.getElementById('state-error').classList.remove('hidden');
        state.classList.add('border-red-500');
        isValid = false;
    }

    // 3. NEW: Validate Plan Source
    const planSource = document.getElementById('plan-source');
    if (!planSource.value) {
        document.getElementById('source-error').classList.remove('hidden');
        planSource.classList.add('border-red-500');
        isValid = false;
    }

    // Stop if any are missing
    if (!isValid) return; 

    // --- Proceed to Loading Animation ---
    document.getElementById('form-container').classList.add('hidden');
    document.getElementById('intro-section').classList.add('hidden');
    
    const loadingState = document.getElementById('loading-state');
    const loadingText = document.getElementById('loading-text');
    const loadingBar = document.getElementById('loading-bar');
    
    loadingState.classList.remove('hidden');

    // Animations...
    setTimeout(() => { loadingBar.style.width = "40%"; }, 100);
    setTimeout(() => { loadingBar.style.width = "75%"; }, 1500);
    setTimeout(() => { loadingBar.style.width = "100%"; }, 3500);
    
    // Rotating Text
    setTimeout(() => { loadingText.textContent = "Comparing BMI with FDA Clinical Criteria..."; }, 1500);
    setTimeout(() => { loadingText.textContent = "Identifying Secondary Coverage Pathways..."; }, 3000);

    currentResultType = determineCoverageStatus();

    setTimeout(() => {
        loadingState.classList.add('hidden');
        document.getElementById('email-gate').classList.remove('hidden');
    }, 4000);
});

// --- UNLOCK RESULTS ---
document.getElementById('email-form').addEventListener('submit', (e) => {
    e.preventDefault();

    // 1. Capture Comorbidities
    const selectedComorbidities = Array.from(
        document.querySelectorAll('input[name="comorbidity"]:checked')
    ).map(cb => cb.value);

    // 1. DATA PACKAGING (Updated with new fields)
    const sensitiveData = {
        email: document.getElementById('user-email').value,
        medication: document.getElementById('medication').value,
        bmi: document.getElementById('bmi').value,
        comorbidities: selectedComorbidities,
        planSource: document.getElementById('plan-source').value,      // NEW
        employerName: document.getElementById('employer-name').value,  // NEW
        carrier: document.getElementById('carrier').value,
        state: document.getElementById('state').value,
        memberId: document.getElementById('member-id').value || "NOT_PROVIDED"
    };

    // 2. SECURITY PLACEHOLDER
    // TODO: Encrypt 'sensitiveData' payload using AES-256 before POST request

    document.getElementById('email-gate').classList.add('hidden');
    document.getElementById('results-container').classList.remove('hidden');

    // Handle Grey result display
    if (currentResultType === 'green') {
        document.getElementById('result-green').classList.remove('hidden');
    } else if (currentResultType === 'yellow') {
        document.getElementById('result-yellow').classList.remove('hidden');
    } else if (currentResultType === 'grey') {
        document.getElementById('result-grey').classList.remove('hidden');
    } else {
        document.getElementById('result-red').classList.remove('hidden');
    }
});