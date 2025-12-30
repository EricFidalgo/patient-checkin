// scripts/fileExport.js

export function exportDataToTextFile(inputData, email, result) {
    const timestamp = new Date().toLocaleString();
    
    // Formatting helpers
    const conditions = inputData.comorbidities && inputData.comorbidities.length > 0 
        ? inputData.comorbidities.join(', ') : 'None';
    const history = inputData.medicationHistory && inputData.medicationHistory.length > 0
        ? inputData.medicationHistory.join(', ') : 'None';

    const fileContent = `
=========================================
VERISCRIPT LEAD & AUTHORIZATION RECORD
Generated: ${timestamp}
=========================================

--- LEAD IDENTITY (SIGNED) ---
First Name: ${inputData.firstName || 'N/A'}
Last Name:  ${inputData.lastName || 'N/A'}
Email:      ${inputData.email}
Phone:      ${inputData.phone}

--- HIPAA AUTHORIZATION PROOF ---
Signed By:  ${inputData.fullName}
Signed At:  ${inputData.signatureTimestamp}
Auth Type:  Sale of PHI (Remuneration Acknowledged)
Signature:  ELECTRONIC_TYPED_SIGNATURE_VERIFIED

--- CLINICAL PROFILE ---
Age: ${inputData.age}
BMI: ${inputData.bmi}
Target Med: ${inputData.medication}
Conditions: ${conditions}
History:    ${history}

--- INSURANCE CONTEXT ---
Carrier:    ${inputData.carrier}
Plan Type:  ${inputData.planSource}
State:      ${inputData.state}
Member ID:  ${document.getElementById('member-id').value || 'Not Provided'}

--- VERIFICATION RESULT ---
Status: ${result.status ? result.status.toUpperCase() : 'UNKNOWN'}
Reason: ${result.reason || 'N/A'}

=========================================
CONFIDENTIAL - CONTAINS PHI
`;

    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    // Filename now includes the lead's name for easier organization
    a.download = `Lead_${inputData.lastName}_${Date.now()}.txt`;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}