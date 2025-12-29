// scripts/fileExport.js

/**
 * Formats user input into a readable text string and triggers a browser download.
 * @param {Object} inputData - The collected form data (age, bmi, carrier, etc.)
 * @param {string} email - The user's email address
 * @param {Object} result - The calculated coverage result
 */
export function exportDataToTextFile(inputData, email, result) {
    // 1. Construct the content of the text file
    const timestamp = new Date().toLocaleString();
    
    // safe check for array fields
    const conditions = inputData.comorbidities && inputData.comorbidities.length > 0 
        ? inputData.comorbidities.join(', ') 
        : 'None';
        
    const history = inputData.medicationHistory && inputData.medicationHistory.length > 0
        ? inputData.medicationHistory.join(', ')
        : 'None';

    const fileContent = `
=========================================
VERISCRIPT USER DATA EXPORT
Date: ${timestamp}
=========================================

--- CONTACT INFO ---
Email: ${email}

--- CLINICAL PROFILE ---
Age: ${inputData.age}
BMI: ${inputData.bmi}
Diagnosed Conditions: ${conditions}
Medication History: ${history}
Target Medication: ${inputData.medication}

--- INSURANCE DETAILS ---
State: ${inputData.state}
Plan Source: ${inputData.planSource}
Carrier: ${inputData.carrier}
Specified Carrier Name: ${inputData.carrierSpecificName || 'N/A'}
Employer Name: ${inputData.employerName || 'N/A'}
Member ID: ${document.getElementById('member-id').value || 'Not Provided'}
Program Enrollment: ${inputData.lifestyleProgramEnrollment ? 'Yes' : 'No'}

--- CALCULATED RESULT ---
Status: ${result.status ? result.status.toUpperCase() : 'UNKNOWN'}
Reason: ${result.reason || 'N/A'}

=========================================
END OF FILE
`;

    // 2. Create a Blob (Binary Large Object) containing the text
    const blob = new Blob([fileContent], { type: 'text/plain' });

    // 3. Create a temporary link element to trigger the download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `veriscript_output_${Date.now()}.txt`; // Generates unique filename
    a.style.display = 'none';
    
    // 4. Append to body, click, and cleanup
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}