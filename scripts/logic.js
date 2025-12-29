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
        employerName,
        medication,
        lifestyleProgramEnrollment 
    } = inputData;

    const rules = config.coverage_engine_config;
    const today = new Date(); // Centralized date for temporal logic

    // ---------------------------------------------------------
    // NEW RULE: MEDICATION SPECIFIC LOGIC (Saxenda)
    // ---------------------------------------------------------
    if (medication === 'Saxenda') {
        return {
            status: 'yellow',
            reason: "Saxenda often requires the same PA as Wegovy and is increasingly classified as non-preferred (Tier 3) due to lower efficacy. Plans typically require a trial of oral Phentermine first."
        };
    }

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
    if (planSource === 'employer' && rules.sehp_audit[state]) {
        const sehpRule = rules.sehp_audit[state];
        return {
            status: sehpRule.status.toLowerCase(),
            reason: `State Plan Audit (${state}): ${sehpRule.reason} (Applies to State Employees).`
        };
    }

    // ---------------------------------------------------------
    // NEW RULE: KAISER PERMANENTE (Closed Loop)
    // ---------------------------------------------------------
    if (carrier === 'Kaiser') {
        const kpRules = rules.carrier_logic.Kaiser;
        
        // Medicare Check
        if (planSource === 'govt' || carrier === 'Medicare' || age >= 65) { 
             if (comorbidities.includes('diabetes')) return { status: 'yellow', reason: 'Covered for Type 2 Diabetes management.' };
             if (comorbidities.includes('established_cvd') && medication === 'Wegovy') return { status: 'yellow', reason: 'Covered for CVD Risk Reduction (Yellow).' };
             return { status: 'red', reason: kpRules.sub_plans.medicare.reason_text };
        }

        // Commercial (Programmatic Gating Update)
        if (lifestyleProgramEnrollment) {
            return { 
                status: 'yellow', 
                reason: "Coverage Active: Validated enrollment in Kaiser 'Medical Weight Management Program' allows for formulary access." 
            };
        }

        return {
            status: 'red', 
            reason: kpRules.sub_plans.commercial.reason_text + " (Denial overrides available only for patients enrolled in Kaiser's internal MWM program)."
        };
    }

    // ---------------------------------------------------------
    // NEW RULE: HUMANA (Market Exit)
    // ---------------------------------------------------------
    if (carrier === 'Humana') {
        const humRules = rules.carrier_logic.Humana;

        if (planSource === 'employer') {
            return { status: 'red', reason: humRules.reason_text };
        }
        
        // Medicare Check
        if (comorbidities.includes('established_cvd') && medication === 'Wegovy') {
             return { status: 'yellow', reason: humRules.sub_plans.medicare.reason_text };
        }
        return { status: 'red', reason: "Statutory Ban: Medicare does not cover weight loss medications." };
    }

    // ---------------------------------------------------------
    // TIER 3: GOVERNMENT PAYER LOGIC (Tricare/VA)
    // ---------------------------------------------------------
    if (planSource === 'govt') {
        const govtRules = rules.plan_source_matrix.government;
        
        // TRICARE Logic
        if (carrier === 'Other' || carrier === 'UnitedHealthcare' || true) { 
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
    // NEW RULE: MEDICAID (Fiscal Cliff & Sunsets)
    // ---------------------------------------------------------
    if (carrier === 'Medicaid') {
         const mcdRules = rules.carrier_logic.Medicaid.logic_map;
         
         // 1. Red States
         if (mcdRules.red_states.includes(state)) {
             return { status: 'red', reason: `State Exclusion: The ${state} Medicaid program has opted not to cover weight loss medications.` };
         }

         // 2. Sunset States (Date Aware)
        if (mcdRules.sunset_states[state]) {
            const sunsetRule = mcdRules.sunset_states[state];
            
            if (sunsetRule.cutoff_date && today >= new Date(sunsetRule.cutoff_date)) {
                
                if (sunsetRule.reinstatement_date && today >= new Date(sunsetRule.reinstatement_date)) {
                    return { 
                        status: sunsetRule.status_reinstated || 'yellow', 
                        reason: sunsetRule.reason_reinstated 
                    };
                }

                return { 
                    status: sunsetRule.status_post || 'red', 
                    reason: sunsetRule.reason_post 
                };
            }

            return { 
                status: sunsetRule.status_pre || 'yellow', 
                reason: sunsetRule.reason_pre || sunsetRule.reason_text 
            };
        }

         // 3. Yellow States
         if (mcdRules.yellow_states.includes(state)) {
             if (state === 'WI') return { status: 'yellow', reason: "State Benefit: Covered. Requires submission of specific PA Form F-00163 detailing your weight loss plan." };
             return { status: 'yellow', reason: "State Benefit: Coverage is available but requires Prior Authorization verifying BMI and lifestyle modification." };
         }
    }

    // ---------------------------------------------------------
    // TIER 4: MARKETPLACE (ACA) LOGIC
    // ---------------------------------------------------------
    if (planSource === 'marketplace') {
        if (state === 'WA' && today.getFullYear() >= 2026) {
            return { 
                status: 'green', 
                reason: "State Mandate: WA SB 5353 requires coverage for obesity treatment effective Jan 1, 2026." 
            };
        }

        const mktRules = rules.plan_source_matrix.marketplace_aca;
        const stateRule = mktRules.exceptions[state];

        if (stateRule) {
            return {
                status: stateRule.status.toLowerCase(),
                reason: stateRule.reason
            };
        }
        
        return {
            status: mktRules.default_status.toLowerCase(),
            reason: mktRules.default_reason
        };
    }

    // ---------------------------------------------------------
    // NEW RULE: CLINICAL CONDITION MODIFIER (Hyperlipidemia)
    // ---------------------------------------------------------
    if (comorbidities.includes('high_cholesterol') && bmi >= 27) {
        if (carrier !== 'Medicare') {
             return {
                status: 'yellow',
                reason: "High Cholesterol + BMI ≥27 satisfies 'Medical Necessity' criteria. However, you must still document a 3-6 month trial of lifestyle modification to unlock coverage."
            };
        }
    }

    // ---------------------------------------------------------
    // TIER 5: CARRIER LOGIC (Standard Commercial)
    // ---------------------------------------------------------
    const carrierRules = rules.carrier_logic[carrier] || rules.carrier_logic["BCBS"]; 
    
    // Medicare Override
    if (carrier === 'Medicare') {
        if (comorbidities.includes('established_cvd') && bmi >= 27) {
            return {
                status: 'yellow',
                reason: "Medicare Exception: Coverage likely for Established CVD diagnosis. (Hypertension alone is excluded)."
            };
        }
        const medRules = rules.carrier_logic.Medicare;
        return {
            status: medRules.status.toLowerCase(),
            reason: medRules.reason
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

// --- NEW FUNCTION: Moved from main.js ---
export function validateMemberID(carrier, rawId) {
    if (!rawId) return { valid: true }; // Optional field

    const id = rawId.toUpperCase().replace(/[^A-Z0-9]/g, ''); // Remove special chars
    
    // 1. Global Length Check (Catch obvious garbage)
    if (id.length < 5) return { valid: false, msg: "ID is too short (min 5 characters)." };
    if (id.length > 25) return { valid: false, msg: "ID is too long (max 25 characters)." };

    // 2. Carrier-Specific Heuristics
    switch (carrier) {
        case 'Medicare':
            // Medicare Beneficiary Identifier (MBI) is exactly 11 chars
            if (id.length !== 11) return { valid: false, msg: "Medicare MBI must be exactly 11 characters." };
            break;
            
        case 'BCBS':
            // Blue Cross usually starts with a 3-letter prefix (or R for Federal)
            if (!/^[A-Z]{3}|R/.test(id)) {
                return { valid: false, msg: "BCBS IDs typically start with a 3-letter prefix (e.g., XYZ...)." };
            }
            break;

        case 'UnitedHealthcare':
            // UHC is almost always numeric
            if (!/^\d+$/.test(id)) {
                 return { valid: false, msg: "UnitedHealthcare IDs are typically numbers only." };
            }
            break;

        case 'Kaiser':
            // Kaiser is typically strictly numeric (Northern/Southern CA, etc.)
            if (!/^\d+$/.test(id)) {
                return { valid: false, msg: "Kaiser MRNs are typically numbers only." };
            }
            if (id.length < 7) return { valid: false, msg: "Kaiser ID seems too short." };
            break;

        case 'Humana':
             // Humana IDs often start with H (Medicare) or are just numeric.
            if (!/^H?\d+$/.test(id)) {
                return { valid: false, msg: "Invalid Humana ID format (usually starts with H or is numeric)." };
            }
            break;

        case 'Medicaid':
            // STATE DEPENDENT. We only check for illegal characters to be safe.
            if (id.length < 8) return { valid: false, msg: "State Medicaid IDs are typically at least 8 characters." };
            break;
            
        case 'Tricare':
            // Often SSN (9) or DoD ID (10-11)
            if (!/^\d{9,11}$/.test(id)) {
                return { valid: false, msg: "Invalid format for Tricare ID." };
            }
            break;
        case 'Ambetter':
          // Ambetter often starts with U (e.g. U12345678) or is numeric
          if (!/^[A-Z0-9]+$/.test(id)) { 
                return { valid: false, msg: "Invalid Ambetter ID format." };
          }
          break;

      case 'Molina':
          // Molina is typically 9-12 digits
          if (!/^\d+$/.test(id)) {
                return { valid: false, msg: "Molina IDs are typically numbers only." };
          }
          break;
    }

    return { valid: true };
}