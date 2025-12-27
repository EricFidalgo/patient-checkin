// scripts/formData.js

export const formData = {
    medications: [
        { value: "Wegovy", label: "Wegovy (Semaglutide)" },
        { value: "Zepbound", label: "Zepbound (Tirzepatide)" },
        { value: "Mounjaro", label: "Mounjaro (Tirzepatide - Type 2 Focus)" },
        { value: "Ozempic", label: "Ozempic (Semaglutide - Type 2 Focus)" },
        { value: "Saxenda", label: "Saxenda (Liraglutide)" }
    ],
    planSources: [
        { value: "employer", label: "Through my Job (Employer)" },
        { value: "marketplace", label: "Marketplace" },
        { value: "govt", label: "Government (VA/TriCare)" },
        { value: "direct", label: "Direct Private Purchase" }
    ],
    carriers: [
        { value: "Aetna", label: "Aetna" },
        { value: "BCBS", label: "Blue Cross Blue Shield" },
        { value: "Cigna", label: "Cigna" },
        { value: "UnitedHealthcare", label: "UnitedHealthcare" },
        { value: "Kaiser", label: "Kaiser Permanente" },
        { value: "Humana", label: "Humana" },
        { value: "Medicaid", label: "Medicaid (State)" },
        { value: "Medicare", label: "Medicare" },
        { value: "Other", label: "Other / Commercial" }
    ],
    states: [
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", 
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", 
        "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", 
        "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", 
        "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
    ],
    medicationHistory: [
        { value: "metformin", label: "Metformin (90+ days)" },
        { value: "sglt2", label: "SGLT-2 (e.g. Jardiance, Farxiga)" }
    ],
    comorbidities: [
        { value: "diabetes", label: "Type 2 Diabetes" },
        { value: "established_cvd", label: "Heart Attack / Stroke / PAD" },
        { value: "hypertension", label: "Hypertension / High BP" },
        { value: "osa", label: "Obstructive Sleep Apnea (OSA)" },
        { value: "pcos", label: "PCOS / Prediabetes" },
        { value: "high_cholesterol", label: "High Cholesterol" },
        { value: "none", label: "None" }
    ]
};