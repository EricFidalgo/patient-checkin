// scripts/logic.js
import { getConfig } from './config.js';

export function determineCoverageStatus(inputData) {
    const config = getConfig();
    // Return object structure even for fallback
    if (!config) return { status: 'yellow', reason: 'Configuration Error: Rules not loaded.' };

    const { carrier, state, bmi, comorbidities, medication, medicationHistory } = inputData;
    const overrides = config.clinical_overrides || {};

    // RULE 1: T2D Step Therapy Check
    if (overrides.t2d_step_therapy?.enabled && comorbidities.includes(overrides.t2d_step_therapy.condition_trigger)) {
        const required = overrides.t2d_step_therapy.required_meds;
        // Safety check: ensure medicationHistory exists (default to empty array if undefined)
        const history = medicationHistory || [];
        const hasStepTherapy = required.every(med => history.includes(med));
        
        if (hasStepTherapy) {
            return { 
                status: overrides.t2d_step_therapy.result_success, 
                reason: "Approved: Type 2 Diabetes diagnosis with verified step therapy (Metformin + SGLT-2) history."
            };
        } else {
            return { 
                status: overrides.t2d_step_therapy.result_fail, 
                reason: overrides.t2d_step_therapy.fail_message || "Step Therapy Required: Missing required trial of Metformin and/or SGLT-2 inhibitors."
            };
        }
    }

    // RULE 2: Medicare "Established CVD" Firewall
    const medicareRule = overrides.medicare_cvd_firewall;
    if (medicareRule?.enabled && carrier === medicareRule.carrier_trigger) {
        const hasEstablished = comorbidities.includes(medicareRule.required_condition);
        
        if (hasEstablished && bmi >= medicareRule.min_bmi) {
            return { 
                status: medicareRule.result_success, 
                reason: "Medicare Exception: Covered for Established CVD (Heart Attack/Stroke/PAD)."
            };
        }
        return { 
            status: medicareRule.result_fail, 
            reason: "Medicare Exclusion: Weight loss drugs are not covered for Hypertension alone without established CVD."
        };
    }

    // RULE 3: OSA Bypass
    const osaRule = overrides.osa_bypass;
    if (osaRule?.enabled && osaRule.carriers.includes(carrier)) {
        if (comorbidities.includes(osaRule.condition_trigger) && medication === osaRule.medication_match) {
            return { 
                status: osaRule.result_override, 
                reason: `OSA Exception: ${carrier} specifically covers Zepbound for Obstructive Sleep Apnea.`
            };
        }
    }

    // RULE 4: Carrier/State Rules
    const carrierRules = config.carrier_rules[carrier] || config.carrier_rules["Other"];
    const stateRule = carrierRules.states?.[state];
    let result = stateRule || carrierRules.default;
    
    // Create a dynamic reason based on the lookup
    let baseReason = `Standard Payer Policy: ${carrier} in ${state} typically returns this status for your profile.`;
    if (config.carrier_rules[carrier]?.state_notes?.[state]) {
        baseReason = config.carrier_rules[carrier].state_notes[state];
    }

    // RULE 5: Grey Zone (Downgrade)
    const greyRule = overrides.grey_zone_check;
    // Filter out "none" to see if real comorbidities exist
    const hasComorbidities = comorbidities.length > 0 && !comorbidities.includes('none');
    
    if (greyRule?.enabled) {
        if ((result === 'green' || result === 'yellow') && bmi < greyRule.max_bmi_threshold && !hasComorbidities) {
            return { 
                status: greyRule.result_override, 
                reason: "Clinical Mismatch: BMI is below 30 without comorbidities. PA will likely require peer-to-peer review."
            };
        }
    }

    return { status: result, reason: baseReason };
}

// --- MISSING FUNCTION RESTORED BELOW ---
export function checkSafetyStop(bmi) {
    const config = getConfig();
    if (!config || !config.safety_stop?.enabled) return { safe: true };

    if (bmi < config.safety_stop.min_bmi) {
        return { safe: false, modalId: config.safety_stop.modal_id };
    }
    return { safe: true };
}