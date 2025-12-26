// scripts/logic.js
import { getConfig } from './config.js';

export function determineCoverageStatus(inputData) {
    const config = getConfig();
    if (!config) return 'yellow'; // Fallback if config completely fails

    // Updated to include medication
    const { carrier, state, bmi, comorbidities, medication } = inputData;
    
    // Safety: Default to empty object if missing
    const overrides = config.clinical_overrides || {};

    // RULE 1: Diabetes Override
    if (overrides.diabetes_guarantee?.enabled) {
        const trigger = overrides.diabetes_guarantee.condition_trigger;
        if (comorbidities.includes(trigger)) {
            return overrides.diabetes_guarantee.result_override;
        }
    }

    // RULE 2: Medicare Loophole
    const medicareRule = overrides.medicare_cardiac_loophole;
    if (medicareRule?.enabled && carrier === medicareRule.carrier_trigger) {
        const hasCondition = comorbidities.includes(medicareRule.required_condition);
        if (hasCondition && bmi >= medicareRule.min_bmi) {
            return medicareRule.result_success;
        }
        return medicareRule.result_fail;
    }

    // RULE 3: OSA Bypass (New)
    const osaRule = overrides.osa_bypass;
    if (osaRule?.enabled && osaRule.carriers.includes(carrier)) {
        // Check for PCOS trigger and specifically Zepbound
        if (comorbidities.includes(osaRule.condition_trigger) && medication === 'Zepbound') {
            return osaRule.result_override;
        }
    }

    // RULE 4: Carrier Lookup
    const carrierRules = config.carrier_rules[carrier] || config.carrier_rules["Other"];
    
    const stateRule = carrierRules.states?.[state];
    let result = stateRule || carrierRules.default;

    // RULE 5: Clinical Nuance (Grey Zone)
    const greyRule = overrides.grey_zone_check;
    const hasComorbidities = comorbidities.length > 0;
    
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