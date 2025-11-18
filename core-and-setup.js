// --- HELPER FUNCTIONS ---
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const fmtRM = n => `RM ${round2(n).toFixed(2)}`;

function toggleInstallmentFields() {
    const isChecked = document.getElementById('isInstallment').checked;
    const fieldsDiv = document.getElementById('installmentFields');
    fieldsDiv.style.display = isChecked ? 'grid' : 'none';
}

function getFuturePayPeriod(period, monthsToAdd) {
    const [year, month] = period.split('-').map(Number);
    // Create a date object. JS months are 0-indexed.
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + monthsToAdd);
    return getMonthKey(date); // Re-use existing helper
}

function toLocalDateString(date) {
    // A timezone-safe way to get YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatHoursDuration(decimalHours) {
    if (typeof decimalHours !== 'number' || isNaN(decimalHours)) {
        return '';
    }
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    
    if (hours > 0 && minutes > 0) {
        return `${hours} h ${minutes} min`;
    } else if (hours > 0) {
        return `${hours} h`;
    } else if (minutes > 0) {
        return `${minutes} min`;
    } else {
        return '0 h';
    }
}

function addHoursToTime(timeStr, hours) {
    if (!timeStr) return '';
    const [startHour, startMinute] = timeStr.split(':').map(Number);
    const totalStartMinutes = (startHour * 60) + startMinute;
    const durationMinutes = hours * 60;
    const totalEndMinutes = totalStartMinutes + durationMinutes;
    
    const endHour = Math.floor(totalEndMinutes / 60);
    const endMinute = Math.round(totalEndMinutes % 60);
    
    const finalHour = endHour + Math.floor(endMinute / 60);
    const finalMinute = endMinute % 60;

    return `${String(finalHour % 24).padStart(2, '0')}:${String(finalMinute).padStart(2, '0')}`;
}

function getRatioFromProfile(profile) {
    switch (profile) {
        case 'mine100': return 1;
        case 'partner100': return 0;
        case 'equal50': return 0.5;
        default: return null;
    }
}

// --- NEW: Tooltip for truncated text ---
function applyTruncationTooltips(selector) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
        if (element.scrollWidth > element.clientWidth) {
            element.setAttribute('title', element.textContent);
        } else {
            element.removeAttribute('title');
        }
    });
}

// --- THEME SWITCHER LOGIC ---
function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    if (document.body.classList.contains('dark-theme')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
}

// --- SIMULATOR LOGIC ---
function launchSimulator() {
    const categorySelect = document.getElementById('simExpenseCategory');
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    const categories = [...new Set(expenses.filter(e => !e.isExcluded).map(e => e.category))];
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = getCategoryInfo(cat).name;
        categorySelect.appendChild(option);
    });
    document.getElementById('simulator-modal').style.display = 'flex';
    runSimulation();
}

function closeSimulator() {
    document.getElementById('simulator-modal').style.display = 'none';
}

function runSimulation() {
    const includedExpenses = expenses.filter(e => !e.isExcluded);
    const partnerContribution = parseFloat(document.getElementById('simPartnerContribution').value) || 0;

    const prevPeriod = getPreviousMonthPeriod(currentPayPeriod);
    const prevOTEntries = JSON.parse(localStorage.getItem(`overtimeEntries_${prevPeriod}`) || '[]');
    const totalOT = prevOTEntries.reduce((s, e) => s + (e.amount || 0), 0);

    const grossIncome = salaryData.basic + salaryData.claims + salaryData.hpAllowance + salaryData.incentive + salaryData.bonus + (salaryData.otherIncome || 0) + totalOT;
    const totalDeductions = salaryData.epf + salaryData.socso + salaryData.eis + salaryData.pcb + salaryData.cashAdvance + salaryData.otherDeductions;

    const currentNetIncome = grossIncome - totalDeductions;
    const currentTotalMyShare = includedExpenses.reduce((s, e) => s + (e.myShare || 0), 0);

    const cat = document.getElementById('simExpenseCategory').value;
    const pct = parseFloat(document.getElementById('simExpenseReduction').value) || 0;
    const categoryTotal = cat ? includedExpenses.filter(e => e.category === cat).reduce((s, e) => s + (e.myShare || 0), 0) : 0;
    const reduction = round2(categoryTotal * (pct / 100));

    const simNetIncome = currentNetIncome + (parseFloat(document.getElementById('simSalaryIncrease').value) || 0);
    let simMyShare = currentTotalMyShare + (parseFloat(document.getElementById('simNewExpense').value) || 0) - reduction - partnerContribution;
    if (simMyShare < 0) simMyShare = 0;

    const originalSavings = currentNetIncome - currentTotalMyShare;
    const simulatedSavings = simNetIncome - simMyShare;
    const diff = simulatedSavings - originalSavings;

    document.getElementById('simulationResult').innerHTML = `
        Original Monthly Savings: <strong>${fmtRM(originalSavings)}</strong><br>
        Simulated Monthly Savings: <strong>${fmtRM(simulatedSavings)}</strong><br>
        Impact: <strong style="color:${diff>=0?'green':'red'};">${diff>=0?'+':''}${fmtRM(diff)}</strong>
    `;
}

const publicHolidays = {
    '2025': ['2025-01-01', '2025-01-29', '2025-01-30', '2025-02-01', '2025-02-12', '2025-03-31', '2025-05-01', '2025-05-12', '2025-06-02', '2025-06-07', '2025-08-31', '2025-09-16', '2025-12-25'],
    '2026': ['2026-01-01', '2026-02-17', '2026-02-18', '2026-03-20', '2026-03-21', '2026-05-01', '2026-05-26', '2026-06-01', '2026-05-28', '2026-06-17', '2026-08-31', '2026-09-16', '2026-08-26', '2026-10-21', '2026-12-25'],
    '2027': ['2027-01-01', '2027-02-06', '2027-02-07', '2027-03-10', '2027-03-11', '2027-05-01', '2027-05-15', '2027-06-07', '2027-05-17', '2027-06-06', '2027-08-31', '2027-09-16', '2027-08-15', '2027-11-09', '2027-12-25']
};

const strategyPresets = {
    'balanced': { rate0_5: 10, rate1_5_weekday: 70, rate1_5_saturday: 10, rate2_0: 10 },
    'front-load-weekends': { rate0_5: 40, rate1_5_weekday: 10, rate1_5_saturday: 40, rate2_0: 10 },
    'front-load-weekdays': { rate0_5: 5, rate1_5_weekday: 85, rate1_5_saturday: 5, rate2_0: 5 }
};

// Data storage
let salaryData = {};
let savingsGoalsData = {};
let overtimeEntries = [];
let expenses = [];
let sinkingFunds = [];
let savingsPots = [];
let budgets = {}; 
let recurringExpenses = [];
let previewedOTEntries = [];
let customCategories = [];
let projectList = [];
let lastSelectedProjects = [];
let currentPayPeriod = '';
let startDatePicker, endDatePicker, payPeriodPicker, expenseDatePicker, fundDueDatePicker, otEditDatePicker, fundEditDueDatePicker, customHolidayPicker;
let expenseSortColumn = 'date';
let expenseSortDirection = 'desc';
let manualExpenseSet = false;
let summaryView = 'my';
let aiSavingsPlan = {};
let otCalendar;
let showArchived = false;

// --- FIRESTORE INTEGRATION ---

// Firestore collections/docs to store this app's data.
// With no authentication, everyone using this app will share the same documents.
// Change these if you want separate docs per user/profile.
const FIRESTORE_APPSTATE_COLLECTION = 'appState';
const FIRESTORE_GLOBAL_DOC_ID = 'globalState';
const FIRESTORE_DEFAULT_DOC_ID = 'globalState'; // legacy single-doc backup
const FIRESTORE_PAYPERIOD_COLLECTION = 'payPeriods';

function isFirestoreReady() {
    return typeof window !== 'undefined' && typeof window.db !== 'undefined' && window.db;
}

// --- Cloud sync UI, autosave & history helpers ---

function updateCloudSyncStatus(state, label) {
    const el = document.getElementById('cloudSyncStatus');
    if (!el) return;
    el.classList.remove('cloud-offline', 'cloud-saving', 'cloud-ok', 'cloud-error');
    el.classList.add('cloud-' + state);
    const labelSpan = el.querySelector('.cloud-sync-label');
    if (labelSpan && label) {
        labelSpan.textContent = label;
    }
}

let cloudSaveTimer = null;
let cloudSaveIntervalId = null;

function scheduleCloudAutosave(reason = '') {
    if (!isFirestoreReady()) {
        updateCloudSyncStatus('offline', 'Offline');
        return;
    }
    if (cloudSaveTimer) {
        clearTimeout(cloudSaveTimer);
    }
    updateCloudSyncStatus('saving', 'Saving…');
    cloudSaveTimer = setTimeout(async () => {
        try {
            await saveAppStateToFirestore();
            updateCloudSyncStatus('ok', 'Saved just now');
            if (typeof updateLastCloudSaveDisplay === 'function') {
                updateLastCloudSaveDisplay();
            }
        } catch (err) {
            console.error('Autosave error:', err);
            updateCloudSyncStatus('error', 'Sync error');
        }
    }, 1500);
}

function startCloudAutosaveHeartbeat() {
    if (!isFirestoreReady()) return;
    if (cloudSaveIntervalId) return; // already running
    cloudSaveIntervalId = setInterval(() => {
        scheduleCloudAutosave('heartbeat');
    }, 60000);
}


async function manualCloudSave() {
    if (!isFirestoreReady()) {
        alert('Cloud sync is not configured or available.');
        return;
    }
    try {
        updateCloudSyncStatus('saving', 'Saving…');
        await saveAppStateToFirestore();
        updateCloudSyncStatus('ok', 'Saved just now');
        if (typeof updateLastCloudSaveDisplay === 'function') {
            updateLastCloudSaveDisplay();
        }
    } catch (err) {
        console.error('Manual cloud save error:', err);
        updateCloudSyncStatus('error', 'Sync error');
        alert('Could not save to cloud. Please check your connection and try again.');
    }
}


// Simple in-memory history (undo) stack
const HISTORY_LIMIT = 20;
let historyStack = [];
let isRestoringFromHistory = false;

function recordHistorySnapshot(label) {
    if (!currentPayPeriod) return;

    const snapshot = {
        label,
        period: currentPayPeriod,
        timestamp: new Date().toISOString(),
        salaryData: JSON.parse(JSON.stringify(salaryData)),
        overtimeEntries: JSON.parse(JSON.stringify(overtimeEntries)),
        expenses: JSON.parse(JSON.stringify(expenses)),
        savingsGoalsData: JSON.parse(JSON.stringify(savingsGoalsData)),
        budgets: JSON.parse(JSON.stringify(budgets)),
        sinkingFunds: JSON.parse(JSON.stringify(sinkingFunds)),
        savingsPots: JSON.parse(JSON.stringify(savingsPots))
    };

    historyStack.push(snapshot);
    if (historyStack.length > HISTORY_LIMIT) {
        historyStack.shift();
    }
    renderHistoryList();
}

function applySnapshot(snapshot) {
    if (!snapshot) return;
    isRestoringFromHistory = true;
    try {
        salaryData       = snapshot.salaryData       || {};
        overtimeEntries  = snapshot.overtimeEntries  || [];
        expenses         = snapshot.expenses         || [];
        savingsGoalsData = snapshot.savingsGoalsData || {};
        budgets          = snapshot.budgets          || {};
        sinkingFunds     = snapshot.sinkingFunds     || [];
        savingsPots      = snapshot.savingsPots      || [];

        saveDataForPeriod(snapshot.period);

        if (typeof updateAllDisplays === 'function') {
            updateAllDisplays();
        }
        if (typeof showToast === 'function') {
            showToast('Snapshot restored.');
        }
    } finally {
        isRestoringFromHistory = false;
    }
}

function undoLastChange() {
    if (!historyStack.length) {
        alert('No more changes to undo.');
        return;
    }

    const snapshot = historyStack[historyStack.length - 1];

    if (snapshot.period !== currentPayPeriod) {
        alert('Please switch to ' + snapshot.period + ' to undo that change.');
        return;
    }

    historyStack.pop();
    applySnapshot(snapshot);
    renderHistoryList();
}

function restoreHistoryAt(index) {
    if (index < 0 || index >= historyStack.length) return;
    const snapshot = historyStack[index];
    // drop this snapshot and any after it, so further undo goes further back
    historyStack = historyStack.slice(0, index);
    applySnapshot(snapshot);
    renderHistoryList();
}

function renderHistoryList() {
    const listEl = document.getElementById('history-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (!historyStack.length) {
        const li = document.createElement('li');
        li.textContent = 'No snapshots yet.';
        li.style.fontSize = '0.85em';
        li.style.color = '#666';
        listEl.appendChild(li);
        return;
    }

    const items = historyStack.slice().reverse();
    items.forEach((snap, idx) => {
        const actualIndex = historyStack.length - 1 - idx;
        const li = document.createElement('li');
        li.style.padding = '6px 8px';
        li.style.borderBottom = '1px solid #eee';
        li.style.cursor = 'pointer';

        const date = new Date(snap.timestamp);
        const timeStr = isNaN(date.getTime()) ? snap.timestamp : date.toLocaleString();

        li.textContent = timeStr + ' – ' + (snap.label || 'Snapshot');

        li.addEventListener('click', () => {
            if (confirm('Restore this snapshot? This will overwrite current data for this pay period.')) {
                restoreHistoryAt(actualIndex);
            }
        });

        listEl.appendChild(li);
    });
}

// Collect the relevant localStorage keys for this app into a single object.
function getAppStorageSnapshot() {
    const dataToExport = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
            key.startsWith('salaryData_') ||
            key.startsWith('overtimeEntries_') ||
            key.startsWith('expenses_') ||
            key === 'sinkingFunds' ||
            key === 'savingsPots' ||
            key === 'customCategories' ||
            key === 'projectList' ||
            key === 'recurringExpenses' ||
            key === 'lastPayPeriod' ||
            key === 'lastSeenPayPeriod'
        ) {
            dataToExport[key] = localStorage.getItem(key);
        }
    }
    return dataToExport;
}

// Load app state from Firestore into localStorage.
// This must run BEFORE initializeData() so the app boots from cloud data.
async function loadAppStateFromFirestore() {
    if (!isFirestoreReady()) {
        console.warn('Firestore not ready; skipping cloud load.');
        return;
    }
    try {
        const docRef = window.db.collection(FIRESTORE_APPSTATE_COLLECTION).doc(FIRESTORE_DEFAULT_DOC_ID);
        const snap = await docRef.get();
        if (!snap.exists) {
            console.info('No Firestore state found yet.');
            return;
        }
        const data = snap.data();
        if (!data || !data.localStorageDump) {
            console.info('Firestore document exists but has no localStorageDump field.');
            return;
        }

        const dump = data.localStorageDump;
        Object.keys(dump).forEach(key => {
            localStorage.setItem(key, dump[key]);
        });
        
        if (data && data.updatedAt) {
            try {
                localStorage.setItem('lastCloudSaveTime', data.updatedAt);
            } catch (e) {
                console.warn('Could not persist lastCloudSaveTime from Firestore:', e);
            }
        }

        console.info('Loaded app state from Firestore.');
    } catch (err) {
        console.error('Error loading state from Firestore:', err);
    }
}

// Save entire localStorage-backed app state to the legacy single Firestore document.
async function saveAppStateToFirestore() {
    if (!isFirestoreReady()) {
        return;
    }
    try {
        const snapshot = getAppStorageSnapshot();
        const docRef = window.db.collection(FIRESTORE_APPSTATE_COLLECTION).doc(FIRESTORE_DEFAULT_DOC_ID);
        const nowIso = new Date().toISOString();
        await docRef.set(
            {
                localStorageDump: snapshot,
                updatedAt: nowIso
            },
            { merge: true }
        );
        try {
            localStorage.setItem('lastCloudSaveTime', nowIso);
        } catch (e) {
            console.warn('Could not persist lastCloudSaveTime locally:', e);
        }
        console.info('Saved full app state to Firestore (default doc).');
    } catch (err) {
        console.error('Error saving state to Firestore:', err);
    }
}

// Helper to get the current pay period key used by the app.
function getCurrentPayPeriodKey() {
    if (typeof currentPayPeriod !== 'undefined' && currentPayPeriod) {
        return currentPayPeriod;
    }
    const last = localStorage.getItem('lastPayPeriod');
    return last || '';
}

// Manual backup: save ONLY the current pay period into its own Firestore document.
async function backupCurrentPeriodToCloud() {
    if (!isFirestoreReady()) {
        alert('Cloud backup is not available. Firestore is not ready.');
        return;
    }
    const period = getCurrentPayPeriodKey();
    if (!period) {
        alert('No pay period selected. Please choose a pay period first.');
        return;
    }

    try {
        const suffix = '_' + period;
        const periodDump = {};

        ['salaryData_', 'overtimeEntries_', 'expenses_'].forEach(prefix => {
            const key = prefix + period;
            const value = localStorage.getItem(key);
            if (value !== null) {
                periodDump[key] = value;
            }
        });

        // Global / cross-period keys
        const globalDump = {};
        ['sinkingFunds','savingsPots','customCategories','projectList','recurringExpenses','lastPayPeriod','lastSeenPayPeriod']
            .forEach(key => {
                const value = localStorage.getItem(key);
                if (value !== null) {
                    globalDump[key] = value;
                }
            });

        const db = window.db;
        // Per-pay-period document
        await db.collection(FIRESTORE_PAYPERIOD_COLLECTION).doc(period).set(
            {
                period: period,
                localStorageDump: periodDump,
                updatedAt: new Date().toISOString()
            },
            { merge: true }
        );

        // Global document
        await db.collection(FIRESTORE_APPSTATE_COLLECTION).doc(FIRESTORE_GLOBAL_DOC_ID).set(
            {
                localStorageDump: globalDump,
                updatedAt: new Date().toISOString()
            },
            { merge: true }
        );

        alert('Cloud backup completed for pay period ' + period + '.');
    } catch (err) {
        console.error('Error backing up current period to Firestore:', err);
        alert('Error during cloud backup. Check console for details.');
    }
}

// --- PATCH ---
// This function is now the single source of truth for refreshing the entire UI from scratch.
function fullAppRefresh() {
    const period = getCurrentPayPeriodKey();
    if (!period) return;
    
    // Re-load all data from localStorage into the application's variables and populate forms
    loadDataForPeriod(period);
    
    // Re-run all display updates, calculations, and table rendering
    updateAllDisplays();
    
    // Special check for the calendar, which sometimes needs an explicit re-render
    if (otCalendar) {
        setTimeout(() => otCalendar.render(), 0);
    }
}


// --- PATCH ---
// We modify the cloud restore function to use our new robust refresh function.
async function restoreCurrentPeriodFromCloud() {
    if (!isFirestoreReady()) {
        alert('Cloud restore is not available. Firestore is not ready.');
        return;
    }
    const period = getCurrentPayPeriodKey();
    if (!period) {
        alert('No pay period selected. Please choose a pay period first.');
        return;
    }

    if (!confirm('This will overwrite local data for pay period ' + period + ' with the cloud backup. Continue?')) {
        return;
    }

    try {
        const db = window.db;
        const docRef = db.collection(FIRESTORE_PAYPERIOD_COLLECTION).doc(period);
        const snap = await docRef.get();
        if (!snap.exists) {
            alert('No cloud backup found for pay period ' + period + '.');
            return;
        }
        const data = snap.data();
        const dump = (data && data.localStorageDump) || {};

        Object.keys(dump).forEach(key => {
            localStorage.setItem(key, dump[key]);
        });

        const globalRef = db.collection(FIRESTORE_APPSTATE_COLLECTION).doc(FIRESTORE_GLOBAL_DOC_ID);
        const globalSnap = await globalRef.get();
        if (globalSnap.exists) {
            const globalData = globalSnap.data();
            const globalDump = (globalData && globalData.localStorageDump) || {};
            Object.keys(globalDump).forEach(key => {
                localStorage.setItem(key, globalDump[key]);
            });
        }

        // Instead of calling initializeData(), we now call our powerful refresh function.
        fullAppRefresh();
        
        alert('Cloud restore completed for pay period ' + period + '.');
        showToast('Cloud data restored and UI refreshed.');

    } catch (err) {
        console.error('Error restoring current period from Firestore:', err);
        alert('Error during cloud restore. Check console for details.');
    }
}

// --- END FIRESTORE INTEGRATION ---




// --- CATEGORY MANAGEMENT ---
const categoryConfig = {
    // Housing & Utilities
    mortgage_rent: { name: 'Mortgage or Rent', icon: '🏠' },
    utilities: { name: 'Utilities & Bills', icon: '💡' },

    // Food
    food: { name: 'Food & Dining', icon: '🍔' },
    groceries: { name: 'Groceries', icon: '🛒' },

    // Transportation
    fuel: { name: 'Fuel', icon: '⛽' },
    toll: { name: 'Toll', icon: '🚗' },
    parking: { name: 'Parking', icon: '🅿️' },
    
    // Financial & Debts
    debt: { name: 'Debt', icon: '💳' },
    credit_card: { name: 'Credit Card', icon: '💳' },
    subscriptions: { name: 'Subscriptions', icon: '🔁' },
    savings_investments: { name: 'Savings & Investments', icon: '💰' },

    // Personal & Lifestyle
    shopping: { name: 'Shopping', icon: '🛍️' },
    entertainment: { name: 'Entertainment', icon: '🎬' },
    health: { name: 'Health & Medical', icon: '🏥' },
    personal_care: { name: 'Personal Care', icon: '🧴' },
    family: { name: 'Family', icon: '👨‍👩‍👧‍👦' },
    gifts: { name: 'Gifts', icon: '🎁' },

    // Other
    others: { name: 'Others', icon: '📦' },
};

const iconPresets = [
    '⛽', '🛣️', '🅿️', '🛠️', '💊', '⚕️', '🧾', '🎓', '👶', '🐾', '🐶', '🐱',
    '👕', '💅', '💇‍♀️', '🎁', '🎉', '✈️', '💼', '📈', '📉', '❤️', '🏛️', '🏡'
];

function prettifyCategoryName(value) {
    if (!value) return 'Unknown';
    // Replace underscores with spaces and capitalize words
    return value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function getCategoryInfo(value) {
    if (categoryConfig[value]) {
        return categoryConfig[value];
    }
    const custom = customCategories.find(c => c.value === value);
    // If a custom category is found, return it. Otherwise, create a pretty fallback.
    return custom || { name: prettifyCategoryName(value), icon: '🏷️' };
}

function loadCustomCategories() {
    customCategories = JSON.parse(localStorage.getItem('customCategories') || '[]');
}

function saveCustomCategories() {
    localStorage.setItem('customCategories', JSON.stringify(customCategories));
    populateCategoryDropdowns();
}

// START: MODIFIED populateCategoryDropdowns function
function populateCategoryDropdowns() {
    const allCategories = [
        ...Object.entries(categoryConfig),
        ...customCategories.map(c => [c.value, { name: c.name, icon: c.icon }])
    ];

    const dropdowns = [
        document.getElementById('expenseCategory'),
        document.getElementById('filterExpenseCategory')
    ];

    // Get a unique list of categories that have expenses in the current period
    const categoriesWithExpenses = [...new Set(expenses.map(e => e.category))];

    dropdowns.forEach(select => {
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '';

        // Specific logic for the filter dropdown
        if (select.id === 'filterExpenseCategory') {
            const allOption = document.createElement('option');
            allOption.value = 'all';
            allOption.textContent = 'All Categories';
            select.appendChild(allOption);

            // Filter all possible categories to only show ones with existing expenses
            const relevantCategories = allCategories.filter(([value]) => categoriesWithExpenses.includes(value));
            
            relevantCategories.forEach(([value, { name, icon }]) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = `${icon} ${name}`;
                select.appendChild(option);
            });

        } else { // Logic for all other category dropdowns (e.g., the one for adding an expense)
            allCategories.forEach(([value, { name, icon }]) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = `${icon} ${name}`;
                select.appendChild(option);
            });
        }

        // Restore the previously selected value if it still exists
        if (currentValue) {
             select.value = currentValue;
        }
    });
}
// END: MODIFIED populateCategoryDropdowns function


function openManageCategoriesModal() {
    populateIconGrid();
    displayCustomCategories();
    resetCategoryForm();
    document.getElementById('manage-categories-modal').style.display = 'flex';
}

function closeManageCategoriesModal() {
    document.getElementById('manage-categories-modal').style.display = 'none';
}

function displayCustomCategories() {
    const list = document.getElementById('customCategoriesList');
    list.innerHTML = '';
    if (customCategories.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No custom categories yet. Add one below!</p>';
    } else {
        customCategories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'custom-category-item';
            item.innerHTML = `
                <span>${cat.icon} ${cat.name}</span>
                <div class="custom-category-item-actions">
                    <button class="btn btn-small btn-secondary" onclick="editCustomCategory('${cat.value}')">Edit</button>
                    <button class="btn btn-small btn-danger" onclick="deleteCustomCategory('${cat.value}')">Delete</button>
                </div>
            `;
            list.appendChild(item);
        });
    }
}

function addCustomCategory() {
    const nameInput = document.getElementById('newCategoryName');
    const iconDisplay = document.getElementById('selectedCategoryIcon');
    const editingValue = document.getElementById('editingCategoryValue').value;
    const name = nameInput.value.trim();
    const icon = iconDisplay.textContent;

    if (!name) {
        alert('Please enter a category name.');
        return;
    }

    if (editingValue) {
        // Update existing category
        const categoryIndex = customCategories.findIndex(c => c.value === editingValue);
        if (categoryIndex > -1) {
            customCategories[categoryIndex].name = name;
            customCategories[categoryIndex].icon = icon;
        }
    } else {
        // Add new category
        const value = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        if (categoryConfig[value] || customCategories.some(c => c.value === value)) {
            alert('A category with this name or a similar internal ID already exists.');
            return;
        }
        customCategories.push({ name, icon, value });
    }

    saveCustomCategories();
    displayCustomCategories();
    displayBudgets(); // This line ensures the budgeting tab refreshes
    resetCategoryForm();
}

function editCustomCategory(value) {
    const category = customCategories.find(c => c.value === value);
    if (!category) return;

    document.getElementById('newCategoryName').value = category.name;
    document.getElementById('selectedCategoryIcon').textContent = category.icon;
    document.getElementById('editingCategoryValue').value = category.value;

    const addBtn = document.getElementById('addCategoryBtn');
    addBtn.textContent = 'Update Category';
    addBtn.classList.remove('btn-success');
    addBtn.classList.add('btn-warning');

    document.getElementById('cancelEditCategoryBtn').style.display = 'inline-block';
}

function resetCategoryForm() {
    document.getElementById('newCategoryName').value = '';
    document.getElementById('selectedCategoryIcon').textContent = '🏷️';
    document.getElementById('editingCategoryValue').value = '';

    const addBtn = document.getElementById('addCategoryBtn');
    addBtn.textContent = 'Add Category';
    addBtn.classList.remove('btn-warning');
    addBtn.classList.add('btn-success');

    document.getElementById('cancelEditCategoryBtn').style.display = 'none';
    document.getElementById('iconPresetGrid').style.display = 'none';
}

function deleteCustomCategory(value) {
    if (confirm('Are you sure you want to delete this category? This cannot be undone.')) {
        customCategories = customCategories.filter(c => c.value !== value);

        // Clean up budget for this category in the current month
        if (budgets[value]) {
            delete budgets[value];
        }

        saveCustomCategories();
        displayCustomCategories();
        // Refresh budget displays to reflect the removal
        displayBudgets();
        updateDashboard();
    }
}

function populateIconGrid() {
    const grid = document.getElementById('iconPresetGrid');
    grid.innerHTML = '';
    const defaultIcons = Object.values(categoryConfig).map(cat => cat.icon);
    const allIcons = [...new Set([...defaultIcons, ...iconPresets])];

    allIcons.forEach(icon => {
        const iconDiv = document.createElement('div');
        iconDiv.className = 'icon-preset';
        iconDiv.textContent = icon;
        iconDiv.onclick = () => selectIcon(icon);
        grid.appendChild(iconDiv);
    });
}

function selectIcon(icon) {
    document.getElementById('selectedCategoryIcon').textContent = icon;
    document.getElementById('iconPresetGrid').style.display = 'none';
}

function toggleIconGrid() {
    const grid = document.getElementById('iconPresetGrid');
    grid.style.display = grid.style.display === 'none' ? 'grid' : 'none';
}

// --- PROJECT MANAGEMENT ---
function loadProjects() {
    projectList = JSON.parse(localStorage.getItem('projectList') || '["PERKESO KASEYA", "JPA SIEM"]');
    lastSelectedProjects = JSON.parse(localStorage.getItem('lastSelectedProjects') || '[]');
}

function saveProjects() {
    localStorage.setItem('projectList', JSON.stringify(projectList));
    populateProjectDropdown();
}

function populateProjectDropdown() {
    const select = document.getElementById('defaultProject');
    select.innerHTML = '';
    projectList.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        if(lastSelectedProjects.includes(name)) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

function openManageProjectsModal() {
    displayProjects();
    document.getElementById('manage-projects-modal').style.display = 'flex';
}

function closeManageProjectsModal() {
    document.getElementById('manage-projects-modal').style.display = 'none';
}

function displayProjects() {
    const list = document.getElementById('projectList');
    list.innerHTML = '';
    projectList.forEach(name => {
        const item = document.createElement('div');
        item.className = 'project-item';
        item.innerHTML = `
            <span>${name}</span>
            <div class="project-item-actions">
                <button class="btn btn-small btn-danger" onclick="deleteProject('${name}')">Delete</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function addProject() {
    const input = document.getElementById('newProjectName');
    const name = input.value.trim();
    if (name && !projectList.includes(name)) {
        projectList.push(name);
        saveProjects();
        displayProjects();
        input.value = '';
    } else if (projectList.includes(name)) {
        alert('This project name already exists.');
    }
}

function deleteProject(name) {
    projectList = projectList.filter(p => p !== name);
    saveProjects();
    displayProjects();
}

const generateId = () => 'id_' + Math.random().toString(36).substr(2, 9);

function getMonthKey(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
}

function getNewPeriodData() {
    return {
        salaryData: { basic: 0, claims: 0, hpAllowance: 80, incentive: 500, bonus: 0, otherIncome: 0, epf: 0, socso: 0, eis: 0, pcb: 0, cashAdvance: 0, otherDeductions: 0 },
        overtimeEntries: [],
        expenses: [],
        savingsGoalsData: { targetSavings: 0, expectedExpenses: 0, emergencyFundGoal: 0, currentEmergencyFund: 0 },
        budgets: {} 
    };
}

function migrateExpenseRow(row) {
    if (row.myShare == null && row.partnerShare == null) {
        const my = row.amount ?? 0;
        const split = row.splitPayment ?? Math.max(0, (row.fullAmount || 0) - my);
        const full = row.fullAmount ?? round2(my + split);
        row.myShare = round2(my);
        row.partnerShare = round2(full - row.myShare);
        row.fullAmount = full;
    }
    row.splitProfile = row.splitProfile || 'custom';
    row.isExcluded = row.isExcluded || false;
    delete row.amount;
    delete row.splitPayment;
    return row;
}

function initializeData() {
    const now = new Date();
    currentPayPeriod = localStorage.getItem('lastPayPeriod') || getMonthKey(now);
    
    initializeDatePickers();
    initializeMonthPickers();
    initializeCalendar();
    
    loadCustomCategories();
    populateCategoryDropdowns(); // This will now populate the filter dropdown as well
    loadProjects();
    populateProjectDropdown();
    
    const savedRecurring = localStorage.getItem('recurringExpenses');
    recurringExpenses = savedRecurring ? JSON.parse(savedRecurring) : [];
    
    const savedSinkingFunds = localStorage.getItem('sinkingFunds');
    sinkingFunds = savedSinkingFunds ? JSON.parse(savedSinkingFunds) : [];
    
    const savedSavingsPots = localStorage.getItem('savingsPots');
    savingsPots = savedSavingsPots ? JSON.parse(savedSavingsPots) : [];

    loadDataForPeriod(currentPayPeriod);
    
    checkForRecurringPrompt();
    
    updateAllDisplays();
    runForecast();
    
    switchTab('salary');
}

function handlePayPeriodChange(newPeriod) {
    if (!newPeriod || newPeriod === currentPayPeriod) return;
    
    if (localStorage.getItem(`salaryData_${currentPayPeriod}`) || expenses.length > 0 || overtimeEntries.length > 0) {
         saveDataForPeriod(currentPayPeriod);
    }

    currentPayPeriod = newPeriod;
    localStorage.setItem('lastPayPeriod', newPeriod);
    
    // Use the robust refresh function
    fullAppRefresh();
    
    checkForRecurringPrompt();
}

function loadDataForPeriod(period) {
    manualExpenseSet = false;
    const savedSalary = localStorage.getItem(`salaryData_${period}`);

    if (savedSalary) {
        salaryData = JSON.parse(savedSalary);
        overtimeEntries = JSON.parse(localStorage.getItem(`overtimeEntries_${period}`) || '[]');
        const rawExpenses = JSON.parse(localStorage.getItem(`expenses_${period}`) || '[]');
        expenses = rawExpenses.map(migrateExpenseRow);
        savingsGoalsData = JSON.parse(localStorage.getItem(`savingsGoalsData_${period}`) || '{}');
        budgets = JSON.parse(localStorage.getItem(`budgets_${period}`) || '{}');

        const allValidCategoryKeys = [...Object.keys(categoryConfig), ...customCategories.map(c => c.value)];
        for (const budgetCategory in budgets) {
            if (!allValidCategoryKeys.includes(budgetCategory)) {
                delete budgets[budgetCategory];
            }
        }

    } else {
        const newData = getNewPeriodData();
        salaryData = newData.salaryData;
        overtimeEntries = newData.overtimeEntries;
        expenses = newData.expenses;
        savingsGoalsData = newData.savingsGoalsData;
        budgets = newData.budgets;
    }

    document.getElementById('basicSalary').value = salaryData.basic || '';
    document.getElementById('claims').value = salaryData.claims || '';
    document.getElementById('hpAllowance').value = salaryData.hpAllowance || '80';
    document.getElementById('incentive').value = salaryData.incentive || '500';
    document.getElementById('bonus').value = salaryData.bonus || '';
    document.getElementById('otherIncome').value = salaryData.otherIncome || '';
    document.getElementById('cashAdvance').value = salaryData.cashAdvance || '';
    document.getElementById('otherDeductions').value = salaryData.otherDeductions || '';
    
    document.getElementById('targetSavings').value = savingsGoalsData.targetSavings || '';
    document.getElementById('expectedExpenses').value = savingsGoalsData.expectedExpenses || '';
    document.getElementById('emergencyFundGoal').value = savingsGoalsData.emergencyFundGoal || '';
    document.getElementById('currentEmergencyFund').value = savingsGoalsData.currentEmergencyFund || '';
    
    if (salaryData.customOtStartDate && salaryData.customOtEndDate) {
        startDatePicker.setDate(salaryData.customOtStartDate, false);
        endDatePicker.setDate(salaryData.customOtEndDate, false);
    } else {
        setDefaultOtDates();
    }
    
    if (salaryData.customPublicHolidays) {
        customHolidayPicker.setDate(salaryData.customPublicHolidays, false);
    } else {
        customHolidayPicker.clear();
    }
    
    const [year, month] = period.split('-').map(Number);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('currentMonth').value = `${months[month - 1]} ${year}`;
}

function saveDataForPeriod(period) {
    if (!period) return;
    
    if (!isRestoringFromHistory) {
        recordHistorySnapshot('Change in ' + period);
    }
    
    salaryData.customOtStartDate = document.getElementById('otStartDate').value;
    salaryData.customOtEndDate = document.getElementById('otEndDate').value;
    
    localStorage.setItem(`salaryData_${period}`, JSON.stringify(salaryData));
    localStorage.setItem(`overtimeEntries_${period}`, JSON.stringify(overtimeEntries));
    localStorage.setItem(`expenses_${period}`, JSON.stringify(expenses));
    localStorage.setItem(`savingsGoalsData_${period}`, JSON.stringify(savingsGoalsData));
    localStorage.setItem(`budgets_${period}`, JSON.stringify(budgets));
    localStorage.setItem('sinkingFunds', JSON.stringify(sinkingFunds));
    localStorage.setItem('savingsPots', JSON.stringify(savingsPots));

    scheduleCloudAutosave('saveDataForPeriod');
}

function updateAllDisplays() {
    autoCalculateDeductions();
    displayOTEntries();
    displayExpenses();
    displayBudgets();
    displaySinkingFunds();
    displaySavingsPots();
    populateCategoryDropdowns();
    updateGoldInvestmentStatus();
    updateDashboard();
    updateSummary();
    updateSavingsAnalysis();
}

function setDefaultOtDates() {
    const payPeriod = document.getElementById('payPeriod').value;
    if (!payPeriod) return;
    const [year, month] = payPeriod.split('-').map(Number);
    
    const otStartDate = new Date(year, month - 2, 26); 
    const otEndDate = new Date(year, month - 1, 25);
    
    startDatePicker.setDate(otStartDate, true);
    endDatePicker.setDate(otEndDate, true);
}

function autoCalculateDeductions() {
    updateAndSaveSalary();
    
    const prevPeriod = getPreviousMonthPeriod(currentPayPeriod);
    const prevOTEntries = JSON.parse(localStorage.getItem(`overtimeEntries_${prevPeriod}`) || '[]');
    const totalOT = prevOTEntries.reduce((sum, e) => sum + e.amount, 0);

    const { epf, socso, eis, pcb } = calculateDeductions(salaryData, totalOT);
    
    document.getElementById('epf').value = epf.toFixed(2);
    document.getElementById('socso').value = socso.toFixed(2);
    document.getElementById('eis').value = eis.toFixed(2);
    document.getElementById('pcb').value = pcb.toFixed(2);
    
    updateAndSaveSalary();
}

function calculatePCB(taxableIncome) {
    if (taxableIncome <= 0) return 0;
    
    const dataPoints = [
        { income: 5916.59, pcb: 159.90 },
        { income: 7295.01, pcb: 311.50 },
        { income: 8584.76, pcb: 534.30 }
    ];

    if (taxableIncome <= dataPoints[0].income) {
        return (taxableIncome / dataPoints[0].income) * dataPoints[0].pcb;
    }

    if (taxableIncome >= dataPoints[dataPoints.length - 1].income) {
        return (taxableIncome / dataPoints[dataPoints.length - 1].income) * dataPoints[dataPoints.length - 1].pcb;
    }

    let lowerBound, upperBound;
    for (let i = 0; i < dataPoints.length - 1; i++) {
        if (taxableIncome >= dataPoints[i].income && taxableIncome <= dataPoints[i + 1].income) {
            lowerBound = dataPoints[i];
            upperBound = dataPoints[i + 1];
            break;
        }
    }

    const incomeRange = upperBound.income - lowerBound.income;
    const pcbRange = upperBound.pcb - lowerBound.pcb;
    const incomeFraction = (taxableIncome - lowerBound.income) / incomeRange;

    return lowerBound.pcb + (incomeFraction * pcbRange);
}

function calculateDeductions(currentSalary, totalOT) {
    const basic = currentSalary.basic || 0;
    const incentive = currentSalary.incentive || 0;
    const bonus = currentSalary.bonus || 0;
    const otherIncome = currentSalary.otherIncome || 0;

    const epf = basic * 0.11;
    const socso = 29.75;
    const eis = 11.90;
    
    const taxableIncome = basic + incentive + bonus + otherIncome + totalOT;
    const pcb = calculatePCB(taxableIncome);

    return { epf, socso, eis, pcb };
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.getElementById(`tab-btn-${tabName}`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');

    if (tabName === 'summary') {
        updateSummary();
    }
    if (tabName === 'overtime' && otCalendar) {
        setTimeout(() => otCalendar.render(), 0);
    }
}


function updateAndSaveSalary() {
    salaryData.basic = parseFloat(document.getElementById('basicSalary').value) || 0;
    salaryData.claims = parseFloat(document.getElementById('claims').value) || 0;
    salaryData.hpAllowance = parseFloat(document.getElementById('hpAllowance').value) || 0;
    salaryData.incentive = parseFloat(document.getElementById('incentive').value) || 0;
    salaryData.bonus = parseFloat(document.getElementById('bonus').value) || 0;
    salaryData.otherIncome = parseFloat(document.getElementById('otherIncome').value) || 0;
    salaryData.epf = parseFloat(document.getElementById('epf').value) || 0;
    salaryData.socso = parseFloat(document.getElementById('socso').value) || 0;
    salaryData.eis = parseFloat(document.getElementById('eis').value) || 0;
    salaryData.pcb = parseFloat(document.getElementById('pcb').value) || 0;
    salaryData.cashAdvance = parseFloat(document.getElementById('cashAdvance').value) || 0;
    salaryData.otherDeductions = parseFloat(document.getElementById('otherDeductions').value) || 0;
    saveDataForPeriod(currentPayPeriod);
    updateDashboard();
    updateSavingsAnalysis();
}

function updateAndSaveSavingsGoals() {
    savingsGoalsData.targetSavings = parseFloat(document.getElementById('targetSavings').value) || 0;
    savingsGoalsData.expectedExpenses = parseFloat(document.getElementById('expectedExpenses').value) || 0;
    savingsGoalsData.emergencyFundGoal = parseFloat(document.getElementById('emergencyFundGoal').value) || 0;
    savingsGoalsData.currentEmergencyFund = parseFloat(document.getElementById('currentEmergencyFund').value) || 0;
    saveDataForPeriod(currentPayPeriod);
    updateDashboard();
    updateSavingsAnalysis();
}

function resetSalaryForm() {
    document.getElementById('basicSalary').value = '';
    document.getElementById('claims').value = '';
    document.getElementById('bonus').value = '';
    document.getElementById('otherIncome').value = '';
    document.getElementById('cashAdvance').value = '';
    document.getElementById('otherDeductions').value = '';
    autoCalculateDeductions();
}

let debounceTimer;

function debounce(func, delay) {
    return function(...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
}

const debouncedAllocation = debounce(handleRealtimeAllocation, 500);

function handleRealtimeAllocation() {
    const totalTargetEarnings = parseFloat(document.getElementById('targetOTEarnings').value) || 0;
    if (totalTargetEarnings <= 0) {
        if (overtimeEntries.length > 0) {
             overtimeEntries = [];
             saveDataForPeriod(currentPayPeriod);
             displayOTEntries();
             updateDashboard();
        }
        return;
    }
    generateSmartOTAllocation(true, true);
    applyOTAllocation(true);
    topUpOTToMeetTarget(true);
}

function initializeDatePickers() {
    const flatpickrConfig = {
        altInput: true,
        altFormat: "d/m/Y",
        dateFormat: "Y-m-d",
        "locale": {
            "firstDayOfWeek": 1
        }
    };

    startDatePicker = flatpickr("#otStartDate", {
    ...flatpickrConfig,
    onChange: function(selectedDates, dateStr) {
        if (endDatePicker.selectedDates.length > 0 && selectedDates[0] > endDatePicker.selectedDates[0]) {
            endDatePicker.setDate(selectedDates[0], true);
        }
        endDatePicker.set('minDate', dateStr);
        saveDataForPeriod(currentPayPeriod); // Save on change

        // NEW: immediately nudge the calendar to the new OT start month
        if (typeof focusCalendarOnCurrentOTWindow === 'function') {
            focusCalendarOnCurrentOTWindow();
        }
        }
    });
    endDatePicker = flatpickr("#otEndDate", {
        ...flatpickrConfig,
         onChange: function(selectedDates, dateStr) {
            saveDataForPeriod(currentPayPeriod); // Save on change
        }
    });
    expenseDatePicker = flatpickr("#expenseDate", {
        ...flatpickrConfig,
        defaultDate: "today"
    });
    fundDueDatePicker = flatpickr("#fundDueDate", {
        ...flatpickrConfig,
        minDate: "today"
    });
    otEditDatePicker = flatpickr("#otEditDate", {
        ...flatpickrConfig
    });
    fundEditDueDatePicker = flatpickr("#fundEditDueDate", {
        ...flatpickrConfig,
        minDate: "today"
    });
    customHolidayPicker = flatpickr("#customPublicHolidays", {
        ...flatpickrConfig,
        mode: "multiple",
        onChange: function(selectedDates, dateStr, instance) {
            salaryData.customPublicHolidays = instance.selectedDates.map(d => toLocalDateString(d));
            saveDataForPeriod(currentPayPeriod);
            debouncedAllocation(); // Re-run allocation when holidays change
        }
    });
}

function initializeMonthPickers() {
    payPeriodPicker = flatpickr("#payPeriod", {
        plugins: [
            new monthSelectPlugin({
              shorthand: true,
              dateFormat: "Y-m",
              altFormat: "F, Y",
            })
        ],
        onChange: function(selectedDates, dateStr, instance) {
            handlePayPeriodChange(dateStr);
        }
    });
    payPeriodPicker.setDate(currentPayPeriod, false);
}



// Settings modal helpers
function openSettingsModal() {
    const el = document.getElementById('settings-modal');
    if (el) {
        el.style.display = 'flex';
        renderHistoryList();
    }
}

function closeSettingsModal() {
    const el = document.getElementById('settings-modal');
    if (el) {
        el.style.display = 'none';
    }
}

// --- PATCHED STARTUP LOGIC ---
document.addEventListener('DOMContentLoaded', function() {
    applySavedTheme();

    const startApp = () => {
        initializeData();
        validateExpenseForm();
        startCloudAutosaveHeartbeat();
        updateLastCloudSaveDisplay();
    };

    if (typeof loadAppStateFromFirestore === 'function' && isFirestoreReady()) {
        loadAppStateFromFirestore()
            .catch(err => {
                console.error('Failed to load from Firestore, starting with local data.', err);
            })
            .finally(() => {
                console.info('Firestore load attempt finished. Starting app...');
                startApp();
            });
    } else {
        console.info('Firestore not ready. Starting app with local data only.');
        startApp();
    }

    document.getElementById('import-file').addEventListener('change', importData);
    document.getElementById('import-ot-file').addEventListener('change', importOTEntries);
    
    document.getElementById('targetSavings').addEventListener('input', updateAndSaveSavingsGoals);
    document.getElementById('emergencyFundGoal').addEventListener('input', updateAndSaveSavingsGoals);
    document.getElementById('currentEmergencyFund').addEventListener('input', updateAndSaveSavingsGoals);
    document.getElementById('expectedExpenses').addEventListener('input', () => {
        manualExpenseSet = true;
        updateAndSaveSavingsGoals();
    });

    document.getElementById('useHouseholdExpenses').addEventListener('change', () => {
        manualExpenseSet = false;
        updateSavingsAnalysis();
    });

    ['myShare','partnerShare','expenseSplitProfile']
      .forEach(id => {
          const el = document.getElementById(id);
          if (el) el.addEventListener('input', id === 'expenseSplitProfile' ? applySplitProfile : updateShares);
      });
    
    document.getElementById('budgetSnapshotSort').addEventListener('change', displayBudgetSnapshot);

    initializePercentageInputs();
});

// -----------------------------
// Optional Firestore Cloud Backup
// -----------------------------

function isFirestoreReady() {
    return typeof window !== 'undefined' && !!window.db;
}

// Build a snapshot of all relevant localStorage keys for this app.
function getAppLocalStorageSnapshot() {
    const dataToExport = {};
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (
                key.startsWith('salaryData_') ||
                key.startsWith('overtimeEntries_') ||
                key.startsWith('expenses_') ||
                key.startsWith('savingsGoalsData_') ||
                key.startsWith('budgets_') ||
                key === 'sinkingFunds' ||
                key === 'savingsPots' ||
                key === 'customCategories' ||
                key === 'projectList' ||
                key === 'recurringExpenses' ||
                key === 'lastPayPeriod' ||
                key === 'lastSeenPayPeriod'
            ) {
                dataToExport[key] = localStorage.getItem(key);
            }
        }
    } catch (e) {
        console.error('[Cloud] Failed to read localStorage for snapshot:', e);
    }
    return dataToExport;
}

function setCloudProgress(percent) {
    const fill = document.getElementById('cloudProgressFill');
    if (!fill) return;
    const clamped = Math.max(0, Math.min(100, percent));
    fill.style.width = clamped + '%';
}

function showCloudOverlay(text = 'Processing…', detail = 'This may take a few seconds…') {
    const overlay = document.getElementById('cloudOverlay');
    const t = document.getElementById('cloudOverlayText');
    const d = document.getElementById('cloudOverlayDetail');

    if (t) t.textContent = text;
    if (d) d.textContent = detail;

    setCloudProgress(10);

    if (overlay) overlay.style.display = 'block';
}

function hideCloudOverlay() {
    setCloudProgress(0);
    const overlay = document.getElementById('cloudOverlay');
    if (overlay) overlay.style.display = 'none';
}

function updateCloudStatus(state, infoText) {
    const badge = document.getElementById('cloudStatusBadge');
    const sub = document.getElementById('cloudStatusSub');
    if (!badge) return;

    badge.classList.remove(
        'cloud-badge-online',
        'cloud-badge-offline',
        'cloud-badge-working',
        'cloud-badge-error'
    );

    let label = '';

    switch (state) {
        case 'online':
            badge.classList.add('cloud-badge-online');
            label = 'Cloud: Online';
            break;
        case 'working':
            badge.classList.add('cloud-badge-working');
            label = 'Cloud: Working…';
            break;
        case 'error':
            badge.classList.add('cloud-badge-error');
            label = 'Cloud: Error';
            break;
        default:
            badge.classList.add('cloud-badge-offline');
            label = 'Cloud: Offline';
            break;
    }

    badge.textContent = label;
    if (sub && infoText) {
        sub.textContent = infoText;
    }
}

// Save the last backup time locally for display.
function setLastBackupTime(iso) {
    try {
        localStorage.setItem('lastCloudBackupTime', iso);
    } catch (e) {
        console.warn('[Cloud] Could not persist lastCloudBackupTime:', e);
    }
}

function getLastBackupTime() {
    try {
        return localStorage.getItem('lastCloudBackupTime');
    } catch (e) {
        console.warn('[Cloud] Could not read lastCloudBackupTime:', e);
        return null;
    }
}

async function backupAllDataToCloud() {
    if (!isFirestoreReady()) {
        alert('Cloud backup is not available (Firestore offline).');
        updateCloudStatus('offline', 'Cloud not connected.');
        return;
    }

    const snapshot = getAppLocalStorageSnapshot();
    const keys = snapshot ? Object.keys(snapshot) : [];
    if (!keys.length) {
        alert('No app data found to back up.');
        return;
    }

    updateCloudStatus('working', 'Preparing backup…');
    showCloudOverlay('Backing up data to cloud…', 'Collecting local data…');
    setCloudProgress(25);

    try {
        const nowIso = new Date().toISOString();

        setCloudProgress(60);

        await window.db
            .collection('backups')
            .doc('latest')
            .set(
                {
                    localStorageDump: snapshot,
                    updatedAt: nowIso
                },
                { merge: true }
            );

        setCloudProgress(100);
        hideCloudOverlay();

        const niceTime = new Date(nowIso).toLocaleString();
        setLastBackupTime(nowIso);
        updateCloudStatus('online', 'Last backup: ' + niceTime);

        if (typeof showToast === 'function') {
            showToast('Cloud backup completed successfully!');
        } else {
            alert('Cloud backup completed successfully!');
        }

        console.info('[Cloud] Backup saved at', nowIso, 'with', keys.length, 'keys.');
    } catch (e) {
        console.error('[Cloud] Error saving backup:', e);
        hideCloudOverlay();
        updateCloudStatus('error', 'Last backup failed.');

        if (typeof showToast === 'function') {
            showToast('Cloud backup failed. Check console for details.');
        } else {
            alert('Cloud backup failed. Check console for details.');
        }
    }
}

async function restoreAllDataFromCloud() {
    if (!isFirestoreReady()) {
        alert('Cloud restore is not available (Firestore offline).');
        updateCloudStatus('offline', 'Cloud not connected.');
        return;
    }

    if (!confirm('This will overwrite local data with the latest cloud backup. Continue?')) {
        return;
    }

    updateCloudStatus('working', 'Restoring backup…');
    showCloudOverlay('Restoring data from cloud…', 'Fetching backup document…');
    setCloudProgress(20);

    try {
        const docRef = window.db.collection('backups').doc('latest');
        const snap = await docRef.get();

        if (!snap.exists) {
            hideCloudOverlay();
            updateCloudStatus('online', 'No backup found yet.');
            alert('No cloud backup was found.');
            return;
        }

        setCloudProgress(50);

        const data = snap.data();
        const dump = data && data.localStorageDump;
        const updatedAt = data && data.updatedAt;

        if (!dump || typeof dump !== 'object') {
            hideCloudOverlay();
            updateCloudStatus('error', 'Backup invalid.');
            alert('Cloud backup is empty or invalid.');
            return;
        }

        // Write keys from backup into localStorage
        Object.keys(dump).forEach(key => {
            try {
                localStorage.setItem(key, dump[key]);
            } catch (e) {
                console.warn('[Cloud] Failed to restore key', key, e);
            }
        });

        setCloudProgress(100);
        hideCloudOverlay();

        if (updatedAt) {
            setLastBackupTime(updatedAt);
            const niceTime = new Date(updatedAt).toLocaleString();
            updateCloudStatus('online', 'Restored from backup at ' + niceTime);
        } else {
            updateCloudStatus('online', 'Restored from cloud just now.');
        }

        if (typeof showToast === 'function') {
            showToast('Cloud restore successful. Reloading…');
        } else {
            alert('Cloud restore successful. Reloading…');
        }

        setTimeout(() => window.location.reload(), 400);
    } catch (e) {
        console.error('[Cloud] Error loading backup from Firestore:', e);
        hideCloudOverlay();
        updateCloudStatus('error', 'Restore failed.');

        if (typeof showToast === 'function') {
            showToast('Cloud restore failed. Check console for details.');
        } else {
            alert('Cloud restore failed. Check console for details.');
        }
    }
}

// Initialise cloud status badge on load
document.addEventListener('DOMContentLoaded', () => {
    const online = isFirestoreReady();
    const last = getLastBackupTime();

    if (online && last) {
        const niceTime = new Date(last).toLocaleString();
        updateCloudStatus('online', 'Last backup: ' + niceTime);
    } else if (online) {
        updateCloudStatus('online', 'Ready for manual backup.');
    } else {
        updateCloudStatus('offline', 'Using local backup only.');
    }
});
