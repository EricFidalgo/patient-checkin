let currentResultType = null;
let APP_CONFIG = null; // Global variable to hold the fetched config

// --- INITIALIZATION ---
// Fetch the config.json when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error('Failed to load configuration');
        APP_CONFIG = await response.json();
        console.log('VeriScript Configuration Loaded');
    } catch (error) {
        console.error('Error loading config:', error);
        alert('System Error: Unable to load coverage rules. Please refresh the page.');
    }
});

// --- UI TOGGLE ---
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
    if (!APP_CONFIG) return; // Ensure config is loaded before proceeding

    // STEP 1 VALIDATION & SAFETY STOP
    if (step === 2) {
        let isValid = true;
        const medication = document.getElementById('medication');
        const bmi = document.getElementById('bmi');
        const comorbidities = document.querySelectorAll('input[name="comorbidity"]:checked');

        // Clear existing error states
        medication.classList.remove('border-red-500');
        bmi.classList.remove('border-red-500');
        document.getElementById('medication-error').classList.add('hidden');
        document.getElementById('bmi-error').classList.add('hidden');
        document.getElementById('comorbidity-error').classList.add('hidden');

        // Validation Checks
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

        // --- DYNAMIC SAFETY STOP LOGIC ---
        // Uses thresholds from config.json
        const safetyRules = APP_CONFIG.safety_stop;
        if (safetyRules.enabled) {
            if (parseFloat(bmi.value) < safetyRules.min_bmi) {
                document.getElementById(safetyRules.modal_id).classList.remove('hidden');
                return; // STOP execution here
            }
        }
    }

    // Execute Transition
    document.querySelectorAll('.step-transition').forEach(el => el.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');
    
    // Update progress bar
    document.getElementById('progress').style.width = `${(step / 2) * 100}%`;
}

function clearError(elementId) {
    document.getElementById(elementId).classList.add('hidden');
    if(elementId === 'medication-error') document.getElementById('medication').classList.remove('border-red-500');
    if(elementId === 'bmi-error') document.getElementById('bmi').classList.remove('border-red-500');
    if(elementId === 'carrier-error') document.getElementById('carrier').classList.remove('border-red-500');
    if(elementId === 'state-error') document.getElementById('state').classList.remove('border-red-500');
}

function determineCoverageStatus() {
    if (!APP_CONFIG) return 'yellow'; // Fallback

    const carrier = document.getElementById('carrier').value;
    const state = document.getElementById('state').value;
    const bmi = parseFloat(document.getElementById('bmi').value);
    
    // Check Comorbidities
    const comorbidityCheckboxes = document.querySelectorAll('input[name="comorbidity"]:checked');
    const hasDiabetes = Array.from(comorbidityCheckboxes).some(cb => cb.value === 'diabetes');
    const hasHypertension = Array.from(comorbidityCheckboxes).some(cb => cb.value === 'hypertension');

    const overrides = APP_CONFIG.clinical_overrides;

    // --- RULE 1: DIABETES OVERRIDE (Dynamic) ---
    if (overrides.diabetes_guarantee.enabled) {
        // Check if selected comorbidities include the trigger (e.g., 'diabetes')
        const triggerCondition = overrides.diabetes_guarantee.condition_trigger;
        const isTriggerPresent = Array.from(comorbidityCheckboxes).some(cb => cb.value === triggerCondition);
        
        if (isTriggerPresent) {
            return overrides.diabetes_guarantee.result_override;
        }
    }

    // --- RULE 2: MEDICARE CARDIAC LOOPHOLE (Dynamic) ---
    const medicareRule = overrides.medicare_cardiac_loophole;
    if (medicareRule.enabled && carrier === medicareRule.carrier_trigger) {
        const hasCondition = Array.from(comorbidityCheckboxes).some(cb => cb.value === medicareRule.required_condition);
        
        if (hasCondition && bmi >= medicareRule.min_bmi) {
            return medicareRule.result_success; // 'grey'
        }
        return medicareRule.result_fail; // 'red'
    }

    // --- RULE 3: CARRIER LOOKUP (Dynamic from JSON) ---
    let result = 'yellow'; // Fallback
    
    const rules = APP_CONFIG.carrier_rules;
    const carrierData = rules[carrier] || rules["Other"];
    
    // Check specific state rule, otherwise use default for that carrier
    result = carrierData.states[state] || carrierData.default;
    
    if (carrier === 'BCBS' && state === 'CA') {
        if (bmi >= 40) return 'yellow'; // BSCA Class III Mandate
        return 'red'; // BSCA excludes Class I/II
    }

    // --- RULE 4: CLINICAL NUANCE / GREY ZONE (Dynamic) ---
    const greyRule = overrides.grey_zone_check;
    const hasComorbidities = comorbidityCheckboxes.length > 0;

    if (greyRule.enabled) {
        // If technically approved (green/yellow) BUT low BMI & no comorbidities -> Downgrade
        if ((result === 'green' || result === 'yellow') && 
            bmi < greyRule.max_bmi_threshold && 
            !hasComorbidities) {
            return greyRule.result_override;
        }
    }

    return result;
}

// --- SUBMISSION & ANIMATION ---
document.getElementById('clarity-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!APP_CONFIG) return;

    let isValid = true;
    
    // 1. Validate Carrier
    const carrier = document.getElementById('carrier');
    if (!carrier.value) {
        document.getElementById('carrier-error').classList.remove('hidden');
        carrier.classList.add('border-red-500');
        isValid = false;
    }

    // 2. Validate State
    const state = document.getElementById('state');
    if (!state.value) {
        document.getElementById('state-error').classList.remove('hidden');
        state.classList.add('border-red-500');
        isValid = false;
    }

    // 3. Validate Plan Source
    const planSource = document.getElementById('plan-source');
    if (!planSource.value) {
        document.getElementById('source-error').classList.remove('hidden');
        planSource.classList.add('border-red-500');
        isValid = false;
    }

    if (!isValid) return; 

    // --- Proceed to Loading Animation ---
    document.getElementById('form-container').classList.add('hidden');
    document.getElementById('intro-section').classList.add('hidden');
    
    const loadingState = document.getElementById('loading-state');
    const loadingText = document.getElementById('loading-text');
    const loadingBar = document.getElementById('loading-bar');
    
    loadingState.classList.remove('hidden');

    // Dynamic Animation Timings from Config
    const animSettings = APP_CONFIG.ui_settings.loading_animation;

    // Bar Progress
    animSettings.steps.forEach(step => {
        setTimeout(() => { loadingBar.style.width = `${step.percent}%`; }, step.time_ms);
    });
    
    // Text Updates
    animSettings.text_updates.forEach(update => {
        setTimeout(() => { loadingText.textContent = update.text; }, update.time_ms);
    });

    currentResultType = determineCoverageStatus();

    // Final reveal logic (timed to match the last animation step)
    const totalAnimationTime = Math.max(...animSettings.steps.map(s => s.time_ms)) + 500;
    
    setTimeout(() => {
        loadingState.classList.add('hidden');
        document.getElementById('email-gate').classList.remove('hidden');
    }, totalAnimationTime);
});

// --- UNLOCK RESULTS ---
document.getElementById('email-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const selectedComorbidities = Array.from(
        document.querySelectorAll('input[name="comorbidity"]:checked')
    ).map(cb => cb.value);

    const sensitiveData = {
        email: document.getElementById('user-email').value,
        medication: document.getElementById('medication').value,
        bmi: document.getElementById('bmi').value,
        comorbidities: selectedComorbidities,
        planSource: document.getElementById('plan-source').value,
        employerName: document.getElementById('employer-name').value,
        carrier: document.getElementById('carrier').value,
        state: document.getElementById('state').value,
        memberId: document.getElementById('member-id').value || "NOT_PROVIDED"
    };

    // TODO: Encryption implementation here

    document.getElementById('email-gate').classList.add('hidden');
    document.getElementById('results-container').classList.remove('hidden');

    // Result Display
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