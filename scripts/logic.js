// scripts/logic.js
import { getConfig } from './config.js';

/**
 * Main function to determine coverage status based on user input and config rules.
 */
export function determineCoverageStatus(inputData) {
    const config = getConfig();
    if (!config || !config.coverage_engine_config) {
        return { status: 'yellow', reason: 'Configuration Error: Rules not loaded.' };
    }

    const { carrier, carrierSpecificName } = inputData;
    let targetCarrier = carrier;

    // 1. Resolve Carrier Config
    // Normalize "Other" input to map to known major carriers if typed manually
    if (carrier === 'Other' && carrierSpecificName) {
        const name = carrierSpecificName.toLowerCase();
        if (name.includes('aetna')) targetCarrier = 'Aetna';
        else if (name.includes('cigna')) targetCarrier = 'Cigna';
        else if (name.includes('blue') || name.includes('bcbs')) targetCarrier = 'BCBS';
        else if (name.includes('uhc') || name.includes('united')) targetCarrier = 'UHC';
        else if (name.includes('medicare')) targetCarrier = 'Medicare';
        else if (name.includes('medicaid')) targetCarrier = 'Medicaid';
        else if (name.includes('tricare')) targetCarrier = 'Tricare';
        else if (name.includes('humana')) targetCarrier = 'Humana';
        else if (name.includes('kaiser')) targetCarrier = 'Kaiser';
    }

    // Direct mapping for Govt/Plan Source overrides
    // If user selected "Government", we force Medicare or Medicaid logic unless it's specifically Military
    if (inputData.planSource === 'govt') {
        if (targetCarrier === 'Medicare') targetCarrier = 'Medicare';
        else if (targetCarrier === 'Tricare') targetCarrier = 'Tricare'; // Honor Tricare selection
        else if (targetCarrier !== 'Tricare') targetCarrier = 'Medicaid'; // Default to Medicaid for generic govt
    }

    const carrierRules = config.coverage_engine_config[targetCarrier];
    
    // If no specific rules for this carrier exist, return default yellow
    if (!carrierRules) {
        return { 
            status: 'yellow', 
            reason: 'Standard Payer Policy: Manual verification required.',
            pricing: null
        };
    }

    // 2. Iterate Rules
    // We look for the FIRST matching rule (cascade logic)
    for (const rule of carrierRules.rules) {
        if (evaluateCondition(rule.if, inputData)) {
            return {
                status: rule.then.status,
                reason: rule.then.reason,
                pricing: carrierRules.pricing // Pass pricing model for UI
            };
        }
    }

    // 3. Default Fallback if no specific rule matched
    return { 
        status: carrierRules.default_status, 
        reason: 'Standard clinical criteria applied. Prior Authorization likely.',
        pricing: carrierRules.pricing
    };
}

/**
 * Evaluates a single rule condition against the user data.
 * Returns TRUE if the condition is met (meaning the rule should trigger).
 */
function evaluateCondition(cond, data) {
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD" for temporal logic

    // --- 1. Basic Demographics & Plan ---
    if (cond.planSource && cond.planSource !== data.planSource) return false;
    
    // State Logic
    if (cond.state && cond.state !== data.state) return false;
    if (cond.state_in && !cond.state_in.includes(data.state)) return false;
    if (cond.state_not_in && cond.state_not_in.includes(data.state)) return false;

    // --- 2. Clinical Data (BMI, Age & Meds) ---
    
    // Medication Match (support Array or String)
    if (cond.medication) {
        const meds = Array.isArray(cond.medication) ? cond.medication : [cond.medication];
        // Check if data.medication contains any of the rule's target meds (partial match allowed)
        const matches = meds.some(m => data.medication.includes(m));
        if (!matches) return false;
    }

    // BMI Logic (Expanded)
    // Supports standard lt/ge and new "bmi_min" (treat as "if bmi < min, then true")
    if (cond.bmi_lt !== undefined && data.bmi >= cond.bmi_lt) return false;
    if (cond.bmi_ge !== undefined && data.bmi < cond.bmi_ge) return false;
    if (cond.bmi_min !== undefined && data.bmi >= cond.bmi_min) return false; // Rule fails if BMI is high enough
    
    if (cond.bmi_range !== undefined) {
        if (data.bmi < cond.bmi_range[0] || data.bmi >= cond.bmi_range[1]) return false;
    }

    // Age Logic (New for Tricare/Medicare)
    if (cond.age_ge !== undefined && data.age < cond.age_ge) return false;
    if (cond.age_lt !== undefined && data.age >= cond.age_lt) return false;

    // --- 3. Comorbidities ---
    
    // Check if user HAS a specific comorbidity
    if (cond.has_comorbidity) {
        if (!data.comorbidities.includes(cond.has_comorbidity)) return false;
    }

    // Check if user is MISSING required comorbidities
    // Condition is met if the intersection of user comorbidities and the required list is empty
    if (cond.missing_comorbidities) {
        const hasAny = cond.missing_comorbidities.some(c => data.comorbidities.includes(c));
        if (hasAny) return false; 
    }

    // --- 4. History & Lifestyle ---
    
    // We map the UI's "lifestyle-program" check to a virtual history item for unified checking
    const effectiveHistory = [...data.medicationHistory];
    if (data.lifestyleProgramEnrollment) effectiveHistory.push('lifestyle_program');

    // New: Check for explicit boolean presence of history (True = Must have history, False = Must have none)
    if (cond.has_med_history === true && effectiveHistory.length === 0) return false;
    if (cond.has_med_history === false && effectiveHistory.length > 0) return false;

    // Check if user is MISSING specific history items (Step Therapy)
    if (cond.missing_history) {
        const hasAnyHist = cond.missing_history.some(h => effectiveHistory.includes(h));
        if (hasAnyHist) return false;
    }

    // Specific Boolean check for program enrollment (Used by UHC)
    if (cond.program_enrollment_required === true) {
        if (!data.lifestyleProgramEnrollment) return true; // Rule triggers (bad outcome) if NOT enrolled
        return false;
    }

    // --- 5. Date Logic (For 2026 Cliffs/Pilots) ---
    if (cond.date_lt && today >= cond.date_lt) return false;
    if (cond.date_ge && today < cond.date_ge) return false;

    return true;
}

/**
 * Safety Stop logic to prevent processing for dangerous BMIs.
 */
export function checkSafetyStop(bmi) {
    const config = getConfig();
    if (!config || !config.safety_stop?.enabled) return { safe: true };

    if (bmi < config.safety_stop.min_bmi) {
        return { safe: false, modalId: config.safety_stop.modal_id };
    }
    return { safe: true };
}

/**
 * Validates Member ID based on carrier-specific regex rules.
 */
export function validateMemberID(carrier, rawId) {
    if (!rawId) return { valid: true }; // Optional field

    const config = getConfig();
    // Default fallback if config isn't loaded yet
    if (!config || !config.coverage_engine_config) return { valid: true };

    const carrierRules = config.coverage_engine_config[carrier];
    
    // If we don't have rules for this carrier, revert to basic check
    if (!carrierRules || !carrierRules.member_id_validation) {
        const clean = rawId.replace(/[^A-Z0-9]/g, '');
        if (clean.length < 5) return { valid: false, msg: "ID too short." };
        return { valid: true };
    }

    const valRule = carrierRules.member_id_validation;
    const regex = new RegExp(valRule.regex);
    
    // For regex, we usually test the raw input or a slightly cleaned version.
    // The regexes provided (e.g., ^W\d{9}) imply uppercase.
    const cleanId = rawId.trim().toUpperCase();

    if (!regex.test(cleanId)) {
        return { valid: false, msg: valRule.help_text || "Invalid format." };
    }

    return { valid: true };
}