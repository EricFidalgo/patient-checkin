// ui.js
export function toggleEmployerField() {
    const source = document.getElementById('plan-source').value;
    const employerField = document.getElementById('employer-field');
    const sourceError = document.getElementById('source-error');
    
    sourceError.classList.add('u-hidden'); // Fixed
    document.getElementById('plan-source').classList.remove('border-red-500');

    if (source === 'employer') {
        employerField.classList.remove('u-hidden'); // Fixed
    } else {
        employerField.classList.add('u-hidden'); // Fixed
    }
}

export function clearError(elementId) {
    const el = document.getElementById(elementId);
    if(el) el.classList.add('u-hidden'); // Fixed
    
    // Map error IDs to input IDs to remove red borders
    const inputMap = {
        'medication-error': 'medication',
        'bmi-error': 'bmi',
        'age-error': 'age',
        'carrier-error': 'carrier',
        'state-error': 'state',
        'source-error': 'plan-source', // Fixed key to match input ID
        'comorbidity-error': null 
    };
    
    if (inputMap[elementId]) {
        const inputEl = document.getElementById(inputMap[elementId]);
        if(inputEl) inputEl.classList.remove('border-red-500');
    }
}

export function transitionToStep(step) {
    // Hide all steps first
    document.querySelectorAll('[data-js="step"]').forEach(el => el.classList.add('u-hidden')); // Fixed
    
    // Show target step
    document.getElementById(`step-${step}`).classList.remove('u-hidden'); // Fixed
    
    // Update progress bar
    const progress = document.getElementById('progress');
    if(progress) progress.style.width = `${(step / 2) * 100}%`;
}

export function showModal(modalId) {
    document.getElementById(modalId).classList.remove('u-hidden'); // Fixed
}

export function runLoadingSequence(config, onComplete) {
    const loadingState = document.getElementById('loading-state');
    const loadingText = document.getElementById('loading-text');
    const loadingBar = document.getElementById('loading-bar');
    
    // Hide Form
    document.getElementById('form-container').classList.add('u-hidden'); // Fixed
    // Try to hide intro section if it exists, otherwise ignore
    const intro = document.getElementById('intro-section');
    if(intro) intro.classList.add('u-hidden'); // Fixed
    
    loadingState.classList.remove('u-hidden'); // Fixed

    const animSettings = config.ui_settings.loading_animation;

    // Run Animations
    animSettings.steps.forEach(step => {
        setTimeout(() => { loadingBar.style.width = `${step.percent}%`; }, step.time_ms);
    });
    
    animSettings.text_updates.forEach(update => {
        setTimeout(() => { loadingText.textContent = update.text; }, update.time_ms);
    });

    const totalTime = Math.max(...animSettings.steps.map(s => s.time_ms)) + 500;
    
    setTimeout(() => {
        loadingState.classList.add('u-hidden'); // Fixed
        onComplete();
    }, totalTime);
}

export function displayResult(resultType) {
    document.getElementById('email-gate').classList.add('u-hidden'); // Fixed
    document.getElementById('results-container').classList.remove('u-hidden'); // Fixed

    const resultIds = {
        'green': 'result-green',
        'yellow': 'result-yellow',
        'red': 'result-red',
        'grey': 'result-grey'
    };
    
    // Hide all first (cleanup), then show the match
    Object.values(resultIds).forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('u-hidden'); // Fixed
    });
    
    const targetId = resultIds[resultType] || 'result-red';
    document.getElementById(targetId).classList.remove('u-hidden'); // Fixed
}