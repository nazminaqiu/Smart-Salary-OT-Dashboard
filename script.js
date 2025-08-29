// --- HELPER FUNCTIONS ---
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const fmtRM = n => `RM ${round2(n).toFixed(2)}`;

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

// --- THEME SWITCHER LOGIC ---
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
}

// --- SIMULATOR LOGIC ---
function launchSimulator() {
    const categorySelect = document.getElementById('simExpenseCategory');
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    const categories = [...new Set(expenses.filter(e => !e.isExcluded).map(e => e.category))];
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ');
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
let recurringExpenses = [];
let previewedOTEntries = [];
let currentPayPeriod = '';
let startDatePicker, endDatePicker, payPeriodPicker, expenseDatePicker, fundDueDatePicker, otEditDatePicker, fundEditDueDatePicker;
let expenseSortColumn = 'date';
let expenseSortDirection = 'desc';
let manualExpenseSet = false;
let summaryView = 'my';
let aiSavingsPlan = {};
let otCalendar;


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
        savingsGoalsData: { targetSavings: 0, expectedExpenses: 0, emergencyFundGoal: 0, currentEmergencyFund: 0 }
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
    
    const savedRecurring = localStorage.getItem('recurringExpenses');
    recurringExpenses = savedRecurring ? JSON.parse(savedRecurring) : [];
    
    const savedSinkingFunds = localStorage.getItem('sinkingFunds');
    sinkingFunds = savedSinkingFunds ? JSON.parse(savedSinkingFunds) : [];

    loadDataForPeriod(currentPayPeriod);
    
    checkForRecurringPrompt();
    
    updateAllDisplays();
    runForecast();
}

function handlePayPeriodChange(newPeriod) {
    if (!newPeriod || newPeriod === currentPayPeriod) return;
    
    if (localStorage.getItem(`salaryData_${currentPayPeriod}`)) {
         saveDataForPeriod(currentPayPeriod);
    }

    currentPayPeriod = newPeriod;
    localStorage.setItem('lastPayPeriod', newPeriod);
    
    loadDataForPeriod(newPeriod);
    setDefaultOtDates();
    updateAllDisplays();
    
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
    } else {
        const newData = getNewPeriodData();
        salaryData = newData.salaryData;
        overtimeEntries = newData.overtimeEntries;
        expenses = newData.expenses;
        savingsGoalsData = newData.savingsGoalsData;
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
    
    const [year, month] = period.split('-').map(Number);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('currentMonth').value = `${months[month - 1]} ${year}`;
}

function saveDataForPeriod(period) {
    if (!period) return;
    salaryData.customOtStartDate = document.getElementById('otStartDate').value;
    salaryData.customOtEndDate = document.getElementById('otEndDate').value;
    
    localStorage.setItem(`salaryData_${period}`, JSON.stringify(salaryData));
    localStorage.setItem(`overtimeEntries_${period}`, JSON.stringify(overtimeEntries));
    localStorage.setItem(`expenses_${period}`, JSON.stringify(expenses));
    localStorage.setItem(`savingsGoalsData_${period}`, JSON.stringify(savingsGoalsData));
    localStorage.setItem('sinkingFunds', JSON.stringify(sinkingFunds));
}

function updateAllDisplays() {
    autoCalculateDeductions();
    displayOTEntries();
    displayExpenses();
    displaySinkingFunds();
    updateDashboard();
    updateSummary();
    updateSavingsAnalysis();
}

function setDefaultOtDates() {
    const payPeriod = document.getElementById('payPeriod').value;
    if (!payPeriod) return;
    const [year, month] = payPeriod.split('-').map(Number);
    
    // New logic: 26th of previous month to 25th of current month
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

function switchTab(event, tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    let targetElement = event.target;
    while (targetElement && !targetElement.classList.contains('tab')) {
        targetElement = targetElement.parentElement;
    }
    if(targetElement) {
        targetElement.classList.add('active');
    }

    document.getElementById(`${tabName}-tab`).classList.add('active');
    if (tabName === 'summary') updateSummary();
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
            "firstDayOfWeek": 1 // start week on Monday
        }
    };

    startDatePicker = flatpickr("#otStartDate", {
        ...flatpickrConfig,
        onChange: function(selectedDates, dateStr) {
            if (endDatePicker.selectedDates.length > 0 && selectedDates[0] > endDatePicker.selectedDates[0]) {
                endDatePicker.setDate(selectedDates[0], true);
            }
            endDatePicker.set('minDate', dateStr);
            saveDataForPeriod(currentPayPeriod);
        }
    });
    endDatePicker = flatpickr("#otEndDate", {
        ...flatpickrConfig,
         onChange: function(selectedDates, dateStr) {
            saveDataForPeriod(currentPayPeriod);
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

// --- CALENDAR LOGIC ---
function initializeCalendar() {
    const calendarEl = document.getElementById('otCalendar');
    otCalendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        firstDay: 1, // Start on Monday
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'shuffleButton dayGridMonth,timeGridWeek'
        },
        customButtons: {
            shuffleButton: {
                text: '🔄 Shuffle',
                click: function() {
                    shuffleSchedule();
                }
            }
        },
        events: (fetchInfo, successCallback, failureCallback) => {
            successCallback(formatOTEntriesForCalendar());
        },
        eventContent: (arg) => {
            const props = arg.event.extendedProps;
            let html = `
                <div class="fc-event-content-wrapper">
                    <div class="fc-event-main-info" onclick="openOTEditModal('${props.id}')">
                        <div style="font-weight: bold;">${props.hours.toFixed(2)}h @ ${props.rate}x</div>
                        <div>${fmtRM(props.amount)}</div>
                    </div>
                    <div class="fc-event-adjuster">
                        <button class="adjust-btn" onclick="event.stopPropagation(); adjustOTFromCalendar('${props.id}', -0.25)">-</button>
                        <button class="adjust-btn" onclick="event.stopPropagation(); adjustOTFromCalendar('${props.id}', 0.25)">+</button>
                    </div>
                </div>
            `;
            return { html: html };
        }
    });
}

function formatOTEntriesForCalendar() {
    return overtimeEntries.map(entry => ({
        id: entry.id,
        title: `${entry.hours.toFixed(2)}h - ${fmtRM(entry.amount)}`,
        start: entry.date,
        allDay: true,
        className: `rate-${String(entry.rate).replace('.', '-')}`,
        extendedProps: {
            id: entry.id,
            hours: entry.hours,
            rate: entry.rate,
            amount: entry.amount,
            remarks: entry.remarks
        }
    }));
}

// --- NEW: Function to adjust OT from calendar view ---
function adjustOTFromCalendar(entryId, amount) {
    const entryIndex = overtimeEntries.findIndex(e => e.id === entryId);
    if (entryIndex === -1) return;

    const entry = overtimeEntries[entryIndex];
    const newHours = round2(entry.hours + amount);

    if (newHours < 0) return; // Don't allow negative hours

    entry.hours = newHours;

    const hourlyRate = getHourlyRate();
    if (hourlyRate > 0) {
        entry.amount = round2(entry.hours * entry.rate * hourlyRate);
    }

    if (entry.startTime) {
        entry.endTime = addHoursToTime(entry.startTime, entry.hours);
    }

    // If hours are 0, remove the entry
    if (entry.hours === 0) {
        if (confirm("Hours are zero. Do you want to delete this entry?")) {
            overtimeEntries.splice(entryIndex, 1);
        } else {
            // If user cancels deletion, revert hours back
            entry.hours = round2(entry.hours - amount);
            return;
        }
    }

    saveDataForPeriod(currentPayPeriod);
    displayOTEntries(); // This will refetch events for the calendar
    updateDashboard();
}

// --- PERCENTAGE LOGIC ---
const percentageIds = ['rate0_5', 'rate1_5_weekday', 'rate1_5_saturday', 'rate2_0'];

function readPercentages() {
    return percentageIds.map(id => parseInt(document.getElementById(id + '_input').value) || 0);
}

function writePercentages(vals) {
    vals.forEach((v, i) => {
        const id = percentageIds[i];
        const el = document.getElementById(id + '_input');
        if (el) el.value = v;
    });
}

function adjustPercentage(id, amount) {
    const input = document.getElementById(id + '_input');
    let currentValue = parseInt(input.value) || 0;
    currentValue += amount;
    input.value = Math.max(0, Math.min(100, currentValue));
    normalizePercentages();
    debouncedAllocation();
}

function normalizePercentages() {
    let vals = readPercentages();
    let sum = vals.reduce((a, b) => a + b, 0);
    const totalEl = document.getElementById('totalPercentage');

    if (sum === 100) {
        totalEl.textContent = 'Total: 100%';
        totalEl.style.color = '#333';
        return;
    }
    
    if (sum === 0) {
        vals = [25, 25, 25, 25];
    } else {
        vals = vals.map(v => Math.max(0, Math.round(v * 100 / sum)));
        let diff = 100 - vals.reduce((a, b) => a + b, 0);
        
        let i = 0;
        while (diff !== 0) {
            const idx = i % vals.length;
            const adjustment = diff > 0 ? 1 : -1;
            if (vals[idx] + adjustment >= 0) {
                vals[idx] += adjustment;
                diff -= adjustment;
            }
            i++;
            if (i > 100) break;
        }
    }
    
    writePercentages(vals);
    totalEl.textContent = 'Total: 100%';
    totalEl.style.color = '#333';
}

function initializePercentageInputs() {
    document.querySelectorAll('.percentage-input').forEach(el => {
        el.addEventListener('input', () => { 
            normalizePercentages();
            debouncedAllocation();
        });
    });
    document.getElementById('allocationStrategy').addEventListener('change', (event) => {
        updatePercentagesForStrategy(event.target.value);
    });
    normalizePercentages();
}

function updatePercentagesForStrategy(strategy) {
    const presets = strategyPresets[strategy];
    if (!presets) return;
    
    const vals = [presets.rate0_5, presets.rate1_5_weekday, presets.rate1_5_saturday, presets.rate2_0];
    writePercentages(vals);
    normalizePercentages();
    handleRealtimeAllocation();
}

// --- OT GENERATION & SHUFFLING ---
function generateAndApplyOT() {
    generateSmartOTAllocation(false, true); 
    
    if (previewedOTEntries.length > 0) {
        applyOTAllocation(true); 
        topUpOTToMeetTarget(); 
        showToast('🚀 Smart OT schedule has been generated and adjusted to meet the target!');
    }
}

function generateSmartOTAllocation(isSilent = false, randomizeDuration = true) {
    const currentPercentages = readPercentages();
    if (currentPercentages.reduce((a,b)=>a+b,0) !== 100) {
        if (!isSilent) alert("OT allocation percentages must sum to 100%. Please adjust the values.");
        return;
    }

    const totalTargetEarnings = parseFloat(document.getElementById('targetOTEarnings').value) || 0;
    const project = document.getElementById('defaultProject').value || 'General OT';
    const startDate = document.getElementById('otStartDate').value;
    const endDate = document.getElementById('otEndDate').value;
    const strategy = document.getElementById('allocationStrategy').value;

    if (!isSilent && !totalTargetEarnings) {
        alert('Please enter target earnings.');
        return;
    }
    if (!isSilent && (!startDate || !endDate)) {
        alert('Please select a valid date range.');
        return;
    }

    let percentages = {
        '0.5': currentPercentages[0],
        '1.5_weekday': currentPercentages[1],
        '1.5_saturday': currentPercentages[2],
        '2.0': currentPercentages[3]
    };

    const targetEarningsByRate = {
        '0.5': totalTargetEarnings * (percentages['0.5'] / 100),
        '1.5_weekday': totalTargetEarnings * (percentages['1.5_weekday'] / 100),
        '1.5_saturday': totalTargetEarnings * (percentages['1.5_saturday'] / 100),
        '2.0': totalTargetEarnings * (percentages['2.0'] / 100)
    };

    previewedOTEntries = [];
    for (const rateKey in targetEarningsByRate) {
        const targetForRate = targetEarningsByRate[rateKey];
        if (targetForRate > 0) {
            const rate = parseFloat(rateKey.split('_')[0]);
            const dayType = rateKey.includes('_') ? rateKey.split('_')[1] : null;
            const entriesForRate = allocateOTHours(targetForRate, project, startDate, endDate, strategy, rate, dayType, isSilent, randomizeDuration);
            previewedOTEntries.push(...entriesForRate);
        }
    }
    
    if (!isSilent) displayOTPreview(totalTargetEarnings);
}

function readHourLimits() {
    const weekday = parseFloat(document.getElementById('maxHoursWeekday').value) || 8;
    const saturday = parseFloat(document.getElementById('maxHoursSaturday').value) || 8;
    const sunday = parseFloat(document.getElementById('maxHoursSunday').value) || 8;
    const ph = parseFloat(document.getElementById('maxHoursPH').value) || 8;
    return { weekday, saturday, sunday, publicHoliday: ph };
}

function getDayTypeFromDate(date) {
    const dateStr = date.toISOString().split('T')[0];
    const year = date.getFullYear().toString();
    if (publicHolidays[year] && publicHolidays[year].includes(dateStr)) return 'publicHoliday';
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) return 'sunday';
    if (dayOfWeek === 6) return 'saturday';
    return 'weekday';
}

function getRateForDayType(dayType) {
    switch(dayType) {
        case 'publicHoliday': return 2.0;
        case 'sunday': return 0.5;
        case 'saturday':
        case 'weekday':
        default: return 1.5;
    }
}

function allocateOTHours(targetAmount, project, startDateStr, endDateStr, strategy, specificRate, dayType, isSilent, randomizeDuration = true) {
    const hourlyRate = getHourlyRate();
    if (hourlyRate <= 0) return [];
    
    const limits = readHourLimits();

    let potentialDays = [];
    let currentDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        const dateStr = currentDate.toISOString().split('T')[0];
        const year = currentDate.getFullYear().toString();
        let rate = 1.5;
        let isWeekend = false;
        let currentDayType = 'weekday';

        if (publicHolidays[year] && publicHolidays[year].includes(dateStr)) {
            rate = 2.0; isWeekend = true; currentDayType = 'publicHoliday';
        } else if (dayOfWeek === 0) {
            rate = 0.5; isWeekend = true; currentDayType = 'sunday';
        } else if (dayOfWeek === 6) {
            rate = 1.5; isWeekend = true; currentDayType = 'saturday';
        }
        
        let match = false;
        if (rate === specificRate) {
            if (dayType === 'weekday' && currentDayType === 'weekday') match = true;
            else if (dayType === 'saturday' && currentDayType === 'saturday') match = true;
            else if (!dayType && (currentDayType === 'sunday' || currentDayType === 'publicHoliday')) match = true;
        }

        if (match) {
            potentialDays.push({ date: new Date(currentDate), rate, isWeekend, limit: limits[currentDayType] });
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    if (potentialDays.length === 0) return [];

    if (strategy === 'back-load') potentialDays.reverse();
    else if (strategy === 'front-load-weekends') potentialDays.sort((a, b) => b.isWeekend - a.isWeekend || a.date - b.date);
    else if (strategy === 'front-load-weekdays') potentialDays.sort((a, b) => a.isWeekend - b.isWeekend || a.date - b.date);

    let totalHoursNeeded = targetAmount / (hourlyRate * specificRate);
    const maxPossibleHours = potentialDays.reduce((sum, day) => sum + day.limit, 0);
    if (totalHoursNeeded > maxPossibleHours) {
        totalHoursNeeded = maxPossibleHours;
    }

    const entries = potentialDays.map(day => ({
        id: generateId(),
        date: day.date.toISOString().split('T')[0],
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.date.getDay()],
        rate: day.rate,
        isWeekend: day.isWeekend,
        hours: 0,
        amount: 0,
        remarks: project + ' - ' + generateTaskDescription(day.date),
        limit: day.limit
    }));

    if (randomizeDuration) {
        entries.forEach(entry => { entry.weight = Math.random(); });

        const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
        if (totalWeight > 0) {
            entries.forEach(entry => {
                const idealHours = (entry.weight / totalWeight) * totalHoursNeeded;
                entry.hours = Math.min(entry.limit, Math.round(idealHours * 4) / 4);
            });
        }

        let currentTotalHours = entries.reduce((sum, e) => sum + e.hours, 0);
        let hourDifference = round2(totalHoursNeeded - currentTotalHours);
        let safetyNet = 0;

        while (Math.abs(hourDifference) > 0.01 && safetyNet < 500) {
            const increment = 0.25 * Math.sign(hourDifference);

            if (increment > 0) {
                let eligibleToAdd = entries.filter(e => e.hours < e.limit);
                if (eligibleToAdd.length === 0) break;
                const randomIndex = Math.floor(Math.random() * eligibleToAdd.length);
                eligibleToAdd[randomIndex].hours += increment;
            } else {
                let eligibleToRemove = entries.filter(e => e.hours > 0);
                if (eligibleToRemove.length === 0) break;
                const randomIndex = Math.floor(Math.random() * eligibleToRemove.length);
                eligibleToRemove[randomIndex].hours += increment;
            }

            hourDifference = round2(hourDifference - increment);
            safetyNet++;
        }
    } else {
        let hoursToDistribute = Math.round(totalHoursNeeded * 4) / 4;
        let safetyNet = 0;
        while (hoursToDistribute > 0.01 && safetyNet < 10000) {
            let targetEntry = entries
                .filter(e => e.hours < e.limit)
                .sort((a, b) => a.hours - b.hours)[0];
            if (!targetEntry) break;
            targetEntry.hours += 0.25;
            hoursToDistribute -= 0.25;
            safetyNet++;
        }
    }

    entries.forEach(entry => {
        entry.hours = round2(entry.hours);
        entry.amount = entry.hours * hourlyRate * entry.rate;
        
        const startHourBase = entry.isWeekend ? 9 : 18;
        const randomHourOffset = Math.floor(Math.random() * 3);
        const randomMinute = Math.floor(Math.random() * 4) * 15;
        
        const startHour = startHourBase + randomHourOffset;
        entry.startTime = `${String(startHour).padStart(2, '0')}:${String(randomMinute).padStart(2, '0')}`;
        entry.endTime = addHoursToTime(entry.startTime, entry.hours);
    });
    
    return entries.filter(e => e.hours > 0);
}

function applyOTAllocation(isSilent = false) {
    if (!isSilent && previewedOTEntries.length === 0) {
        alert('Please generate an allocation first');
        return;
    }
    if (!isSilent && !confirm(`Apply ${previewedOTEntries.length} OT entries?`)) return;

    overtimeEntries = previewedOTEntries;
    saveDataForPeriod(currentPayPeriod);
    previewedOTEntries = [];
    document.getElementById('otAllocationPreview').style.display = 'none';
    displayOTEntries();
    updateDashboard();
    if (!isSilent) showToast('OT allocation applied successfully!');
}

function topUpOTToMeetTarget(isSilent = false) {
    const targetEarnings = parseFloat(document.getElementById('targetOTEarnings').value) || 0;
    if (targetEarnings <= 0 || overtimeEntries.length === 0) return;

    const currentEarnings = overtimeEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
    let gap = targetEarnings - currentEarnings;

    if (Math.abs(gap) <= 0.01) {
        if (!isSilent) showToast('✅ Target already met!');
        return;
    }

    const hourly = getHourlyRate();
    if (!hourly) return;

    overtimeEntries.sort((a, b) => (b.rate - a.rate) || (a.hours - b.hours));
    let safetyNet = 0;

    while (Math.abs(gap) > 0.01 && safetyNet < 200) {
        let entryToBoost = overtimeEntries.find(e => e.hours < (e.limit || 8));
        if (!entryToBoost) {
            console.warn("Could not meet OT target because all available days are maxed out at their limits.");
            break;
        }

        const limit = entryToBoost.limit || 8;
        const earningsPerIncrement = 0.25 * hourly * entryToBoost.rate;
        const canAddHours = limit - entryToBoost.hours;
        
        if (gap >= earningsPerIncrement && canAddHours >= 0.25) {
            entryToBoost.hours += 0.25;
            gap -= earningsPerIncrement;
        } else {
            const hoursNeededForGap = gap / (hourly * entryToBoost.rate);
            if (canAddHours >= hoursNeededForGap) {
                entryToBoost.hours += hoursNeededForGap;
                gap = 0;
            } else {
                const partialAmount = canAddHours * hourly * entryToBoost.rate;
                entryToBoost.hours = limit;
                gap -= partialAmount;
            }
        }
        safetyNet++;
    }

    overtimeEntries.forEach(entry => {
        entry.hours = round2(entry.hours);
        entry.amount = round2(entry.hours * hourly * entry.rate);
        if (entry.startTime) {
            entry.endTime = addHoursToTime(entry.startTime, entry.hours);
        }
    });

    saveDataForPeriod(currentPayPeriod);
    displayOTEntries();
    updateDashboard();
    if (!isSilent) showToast('🎯 OT schedule topped up to meet target!');
}

function generateTaskDescription(date) {
    const dayOfWeek = date.getDay();
    const hour = date.getHours();

    const tasks = {
        weeknight: ["Report prep", "Data analysis", "Client follow-up", "System maintenance", "Code review"],
        weekend: ["System upgrade", "Server backup", "Database migration", "Feature deployment", "Documentation"],
        lateNight: ["Critical patch", "Emergency support", "System diagnostics", "Security scan"]
    };

    let taskPool;
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        taskPool = tasks.weekend;
    } else {
        taskPool = tasks.weeknight;
    }

    if (hour >= 22 || hour < 6) {
        taskPool = taskPool.concat(tasks.lateNight);
    }
    
    return taskPool[Math.floor(Math.random() * taskPool.length)];
}

function displayOTPreview(targetAmount) {
    const previewDiv = document.getElementById('otAllocationPreview');
    const contentDiv = document.getElementById('previewContent');
    previewDiv.style.display = 'block';
    contentDiv.innerHTML = '';
    let totalHours = 0, totalAmount = 0;
    previewedOTEntries.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(entry => {
        totalHours += entry.hours; totalAmount += entry.amount;
        const item = document.createElement('div');
        item.className = 'ot-preview-item';
        item.innerHTML = `<div><strong>${entry.date}</strong> (${entry.dayName})<br>${entry.startTime} - ${entry.endTime}</div><div>${entry.hours.toFixed(2)}h @ ${entry.rate}x<br><strong>RM ${entry.amount.toFixed(2)}</strong></div>`;
        contentDiv.appendChild(item);
    });
    
    if (targetAmount && totalAmount < targetAmount * 0.99) {
        const warning = document.createElement('div');
        warning.className = 'alert alert-warning';
        warning.innerHTML = `<strong>Warning:</strong> Target of RM ${targetAmount.toFixed(2)} could not be reached with the specified daily limits. The maximum achievable is <strong>RM ${totalAmount.toFixed(2)}</strong>.`;
        contentDiv.prepend(warning);
    }

    const summary = document.createElement('div');
    summary.style.cssText = 'margin-top: 15px; padding: 10px; background: #e7f3ff; border-radius: 5px;';
    summary.innerHTML = `<strong>Total: ${totalHours.toFixed(2)} hours = RM ${totalAmount.toFixed(2)}</strong>`;
    contentDiv.appendChild(summary);
}

function previewOTAllocation() {
    if (previewedOTEntries.length === 0) { alert('Please generate an allocation first'); return; }
    const previewDiv = document.getElementById('otAllocationPreview');
    previewDiv.style.display = previewDiv.style.display === 'none' ? 'block' : 'none';
}

function getDayType(entry) {
    const date = new Date(entry.date);
    return getDayTypeFromDate(date);
}

function displayOTEntries() {
    if (otCalendar) {
        otCalendar.refetchEvents();
        const startDate = document.getElementById('otStartDate').value;
        if(startDate) {
            otCalendar.gotoDate(startDate);
        }
    }
    
    let totalHours = 0, totalAmount = 0;
    let hoursByDayType = { weekday: 0, saturday: 0, sunday: 0, publicHoliday: 0 };

    overtimeEntries.forEach(entry => {
        totalHours += entry.hours; 
        totalAmount += entry.amount;
        const dayType = getDayType(entry);
        hoursByDayType[dayType] += entry.hours;
    });
    
    document.getElementById('totalOTHoursSummary').textContent = totalHours.toFixed(2);
    document.getElementById('totalOTEarningsSummary').textContent = fmtRM(totalAmount);
    
    const adjusterDiv = document.getElementById('otAdjuster');
    const stickySummaryDiv = document.getElementById('sticky-ot-summary');

    if (overtimeEntries.length > 0) {
        const adjusterGrid = document.getElementById('otAdjusterGrid');
        adjusterGrid.innerHTML = '';

        const dayTypes = {
            weekday: "Weekday",
            saturday: "Saturday",
            sunday: "Sunday",
            publicHoliday: "Public Holiday"
        };

        for (const dayType in dayTypes) {
            if (hoursByDayType[dayType] > 0) {
                const formGroup = document.createElement('div');
                formGroup.className = 'adjuster-group';
                formGroup.innerHTML = `
                    <label>${dayTypes[dayType]} Hours: <strong id="display_day_${dayType}">${hoursByDayType[dayType].toFixed(2)}</strong></label>
                    <div>
                        <button class="btn btn-small btn-secondary" onclick="adjustHoursByDayType('${dayType}', -1)">-1hr</button>
                        <button class="btn btn-small btn-secondary" onclick="adjustHoursByDayType('${dayType}', -0.25)">-15m</button>
                        <button class="btn btn-small btn-secondary" onclick="adjustHoursByDayType('${dayType}', 0.25)">+15m</button>
                        <button class="btn btn-small btn-secondary" onclick="adjustHoursByDayType('${dayType}', 1)">+1hr</button>
                    </div>
                `;
                adjusterGrid.appendChild(formGroup);
            }
        }
        adjusterDiv.style.display = 'block';
        stickySummaryDiv.style.display = 'block'; 
    } else {
        adjusterDiv.style.display = 'none';
        stickySummaryDiv.style.display = 'none';
    }

    const targetOTEarnings = parseFloat(document.getElementById('targetOTEarnings').value) || 0;
    const otProgressBarContainer = document.getElementById('otTargetProgressBarContainer');
    if (targetOTEarnings > 0) {
        otProgressBarContainer.style.display = 'block';
        const otProgress = document.getElementById('otTargetProgress');
        const percent = Math.min((totalAmount / targetOTEarnings) * 100, 100);
        otProgress.style.width = `${percent}%`;
        otProgress.textContent = `${fmtRM(totalAmount)} / ${fmtRM(targetOTEarnings)} (${percent.toFixed(1)}%)`;
    } else {
        otProgressBarContainer.style.display = 'none';
    }
}

function adjustHoursByDayType(dayType, adjustment) {
    const hourlyRate = getHourlyRate();
    if (!hourlyRate) return;

    let remainingAdjustment = Math.abs(adjustment);
    const increment = 0.25 * Math.sign(adjustment);

    while (remainingAdjustment > 0.01) {
        let eligibleEntry = null;

        if (adjustment > 0) {
            const eligibleToAdd = overtimeEntries
                .filter(e => getDayType(e) === dayType && e.hours < (e.limit || 8))
                .sort((a, b) => a.hours - b.hours);
            
            if (eligibleToAdd.length === 0) {
                alert("Cannot add more hours; all days of this type are at their limit.");
                break;
            }
            eligibleEntry = eligibleToAdd[0];
        } else { // adjustment < 0
            const eligibleToRemove = overtimeEntries
                .filter(e => getDayType(e) === dayType && e.hours > 0)
                .sort((a, b) => b.hours - a.hours);

            if (eligibleToRemove.length === 0) {
                break; // No hours to remove
            }
            eligibleEntry = eligibleToRemove[0];
        }

        if (eligibleEntry) {
            const originalEntry = overtimeEntries.find(e => e.id === eligibleEntry.id);
            if (originalEntry) {
                originalEntry.hours += increment;
                if (originalEntry.hours < 0) originalEntry.hours = 0;
            }
        }

        remainingAdjustment -= 0.25;
    }

    overtimeEntries.forEach(entry => {
        entry.amount = entry.hours * hourlyRate * entry.rate;
        if (entry.startTime) {
            entry.endTime = addHoursToTime(entry.startTime, entry.hours);
        }
    });

    saveDataForPeriod(currentPayPeriod);
    displayOTEntries();
    updateDashboard();
}

function deleteAllOTEntries() {
    if (confirm("Are you sure you want to delete ALL overtime entries? This action cannot be undone.")) {
        overtimeEntries = [];
        saveDataForPeriod(currentPayPeriod);
        displayOTEntries();
        updateDashboard();
        showToast("All overtime entries have been deleted.");
    }
}

// --- NEW SHUFFLE FUNCTION ---
function shuffleSchedule() {
    if (overtimeEntries.length === 0) {
        alert("There is no schedule to shuffle. Please generate one first.");
        return;
    }

    if (!confirm("This will re-randomize the hours across the available days while keeping the total hours for each day type the same. Continue?")) {
        return;
    }

    const hourlyRate = getHourlyRate();
    if (hourlyRate <= 0) return;

    const hoursToDistribute = { weekday: 0, saturday: 0, sunday: 0, publicHoliday: 0 };
    overtimeEntries.forEach(entry => {
        const dayType = getDayType(entry);
        hoursToDistribute[dayType] += entry.hours;
    });

    const limits = readHourLimits();
    const startDateStr = document.getElementById('otStartDate').value;
    const endDateStr = document.getElementById('otEndDate').value;
    let potentialDays = [];
    let currentDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    while (currentDate <= endDate) {
        const dayType = getDayTypeFromDate(new Date(currentDate));
        potentialDays.push({
            id: generateId(),
            date: new Date(currentDate).toISOString().split('T')[0],
            dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(currentDate).getDay()],
            rate: getRateForDayType(dayType),
            isWeekend: dayType === 'saturday' || dayType === 'sunday' || dayType === 'publicHoliday',
            hours: 0,
            amount: 0,
            remarks: document.getElementById('defaultProject').value || 'General OT',
            limit: limits[dayType],
            dayType: dayType
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }

    let newEntries = [];

    for (const dayType in hoursToDistribute) {
        let totalHoursForType = hoursToDistribute[dayType];
        if (totalHoursForType <= 0) continue;

        let eligibleDaysForType = potentialDays.filter(d => d.dayType === dayType);
        if (eligibleDaysForType.length === 0) continue;

        eligibleDaysForType.forEach(entry => { entry.weight = Math.random(); });
        const totalWeight = eligibleDaysForType.reduce((sum, e) => sum + e.weight, 0);

        if (totalWeight > 0) {
            eligibleDaysForType.forEach(entry => {
                const idealHours = (entry.weight / totalWeight) * totalHoursForType;
                entry.hours = Math.min(entry.limit, Math.round(idealHours * 4) / 4);
            });
        }

        let currentTotalHours = eligibleDaysForType.reduce((sum, e) => sum + e.hours, 0);
        let hourDifference = round2(totalHoursForType - currentTotalHours);
        let safetyNet = 0;

        while (Math.abs(hourDifference) > 0.01 && safetyNet < 1000) {
            const increment = 0.25 * Math.sign(hourDifference);

            if (increment > 0) {
                let eligibleToAdd = eligibleDaysForType.filter(e => e.hours < e.limit);
                if (eligibleToAdd.length === 0) break;
                eligibleToAdd[Math.floor(Math.random() * eligibleToAdd.length)].hours += increment;
            } else {
                let eligibleToRemove = eligibleDaysForType.filter(e => e.hours > 0);
                if (eligibleToRemove.length === 0) break;
                eligibleToRemove[Math.floor(Math.random() * eligibleToRemove.length)].hours += increment;
            }
            hourDifference = round2(hourDifference - increment);
            safetyNet++;
        }
        
        newEntries.push(...eligibleDaysForType.filter(d => d.hours > 0));
    }

    newEntries.forEach(entry => {
        entry.hours = round2(entry.hours);
        entry.amount = entry.hours * hourlyRate * entry.rate;
        entry.remarks += ' - ' + generateTaskDescription(new Date(entry.date));
        
        const startHourBase = entry.isWeekend ? 9 : 18;
        const randomHourOffset = Math.floor(Math.random() * 3);
        const randomMinute = Math.floor(Math.random() * 4) * 15;
        
        const startHour = startHourBase + randomHourOffset;
        entry.startTime = `${String(startHour).padStart(2, '0')}:${String(randomMinute).padStart(2, '0')}`;
        entry.endTime = addHoursToTime(entry.startTime, entry.hours);
    });

    overtimeEntries = newEntries;
    saveDataForPeriod(currentPayPeriod);
    displayOTEntries();
    updateDashboard();
    showToast('🔄 Schedule has been successfully shuffled!');
}


// --- OT MODAL LOGIC ---
function openOTEditModal(id) {
    const entry = overtimeEntries.find(e => e.id === id);
    if (!entry) return;

    document.getElementById('otEditId').value = id;
    otEditDatePicker.setDate(entry.date, false);
    document.getElementById('otEditRate').value = entry.rate;
    document.getElementById('otEditStartTime').value = entry.startTime || '';
    document.getElementById('otEditEndTime').value = entry.endTime || '';
    document.getElementById('otEditHours').value = entry.hours.toFixed(2);
    document.getElementById('otEditRemarks').value = entry.remarks || '';
    
    document.getElementById('ot-edit-modal').style.display = 'flex';
}

function closeOTEditModal() {
    document.getElementById('ot-edit-modal').style.display = 'none';
}

function adjustModalHour(amount) {
    const hoursInput = document.getElementById('otEditHours');
    let currentHours = parseFloat(hoursInput.value) || 0;
    currentHours += amount;
    if (currentHours < 0) currentHours = 0;
    hoursInput.value = currentHours.toFixed(2);
}

function saveOTEntryFromModal() {
    const id = document.getElementById('otEditId').value;
    const entryIndex = overtimeEntries.findIndex(e => e.id === id);
    if (entryIndex === -1) return;

    const entry = overtimeEntries[entryIndex];
    const hourlyRate = getHourlyRate();

    entry.date = document.getElementById('otEditDate').value;
    entry.rate = parseFloat(document.getElementById('otEditRate').value);
    entry.startTime = document.getElementById('otEditStartTime').value;
    entry.endTime = document.getElementById('otEditEndTime').value;
    entry.hours = parseFloat(document.getElementById('otEditHours').value) || 0;
    entry.remarks = document.getElementById('otEditRemarks').value;
    
    if (entry.startTime && entry.endTime) {
        const start = new Date(`${entry.date}T${entry.startTime}`);
        const end = new Date(`${entry.date}T${entry.endTime}`);
        if (end < start) { end.setDate(end.getDate() + 1); }
        const diffMs = end - start;
        const rawHours = diffMs / (1000 * 60 * 60);
        entry.hours = Math.round(rawHours * 4) / 4;
    } else if (entry.startTime && entry.hours > 0) {
         entry.endTime = addHoursToTime(entry.startTime, entry.hours);
    }

    entry.amount = entry.hours * entry.rate * hourlyRate;
    
    saveDataForPeriod(currentPayPeriod);
    displayOTEntries();
    updateDashboard();
    closeOTEditModal();
    showToast('OT Entry Updated!');
}

function deleteOTEntryFromModal() {
    const id = document.getElementById('otEditId').value;
    if (confirm('Are you sure you want to delete this entry?')) {
        overtimeEntries = overtimeEntries.filter(e => e.id != id);
        saveDataForPeriod(currentPayPeriod);
        displayOTEntries();
        updateDashboard();
        closeOTEditModal();
        showToast('OT Entry Deleted.');
    }
}

// --- EXPENSE FUNCTIONS ---
function applySplitProfile() {
    const profile = document.getElementById('expenseSplitProfile').value;
    const fullAmountEl = document.getElementById('expenseFullAmount');
    const myShareEl = document.getElementById('myShare');
    const partnerShareEl = document.getElementById('partnerShare');

    if (profile === 'equal50') {
        const myShare = parseFloat(myShareEl.value) || 0;
        const partnerShare = parseFloat(partnerShareEl.value) || 0;
        const total = myShare + partnerShare;
        if (total > 0) {
            myShareEl.value = (total / 2).toFixed(2);
            partnerShareEl.value = (total / 2).toFixed(2);
        }
    } else if (profile === 'mine100') {
        const myShare = parseFloat(myShareEl.value) || 0;
        partnerShareEl.value = '';
    } else if (profile === 'partner100') {
        const partnerShare = parseFloat(partnerShareEl.value) || 0;
        myShareEl.value = '';
    }
    updateShares();
}

function updateShares() {
    const myShareEl = document.getElementById('myShare');
    const partnerShareEl = document.getElementById('partnerShare');
    const fullAmountEl = document.getElementById('expenseFullAmount');
    const splitProfileEl = document.getElementById('expenseSplitProfile');

    const myShare = parseFloat(myShareEl.value) || 0;
    const partnerShare = parseFloat(partnerShareEl.value) || 0;
    
    fullAmountEl.value = (myShare + partnerShare).toFixed(2);

    if (myShare > 0 && partnerShare === 0) {
        splitProfileEl.value = 'mine100';
    } else if (myShare === 0 && partnerShare > 0) {
        splitProfileEl.value = 'partner100';
    } else if (myShare > 0 && myShare === partnerShare) {
        splitProfileEl.value = 'equal50';
    } else {
        splitProfileEl.value = 'custom';
    }
    validateExpenseForm();
}

function validateExpenseForm() {
    const myShare = parseFloat(document.getElementById('myShare').value) || 0;
    const partnerShare = parseFloat(document.getElementById('partnerShare').value) || 0;
    document.getElementById('addExpenseBtn').disabled = (myShare + partnerShare) <= 0;
}

function addExpense() {
    const date = document.getElementById('expenseDate').value;
    const category = document.getElementById('expenseCategory').value;
    const myShare = parseFloat(document.getElementById('myShare').value) || 0;
    const partnerShare = parseFloat(document.getElementById('partnerShare').value) || 0;
    const fullAmount = round2(myShare + partnerShare);
    const description = document.getElementById('expenseDescription').value;
    const isRecurring = document.getElementById('isRecurringExpense').checked;
    const splitProfile = document.getElementById('expenseSplitProfile').value;

    if (!date || !fullAmount) { alert('Please fill in a date and at least one share amount.'); return; }
    
    const newExpense = { id: generateId(), date, category, myShare, partnerShare, description, fullAmount, isRecurring, splitProfile, isExcluded: false };
    expenses.push(newExpense);

    if (isRecurring) {
        const recurringExists = recurringExpenses.some(re => re.description === description && re.myShare === myShare && re.partnerShare === partnerShare);
        if (!recurringExists) {
            recurringExpenses.push({ id: generateId(), category, myShare, partnerShare, description, fullAmount, splitProfile });
            localStorage.setItem('recurringExpenses', JSON.stringify(recurringExpenses));
        }
    }

    saveDataForPeriod(currentPayPeriod);
    displayExpenses();
    updateDashboard();
    
    document.getElementById('myShare').value = '';
    document.getElementById('partnerShare').value = '';
    document.getElementById('expenseFullAmount').value = '';
    document.getElementById('expenseDescription').value = '';
    document.getElementById('isRecurringExpense').checked = false;
    validateExpenseForm();
}

function sortExpenses(column) {
    if (expenseSortColumn === column) {
        expenseSortDirection = expenseSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        expenseSortColumn = column;
        expenseSortDirection = ['date', 'myShare', 'partnerShare', 'fullAmount'].includes(column) ? 'desc' : 'asc';
    }
    displayExpenses();
}

function displayExpenses() {
    const tbody = document.getElementById('expenseTableBody');
    const tfoot = document.getElementById('expenseTableFooter');
    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    const direction = expenseSortDirection === 'asc' ? 1 : -1;
    expenses.sort((a, b) => {
        let valA = a[expenseSortColumn];
        let valB = b[expenseSortColumn];

        if (expenseSortColumn === 'date') {
            valA = new Date(valA);
            valB = new Date(valB);
        }
        
        if (typeof valA === 'string') {
            return valA.localeCompare(valB) * direction;
        } else {
            return (valA - valB) * direction;
        }
    });
    
    document.querySelectorAll('#expenseTable th.sortable').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (th.getAttribute('onclick').includes(`'${expenseSortColumn}'`)) {
            th.classList.add(expenseSortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
        }
    });

    
    let totalMyShare = 0;
    let totalPartnerShare = 0;
    let totalFullAmount = 0;
    
    expenses.forEach(expense => {
        if (!expense.isExcluded) {
            totalMyShare += expense.myShare;
            totalPartnerShare += expense.partnerShare || 0;
            totalFullAmount += expense.fullAmount || 0;
        }

        const profileMap = {'equal50': '50/50', 'mine100': 'You Pay 100%', 'partner100': 'Partner Pays 100%', 'custom': 'Custom'};
        const profileText = profileMap[expense.splitProfile] || 'Custom';

        const row = tbody.insertRow();
        row.id = `exp-row-${expense.id}`;
        if (expense.isExcluded) {
            row.classList.add('excluded-expense');
        }
        row.innerHTML = `
            <td onclick="makeEditable(this, '${expense.id}', 'date')">${expense.date}</td>
            <td onclick="makeEditable(this, '${expense.id}', 'category')"><span class="expense-category category-${expense.category.replace(/_/g, '-')}">${expense.category.replace(/_/g, ' ')}</span></td>
            <td onclick="makeEditable(this, '${expense.id}', 'description')">${expense.description}</td>
            <td onclick="makeEditable(this, '${expense.id}', 'splitProfile')"><span class="split-pill">${profileText}</span></td>
            <td onclick="makeEditable(this, '${expense.id}', 'myShare')">${fmtRM(expense.myShare)}</td>
            <td onclick="makeEditable(this, '${expense.id}', 'partnerShare')">${fmtRM(expense.partnerShare || 0)}</td>
            <td>${fmtRM(expense.fullAmount || 0)}</td>
            <td style="text-align: center;"><input type="checkbox" onchange="toggleRecurringStatus('${expense.id}', this.checked)" ${expense.isRecurring ? 'checked' : ''}></td>
            <td style="text-align: center;"><input type="checkbox" onchange="toggleExpenseExclusion('${expense.id}', this.checked)" ${expense.isExcluded ? 'checked' : ''}></td>
            <td>
                <button class="btn btn-small btn-danger" onclick="deleteExpense('${expense.id}')">Delete</button>
            </td>`;
    });

    const footerRow = tfoot.insertRow();
    footerRow.style.fontWeight = 'bold';
    footerRow.innerHTML = `
        <td colspan="4" style="text-align: right;">Included Subtotal:</td>
        <td>${fmtRM(totalMyShare)}</td>
        <td>${fmtRM(totalPartnerShare)}</td>
        <td>${fmtRM(totalFullAmount)}</td>
        <td colspan="3"></td>
    `;

    if (!manualExpenseSet) {
        const useHousehold = document.getElementById('useHouseholdExpenses')?.checked || false;
        const expectedExpensesInput = document.getElementById('expectedExpenses');
        const expenseSum = getExpensesSum(useHousehold);
        expectedExpensesInput.value = expenseSum > 0 ? expenseSum.toFixed(2) : '';
        savingsGoalsData.expectedExpenses = expenseSum;
        updateSavingsAnalysis();
    }
}

function makeEditable(cell, id, field) {
    if (cell.querySelector('input, select')) return;
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;

    let inputElement;

    const commitChanges = (newValue) => {
        const expenseIndex = expenses.findIndex(e => e.id === id);
        if (expenseIndex === -1) {
            displayExpenses();
            return;
        }

        if (field === 'myShare' || field === 'partnerShare') {
            expenses[expenseIndex][field] = parseFloat(newValue) || 0;
            const myShare = expenses[expenseIndex].myShare || 0;
            const partnerShare = expenses[expenseIndex].partnerShare || 0;
            expenses[expenseIndex].fullAmount = round2(myShare + partnerShare);
            expenses[expenseIndex].splitProfile = 'custom';
        } else if (field === 'splitProfile') {
            expenses[expenseIndex].splitProfile = newValue;
            const ratio = getRatioFromProfile(newValue);
            if (ratio !== null) {
                const full = expenses[expenseIndex].fullAmount || 0;
                expenses[expenseIndex].myShare = round2(full * ratio);
                expenses[expenseIndex].partnerShare = round2(full - expenses[expenseIndex].myShare);
            }
        }
        else {
            expenses[expenseIndex][field] = newValue;
        }
        
        saveDataForPeriod(currentPayPeriod);
        updateDashboard();
        updateSummary();
        displayExpenses();
    };
    
    switch (field) {
        case 'date':
            inputElement = document.createElement('input');
            inputElement.type = 'text';
            inputElement.value = expense.date;
            break;
        case 'category':
            inputElement = document.createElement('select');
            inputElement.innerHTML = document.getElementById('expenseCategory').innerHTML;
            inputElement.value = expense.category;
            break;
        case 'description':
            inputElement = document.createElement('input');
            inputElement.type = 'text';
            inputElement.value = expense.description;
            break;
        case 'myShare':
        case 'partnerShare':
            inputElement = document.createElement('input');
            inputElement.type = 'number';
            inputElement.step = '0.01';
            inputElement.value = expense[field] || 0;
            break;
        case 'splitProfile':
            inputElement = document.createElement('select');
            inputElement.innerHTML = document.getElementById('expenseSplitProfile').innerHTML;
            inputElement.value = expense.splitProfile;
            break;
        default:
            return;
    }

    cell.innerHTML = '';
    cell.appendChild(inputElement);

    if (field === 'date') {
        const fp = flatpickr(inputElement, {
            dateFormat: "Y-m-d",
            defaultDate: expense.date,
            onClose: (selectedDates, dateStr, instance) => {
                commitChanges(dateStr);
            }
        });
        fp.open();
    } else {
        inputElement.focus();
        inputElement.onblur = () => commitChanges(inputElement.value);
        inputElement.onkeydown = (e) => {
            if (e.key === 'Enter') inputElement.blur();
            else if (e.key === 'Escape') {
                displayExpenses();
            }
        };
    }
}

function deleteExpense(id) {
    const expenseIndex = expenses.findIndex(e => e.id === id);
    if (expenseIndex > -1) {
        const expenseToDelete = expenses[expenseIndex];
        if (expenseToDelete.isRecurring) {
            const recurringIndex = recurringExpenses.findIndex(re => re.description === expenseToDelete.description && re.myShare === expenseToDelete.myShare);
            if (recurringIndex > -1) {
                recurringExpenses.splice(recurringIndex, 1);
                localStorage.setItem('recurringExpenses', JSON.stringify(recurringExpenses));
            }
        }
        expenses.splice(expenseIndex, 1);
        saveDataForPeriod(currentPayPeriod);
        displayExpenses();
        updateDashboard();
    }
}

// --- SAVINGS ANALYSIS & OT CALCULATION ---
function getExpensesSum(useHousehold=false){
  return expenses
    .filter(e => !e.isExcluded)
    .reduce((s,e)=> s + (useHousehold ? (e.fullAmount||0) : (e.myShare||0)), 0);
}

function updateSavingsAnalysis() {
    const targetSavings = parseFloat(document.getElementById('targetSavings').value) || 0;
    const analysisDiv = document.getElementById('savingsAnalysis');
    const useHousehold = document.getElementById('useHouseholdExpenses')?.checked || false;

    document.getElementById('expenseBasisLabel').textContent = useHousehold ? '(Household)' : '(Your Share)';

    const expectedExpensesValue = getExpensesSum(useHousehold);
    document.getElementById('expectedExpenses').value = expectedExpensesValue > 0 ? expectedExpensesValue.toFixed(2) : '';
    savingsGoalsData.expectedExpenses = expectedExpensesValue;
    
    runAICoach();

    if (!targetSavings) {
        analysisDiv.style.display = 'none';
        return;
    }
    
    const baseNetIncome = getNetIncome(0, false); // **PATCH**: Include claims for projection
    const afterExpenses = baseNetIncome - expectedExpensesValue;
    const otRequired = Math.max(0, targetSavings + expectedExpensesValue - baseNetIncome);
    
    const hourlyRate = getHourlyRate();
    const hoursNeeded = hourlyRate > 0 ? otRequired / (hourlyRate * 1.5) : 0;
    
    analysisDiv.style.display = 'block';
    document.getElementById('baseNetIncome').textContent = fmtRM(baseNetIncome);
    document.getElementById('afterExpenses').textContent = fmtRM(afterExpenses);
    document.getElementById('otRequired').textContent = fmtRM(otRequired);
    document.getElementById('hoursNeeded').textContent = `${hoursNeeded.toFixed(1)} hrs`;
    
    const alertDiv = document.getElementById('savingsAlert');
    if (otRequired <= 0.01 && baseNetIncome > 0) {
        alertDiv.className = 'alert alert-success';
        alertDiv.innerHTML = '✅ Great! You can achieve your savings target next month without any overtime!';
        document.getElementById('createOTPlanBtn').style.display = 'none';
    } else if (baseNetIncome > 0) {
        alertDiv.className = 'alert alert-warning';
        alertDiv.innerHTML = `⚠️ You need to work <strong>${hoursNeeded.toFixed(1)} hours</strong> of overtime <strong>this period</strong> to reach your target <strong>next month</strong>.`;
        document.getElementById('createOTPlanBtn').style.display = 'inline-block';
    } else {
         alertDiv.className = 'alert alert-info';
         alertDiv.innerHTML = 'Enter your salary details to begin the analysis.';
         document.getElementById('createOTPlanBtn').style.display = 'none';
    }

    populateMiniSimulator();
    runMiniSimulator();
}

// --- [START] HYBRID/PATCHED refreshSavingsHeader FUNCTION ---
function refreshSavingsHeader() {
    const target = +document.getElementById('targetSavings').value || 0;
    const indContainer = document.getElementById('savingsIndicatorContainer');
    const topUpBtn = document.getElementById('topUpBtn');
    const actualVsTargetLabel = document.getElementById('actualVsTargetLabel');
    const savingsActualEl = document.getElementById('savingsActual');

    // These calculations are needed for both scenarios
    const prevPeriod = getPreviousMonthPeriod(currentPayPeriod);
    const prevOTEntries = JSON.parse(localStorage.getItem(`overtimeEntries_${prevPeriod}`) || '[]');
    const totalOT = prevOTEntries.reduce((sum, e) => sum + e.amount, 0);
    const netIncomeForSavings = getNetIncome(totalOT, false);
    const totalMyShare = expenses.filter(e => !e.isExcluded).reduce((sum, e) => sum + e.myShare, 0);
    const actualSavings = netIncomeForSavings - totalMyShare;

    // This function populates the global `aiSavingsPlan` variable
    runAICoach(); 

    if (target === 0) {
        // --- HYBRID IDEA IMPLEMENTATION (PART 2) ---
        // Display the AI savings suggestion as the secondary metric.
        actualVsTargetLabel.textContent = "💡 AI Savings Suggestion";
        
        if (aiSavingsPlan && aiSavingsPlan.total > 0) {
            savingsActualEl.innerHTML = `Try saving <strong style="color: #667eea; cursor: pointer;" onclick="applyAISavingsPlan()">${fmtRM(aiSavingsPlan.total)}</strong>`;
        } else {
            savingsActualEl.textContent = `All surplus is allocated.`;
        }
        
        // Hide the indicator and top-up button as they are not relevant
        indContainer.style.display = 'none';

    } else {
        // Original behavior: Compare actual savings to the target
        actualVsTargetLabel.textContent = "Actual Savings vs Target";
        savingsActualEl.textContent = fmtRM(actualSavings);
        savingsActualEl.dataset.value = actualSavings;

        indContainer.style.display = 'flex'; // Ensure the container is visible
        const ind = document.getElementById('savingsIndicator');
        const shortfall = target - actualSavings;

        if (shortfall <= 0) {
            ind.className = 'savings-indicator savings-good';
            ind.textContent = 'On Track';
            topUpBtn.style.display = 'none';
        } else {
            ind.className = 'savings-indicator savings-warning';
            ind.textContent = `Short by ${fmtRM(shortfall)}`;
            topUpBtn.style.display = 'inline-block';
        }
    }
}
// --- [END] HYBRID/PATCHED refreshSavingsHeader FUNCTION ---

function getNetIncome(otAmount, excludeClaims = false) {
    const claims = excludeClaims ? 0 : (salaryData.claims || 0);
    const gross = (salaryData.basic || 0) + claims + (salaryData.hpAllowance || 0) + (salaryData.incentive || 0) + (salaryData.bonus || 0) + (salaryData.otherIncome || 0) + otAmount;
    const deductionsObj = calculateDeductions(salaryData, otAmount);
    const totalDeductions = deductionsObj.epf + deductionsObj.socso + deductionsObj.eis + deductionsObj.pcb + (salaryData.cashAdvance || 0) + (salaryData.otherDeductions || 0);
    return gross - totalDeductions;
}

// --- [START] HYBRID/PATCHED updateDashboard FUNCTION ---
function updateDashboard() {
    const prevPeriod = getPreviousMonthPeriod(currentPayPeriod);
    const prevOTEntries = JSON.parse(localStorage.getItem(`overtimeEntries_${prevPeriod}`) || '[]');
    const totalOT = prevOTEntries.reduce((sum, e) => sum + e.amount, 0);

    const grossIncome = (salaryData.basic || 0) + (salaryData.claims || 0) + (salaryData.hpAllowance || 0) + (salaryData.incentive || 0) + (salaryData.bonus || 0) + (salaryData.otherIncome || 0) + totalOT;
    const totalDeductions = (salaryData.epf || 0) + (salaryData.socso || 0) + (salaryData.eis || 0) + (salaryData.pcb || 0) + (salaryData.cashAdvance || 0) + (salaryData.otherDeductions || 0);
    const netIncome = grossIncome - totalDeductions;
    
    const baseNetSalary = getNetIncome(0, true);
    
    const currentMonthName = document.getElementById('currentMonth').value.split(' ')[0];
    document.getElementById('dashboardTitle').textContent = `Current Finances (${currentMonthName})`;
    document.getElementById('baseNetSalaryDashboard').textContent = fmtRM(baseNetSalary);
    document.getElementById('totalIncome').textContent = fmtRM(grossIncome);
    document.getElementById('netIncome').textContent = fmtRM(netIncome);
    document.getElementById('otPaidThisMonth').textContent = fmtRM(totalOT);
    document.getElementById('otPaidThisMonthLabel').textContent = `OT Paid This Month (from ${prevPeriod})`;

    const totalMyShare = expenses.filter(e => !e.isExcluded).reduce((sum, e) => sum + e.myShare, 0);
    const netAfterExpenses = netIncome - totalMyShare;
    document.getElementById('netAfterExpenses').textContent = fmtRM(netAfterExpenses);
    
    const target = parseFloat(document.getElementById('targetSavings').value) || 0;
    const savingsTargetDisplayEl = document.getElementById('savingsTargetDisplay');
    const savingsGoalCard = document.getElementById('this-months-savings-goal');
    
    if (target > 0) {
        // Original behavior: Show the user-defined target
        savingsGoalCard.querySelector(".card-title").textContent = "🎯 This Month's Savings Goal";
        savingsGoalCard.querySelector(".stat-label").textContent = "Target Savings";
        savingsTargetDisplayEl.textContent = fmtRM(target);
    } else {
        // --- HYBRID IDEA IMPLEMENTATION (PART 1) ---
        // Show projected savings as the main stat.
        savingsGoalCard.querySelector(".card-title").textContent = "💰 Savings Potential & AI Tip";
        savingsGoalCard.querySelector(".stat-label").textContent = "Projected Savings This Month";
        savingsTargetDisplayEl.textContent = fmtRM(netAfterExpenses);
    }
    
    const projectedOT = overtimeEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
    document.getElementById('projectedNextMonthOT').textContent = fmtRM(projectedOT);

    refreshSavingsHeader();
    
    const netIncomeForSavings = getNetIncome(totalOT, false);
    const liveActualSavings = netIncomeForSavings - totalMyShare;

    const progressPercent = target > 0 ? Math.min((liveActualSavings / target) * 100, 100) : 0;
    const progressBar = document.getElementById('savingsProgress');
    if (progressBar) {
        progressBar.style.width = `${progressPercent}%`;
        progressBar.textContent = `${progressPercent.toFixed(1)}%`;
    }

    const monthSavedEl = document.getElementById('monthSaved');
    if (monthSavedEl) monthSavedEl.textContent = fmtRM(liveActualSavings);
    
    const totalSinkingFundSavings = sinkingFunds.reduce((sum, fund) => sum + fund.savedAmount, 0);
    document.getElementById('sinkingFundsTotal').textContent = fmtRM(totalSinkingFundSavings);
    
    const upcomingFunds = sinkingFunds.filter(f => new Date(f.dueDate) > new Date()).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
    if (upcomingFunds.length > 0) {
        document.getElementById('nextGoalDue').textContent = `${upcomingFunds[0].name} (${upcomingFunds[0].dueDate})`;
    } else {
        document.getElementById('nextGoalDue').textContent = 'N/A';
    }
}
// --- [END] HYBRID/PATCHED updateDashboard FUNCTION ---

function getHourlyRate() {
  if (!salaryData || !salaryData.basic) return 0;
  return (salaryData.basic / 26) / 8;
}

function getCurrentOTWindow() {
  const s = document.getElementById('otStartDate')?.value;
  const e = document.getElementById('otEndDate')?.value;
  if (!s || !e) return null;
  return { start: new Date(s), end: new Date(e) };
}

function updateSummary() {
    const prevPeriod = getPreviousMonthPeriod(currentPayPeriod);
    const prevOTEntries = JSON.parse(localStorage.getItem(`overtimeEntries_${prevPeriod}`) || '[]');
    const totalOT = prevOTEntries.reduce((sum, e) => sum + e.amount, 0);

    const grossIncome = (salaryData.basic || 0) + (salaryData.claims || 0) + (salaryData.hpAllowance || 0) + (salaryData.incentive || 0) + (salaryData.bonus || 0) + (salaryData.otherIncome || 0) + totalOT;
    const totalDeductions = (salaryData.epf || 0) + (salaryData.socso || 0) + (salaryData.eis || 0) + (salaryData.pcb || 0) + (salaryData.cashAdvance || 0) + (salaryData.otherDeductions || 0);
    const netIncome = grossIncome - totalDeductions;
    
    const baseNetSalary = getNetIncome(0, true);
    
    const includedExpenses = expenses.filter(e => !e.isExcluded);
    const totalMyShare = includedExpenses.reduce((sum, e) => sum + e.myShare, 0);
    const totalPartnerShare = includedExpenses.reduce((sum, e) => sum + (e.partnerShare || 0), 0);
    const totalFullAmount = includedExpenses.reduce((sum, e) => sum + (e.fullAmount || 0), 0);

    const expensesToDisplay = summaryView === 'my' ? totalMyShare : totalFullAmount;
    const personalSavings = netIncome - totalMyShare;
    const householdCoverage = netIncome - totalFullAmount;
    const savingsRate = netIncome > 0 ? (personalSavings / netIncome * 100) : 0;
    
    document.getElementById('summaryGross').textContent = fmtRM(grossIncome);
    document.getElementById('summaryDeductions').textContent = fmtRM(totalDeductions);
    document.getElementById('summaryBaseNet').textContent = fmtRM(baseNetSalary);
    document.getElementById('summaryNet').textContent = fmtRM(netIncome);
    document.getElementById('summaryExpenses').textContent = fmtRM(expensesToDisplay);
    document.getElementById('summarySavings').textContent = fmtRM(personalSavings);
    document.getElementById('savingsRate').textContent = `${savingsRate.toFixed(1)}%`;
    
    const householdItem = document.getElementById('summaryHouseholdCoverageItem');
    if (summaryView === 'household') {
        document.getElementById('summaryHouseholdCoverage').textContent = fmtRM(householdCoverage);
        householdItem.style.display = 'block';
    } else {
        householdItem.style.display = 'none';
    }

    document.getElementById('incomeBasic').textContent = fmtRM(salaryData.basic || 0);
    document.getElementById('incomeOT').textContent = fmtRM(totalOT);
    document.getElementById('incomeAllowances').textContent = fmtRM((salaryData.hpAllowance || 0) + (salaryData.incentive || 0));
    document.getElementById('incomeOthers').textContent = fmtRM((salaryData.claims || 0) + (salaryData.bonus || 0) + (salaryData.otherIncome || 0));
    
    const categoryTotals = {};
    includedExpenses.forEach(expense => {
        if (!categoryTotals[expense.category]) categoryTotals[expense.category] = 0;
        const amountToAdd = summaryView === 'my' ? expense.myShare : expense.fullAmount;
        categoryTotals[expense.category] += amountToAdd;
    });
    const breakdownDiv = document.getElementById('categoryBreakdown');
    breakdownDiv.innerHTML = '';
    Object.entries(categoryTotals).forEach(([category, amount]) => {
        const div = document.createElement('div');
        div.className = 'summary-item';
        div.innerHTML = `<div class="stat-label">${category.replace(/_/g, ' ')}</div><div style="font-size: 1.2em; font-weight: bold;">${fmtRM(amount)}</div><div style="font-size: 0.9em; color: #666;">${(expensesToDisplay > 0 ? (amount / expensesToDisplay) * 100 : 0).toFixed(1)}% of total</div>`;
        breakdownDiv.appendChild(div);
    });
}

function toggleSummaryView(){
  summaryView = summaryView==='my' ? 'household' : 'my';
  document.getElementById('summaryViewToggle').textContent = `View: ${summaryView==='my'?'My Cash Flow':'Household'}`;
  document.getElementById('summaryExpensesLabel').textContent = `Expenses (${summaryView==='my'?'Your Share':'Household'})`;
  document.getElementById('categoryBreakdownTitle').textContent = `Expense Breakdown by Category (${summaryView==='my'?'Your Share':'Household'})`;
  updateSummary();
}

function runForecast() {
    let totalIncome = 0, totalExpenses = 0, months = 0;
    const today = new Date();
    for (let i = 1; i <= 3; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const period = getMonthKey(d);
        const pastSalary = JSON.parse(localStorage.getItem(`salaryData_${period}`));
        const pastOT = JSON.parse(localStorage.getItem(`overtimeEntries_${period}`));
        const pastExpenses = JSON.parse(localStorage.getItem(`expenses_${period}`));
        if (pastSalary && pastOT && pastExpenses) {
            const otTotal = pastOT.reduce((sum, e) => sum + e.amount, 0);
            totalIncome += (pastSalary.basic || 0) + (pastSalary.claims || 0) + (pastSalary.hpAllowance || 0) + (pastSalary.incentive || 0) + (pastSalary.bonus || 0) + (pastSalary.otherIncome || 0) + otTotal;
            totalExpenses += pastExpenses.filter(e => !e.isExcluded).reduce((sum, e) => sum + (e.myShare || 0), 0);
            months++;
        }
    }
    const avgIncome = months > 0 ? totalIncome / months : 0;
    const avgExpenses = months > 0 ? totalExpenses / months : 0;
    
    const forecastedIncomeEl = document.getElementById('forecastedIncome');
    const forecastedExpensesEl = document.getElementById('forecastedExpenses');

    if (forecastedIncomeEl) {
        forecastedIncomeEl.textContent = fmtRM(avgIncome);
    }
    if (forecastedExpensesEl) {
        forecastedExpensesEl.textContent = fmtRM(avgExpenses);
    }
}

function runAICoach() {
    const coachSection = document.getElementById('aiCoachSection');
    const suggestionsDiv = document.getElementById('aiCoachSuggestions');
    const applyBtn = document.getElementById('applySavingsPlanBtn');
    const coachText = document.getElementById('aiCoachText');

    suggestionsDiv.innerHTML = ''; 

    const grossIncome = (salaryData.basic || 0) + (salaryData.claims || 0) + (salaryData.hpAllowance || 0) + (salaryData.incentive || 0) + (salaryData.bonus || 0) + (salaryData.otherIncome || 0);
    const totalDeductions = (salaryData.epf || 0) + (salaryData.socso || 0) + (salaryData.eis || 0) + (salaryData.pcb || 0) + (salaryData.cashAdvance || 0) + (salaryData.otherDeductions || 0);
    const netIncome = grossIncome - totalDeductions;
    const totalMyShare = getExpensesSum(false);
    let surplus = netIncome - totalMyShare;

    if (surplus <= 0) {
        coachSection.style.display = 'none';
        aiSavingsPlan = { total: 0 }; // Reset the plan
        return;
    }

    coachSection.style.display = 'block';
    coachText.innerHTML = `You have a surplus of <strong>${fmtRM(surplus)}</strong> this month. Here's a suggested allocation plan:`;
    
    aiSavingsPlan = { total: 0, allocations: [] };
    let totalAllocated = 0;

    const emergencyGoal = savingsGoalsData.emergencyFundGoal || 0;
    const emergencyCurrent = savingsGoalsData.currentEmergencyFund || 0;
    if (emergencyCurrent < emergencyGoal) {
        const emergencyNeeded = emergencyGoal - emergencyCurrent;
        let emergencyAllocation = Math.min(emergencyNeeded, surplus * 0.5);
        emergencyAllocation = round2(emergencyAllocation);
        
        if (emergencyAllocation > 0) {
            aiSavingsPlan.allocations.push({ name: 'Emergency Fund', amount: emergencyAllocation });
            surplus -= emergencyAllocation;
            totalAllocated += emergencyAllocation;
        }
    }

    sinkingFunds.forEach(fund => {
        const today = new Date();
        const due = new Date(fund.dueDate);
        const monthsLeft = Math.max(1, (due.getFullYear() - today.getFullYear()) * 12 + (due.getMonth() - today.getMonth()));
        const monthlyContribution = (fund.totalAmount - fund.savedAmount) / monthsLeft;

        if (monthlyContribution > 0 && surplus > 0) {
            const allocation = Math.min(surplus, monthlyContribution);
            aiSavingsPlan.allocations.push({ name: `Goal: ${fund.name}`, amount: allocation });
            surplus -= allocation;
            totalAllocated += allocation;
        }
    });

    if (surplus > 0) {
        aiSavingsPlan.allocations.push({ name: 'Flexible Savings', amount: surplus });
        totalAllocated += surplus;
    }

    aiSavingsPlan.total = round2(totalAllocated);

    aiSavingsPlan.allocations.forEach(alloc => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `<span>${alloc.name}</span><strong>${fmtRM(alloc.amount)}</strong>`;
        suggestionsDiv.appendChild(item);
    });

    if (aiSavingsPlan.total > 0) {
        applyBtn.style.display = 'block';
    } else {
        applyBtn.style.display = 'none';
    }
}

function applyAISavingsPlan() {
    if (aiSavingsPlan && aiSavingsPlan.total > 0) {
        document.getElementById('targetSavings').value = aiSavingsPlan.total.toFixed(2);
        updateAndSaveSavingsGoals();
        showToast('AI Savings Plan applied to your monthly target!');
    }
}

function showToast(message) {
    const toast = document.getElementById('toast-notification');
    if (toast) {
        toast.textContent = message;
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.top = '30px';
        }, 100);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.top = '20px';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 500);
        }, 4000);
    }
}

function exportData() {
    closeExportAsModal();
    const dataToExport = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('salaryData_') || key.startsWith('overtimeEntries_') || key.startsWith('expenses_') || key.startsWith('savingsGoalsData_') || key === 'recurringExpenses' || key === 'lastPayPeriod' || key === 'sinkingFunds') {
            dataToExport[key] = localStorage.getItem(key);
        }
    }

    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `salary-tracker-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Data exported successfully!');
}

function triggerImport() {
    document.getElementById('import-file').click();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!confirm('This will overwrite all existing data. Are you sure you want to continue?')) {
                return;
            }
            
            localStorage.clear();
            
            for (const key in importedData) {
                if (Object.prototype.hasOwnProperty.call(importedData, key)) {
                    localStorage.setItem(key, importedData[key]);
                }
            }
            
            showToast('Data imported successfully! Reloading...');
            setTimeout(() => {
                location.reload();
            }, 1500);

        } catch (error) {
            alert('Error parsing JSON file. Please make sure it is a valid backup file.');
            console.error("Import error:", error);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// --- NEW: OT Import/Export Functions ---
function exportOTEntries() {
    if (overtimeEntries.length === 0) {
        alert('No OT entries to export.');
        return;
    }

    const jsonString = JSON.stringify(overtimeEntries, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `overtime_entries_${currentPayPeriod}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Overtime entries exported successfully!');
}

function triggerOTImport() {
    document.getElementById('import-ot-file').click();
}

function importOTEntries(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedEntries = JSON.parse(e.target.result);
            
            if (!Array.isArray(importedEntries)) {
                throw new Error("Imported data is not a valid array.");
            }

            if (importedEntries.length > 0) {
                const firstEntry = importedEntries[0];
                if (typeof firstEntry.date === 'undefined' || typeof firstEntry.hours === 'undefined' || typeof firstEntry.rate === 'undefined') {
                     throw new Error("Imported data is missing required fields (date, hours, rate).");
                }
            }

            if (!confirm(`This will replace all ${overtimeEntries.length} current OT entries with ${importedEntries.length} new entries. Are you sure?`)) {
                return;
            }
            
            overtimeEntries = importedEntries;
            
            saveDataForPeriod(currentPayPeriod);
            displayOTEntries();
            updateDashboard();
            showToast('Overtime entries imported successfully!');

        } catch (error) {
            alert('Error parsing OT file. Please make sure it is a valid JSON file exported from this tool.');
            console.error("OT Import error:", error);
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
}

// --- RECURRING & EXCLUDE EXPENSES ---
function toggleRecurringStatus(expenseId, isChecked) {
    const expenseIndex = expenses.findIndex(e => e.id === expenseId);
    if (expenseIndex === -1) return;

    expenses[expenseIndex].isRecurring = isChecked;

    const expense = expenses[expenseIndex];
    const recurringIndex = recurringExpenses.findIndex(re => re.description === expense.description && re.myShare === expense.myShare && re.partnerShare === partnerShare);

    if (isChecked) {
        if (recurringIndex === -1) {
            recurringExpenses.push({ id: generateId(), category: expense.category, myShare: expense.myShare, partnerShare: expense.partnerShare, description: expense.description, fullAmount: expense.fullAmount, splitProfile: expense.splitProfile });
            localStorage.setItem('recurringExpenses', JSON.stringify(recurringExpenses));
        }
    } else {
        if (recurringIndex > -1) {
            recurringExpenses.splice(recurringIndex, 1);
            localStorage.setItem('recurringExpenses', JSON.stringify(recurringExpenses));
        }
    }
    saveDataForPeriod(currentPayPeriod);
    showToast(`Expense marked as ${isChecked ? 'recurring' : 'not recurring'}.`);
}

function toggleExpenseExclusion(expenseId, isChecked) {
    const expenseIndex = expenses.findIndex(e => e.id === expenseId);
    if (expenseIndex === -1) return;

    expenses[expenseIndex].isExcluded = isChecked;
    saveDataForPeriod(currentPayPeriod);
    
    displayExpenses();
    updateDashboard();
    updateSummary();
    updateSavingsAnalysis();
    showToast(`Expense ${isChecked ? 'excluded from' : 'included in'} totals.`);
}

function applyRecurringExpenses() {
    if (recurringExpenses.length === 0) {
        alert('You have no recurring expenses saved. Mark an expense as recurring to save it.');
        return;
    }

    let addedCount = 0;
    const firstDayOfMonth = `${currentPayPeriod}-01`;

    recurringExpenses.forEach(recurring => {
        const isDuplicate = expenses.some(exp => 
            exp.description === recurring.description && exp.myShare === recurring.myShare && exp.isRecurring
        );

        if (!isDuplicate) {
            expenses.push({
                ...recurring,
                id: generateId(),
                date: firstDayOfMonth,
                isRecurring: true,
                isExcluded: false
            });
            addedCount++;
        }
    });

    if (addedCount > 0) {
        saveDataForPeriod(currentPayPeriod);
        displayExpenses();
        updateDashboard();
        showToast(`${addedCount} recurring expense(s) applied for this month.`);
    } else {
        showToast('All recurring expenses have already been applied for this month.');
    }
}

// --- COPY LAST MONTH ---
function getPreviousMonthPeriod(period) {
    const [year, month] = period.split('-').map(Number);
    const date = new Date(year, month - 2, 1, 12, 0, 0); 
    return getMonthKey(date);
}

function copyLastMonthSalary(isSilent = false) {
    const prevPeriod = getPreviousMonthPeriod(currentPayPeriod);
    const prevSalaryData = localStorage.getItem(`salaryData_${prevPeriod}`);

    if (!prevSalaryData) {
        if (!isSilent) alert(`No salary data found for the previous month (${prevPeriod}).`);
        return false;
    }
    
    const proceed = isSilent ? true : confirm(`This will overwrite the current salary data with data from ${prevPeriod}. Continue?`);

    if (proceed) {
        salaryData = JSON.parse(prevSalaryData);
        delete salaryData.customOtStartDate;
        delete salaryData.customOtEndDate;
        
        document.getElementById('basicSalary').value = salaryData.basic || '';
        document.getElementById('claims').value = salaryData.claims || '';
        document.getElementById('hpAllowance').value = salaryData.hpAllowance || '';
        document.getElementById('incentive').value = salaryData.incentive || '';
        document.getElementById('bonus').value = salaryData.bonus || '';
        document.getElementById('otherIncome').value = salaryData.otherIncome || '';
        document.getElementById('cashAdvance').value = salaryData.cashAdvance || '';
        document.getElementById('otherDeductions').value = salaryData.otherDeductions || '';
        
        autoCalculateDeductions();
        if (!isSilent) showToast(`Salary data from ${prevPeriod} has been copied.`);
        return true;
    }
    return false;
}

function copyLastMonthExpenses(isSilent = false) {
    const prevPeriod = getPreviousMonthPeriod(currentPayPeriod);
    const prevExpensesData = localStorage.getItem(`expenses_${prevPeriod}`);

    if (!prevExpensesData) {
        if (!isSilent) alert(`No expense data found for the previous month (${prevPeriod}).`);
        return false;
    }
    
    const proceed = isSilent ? true : confirm(`This will REPLACE all current expenses with the data from ${prevPeriod}. Continue?`);

    if (proceed) {
        const lastMonthExpenses = JSON.parse(prevExpensesData);
        const [currentYear, currentMonth] = currentPayPeriod.split('-').map(Number);
        
        expenses = lastMonthExpenses.map(exp => {
            const oldDate = new Date(exp.date);
            const newDay = Math.min(oldDate.getUTCDate(), new Date(currentYear, currentMonth, 0).getDate());
            const newDate = new Date(Date.UTC(currentYear, currentMonth - 1, newDay));
            
            return {
                ...exp,
                id: generateId(),
                date: newDate.toISOString().split('T')[0]
            };
        });

        saveDataForPeriod(currentPayPeriod);
        displayExpenses();
        updateDashboard();
        if (!isSilent) showToast(`Expenses from ${prevPeriod} have been copied.`);
        return true;
    }
    return false;
}

// --- REPORTS & MODALS ---
function launchExportAsModal() {
    document.getElementById('export-as-modal').style.display = 'flex';
}

function closeExportAsModal() {
    document.getElementById('export-as-modal').style.display = 'none';
}

function exportToCSV(data, filename, headers) {
    if (data.length === 0) {
        alert('No data to export.');
        return;
    }
    
    const csvHeaders = headers || Object.keys(data[0]);
    
    let csvContent = "data:text/csv;charset=utf-8," + csvHeaders.join(",") + "\n";

    const rows = data.map(row => {
        return csvHeaders.map(header => {
            let cell = row[header] === null || row[header] === undefined ? '' : row[header];
            if (typeof cell === 'string' && cell.includes(',')) {
                cell = `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        }).join(",");
    });
    
    csvContent += rows.join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`${filename} exported successfully!`);
}

function exportExpensesCSV() {
    const filename = `expenses_${currentPayPeriod}.csv`;
    const headers = ['date', 'category', 'description', 'myShare', 'partnerShare', 'fullAmount', 'splitProfile', 'isRecurring', 'isExcluded'];
    exportToCSV(expenses, filename, headers);
    closeExportAsModal();
}

function exportOvertimeCSV() {
    const filename = `overtime_${currentPayPeriod}.csv`;
    
    // 1. Sort entries by date in ascending order
    const sortedEntries = [...overtimeEntries].sort((a, b) => new Date(a.date) - new Date(b.date));

    const dataToExport = sortedEntries.map(e => ({
        Date: e.date,
        Day: e.dayName,
        StartTime: e.startTime || '',
        EndTime: e.endTime || '',
        Hours: e.hours.toFixed(2),
        // 2. Add the new formatted duration column
        Duration: formatHoursDuration(e.hours),
        Rate: `${e.rate}x`,
        Earnings: e.amount.toFixed(2),
        Remarks: e.remarks || ''
    }));

    // 3. Define headers explicitly to control column order
    const headers = ['Date', 'Day', 'StartTime', 'EndTime', 'Hours', 'Duration', 'Rate', 'Earnings', 'Remarks'];

    exportToCSV(dataToExport, filename, headers);
    closeExportAsModal();
}

const DEFAULT_RATIO = 0.5;
function generateSettleUpReport(){
  const includedExpenses = expenses.filter(e => !e.isExcluded);
  const totalHousehold = includedExpenses.reduce((s,e)=> s + (e.fullAmount || 0), 0);
  const iPaid = includedExpenses.reduce((s,e)=> s + (e.myShare || 0), 0);
  const myBaseline = round2(totalHousehold * DEFAULT_RATIO);
  const net = round2(iPaid - myBaseline);
  const msg = net>0 ? `Partner owes you ${fmtRM(net)}` :
             net<0 ? `You owe partner ${fmtRM(Math.abs(net))}` :
                     'All settled — perfectly split.';

  document.getElementById('settleup-content').innerHTML = `
    <p>Total Household (Included Expenses): <strong>${fmtRM(totalHousehold)}</strong></p>
    <p>You Paid (Your Share): <strong>${fmtRM(iPaid)}</strong></p>
    <p>Your Baseline (${DEFAULT_RATIO*100}%): <strong>${fmtRM(myBaseline)}</strong></p>
    <hr><h3>${msg}</h3>`;
  document.getElementById('settleup-modal').style.display='flex';
}

function closeSettleUp() {
    document.getElementById('settleup-modal').style.display = 'none';
}

// Helper function to create a summary card HTML string
async function createSummaryCardImage(title, items, themeColor, pdf) {
    let itemHTML = '';
    items.forEach(item => {
        const valueColor = item.valueColor || '#333'; // Default to dark grey
        itemHTML += `
            <div style="flex: 1; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: ${valueColor}; margin-bottom: 5px;">${item.value}</div>
                <div style="font-size: 12px; color: #666;">${item.label}</div>
            </div>
        `;
    });

    const cardHTML = `
        <div style="
            background: white;
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            text-align: center;
            width: 720px; /* Fixed width for rendering */
        ">
            <h3 style="font-size: 18px; color: ${themeColor}; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">${title}</h3>
            <div style="display: flex; justify-content: space-around; gap: 10px;">
                ${itemHTML}
            </div>
        </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.innerHTML = cardHTML;
    document.body.appendChild(tempDiv);

    const canvas = await html2canvas(tempDiv, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    document.body.removeChild(tempDiv);

    const imgWidth = pdf.internal.pageSize.getWidth() - 80; // Match PDF width minus margins
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    return { imgData, imgWidth, imgHeight };
}

// --- NEW DETAILED PDF FUNCTIONS ---
function launchDetailedPDFModal() {
    closeExportAsModal();
    const titleInput = document.getElementById('detailedReportTitle');
    const monthName = document.getElementById('currentMonth').value;
    titleInput.value = `${monthName} Financial Report`;
    document.getElementById('detailed-pdf-modal').style.display = 'flex';
}

function closeDetailedPDFModal() {
    document.getElementById('detailed-pdf-modal').style.display = 'none';
}

async function exportDetailedPDF() {
    const reportTitle = document.getElementById('detailedReportTitle').value || 'Financial Report';
    const themeColor = document.getElementById('detailedThemeColor').value || '#667eea';
    const includeExcluded = document.getElementById('includeExcludedExpenses').checked;

    // 1. Gather Data
    const prevPeriod = getPreviousMonthPeriod(currentPayPeriod);
    const prevOTEntries = JSON.parse(localStorage.getItem(`overtimeEntries_${prevPeriod}`) || '[]');
    const totalOT = prevOTEntries.reduce((sum, e) => sum + e.amount, 0);

    const grossIncome = (salaryData.basic || 0) + (salaryData.claims || 0) + (salaryData.hpAllowance || 0) + (salaryData.incentive || 0) + (salaryData.bonus || 0) + (salaryData.otherIncome || 0) + totalOT;
    const totalDeductions = (salaryData.epf || 0) + (salaryData.socso || 0) + (salaryData.eis || 0) + (salaryData.pcb || 0) + (salaryData.cashAdvance || 0) + (salaryData.otherDeductions || 0);
    const netIncome = grossIncome - totalDeductions;
    
    const expensesForReport = includeExcluded ? expenses : expenses.filter(e => !e.isExcluded);
    
    const totalMyShare = expensesForReport.reduce((sum, e) => sum + e.myShare, 0);
    const totalPartnerShare = expensesForReport.reduce((sum, e) => sum + (e.partnerShare || 0), 0);
    const totalFullAmount = expensesForReport.reduce((sum, e) => sum + (e.fullAmount || 0), 0);

    const netAfterExpenses = netIncome - totalMyShare;
    const savingsRate = netIncome > 0 ? (netAfterExpenses / netIncome * 100) : 0;
    
    const projectedOT = overtimeEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
    const projectedHours = overtimeEntries.reduce((sum, e) => sum + (e.hours || 0), 0);

    const topCategories = {};
    expensesForReport.forEach(exp => {
        topCategories[exp.category] = (topCategories[exp.category] || 0) + exp.myShare;
    });
    const top5Categories = Object.entries(topCategories)
        .sort(([,a],[,b]) => b-a)
        .slice(0, 5)
        .map(([name, amount]) => `<li>${name.replace(/_/g, ' ')}: <strong>${fmtRM(amount)}</strong></li>`)
        .join('');
        
    // 2. Create Hidden Div for Rendering
    const infographicContainer = document.createElement('div');
    infographicContainer.id = 'pdf-infographic-container';
    infographicContainer.style.cssText = `
        position: absolute; left: -9999px; width: 800px; padding: 40px;
        background-color: #f8f9fa; font-family: 'Segoe UI', sans-serif;
        color: #333;
    `;

    // 3. Build HTML Content for Infographic
    infographicContainer.innerHTML = `
        <style>
            #pdf-infographic-container h1, #pdf-infographic-container h2, #pdf-infographic-container h3 { margin: 0; padding: 0; }
            #pdf-infographic-container .inf-header { text-align: center; margin-bottom: 30px; }
            #pdf-infographic-container .inf-header h1 { font-size: 32px; color: ${themeColor}; }
            #pdf-infographic-container .inf-header p { font-size: 18px; color: #666; }
            #pdf-infographic-container .inf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            #pdf-infographic-container .inf-card { background: white; border-radius: 15px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
            #pdf-infographic-container .inf-card.full { grid-column: 1 / -1; }
            #pdf-infographic-container .inf-card h3 { font-size: 16px; color: #888; text-transform: uppercase; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            #pdf-infographic-container .inf-card ul { list-style: none; padding: 0; margin: 0; }
            #pdf-infographic-container .inf-card li { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
            #pdf-infographic-container .inf-card li:last-child { border-bottom: none; }
            #pdf-infographic-container .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; }
            #pdf-infographic-container .kpi-item .value { font-size: 36px; font-weight: bold; color: ${themeColor}; }
            #pdf-infographic-container .kpi-item .label { font-size: 14px; color: #666; }
        </style>
        <div class="inf-header">
            <h1>${reportTitle}</h1>
            <p>Financial Summary for ${document.getElementById('currentMonth').value}</p>
        </div>
        <div class="inf-card full kpi-grid">
            <div class="kpi-item">
                <div class="value" style="color: #28a745;">${fmtRM(netIncome)}</div>
                <div class="label">💰 Net Income</div>
            </div>
            <div class="kpi-item">
                <div class="value" style="color: #dc3545;">${fmtRM(totalMyShare)}</div>
                <div class="label">🛒 Total Expenses</div>
            </div>
            <div class="kpi-item">
                <div class="value" style="color: #20c997;">${fmtRM(netAfterExpenses)}</div>
                <div class="label">🏦 Net Savings</div>
            </div>
        </div>
        <div class="inf-grid" style="margin-top: 20px;">
            <div class="inf-card">
                <h3>Income Breakdown</h3>
                <ul>
                    <li><span>Basic Salary</span> <strong>${fmtRM(salaryData.basic || 0)}</strong></li>
                    <li><span>Allowances & Incentives</span> <strong>${fmtRM((salaryData.hpAllowance || 0) + (salaryData.incentive || 0))}</strong></li>
                    <li><span>Claims, Bonus, Other</span> <strong>${fmtRM((salaryData.claims || 0) + (salaryData.bonus || 0) + (salaryData.otherIncome || 0))}</strong></li>
                    <li><span>Overtime Paid</span> <strong>${fmtRM(totalOT)}</strong></li>
                    <li style="background: #f0f8ff;"><span>Gross Income</span> <strong>${fmtRM(grossIncome)}</strong></li>
                </ul>
            </div>
            <div class="inf-card">
                <h3>Deductions</h3>
                <ul>
                    <li><span>EPF, SOCSO, EIS</span> <strong>${fmtRM((salaryData.epf || 0) + (salaryData.socso || 0) + (salaryData.eis || 0))}</strong></li>
                    <li><span>PCB (Tax)</span> <strong>${fmtRM(salaryData.pcb || 0)}</strong></li>
                    <li><span>Other Deductions</span> <strong>${fmtRM((salaryData.cashAdvance || 0) + (salaryData.otherDeductions || 0))}</strong></li>
                    <li style="background: #fff0f5;"><span>Total Deductions</span> <strong>${fmtRM(totalDeductions)}</strong></li>
                </ul>
            </div>
            <div class="inf-card">
                <h3>Top 5 Spending Categories</h3>
                <ul>${top5Categories || '<li>No expenses recorded.</li>'}</ul>
            </div>
            <div class="inf-card">
                <h3>Key Metrics</h3>
                <ul>
                    <li><span>Savings Rate</span> <strong>${savingsRate.toFixed(1)}%</strong></li>
                    <li><span>Projected OT (Next Month)</span> <strong>${fmtRM(projectedOT)}</strong></li>
                    <li><span>Projected OT Hours</span> <strong>${projectedHours.toFixed(2)} hrs</strong></li>
                </ul>
            </div>
        </div>
    `;
    document.body.appendChild(infographicContainer);

    // 4. Use html2canvas to render the infographic
    const canvas = await html2canvas(infographicContainer, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    document.body.removeChild(infographicContainer);

    // 5. Initialize jsPDF and add the infographic
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    // 6. Add Overtime Details Table - Sorted by Date
    if (overtimeEntries.length > 0) {
        pdf.addPage();
        pdf.setFontSize(18);
        pdf.setTextColor(themeColor);
        pdf.text('Overtime Entry Details', 40, 60);

        // OT Summary Card Data
        const totalOTHours = overtimeEntries.reduce((sum, e) => sum + e.hours, 0);
        const totalOTEarnings = overtimeEntries.reduce((sum, e) => sum + e.amount, 0);
        const averageHourlyRate = totalOTHours > 0 ? totalOTEarnings / totalOTHours : 0;

        const otSummaryItems = [
            { value: totalOTHours.toFixed(2) + 'h', label: 'Total Hours', valueColor: '#28a745' },
            { value: fmtRM(totalOTEarnings), label: 'Total Earnings', valueColor: '#28a745' },
            { value: fmtRM(averageHourlyRate), label: 'Avg. Hourly Rate', valueColor: '#17a2b8' }
        ];
        const otSummaryCard = await createSummaryCardImage('Overtime Summary', otSummaryItems, themeColor, pdf);
        pdf.addImage(otSummaryCard.imgData, 'PNG', 40, 80, otSummaryCard.imgWidth, otSummaryCard.imgHeight);
        
        const sortedOTEntries = [...overtimeEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
        const otBody = sortedOTEntries.map(e => [
            e.date,
            e.dayName,
            `${e.startTime || ''} - ${e.endTime || ''}`, // Include start and end time
            e.hours.toFixed(2),
            `${e.rate}x`,
            fmtRM(e.amount),
            e.remarks || ''
        ]);

        pdf.autoTable({
            head: [['Date', 'Day', 'Time', 'Hours', 'Rate', 'Earnings', 'Remarks']], // Updated head
            body: otBody,
            startY: otSummaryCard.imgHeight + 90, // Adjust startY after summary card
            headStyles: { fillColor: themeColor }
        });
    }

    // 7. Add Expenses Details Table - Sorted by current view and with option to exclude
    if (expensesForReport.length > 0) {
        pdf.addPage();
        pdf.setFontSize(18);
        pdf.setTextColor(themeColor);
        pdf.text('Expense Details', 40, 60);

        // Expense Summary Card Data
        const expenseSummaryItems = [
            { value: fmtRM(totalMyShare), label: 'Your Share', valueColor: '#dc3545' },
            { value: fmtRM(totalPartnerShare), label: 'Partner\'s Share', valueColor: '#6c757d' },
            { value: fmtRM(totalFullAmount), label: 'Household Total', valueColor: '#dc3545' }
        ];
        const expenseSummaryCard = await createSummaryCardImage('Expense Summary', expenseSummaryItems, themeColor, pdf);
        pdf.addImage(expenseSummaryCard.imgData, 'PNG', 40, 80, expenseSummaryCard.imgWidth, expenseSummaryCard.imgHeight);

        const expensesForTable = [...expensesForReport].sort((a, b) => {
            const valA = summaryView === 'my' ? a.myShare : a.fullAmount;
            const valB = summaryView === 'my' ? b.myShare : b.fullAmount;
            return valB - valA; // Sort descending by amount
        });

        const expenseBody = expensesForTable.map(e => [
            e.date,
            e.category.replace(/_/g, ' '),
            e.description || '',
            fmtRM(e.myShare),
            fmtRM(e.partnerShare || 0),
            fmtRM(e.fullAmount)
        ]);

        pdf.autoTable({
            head: [['Date', 'Category', 'Description', 'My Share', 'Partner\'s Share', 'Full Amount']],
            body: expenseBody,
            startY: expenseSummaryCard.imgHeight + 90, // Adjust startY after summary card
            headStyles: { fillColor: themeColor }
        });
    }
    
    // 8. Trigger Download
    pdf.save(`${reportTitle.replace(/ /g, '_')}.pdf`);
    closeDetailedPDFModal();
}

// --- NEW: Expenses Only PDF Functions ---
function launchExpensesOnlyPDFModal() {
    closeExportAsModal();
    const titleInput = document.getElementById('expensesOnlyReportTitle');
    const monthName = document.getElementById('currentMonth').value;
    titleInput.value = `${monthName} Expenses Summary`;
    document.getElementById('expenses-only-pdf-modal').style.display = 'flex';
}

function closeExpensesOnlyPDFModal() {
    document.getElementById('expenses-only-pdf-modal').style.display = 'none';
}

async function exportExpensesOnlyPDF() {
    const reportTitle = document.getElementById('expensesOnlyReportTitle').value || 'Expenses Only Report';
    const themeColor = document.getElementById('expensesOnlyThemeColor').value || '#dc3545';
    const includeExcluded = document.getElementById('expensesOnlyIncludeExcludedExpenses').checked;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');

    pdf.setFontSize(22);
    pdf.setTextColor(themeColor);
    pdf.text(reportTitle, 40, 40);
    pdf.setFontSize(12);
    pdf.setTextColor(90);
    pdf.text(`For: ${document.getElementById('currentMonth').value}`, 40, 60);

    let currentY = 80;

    const expensesForReport = includeExcluded ? expenses : expenses.filter(e => !e.isExcluded);

    if (expensesForReport.length > 0) {
        pdf.setFontSize(18);
        pdf.setTextColor(themeColor);
        pdf.text('Expenses Tracker', 40, currentY);
        currentY += 20;

        // Expense Summary Card Data
        const totalMyShare = expensesForReport.reduce((sum, e) => sum + e.myShare, 0);
        const totalPartnerShare = expensesForReport.reduce((sum, e) => sum + (e.partnerShare || 0), 0);
        const totalFullAmount = expensesForReport.reduce((sum, e) => sum + (e.fullAmount || 0), 0);
        
        const expenseSummaryItems = [
            { value: fmtRM(totalMyShare), label: 'Your Share', valueColor: '#dc3545' },
            { value: fmtRM(totalPartnerShare), label: 'Partner\'s Share', valueColor: '#6c757d' },
            { value: fmtRM(totalFullAmount), label: 'Household Total', valueColor: '#dc3545' }
        ];
        const expenseSummaryCard = await createSummaryCardImage('Expense Summary', expenseSummaryItems, themeColor, pdf);
        pdf.addImage(expenseSummaryCard.imgData, 'PNG', 40, currentY, expenseSummaryCard.imgWidth, expenseSummaryCard.imgHeight);
        currentY += expenseSummaryCard.imgHeight + 10;


        const expensesForTable = [...expensesForReport].sort((a, b) => {
            const valA = summaryView === 'my' ? a.myShare : a.fullAmount;
            const valB = summaryView === 'my' ? b.myShare : b.fullAmount;
            return valB - valA; // Sort descending by amount
        });

        const expenseBody = expensesForTable.map(e => [
            e.date,
            e.category.replace(/_/g, ' '),
            e.description || '',
            e.isExcluded ? 'Yes' : 'No',
            fmtRM(e.myShare),
            fmtRM(e.partnerShare || 0),
            fmtRM(e.fullAmount)
        ]);

        pdf.autoTable({
            head: [['Date', 'Category', 'Description', 'Excluded', 'My Share', 'Partner\'s Share', 'Full Amount']],
            body: expenseBody,
            startY: currentY,
            headStyles: { fillColor: themeColor },
            margin: { top: 10 }
        });
    } else {
        pdf.setFontSize(12);
        pdf.setTextColor(90);
        pdf.text('No expense entries recorded for this period.', 40, currentY + 10);
    }
    
    pdf.save(`${reportTitle.replace(/ /g, '_')}.pdf`);
    closeExpensesOnlyPDFModal();
}

// --- NEW: OT Only PDF Functions ---
function launchOTOnlyPDFModal() {
    closeExportAsModal();
    const titleInput = document.getElementById('otOnlyReportTitle');
    const monthName = document.getElementById('currentMonth').value;
    titleInput.value = `${monthName} Overtime Summary`;
    document.getElementById('ot-only-pdf-modal').style.display = 'flex';
}

function closeOTOnlyPDFModal() {
    document.getElementById('ot-only-pdf-modal').style.display = 'none';
}

async function exportOTOnlyPDF() {
    const reportTitle = document.getElementById('otOnlyReportTitle').value || 'Overtime Only Report';
    const themeColor = document.getElementById('otOnlyThemeColor').value || '#667eea';

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');

    pdf.setFontSize(22);
    pdf.setTextColor(themeColor);
    pdf.text(reportTitle, 40, 40);
    pdf.setFontSize(12);
    pdf.setTextColor(90);
    pdf.text(`For: ${document.getElementById('currentMonth').value}`, 40, 60);

    let currentY = 80;

    if (overtimeEntries.length > 0) {
        pdf.setFontSize(18);
        pdf.setTextColor(themeColor);
        pdf.text('Smart OT Allocator', 40, currentY);
        currentY += 20;
        
        // OT Summary Card Data
        const totalOTHours = overtimeEntries.reduce((sum, e) => sum + e.hours, 0);
        const totalOTEarnings = overtimeEntries.reduce((sum, e) => sum + e.amount, 0);
        const averageHourlyRate = totalOTHours > 0 ? totalOTEarnings / totalOTHours : 0;

        const otSummaryItems = [
            { value: totalOTHours.toFixed(2) + 'h', label: 'Total Hours', valueColor: '#28a745' },
            { value: fmtRM(totalOTEarnings), label: 'Total Earnings', valueColor: '#28a745' },
            { value: fmtRM(averageHourlyRate), label: 'Avg. Hourly Rate', valueColor: '#17a2b8' }
        ];
        const otSummaryCard = await createSummaryCardImage('Overtime Summary', otSummaryItems, themeColor, pdf);
        pdf.addImage(otSummaryCard.imgData, 'PNG', 40, currentY, otSummaryCard.imgWidth, otSummaryCard.imgHeight);
        currentY += otSummaryCard.imgHeight + 10;


        const sortedOTEntries = [...overtimeEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
        const otBody = sortedOTEntries.map(e => [
            e.date,
            e.dayName,
            `${e.startTime || ''} - ${e.endTime || ''}`,
            e.hours.toFixed(2),
            `${e.rate}x`,
            fmtRM(e.amount),
            e.remarks || ''
        ]);

        pdf.autoTable({
            head: [['Date', 'Day', 'Time', 'Hours', 'Rate', 'Earnings', 'Remarks']],
            body: otBody,
            startY: currentY,
            headStyles: { fillColor: themeColor },
            margin: { top: 10 }
        });
    } else {
        pdf.setFontSize(12);
        pdf.setTextColor(90);
        pdf.text('No overtime entries recorded for this period.', 40, currentY + 10);
    }
    
    pdf.save(`${reportTitle.replace(/ /g, '_')}.pdf`);
    closeOTOnlyPDFModal();
}


// --- SINKING FUNDS ---
function addSinkingFund() {
    const name = document.getElementById('fundName').value;
    const totalAmount = parseFloat(document.getElementById('fundTotal').value);
    const dueDate = document.getElementById('fundDueDate').value;

    if (!name || !totalAmount || !dueDate) {
        alert('Please fill out all fields for the new goal.');
        return;
    }

    const newFund = {
        id: generateId(),
        name,
        totalAmount,
        dueDate,
        savedAmount: 0,
        allocations: {}
    };

    sinkingFunds.push(newFund);
    saveDataForPeriod(currentPayPeriod);
    displaySinkingFunds();
    
    document.getElementById('fundName').value = '';
    document.getElementById('fundTotal').value = '';
    fundDueDatePicker.clear();
    showToast(`New goal "${name}" added!`);
}

function displaySinkingFunds() {
    const container = document.getElementById('sinkingFundsContainer');
    container.innerHTML = '';
    
    if (sinkingFunds.length === 0) {
        container.innerHTML = '<p>No future goals added yet. Add one above to start planning!</p>';
        return;
    }

    sinkingFunds.forEach(fund => {
        const today = new Date();
        const due = new Date(fund.dueDate);
        const monthsLeft = Math.max(0, (due.getFullYear() - today.getFullYear()) * 12 + (due.getMonth() - today.getMonth()));
        const monthlyContribution = monthsLeft > 0 ? (fund.totalAmount - fund.savedAmount) / monthsLeft : (fund.totalAmount - fund.savedAmount);
        const progress = fund.totalAmount > 0 ? (fund.savedAmount / fund.totalAmount) * 100 : 0;
        
        const hasAllocatedThisMonth = fund.allocations && fund.allocations[currentPayPeriod];

        const allocationButtonHTML = hasAllocatedThisMonth
            ? `<button class="btn btn-small btn-warning" onclick="unallocateContribution('${fund.id}')">Unallocate for ${currentPayPeriod}</button>`
            : `<button class="btn btn-small" onclick="allocateContribution('${fund.id}')">Allocate ${fmtRM(monthlyContribution)}</button>`;

        const card = document.createElement('div');
        card.className = 'sinking-fund-card';
        card.innerHTML = `
            <h4>${fund.name}</h4>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress.toFixed(1)}%; background: linear-gradient(90deg, #20c997, #28a745);">${progress.toFixed(1)}%</div>
            </div>
            <div class="sinking-fund-details">
                <span>Saved: <strong>${fmtRM(fund.savedAmount)} / ${fmtRM(fund.totalAmount)}</strong></span>
                <span>Due: <strong>${fund.dueDate}</strong></span>
            </div>
            <div class="sinking-fund-details">
                <span>Monthly: <strong>${fmtRM(monthlyContribution)}</strong></span>
                <span>Months Left: <strong>${monthsLeft}</strong></span>
            </div>
            <div class="sinking-fund-actions">
                ${allocationButtonHTML}
                <button class="btn btn-small btn-secondary" onclick="openSinkingFundEditModal('${fund.id}')">Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteSinkingFund('${fund.id}')">Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function allocateContribution(fundId) {
    const fundIndex = sinkingFunds.findIndex(f => f.id === fundId);
    if (fundIndex === -1) return;

    const fund = sinkingFunds[fundIndex];
    const today = new Date();
    const due = new Date(fund.dueDate);
    const monthsLeft = Math.max(1, (due.getFullYear() - today.getFullYear()) * 12 + (due.getMonth() - today.getMonth()));
    const monthlyContribution = (fund.totalAmount - fund.savedAmount) / monthsLeft;

    if (monthlyContribution <= 0) {
        showToast("This goal is already fully funded!", "warning");
        return;
    }

    fund.savedAmount = round2(fund.savedAmount + monthlyContribution);
    if (!fund.allocations) fund.allocations = {};
    fund.allocations[currentPayPeriod] = true;

    const expenseDate = `${currentPayPeriod}-01`;
    const newExpense = {
        id: generateId(),
        date: expenseDate,
        category: 'savings_investments',
        myShare: monthlyContribution,
        partnerShare: 0,
        fullAmount: monthlyContribution,
        description: `Sinking Fund: ${fund.name}`,
        isRecurring: false,
        splitProfile: 'mine100',
        isExcluded: false,
        isSinkingFund: true,
        fundId: fund.id
    };
    expenses.push(newExpense);

    saveDataForPeriod(currentPayPeriod);
    updateAllDisplays();
    showToast(`Contribution for "${fund.name}" allocated!`);
}

function unallocateContribution(fundId) {
    const fundIndex = sinkingFunds.findIndex(f => f.id === fundId);
    if (fundIndex === -1) return;

    if (!confirm("This will remove the contribution from this fund and delete the corresponding expense entry for this month. Continue?")) {
        return;
    }

    const fund = sinkingFunds[fundIndex];

    const expenseIndex = expenses.findIndex(exp =>
        exp.isSinkingFund === true &&
        exp.fundId === fundId &&
        exp.date.startsWith(currentPayPeriod)
    );

    if (expenseIndex === -1) {
        alert("Error: Could not find the original expense entry to remove. Unallocation failed. Please check your expenses manually.");
        return;
    }
    
    const amountToUnallocate = expenses[expenseIndex].myShare;

    expenses.splice(expenseIndex, 1);

    fund.savedAmount = round2(fund.savedAmount - amountToUnallocate);
    if (fund.savedAmount < 0) fund.savedAmount = 0;
    
    if (fund.allocations && fund.allocations[currentPayPeriod]) {
        delete fund.allocations[currentPayPeriod];
    }

    saveDataForPeriod(currentPayPeriod);
    updateAllDisplays();
    showToast(`Contribution for "${fund.name}" has been unallocated.`);
}

function deleteSinkingFund(fundId) {
    if (confirm("Are you sure you want to delete this goal? This cannot be undone.")) {
        sinkingFunds = sinkingFunds.filter(f => f.id !== fundId);
        saveDataForPeriod(currentPayPeriod);
        updateAllDisplays();
        showToast("Goal deleted.");
    }
}

function closeSinkingFundEditModal() {
    document.getElementById('sinking-fund-edit-modal').style.display = 'none';
}

function openSinkingFundEditModal(id) {
    const fund = sinkingFunds.find(f => f.id === id);
    if (!fund) return;

    document.getElementById('fundEditId').value = id;
    document.getElementById('fundEditName').value = fund.name;
    document.getElementById('fundEditTotal').value = fund.totalAmount;
    fundEditDueDatePicker.setDate(fund.dueDate, false);
    
    document.getElementById('sinking-fund-edit-modal').style.display = 'flex';
}

function saveSinkingFundFromModal() {
    const id = document.getElementById('fundEditId').value;
    const fundIndex = sinkingFunds.findIndex(f => f.id === id);
    if (fundIndex === -1) return;

    const name = document.getElementById('fundEditName').value;
    const totalAmount = parseFloat(document.getElementById('fundEditTotal').value) || 0;
    const dueDate = document.getElementById('fundEditDueDate').value;

    if (!name || !totalAmount || !dueDate) {
        alert('Please fill out all fields.');
        return;
    }

    sinkingFunds[fundIndex].name = name;
    sinkingFunds[fundIndex].totalAmount = totalAmount;
    sinkingFunds[fundIndex].dueDate = dueDate;

    if (sinkingFunds[fundIndex].savedAmount > totalAmount) {
        sinkingFunds[fundIndex].savedAmount = totalAmount;
        showToast("Saved amount adjusted to match new total.", "warning");
    }

    saveDataForPeriod(currentPayPeriod);
    updateAllDisplays();
    closeSinkingFundEditModal();
    showToast('Goal details updated successfully!');
}


// --- WORKFLOW ENHANCEMENTS ---
function createOTPlan() {
    const otRequiredText = document.getElementById('otRequired').textContent;
    const otAmount = parseFloat(otRequiredText.replace(/[^0-9.-]+/g,""));

    if (otAmount > 0) {
        document.getElementById('tab-btn-overtime').click();
        
        const targetInput = document.getElementById('targetOTEarnings');
        targetInput.value = otAmount.toFixed(2);
        
        handleRealtimeAllocation();
        
        showToast(`OT Target of ${fmtRM(otAmount)} set. Ready to generate schedule.`);
    } else {
        showToast('No overtime is required for this goal.', 'info');
    }
}

function launchTopUpModal() {
    const targetSavings = parseFloat(document.getElementById('targetSavings').value) || 0;
    const actualSavings = parseFloat(document.getElementById('savingsActual').dataset.value) || 0;
    const shortfall = targetSavings - actualSavings;

    if (shortfall <= 0) {
        showToast('You are already on track to meet your savings goal!', 'info');
        return;
    }

    document.getElementById('topUpModalText').innerHTML = `You have a savings shortfall of <strong>${fmtRM(shortfall)}</strong>.`;
    document.getElementById('topup-modal').style.display = 'flex';
}

function closeTopUpModal() {
    document.getElementById('topup-modal').style.display = 'none';
}

function topUpFromClaims() {
    const targetSavings = parseFloat(document.getElementById('targetSavings').value) || 0;
    const actualSavings = parseFloat(document.getElementById('savingsActual').dataset.value) || 0;
    const shortfall = targetSavings - actualSavings;

    if (shortfall > 0) {
        const claimsInput = document.getElementById('claims');
        const currentClaims = parseFloat(claimsInput.value) || 0;
        
        claimsInput.value = (currentClaims + shortfall).toFixed(2);
        
        document.getElementById('tab-btn-salary').click();
        
        autoCalculateDeductions();
        
        showToast(`${fmtRM(shortfall)} added to your claims to cover the savings shortfall.`);
    } else {
        showToast('You are already on track to meet your savings goal!', 'info');
    }
    closeTopUpModal();
}

function planOTForTarget() {
    const targetSavings = parseFloat(document.getElementById('targetSavings').value) || 0;
    const actualSavings = parseFloat(document.getElementById('savingsActual').dataset.value) || 0;
    const shortfall = targetSavings - actualSavings;
    
    if (shortfall <= 0) {
        showToast('You are already on track to meet your savings goal!', 'info');
        closeTopUpModal();
        return;
    }
    
    const hourlyRate = getHourlyRate();
    if(!hourlyRate) {
        alert("Please set your basic salary first to calculate OT.");
        closeTopUpModal();
        return;
    }

    const otRequired = shortfall;
    const hoursNeeded = otRequired / (hourlyRate * 1.5); // Assume average rate

    if (confirm(`To cover the ${fmtRM(shortfall)} shortfall next month, you'll need to plan for approximately ${hoursNeeded.toFixed(1)} more hours of OT this period. Would you like to add this to your OT target?`)) {
         const targetInput = document.getElementById('targetOTEarnings');
        const currentOTEarnings = parseFloat(targetInput.value) || 0;
        const newTargetOTEarnings = currentOTEarnings + otRequired;

        document.getElementById('tab-btn-overtime').click();
        targetInput.value = newTargetOTEarnings.toFixed(2);
        handleRealtimeAllocation();
        showToast(`OT Target increased by ${fmtRM(otRequired)}.`);
    }
    closeTopUpModal();
}

function checkForRecurringPrompt() {
    const lastSeenPeriod = localStorage.getItem('lastSeenPayPeriod');
    if (currentPayPeriod !== lastSeenPeriod && recurringExpenses.length > 0) {
        document.getElementById('recurringPromptText').textContent = `You have ${recurringExpenses.length} recurring expenses. Would you like to add them now?`;
        document.getElementById('recurring-prompt-modal').style.display = 'flex';
    }
    localStorage.setItem('lastSeenPayPeriod', currentPayPeriod);
}

function closeRecurringPrompt() {
    document.getElementById('recurring-prompt-modal').style.display = 'none';
}

function applyRecurringFromPrompt() {
    applyRecurringExpenses();
    closeRecurringPrompt();
}

function populateMiniSimulator() {
    const miniSimSection = document.getElementById('miniSimulatorSection');
    const categorySelect = document.getElementById('miniSimExpenseCategory');
    
    const categories = [...new Set(expenses.filter(e => !e.isExcluded && e.myShare > 0).map(e => e.category))];
    
    if (categories.length > 0) {
        const currentSelection = categorySelect.value;
        categorySelect.innerHTML = '';
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ');
            categorySelect.appendChild(option);
        });

        if (categories.includes(currentSelection)) {
            categorySelect.value = currentSelection;
        }

        miniSimSection.style.display = 'block';
    } else {
        miniSimSection.style.display = 'none';
    }
}

function runMiniSimulator() {
    const resultDiv = document.getElementById('miniSimulatorResult');
    const category = document.getElementById('miniSimExpenseCategory').value;
    const reductionPct = parseFloat(document.getElementById('miniSimExpenseReduction').value) || 0;

    if (!category || reductionPct <= 0) {
        resultDiv.innerHTML = '';
        return;
    }

    const useHousehold = document.getElementById('useHouseholdExpenses').checked;
    const expenseKey = useHousehold ? 'fullAmount' : 'myShare';

    const categoryTotal = expenses
        .filter(e => !e.isExcluded && e.category === category)
        .reduce((sum, e) => sum + (e[expenseKey] || 0), 0);

    const reductionAmount = categoryTotal * (reductionPct / 100);

    const baseNetIncome = getNetIncome(0, true);
    const originalExpectedExpenses = getExpensesSum(useHousehold);
    const targetSavings = parseFloat(document.getElementById('targetSavings').value) || 0;

    const simulatedExpenses = originalExpectedExpenses - reductionAmount;
    const newOtRequired = Math.max(0, targetSavings + simulatedExpenses - baseNetIncome);
    
    const hourlyRate = getHourlyRate();
    const newHoursNeeded = hourlyRate > 0 ? newOtRequired / (hourlyRate * 1.5) : 0;

    resultDiv.innerHTML = `By reducing spending by <strong>${fmtRM(reductionAmount)}</strong>, you will only need <strong>${fmtRM(newOtRequired)}</strong> of OT, which is about <strong>${newHoursNeeded.toFixed(1)} hours</strong>.`;
}


document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('import-file').addEventListener('change', importData);
    document.getElementById('import-ot-file').addEventListener('change', importOTEntries); // Added event listener for OT import
    
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
          if(el) el.addEventListener('input', id === 'expenseSplitProfile' ? applySplitProfile : updateShares)
        });
    
    initializePercentageInputs();
    initializeData();
    validateExpenseForm();
});