// scripts/logic.js
import { getConfig } from './config.js';

export function determineCoverageStatus(inputData) {
    const config = getConfig();
    if (!config) return 'yellow'; 

    const { carrier, state, bmi, comorbidities, medication, medicationHistory } = inputData;
    const overrides = config.clinical_overrides || {};

    // RULE 1: T2D Step Therapy Check (New 2025 Logic)
    if (overrides.t2d_step_therapy?.enabled && comorbidities.includes(overrides.t2d_step_therapy.condition_trigger)) {
        const required = overrides.t2d_step_therapy.required_meds; // ['metformin', 'sglt2']
        const hasStepTherapy = required.every(med => medicationHistory.includes(med));
        
        if (hasStepTherapy) {
            return overrides.t2d_step_therapy.result_success; // Green
        } else {
            return overrides.t2d_step_therapy.result_fail; // Yellow (needs step therapy)
        }
    }

    // RULE 2: Medicare "Established CVD" Firewall
    // Strict check: Must have "established_cvd", cannot rely on "hypertension" alone
    const medicareRule = overrides.medicare_cvd_firewall;
    if (medicareRule?.enabled && carrier === medicareRule.carrier_trigger) {
        const hasEstablished = comorbidities.includes(medicareRule.required_condition);
        
        if (hasEstablished && bmi >= medicareRule.min_bmi) {
            return medicareRule.result_success; // Yellow (Valid PA)
        }
        // If they only have hypertension, or nothing, fall to Red
        return medicareRule.result_fail;
    }

    // RULE 3: OSA Bypass (Zepbound Specific)
    const osaRule = overrides.osa_bypass;
    if (osaRule?.enabled && osaRule.carriers.includes(carrier)) {
        if (comorbidities.includes(osaRule.condition_trigger) && medication === osaRule.medication_match) {
            return osaRule.result_override; // Green
        }
    }

    // RULE 4: Carrier/State Rules
    const carrierRules = config.carrier_rules[carrier] || config.carrier_rules["Other"];
    const stateRule = carrierRules.states?.[state];
    let result = stateRule || carrierRules.default;

    // RULE 5: Grey Zone
    const greyRule = overrides.grey_zone_check;
    const hasComorbidities = comorbidities.length > 0 && !comorbidities.includes('none');
    
    if (greyRule?.enabled) {
        if ((result === 'green' || result === 'yellow') && 
            bmi < greyRule.max_bmi_threshold && 
            !hasComorbidities) {
            return greyRule.result_override;
        }
    }

    return result;
}

export function checkSafetyStop(bmi) {
    const config = getConfig();
    if (!config || !config.safety_stop?.enabled) return { safe: true };

    if (bmi < config.safety_stop.min_bmi) {
        return { safe: false, modalId: config.safety_stop.modal_id };
    }
    return { safe: true };
}