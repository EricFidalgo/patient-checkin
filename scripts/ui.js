// ui.js
export function toggleEmployerField() {
    const source = document.getElementById('plan-source').value;
    const employerField = document.getElementById('employer-field');
    const sourceError = document.getElementById('source-error');
    
    sourceError.classList.add('hidden');
    document.getElementById('plan-source').classList.remove('border-red-500');

    if (source === 'employer') {
        employerField.classList.remove('hidden');
    } else {
        employerField.classList.add('hidden');
    }
}

export function clearError(elementId) {
    document.getElementById(elementId).classList.add('hidden');
    // Map error IDs to input IDs to remove red borders
    const inputMap = {
        'medication-error': 'medication',
        'bmi-error': 'bmi',
        'carrier-error': 'carrier',
        'state-error': 'state'
    };
    if (inputMap[elementId]) {
        document.getElementById(inputMap[elementId]).classList.remove('border-red-500');
    }
}

export function transitionToStep(step) {
    document.querySelectorAll('.step-transition').forEach(el => el.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');
    document.getElementById('progress').style.width = `${(step / 2) * 100}%`;
}

export function showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

export function runLoadingSequence(config, onComplete) {
    const loadingState = document.getElementById('loading-state');
    const loadingText = document.getElementById('loading-text');
    const loadingBar = document.getElementById('loading-bar');
    
    // Hide Form
    document.getElementById('form-container').classList.add('hidden');
    document.getElementById('intro-section').classList.add('hidden');
    loadingState.classList.remove('hidden');

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
        loadingState.classList.add('hidden');
        onComplete();
    }, totalTime);
}

export function displayResult(resultType) {
    document.getElementById('email-gate').classList.add('hidden');
    document.getElementById('results-container').classList.remove('hidden');

    const resultIds = {
        'green': 'result-green',
        'yellow': 'result-yellow',
        'red': 'result-red',
        'grey': 'result-grey'
    };
    
    // Hide all first (cleanup), then show the match
    Object.values(resultIds).forEach(id => document.getElementById(id).classList.add('hidden'));
    
    const targetId = resultIds[resultType] || 'result-red';
    document.getElementById(targetId).classList.remove('hidden');
}