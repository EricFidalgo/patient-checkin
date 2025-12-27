// scripts/logic.js
import { getConfig } from './config.js';

export function determineCoverageStatus(inputData) {
    const config = getConfig();
    if (!config) return { status: 'yellow', reason: 'Configuration Error: Rules not loaded.' };

    const { 
        carrier, 
        state, 
        bmi, 
        age,
        comorbidities, 
        planSource, 
        employerName 
    } = inputData;

    const rules = config.coverage_engine_config;

    // ---------------------------------------------------------
    // TIER 1: EMPLOYER CHECK (Highest Priority)
    // ---------------------------------------------------------
    if (planSource === 'employer' && employerName) {
        const cleanName = employerName.toLowerCase().trim();
        const db = rules.employer_database;

        // 1. Red List (Carve Outs)
        const isRed = db.red_list_carve_outs.some(name => cleanName.includes(name.toLowerCase()));
        if (isRed) {
            return { 
                status: 'red', 
                reason: `Employer Carve-Out: ${employerName} has explicitly terminated coverage for weight loss medications.` 
            };
        }

        // 2. Green List (Managed)
        const greenKey = Object.keys(db.green_list_managed).find(key => cleanName.includes(key.toLowerCase()));
        if (greenKey) {
            return { status: 'green', reason: db.green_list_managed[greenKey] };
        }

        // 3. Yellow List (Restricted)
        const yellowKey = Object.keys(db.yellow_list_restricted).find(key => cleanName.includes(key.toLowerCase()));
        if (yellowKey) {
            return { status: 'yellow', reason: db.yellow_list_restricted[yellowKey] };
        }
    }

    // ---------------------------------------------------------
    // TIER 2: STATE EMPLOYEE HEALTH PLAN (SEHP) AUDIT
    // ---------------------------------------------------------
    // If they selected Employer Source and didn't match a specific name, 
    // check if they are in a state with strict SEHP rules.
    // (Assumption: State employees often select "Employer" + their State)
    if (planSource === 'employer' && rules.sehp_audit[state]) {
        // We add a disclaimer that this applies if they are a state employee
        const sehpRule = rules.sehp_audit[state];
        // If the rule is RED, we warn them. If it's YELLOW, we warn them.
        // We append a note about SEHP relevance.
        return {
            status: sehpRule.status.toLowerCase(),
            reason: `State Plan Audit (${state}): ${sehpRule.reason} (Applies to State Employees).`
        };
    }

    // ---------------------------------------------------------
    // TIER 3: GOVERNMENT PAYER LOGIC
    // ---------------------------------------------------------
    if (planSource === 'govt') {
        const govtRules = rules.plan_source_matrix.government;
        
        // TRICARE Logic
        // If carrier is explicitly TriCare or inferred from Govt source
        if (carrier === 'Other' || carrier === 'UnitedHealthcare' || true) { // Broad catch for Govt source
             // TriCare For Life (Age 65+)
             if (age >= govtRules.tricare.age_cutoff_for_life) {
                 return {
                     status: govtRules.tricare.tricare_for_life.status.toLowerCase(),
                     reason: govtRules.tricare.tricare_for_life.reason
                 };
             }
             // TriCare Prime/Select (Under 65)
             return {
                 status: govtRules.tricare.tricare_prime_select.status.toLowerCase(),
                 reason: govtRules.tricare.tricare_prime_select.reason
             };
        }
    }

    // ---------------------------------------------------------
    // TIER 4: MARKETPLACE (ACA) LOGIC
    // ---------------------------------------------------------
    if (planSource === 'marketplace') {
        const mktRules = rules.plan_source_matrix.marketplace_aca;
        const stateRule = mktRules.exceptions[state];

        if (stateRule) {
            return {
                status: stateRule.status.toLowerCase(),
                reason: stateRule.reason
            };
        }
        
        // Default Marketplace
        return {
            status: mktRules.default_status.toLowerCase(),
            reason: mktRules.default_reason
        };
    }

    // ---------------------------------------------------------
    // TIER 5: CARRIER LOGIC (Standard Commercial)
    // ---------------------------------------------------------
    const carrierRules = rules.carrier_logic[carrier] || rules.carrier_logic["BCBS"]; // Fallback style
    
    // Medicare Override (Defined in carrier logic)
    if (carrier === 'Medicare') {
        // Check for Established CVD Exception
        if (comorbidities.includes('established_cvd') && bmi >= 27) {
            return {
                status: 'yellow',
                reason: "Medicare Exception: Coverage likely for Established CVD diagnosis. (Hypertension alone is excluded)."
            };
        }
        return {
            status: carrierRules.status.toLowerCase(),
            reason: carrierRules.reason
        };
    }

    // BCBS Special Handling
    if (carrier === 'BCBS') {
        if (carrierRules.state_exclusions && carrierRules.state_exclusions.includes(state)) {
            return {
                status: 'red',
                reason: `BCBS ${state} Exclusion: Fully insured plans in your state have terminated weight loss coverage.`
            };
        }
    }

    // Default Carrier Result
    if (carrierRules) {
        return {
            status: (carrierRules.status || 'yellow').toLowerCase(),
            reason: carrierRules.reason || carrierRules.default_reason
        };
    }

    return { status: 'yellow', reason: 'Standard Payer Policy: Prior Authorization likely required.' };
}

export function checkSafetyStop(bmi) {
    const config = getConfig();
    if (!config || !config.safety_stop?.enabled) return { safe: true };

    if (bmi < config.safety_stop.min_bmi) {
        return { safe: false, modalId: config.safety_stop.modal_id };
    }
    return { safe: true };
}