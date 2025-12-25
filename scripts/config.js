// config.js
let appConfig = null;

export async function loadConfig() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error('Failed to load configuration');
        appConfig = await response.json();
        console.log('VeriScript Configuration Loaded');
        return appConfig;
    } catch (error) {
        console.error('Error loading config:', error);
        alert('System Error: Unable to load coverage rules. Please refresh the page.');
        return null;
    }
}

export function getConfig() {
    return appConfig;
}