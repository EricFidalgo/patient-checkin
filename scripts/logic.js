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

export function validateMemberID(carrier, rawId) {
    if (!rawId) return { valid: true }; // Optional field

    const id = rawId.toUpperCase().replace(/[^A-Z0-9]/g, ''); // Remove special chars
    
    // 1. Global Length Check (Catch obvious garbage)
    if (id.length < 5) return { valid: false, msg: "ID is too short (min 5 characters)." };
    if (id.length > 25) return { valid: false, msg: "ID is too long (max 25 characters)." };

    // 2. Carrier-Specific Heuristics
    switch (carrier) {
        
    }

    return { valid: true };
}