// scripts/formData.js

export const formData = {
    medications: [
        { value: "Wegovy", label: "Wegovy (Semaglutide) - Weight Loss" },
        { value: "Zepbound", label: "Zepbound (Tirzepatide) - Weight Loss" },
        { value: "Ozempic", label: "Ozempic (Semaglutide) - Type 2 Focus" },
        { value: "Mounjaro", label: "Mounjaro (Tirzepatide) - Type 2 Focus" },
        { value: "Rybelsus", label: "Rybelsus (Oral Semaglutide Pill)" },
        { value: "Saxenda", label: "Saxenda (Liraglutide)" },
        { value: "Trulicity", label: "Trulicity (Dulaglutide)" },
        { value: "Victoza", label: "Victoza (Liraglutide)" },
        { value: "Compounded", label: "Compounded Semaglutide / Tirzepatide" }
    ],
    planSources: [
        { value: "employer", label: "Through my Job (Employer)" },
        { value: "marketplace", label: "Marketplace / ACA (Obamacare)" },
        { value: "govt", label: "Medicaid / Medicare / Military" },
        { value: "direct", label: "Direct Private Purchase" }
    ],
    carriers: [
        { value: "Aetna", label: "Aetna" },
        { value: "Ambetter", label: "Ambetter (Centene)" },
        { value: "BCBS", label: "Blue Cross Blue Shield" },
        { value: "Cigna", label: "Cigna" },
        { value: "UHC", label: "UnitedHealthcare" },
        { value: "Kaiser", label: "Kaiser Permanente" },
        { value: "Humana", label: "Humana" },
        { value: "Molina", label: "Molina Healthcare" },
        { value: "Tricare", label: "Tricare (Military)" },
        { value: "Medicaid", label: "Medicaid (State - Generic)" },
        { value: "Medicare", label: "Medicare (Original)" },
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
        { value: "sglt2", label: "SGLT-2 (e.g. Jardiance, Farxiga)" },
        { value: "phentermine", label: "Phentermine (Adipex-P)" },
        { value: "contrave", label: "Contrave (Bupropion/Naltrexone)" },
        { value: "qsymia", label: "Qsymia (Phentermine/Topiramate)" },
        { value: "orlistat", label: "Orlistat (Xenical / Alli)" },
    ],
    comorbidities: [
        { value: "diabetes", label: "Type 2 Diabetes" },
        { value: "prediabetes", label: "Prediabetes (HbA1c 5.7% - 6.4%)" },
        { value: "high_cholesterol", label: "High Cholesterol (Hyperlipidemia)" },
        { value: "hypertension", label: "Hypertension / High Blood Pressure" },
        { value: "osa", label: "Obstructive Sleep Apnea (OSA)" },
        { value: "established_cvd", label: "Heart Disease (History of Heart Attack/Stroke)" },
        { value: "pcos", label: "Polycystic Ovary Syndrome (PCOS)" },
        { value: "fatty_liver", label: "Fatty Liver Disease (NAFLD/NASH)" },
    ]
};