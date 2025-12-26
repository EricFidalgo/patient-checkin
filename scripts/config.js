// config.js
let appConfig = null;

export async function loadConfig() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error('Failed to load configuration');

        // 1. Get text first
        let configText = await response.text();

        // 2. Replace {{YEAR}} with the current year
        const currentYear = new Date().getFullYear();
        configText = configText.replace(/{{YEAR}}/g, currentYear);

        // 3. Parse JSON
        appConfig = JSON.parse(configText);
        
        console.log('VeriScript Configuration Loaded');
        return appConfig;
    } catch (error) {
        console.error('Error loading config:', error);
        return null;
    }
}

export function getConfig() {
    return appConfig;
}