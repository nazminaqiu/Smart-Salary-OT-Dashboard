// --- ui.js ---

import { fmt, fmtDisplay } from './utils.js';

// Cache all DOM elements for performance
export const elements = {
    monthSelect: document.getElementById('monthSelect'),
    monthLabel: document.getElementById('monthLabel'),
    // ... add ALL your other document.getElementById calls here
    otTableBody: document.querySelector('#otTable tbody'),
    grossOut: document.getElementById('grossOut'),
    deductOut: document.getElementById('deductOut'),
    netOut: document.getElementById('netOut'),
    // ... etc.
};

// Renders the OT table for the given month data
export function renderOT(otData, params, dateRange) {
    elements.otTableBody.innerHTML = ''; // Clear previous content
    if (!otData || otData.length === 0) {
        // ... render empty state message
        return;
    }
    
    otData.forEach((row, idx) => {
        const tr = document.createElement('tr');
        const otPay = (row.hours || 0) * (row.mult || 0) * (params.hourly || 0);
        // ... build the innerHTML for the table row
        tr.innerHTML = `
          <td data-label="Date"><input type="text" value="${row.date||''}" data-idx="${idx}" data-field="date"></td>
          <td data-label="OT Pay" class="otpay">${fmtDisplay(otPay)}</td>
          `;
        elements.otTableBody.appendChild(tr);
    });

    // Note: Event listeners should be attached in a separate module (e.g., main.js)
    // to keep rendering logic separate from interaction logic.
}

// Updates the main summary cards
export function updateSummary(totals) {
    elements.grossOut.innerHTML = `<span class="currency">RM</span> ${fmt(totals.gross)}`;
    elements.deductOut.innerHTML = `<span class="currency">RM</span> ${fmt(totals.deductions)}`;
    elements.netOut.innerHTML = `<span class="currency">RM</span> ${fmt(totals.net)}`;
    // ... update other summary elements
}

// Shows a temporary message to the user
export function showSaveMessage(message, isSuccess = true) {
    const saveMessage = document.getElementById('saveMessage'); // One-off query is okay here
    saveMessage.innerHTML = `<div class="${isSuccess ? 'success-message' : 'error-message'}">${message}</div>`;
    saveMessage.style.display = 'block';
    setTimeout(() => { saveMessage.style.display = 'none'; }, 3000);
}

// You would continue this pattern for all other rendering functions:
// - renderExpenses()
// - renderExpenseAnalysis()
// - updateSmartGoalUI()
// - etc.