// --- utils.js ---

// Formats a number to 2 decimal places
export function fmt(n) { 
    return (Number(n) || 0).toFixed(2); 
}

// Formats a number as Malaysian Ringgit
export function fmtDisplay(n) { 
    return `RM ${fmt(n)}`; 
}

// Formats a Date object to "YYYY-MM-DD"
export function formatDateToYyyyMmDd(date) {
    if (!date || isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Debounce function to limit the rate at which a function gets called
export function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

// ... other utility functions like:
// - getDayOfWeek()
// - calculateDuration()
// - etc.