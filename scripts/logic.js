// scripts/logic.js
import { getConfig } from './config.js';

export function determineCoverageStatus(inputData) {
    const config = getConfig();
    if (!config) return 'yellow'; // Fallback if config completely fails

    const { carrier, state, bmi, comorbidities } = inputData;
    
    // Safety: Default to empty object if missing
    const overrides = config.clinical_overrides || {};

    // RULE 1: Diabetes Override
    // FIX: Use '?.' to check if diabetes_guarantee exists before checking enabled
    if (overrides.diabetes_guarantee?.enabled) {
        const trigger = overrides.diabetes_guarantee.condition_trigger;
        if (comorbidities.includes(trigger)) {
            return overrides.diabetes_guarantee.result_override;
        }
    }

    // RULE 2: Medicare Loophole
    const medicareRule = overrides.medicare_cardiac_loophole;
    // FIX: Check if medicareRule exists (medicareRule?.enabled)
    if (medicareRule?.enabled && carrier === medicareRule.carrier_trigger) {
        const hasCondition = comorbidities.includes(medicareRule.required_condition);
        if (hasCondition && bmi >= medicareRule.min_bmi) {
            return medicareRule.result_success;
        }
        return medicareRule.result_fail;
    }

    // RULE 3: Carrier Lookup
    // Safety: Handle cases where the carrier might not be in the config
    const carrierRules = config.carrier_rules[carrier] || config.carrier_rules["Other"];
    
    // Safety: Check if 'states' exists
    const stateRule = carrierRules.states?.[state];
    let result = stateRule || carrierRules.default;

    // RULE 4: Clinical Nuance (Grey Zone)
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

// Keep checkSafetyStop as is, or add safety there too:
export function checkSafetyStop(bmi) {
    const config = getConfig();
    // Safety check for safety_stop existence
    if (!config || !config.safety_stop?.enabled) return { safe: true };

    if (bmi < config.safety_stop.min_bmi) {
        return { safe: false, modalId: config.safety_stop.modal_id };
    }
    return { safe: true };
}