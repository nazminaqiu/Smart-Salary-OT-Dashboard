// --- state.js ---

import { STORAGE_KEY, defaultParams } from './constants.js';
import { debounce, formatDateToYyyyMmDd } from './utils.js';

// The main state object for the entire application
export let state = {};

// Generate the list of months for the application
function generateMonths(startYear, endYear) {
    const generatedMonths = [];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    for (let year = startYear; year <= endYear; year++) {
        for (let month = 0; month < 12; month++) {
            const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
            const fullMonthLabel = `${monthNames[month]} ${year}`;
            generatedMonths.push({ key: monthKey, fullLabel: fullMonthLabel });
        }
    }
    return generatedMonths;
}

export const months = generateMonths(2024, 2027);

// Load state from localStorage or initialize a new one
export function loadState() {
    let parsedState;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        parsedState = raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.error("Failed to parse state from localStorage:", e);
        parsedState = null;
    }

    if (!parsedState) {
        const newState = { params: {}, ot: {}, expenses: {}, customPatterns: [], budgets: {}, expensesInitialized: {} };
        months.forEach(m => {
            newState.params[m.key] = { ...defaultParams };
        });
        state = newState;
        return;
    }
    
    // Ensure all months exist and have default params
    months.forEach(m => {
        if (!parsedState.params[m.key]) {
            parsedState.params[m.key] = { ...defaultParams };
        } else {
            parsedState.params[m.key] = { ...defaultParams, ...parsedState.params[m.key] };
        }
        // ... (add other initialization logic from your original loadState)
    });
    
    state = parsedState;
}

// Private save function
function _saveState() {
    try {
        state.customPatterns = otPatterns.custom; // Ensure custom patterns are in sync
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        console.log("State saved.");
    } catch (e) {
        console.error("Failed to save state to localStorage:", e);
        alert("There was an error saving your data. Please ensure you have enough space and try again.");
    }
}

// Debounced save function to improve performance
export const saveState = debounce(_saveState, 500);

// Function to get a specific part of the state
export function getState() {
    return state;
}

// Function to reset the entire application state
export function resetState() {
    if (confirm('⚠️ This will reset ALL data for all months. This cannot be undone. Are you sure?')) {
        localStorage.removeItem(STORAGE_KEY);
        loadState();
        return true; // Indicate that a reset happened
    }
    return false;
}