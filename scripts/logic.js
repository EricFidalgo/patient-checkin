// scripts/logic.js
import { getConfig } from './config.js';

function normalizeInputData(inputData) {
    const data = { ...inputData }; // Create copy

    // 1. Map Comorbidities (Long Text -> Short Code)
    const conditionMap = {
        "Obstructive Sleep Apnea (OSA)": "osa",
        "Type 2 Diabetes": "diabetes",
        "Prediabetes (HbA1c 5.7% - 6.4%)": "prediabetes",
        "High Cholesterol (Hyperlipidemia)": "cvd", // Generalized CVD risk
        "Heart Disease (History of Heart Attack/Stroke)": "established_cvd",
        "Polycystic Ovary Syndrome (PCOS)": "pcos",
        "Hypertension / High Blood Pressure": "hypertension"
    };

    if (data.comorbidities && Array.isArray(data.comorbidities)) {
        data.comorbidities = data.comorbidities.map(c => conditionMap[c] || c);
    }

    // 2. Map Medication History (Include Metformin as valid history if selected)
    const historyMap = {
        "Metformin (90+ days)": "metformin",
        "Phentermine (Adipex-P)": "phentermine",
        "Qsymia (Phentermine/Topiramate)": "qsymia",
        "Contrave (Bupropion/Naltrexone)": "contrave",
        "Orlistat (Xenical / Alli)": "orlistat"
    };

    if (data.medicationHistory && Array.isArray(data.medicationHistory)) {
        data.medicationHistory = data.medicationHistory.map(h => historyMap[h] || h);
    }

    return data;
}

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
        else if (name.includes('molina')) targetCarrier = 'Molina';
        else if (name.includes('ambetter')) targetCarrier = 'Ambetter';
    }

    // Direct mapping for Govt/Plan Source overrides
    // If user selected "Government", we force Medicare or Medicaid logic unless it's specifically Military
    if (inputData.planSource === 'govt') {
        if (targetCarrier === 'Medicare') targetCarrier = 'Medicare';
        else if (targetCarrier === 'Tricare') targetCarrier = 'Tricare'; // Honor Tricare selection
        else if (targetCarrier !== 'Tricare') targetCarrier = 'Medicaid'; // Default to Medicaid for generic govt
    }

    // [UPDATED] 2. 2026 Market Exit & Geo-Restriction Logic
    // Intercepts Marketplace plans before processing standard rules
    if (inputData.planSource === 'marketplace') {
        
        // Aetna Market Exit: Aetna has entirely exited the ACA Marketplace for 2026.
        if (targetCarrier === 'Aetna') {
            return { 
                status: 'red', 
                reason: 'MARKET EXIT: Aetna CVS Health has entirely exited the ACA Marketplace for 2026. Coverage terminated Dec 31, 2025.',
                pricing: null 
            };
        }

        // Cigna Geo-Fencing: 2026 IFP plans are strictly limited to 11 states.
        if (targetCarrier === 'Cigna') {
            const cignaAllowed = ["AZ", "CO", "FL", "GA", "IL", "IN", "MS", "NC", "TN", "TX", "VA"];
            if (!cignaAllowed.includes(inputData.state)) {
                return { 
                    status: 'red', 
                    reason: `GEO-RESTRICTION: Cigna 2026 Marketplace plans are strictly limited to 11 states. Not available in ${inputData.state}.`,
                    pricing: null 
                };
            }
        }

        // Humana Market Exit: Humana has exited the Commercial Group market.
        if (targetCarrier === 'Humana' && inputData.planSource === 'employer') {
            return { 
                status: 'red', 
                reason: 'MARKET EXIT: Humana has exited the Employer Group Commercial market. Policy likely invalid.', 
                pricing: null 
            };
        }

        // Tricare For Life (TFL) Statutory Exclusion
        if (targetCarrier === 'Tricare' && inputData.age >= 65) {
             const weightLossMeds = ["Wegovy", "Zepbound", "Saxenda", "Qsymia", "Contrave"];
             if (weightLossMeds.includes(inputData.medication[0])) { // Assuming single selection
                return {
                    status: 'red',
                    reason: 'STATUTORY EXCLUSION: Tricare For Life (Age 65+) follows Medicare exclusion of weight loss drugs.',
                    pricing: null
                };
             }
        }
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

    // 3. Iterate Rules
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

    // 4. Default Fallback if no specific rule matched
    return { 
        status: carrierRules.default_status, 
        reason: 'Standard clinical criteria applied. Prior Authorization likely.',
        pricing: carrierRules.pricing
    };
}

/**
 * Evaluates a single rule condition against the user data.
 * Updated to handle "OR" logic for comorbidities (Molina) and strict history checks (Ambetter).
 */
function evaluateCondition(cond, data) {
    const today = new Date().toISOString().split('T')[0];

    // --- 1. Basic Demographics & Plan ---
    if (cond.planSource && cond.planSource !== data.planSource) return false;
    
    // State Logic (Molina/Ambetter Geographic Rules)
    if (cond.state && cond.state !== data.state) return false;
    if (cond.state_in && !cond.state_in.includes(data.state)) return false;
    if (cond.state_not_in && cond.state_not_in.includes(data.state)) return false;

    // --- 2. Clinical Data ---
    
    // Medication Match
    if (cond.medication) {
        const meds = Array.isArray(cond.medication) ? cond.medication : [cond.medication];
        const matches = meds.some(m => data.medication.includes(m));
        if (!matches) return false;
    }

    // BMI Logic
    if (cond.bmi_lt !== undefined && data.bmi >= cond.bmi_lt) return false;
    if (cond.bmi_ge !== undefined && data.bmi < cond.bmi_ge) return false;
    if (cond.bmi_min !== undefined && data.bmi >= cond.bmi_min) return false;
    if (cond.bmi_range !== undefined) {
        if (data.bmi < cond.bmi_range[0] || data.bmi >= cond.bmi_range[1]) return false;
    }

    // Age Logic
    if (cond.age_ge !== undefined && data.age < cond.age_ge) return false;
    if (cond.age_lt !== undefined && data.age >= cond.age_lt) return false;

    // --- 3. Comorbidities (Updated) ---
    
    // Exact Match (Single)
    if (cond.has_comorbidity) {
        if (!data.comorbidities.includes(cond.has_comorbidity)) return false;
    }

    // NEW: "OR" Logic (Molina Exception: Diabetes OR CVD)
    // Returns FALSE (rule mismatch) if user has NONE of the listed conditions.
    if (cond.has_any_comorbidity) {
        const hasMatch = cond.has_any_comorbidity.some(c => data.comorbidities.includes(c));
        if (!hasMatch) return false;
    }

    // Exclusion Match (Missing specific conditions)
    if (cond.missing_comorbidities) {
        // If user has ANY of the items in the list, they are NOT missing the requirement.
        const hasAny = cond.missing_comorbidities.some(c => data.comorbidities.includes(c));
        if (hasAny) return false; 
    }

    // --- 4. History & Lifestyle ---
    
    const effectiveHistory = [...data.medicationHistory];
    if (data.lifestyleProgramEnrollment) effectiveHistory.push('lifestyle_program');

    // Boolean History Check (Ambetter Metformin Gate)
    if (cond.has_med_history === true && effectiveHistory.length === 0) return false;
    if (cond.has_med_history === false && effectiveHistory.length > 0) return false;

    // Step Therapy Logic
    if (cond.missing_history) {
        const hasAnyHist = cond.missing_history.some(h => effectiveHistory.includes(h));
        if (hasAnyHist) return false;
    }

    // Explicit Program Enrollment (UHC/Ambetter)
    if (cond.program_enrollment_required === true) {
        if (!data.lifestyleProgramEnrollment) return true; // Fail rule if not enrolled
        return false;
    }

    // --- 5. Date Logic ---
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
export function validateMemberID(carrier, rawId, inputData = {}) {
    if (!rawId) return { valid: true }; 

    const config = getConfig();
    if (!config || !config.coverage_engine_config) return { valid: true };

    // 1. Ambetter Specific: Strict Numeric Check + Legacy Legacy Handling
    if (carrier === 'Ambetter') {
        const clean = rawId.replace(/[^0-9]/g, '');
        if (clean.length < 9 || clean.length > 12) {
            return { valid: false, msg: "Ambetter 2026: ID must be 9-12 digits (Numeric Only)." };
        }
        return { valid: true };
    }

    // 2. Molina Specific: Polymorphic Logic (State overrides)
    if (carrier === 'Molina') {
        // TX & OH Duals/MMP require Alphanumeric acceptance
        if ((inputData.state === 'TX' || inputData.state === 'OH') && /[A-Z]/.test(rawId)) {
             return { valid: true }; // Allow alphanumeric for MMP
        }
        // WA requires specific suffix check or ProviderOne format
        if (inputData.state === 'WA' && rawId.toUpperCase().endsWith('WA')) {
             return { valid: true };
        }
    }

    // 3. Standard Logic (Fallback to Config Regex)
    const carrierRules = config.coverage_engine_config[carrier];
    if (!carrierRules || !carrierRules.member_id_validation) {
        return { valid: true };
    }

    const valRule = carrierRules.member_id_validation;
    const regex = new RegExp(valRule.regex);
    const cleanId = rawId.trim().toUpperCase();

    if (!regex.test(cleanId)) {
        return { valid: false, msg: valRule.help_text || "Invalid format." };
    }

    return { valid: true };
}