// scripts/logic.js
import { getConfig } from './config.js';

export function determineCoverageStatus(inputData) {
    const config = getConfig();
    if (!config || !config.coverage_engine_config) {
        return { status: 'yellow', reason: 'Configuration Error: Rules not loaded.' };
    }

    const { carrier, carrierSpecificName } = inputData;
    
    // 1. Resolve Carrier Config
    // If "Other" was selected, we check if they typed a known major carrier name
    let targetCarrier = carrier;
    if (carrier === 'Other' && carrierSpecificName) {
        const name = carrierSpecificName.toLowerCase();
        if (name.includes('aetna')) targetCarrier = 'Aetna';
        else if (name.includes('cigna')) targetCarrier = 'Cigna';
        else if (name.includes('blue') || name.includes('bcbs')) targetCarrier = 'BCBS';
    }

    const carrierRules = config.coverage_engine_config[targetCarrier];
    
    // If no specific rules for this carrier, return default yellow
    if (!carrierRules) {
        return { 
            status: 'yellow', 
            reason: 'Standard Payer Policy: Manual verification required.' 
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

function evaluateCondition(cond, data) {
    // 1. Plan Source
    if (cond.planSource && cond.planSource !== data.planSource) return false;

    // 2. Medication Match (Array or String)
    if (cond.medication) {
        const meds = Array.isArray(cond.medication) ? cond.medication : [cond.medication];
        // Check if data.medication contains any of the rule's target meds (partial match allowed)
        // e.g. rule "Compounded" matches "Compounded Semaglutide"
        const matches = meds.some(m => data.medication.includes(m));
        if (!matches) return false;
    }

    // 3. BMI Logic
    if (cond.bmi_lt !== undefined && data.bmi >= cond.bmi_lt) return false;
    if (cond.bmi_ge !== undefined && data.bmi < cond.bmi_ge) return false;
    if (cond.bmi_range !== undefined) {
        if (data.bmi < cond.bmi_range[0] || data.bmi >= cond.bmi_range[1]) return false;
    }

    // 4. State Logic
    if (cond.state && cond.state !== data.state) return false;
    if (cond.state_in && !cond.state_in.includes(data.state)) return false;
    if (cond.state_not_in && cond.state_not_in.includes(data.state)) return false;

    // 5. Comorbidities (Missing vs Has)
    if (cond.missing_comorbidities) {
        // Condition matches if user DOES NOT have the required comorbidities
        // If the user has ANY of the items in the list, they satisfy the requirement (so condition is false)
        // Wait: The rule is "missing_comorbidities": ["diabetes"]. matches if user lacks diabetes.
        // If list is ["htn", "cvd"], matches if user has NEITHER?
        // Usually logical OR for satisfaction (having HTN is enough).
        // So: if user.comorbidities intersection rule.list is EMPTY, then missing is TRUE.
        const hasAny = cond.missing_comorbidities.some(c => data.comorbidities.includes(c));
        if (hasAny) return false; 
    }
    
    if (cond.has_comorbidity) {
        if (!data.comorbidities.includes(cond.has_comorbidity)) return false;
    }

    // 6. History / Lifestyle
    // We map the UI's "lifestyle-program" check to a virtual history item if checked
    const effectiveHistory = [...data.medicationHistory];
    if (data.lifestyleProgramEnrollment) effectiveHistory.push('lifestyle_program');

    if (cond.missing_history) {
        const hasAnyHist = cond.missing_history.some(h => effectiveHistory.includes(h));
        if (hasAnyHist) return false;
    }

    return true;
}

export function checkSafetyStop(bmi) {
    const config = getConfig();
    if (!config || !config.safety_stop?.enabled) return { safe: true };

    if (bmi < config.safety_stop.min_bmi) {
        return { safe: false, modalId: config.safety_stop.modal_id };
    }
    return { safe: true };
}

export function validateMemberID(carrier, rawId) {
    if (!rawId) return { valid: true }; // Optional field

    const config = getConfig();
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