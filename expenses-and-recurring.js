// --- EXPENSE FUNCTIONS ---
function applySplitProfile() {
    const profile = document.getElementById('expenseSplitProfile').value;
    const myShareEl = document.getElementById('myShare');
    const partnerShareEl = document.getElementById('partnerShare');
    
    const total = (parseFloat(myShareEl.value) || 0) + (parseFloat(partnerShareEl.value) || 0);
    const ratio = getRatioFromProfile(profile);

    if (ratio !== null && total > 0) {
        myShareEl.value = round2(total * ratio).toFixed(2);
        partnerShareEl.value = round2(total * (1 - ratio)).toFixed(2);
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
    const myShareInput = document.getElementById('myShare');
    const partnerShareInput = document.getElementById('partnerShare');
    const myShare = parseFloat(myShareInput.value) || 0;
    const partnerShare = parseFloat(partnerShareInput.value) || 0;

    // Disable if the total amount is negative OR if both input fields are empty strings.
    const areInputsEmpty = myShareInput.value.trim() === '' && partnerShareInput.value.trim() === '';
    document.getElementById('addExpenseBtn').disabled = areInputsEmpty || (myShare + partnerShare) < 0;
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
    const isInstallment = document.getElementById('isInstallment').checked;

    if (!date) { alert('Please fill in a date.'); return; }

    const newExpense = { id: generateId(), date, category, myShare, partnerShare, description, fullAmount, isRecurring, splitProfile, isExcluded: false };

    // --- START: Installment Logic ---
    if (isInstallment) {
        const currentNum = parseInt(document.getElementById('currentInstallment').value);
        const totalNum = parseInt(document.getElementById('totalInstallments').value);

        if (!currentNum || !totalNum || currentNum <= 0 || totalNum <= 0 || currentNum >= totalNum) {
            alert('Please enter valid installment numbers (e.g., Current: 1, Total: 3). The current number must be less than the total.');
            return;
        }

        // Remove any existing numbering like "(1/3)" to create a base description
        const baseDescription = description.replace(/\s*\(\d+\/\d+\)$/, '').trim();
        newExpense.description = `${baseDescription} (${currentNum}/${totalNum})`;

        const originalDate = new Date(date + 'T12:00:00Z'); // Use UTC to prevent timezone issues

        for (let i = 1; i <= totalNum - currentNum; i++) {
            const futureMonthDate = new Date(originalDate);
            futureMonthDate.setUTCMonth(originalDate.getUTCMonth() + i);

            // Handle date overflow (e.g., Jan 31 + 1 month -> Feb 28/29)
            if (futureMonthDate.getUTCDate() < originalDate.getUTCDate()) {
                 futureMonthDate.setUTCDate(0); // Sets it to the last day of the previous month.
            }

            const futurePeriod = getMonthKey(futureMonthDate);
            const futureDateStr = toLocalDateString(futureMonthDate);

            // Load, modify, and save expenses for the future period
            let futureExpenses = JSON.parse(localStorage.getItem(`expenses_${futurePeriod}`) || '[]');

            const futureExpense = {
                ...newExpense, // Copy properties from the current expense
                id: generateId(),
                date: futureDateStr,
                description: `${baseDescription} (${currentNum + i}/${totalNum})`,
                isRecurring: false, // Future installments are not "recurring" in the same sense
                isInstallment: false // Only the first entry triggers the creation
            };
            
            futureExpenses.push(futureExpense);
            localStorage.setItem(`expenses_${futurePeriod}`, JSON.stringify(futureExpenses));
        }
         showToast(`${totalNum - currentNum} future installment(s) have been scheduled.`);
    }
    // --- END: Installment Logic ---

    expenses.push(newExpense);

    if (isRecurring && !isInstallment) { // Only mark as recurring if it's not an installment
        const recurringExists = recurringExpenses.some(re => re.description === description && re.myShare === myShare && re.partnerShare === partnerShare);
        if (!recurringExists) {
            recurringExpenses.push({ id: generateId(), category, myShare, partnerShare, description, fullAmount, splitProfile });
            localStorage.setItem('recurringExpenses', JSON.stringify(recurringExpenses));
        }
    }

    saveDataForPeriod(currentPayPeriod);
    updateAllDisplays();
    
    // Reset form fields
    document.getElementById('myShare').value = '';
    document.getElementById('partnerShare').value = '';
    document.getElementById('expenseFullAmount').value = '';
    document.getElementById('expenseDescription').value = '';
    document.getElementById('isRecurringExpense').checked = false;
    document.getElementById('isInstallment').checked = false;
    document.getElementById('currentInstallment').value = '';
    document.getElementById('totalInstallments').value = '';
    toggleInstallmentFields(); // Hide the installment fields again

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

// START: NEW FUNCTION to clear expense filters
function clearExpenseFilters() {
    document.getElementById('filterExpenseCategory').value = 'all';
    document.getElementById('filterExpenseDescription').value = '';
    displayExpenses();
}
// END: NEW FUNCTION

// START: MODIFIED displayExpenses function
function displayExpenses() {
    const tbody = document.getElementById('expenseTableBody');
    const tfoot = document.getElementById('expenseTableFooter');
    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    // Get filter values
    const categoryFilter = document.getElementById('filterExpenseCategory').value;
    const descriptionFilter = document.getElementById('filterExpenseDescription').value.toLowerCase();

    // Filter the expenses array
    let filteredExpenses = [...expenses];

    if (categoryFilter !== 'all') {
        filteredExpenses = filteredExpenses.filter(expense => expense.category === categoryFilter);
    }

    if (descriptionFilter) {
        filteredExpenses = filteredExpenses.filter(expense =>
            expense.description && expense.description.toLowerCase().includes(descriptionFilter)
        );
    }
    // END of new filter logic

    const direction = expenseSortDirection === 'asc' ? 1 : -1;
    // Sort the *filtered* array
    filteredExpenses.sort((a, b) => {
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
    
    // Iterate over the *filtered* array
    filteredExpenses.forEach(expense => {
        if (!expense.isExcluded) {
            totalMyShare += expense.myShare;
            totalPartnerShare += expense.partnerShare || 0;
            totalFullAmount += expense.fullAmount || 0;
        }

        const categoryInfo = getCategoryInfo(expense.category);
        const categoryName = `${categoryInfo.icon} ${categoryInfo.name}`;
        
        const profileMap = {'equal50': '50/50', 'mine100': 'You Pay 100%', 'partner100': 'Partner Pays 100%', 'custom': 'Custom'};
        const profileText = profileMap[expense.splitProfile] || 'Custom';

        const row = tbody.insertRow();
        row.id = `exp-row-${expense.id}`;
        if (expense.isExcluded) {
            row.classList.add('excluded-expense');
        }
        row.innerHTML = `
            <td onclick="makeEditable(this, '${expense.id}', 'date')">${expense.date}</td>
            <td onclick="makeEditable(this, '${expense.id}', 'category')"><span class="expense-category category-${expense.category.replace(/_/g, '-')}">${categoryName}</span></td>
            <td onclick="makeEditable(this, '${expense.id}', 'description')">${expense.description}</td>
            <td onclick="makeEditable(this, '${expense.id}', 'splitProfile')"><span class="split-pill">${profileText}</span></td>
            <td onclick="makeEditable(this, '${expense.id}', 'myShare')">${fmtRM(expense.myShare)}</td>
            <td onclick="makeEditable(this, '${expense.id}', 'partnerShare')">${fmtRM(expense.partnerShare || 0)}</td>
            <td>${fmtRM(expense.fullAmount || 0)}</td>
            <td style="text-align: center;"><input type="checkbox" onchange="toggleRecurringStatus('${expense.id}', this.checked)" ${expense.isRecurring ? 'checked' : ''}></td>
            <td style="text-align: center;"><input type="checkbox" onchange="toggleExpenseExclusion('${expense.id}', this.checked)" ${expense.isExcluded ? 'checked' : ''}></td>
            <td style="text-align: center;">
                 <button class="btn-delete-expense" onclick="deleteExpense('${expense.id}')" title="Delete Expense">&times;</button>
            </td>`;
    });

    const footerRow = tfoot.insertRow();
    footerRow.style.fontWeight = 'bold';
    // The totals are now correctly calculated from the filtered expenses
    footerRow.innerHTML = `
        <td colspan="4" style="text-align: right;">Filtered Subtotal (Included):</td>
        <td>${fmtRM(totalMyShare)}</td>
        <td>${fmtRM(totalPartnerShare)}</td>
        <td>${fmtRM(totalFullAmount)}</td>
        <td colspan="3"></td>
    `;

    if (!manualExpenseSet) {
        const useHousehold = document.getElementById('useHouseholdExpenses')?.checked || false;
        const expectedExpensesInput = document.getElementById('expectedExpenses');
        // IMPORTANT: The "Expected Monthly Expenses" should be based on ALL expenses, not filtered ones.
        const expenseSum = getExpensesSum(useHousehold); 
        expectedExpensesInput.value = expenseSum > 0 ? expenseSum.toFixed(2) : '';
        savingsGoalsData.expectedExpenses = expenseSum;
        updateSavingsAnalysis();
    }
    
    displayBudgetSnapshot();
}
// END: MODIFIED displayExpenses function

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
            
            if (myShare > 0 && partnerShare === 0) expenses[expenseIndex].splitProfile = 'mine100';
            else if (myShare === 0 && partnerShare > 0) expenses[expenseIndex].splitProfile = 'partner100';
            else if (myShare > 0 && myShare === partnerShare) expenses[expenseIndex].splitProfile = 'equal50';
            else expenses[expenseIndex].splitProfile = 'custom';

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
        updateAllDisplays(); 
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
        updateAllDisplays();
    }
}

// --- NEW: Clear All Expenses Function ---
function clearAllExpenses() {
    // New confirmation message is more specific about what will be deleted.
    if (confirm("Are you sure you want to delete all manually added expenses for this month? Scheduled installments will not be affected.")) {
        
        const installmentPattern = /\s*\(\d+\/\d+\)$/;
        
        // Instead of clearing the array, we filter it, KEEPING any expense that has an installment description.
        expenses = expenses.filter(exp => installmentPattern.test(exp.description));

        saveDataForPeriod(currentPayPeriod);
        updateAllDisplays();
        showToast("Manually added expenses for this month have been cleared.");
    }
}

function toggleExpenseExclusion(expenseId, isChecked) {
    const expenseIndex = expenses.findIndex(e => e.id === expenseId);
    if (expenseIndex === -1) return;

    expenses[expenseIndex].isExcluded = isChecked;
    saveDataForPeriod(currentPayPeriod);
    updateAllDisplays();
    showToast(`Expense ${isChecked ? 'excluded from' : 'included in'} totals.`);
}

// --- BUDGET SNAPSHOT FUNCTION ---
function displayBudgetSnapshot() {
    const container = document.getElementById('budgetSnapshotItems');
    const snapshotSection = document.getElementById('budgetSnapshotContainer');
    if (!container || !snapshotSection) return;

    container.innerHTML = '';

    const categorySpending = expenses
        .filter(e => !e.isExcluded)
        .reduce((acc, expense) => {
            acc[expense.category] = (acc[expense.category] || 0) + expense.myShare;
            return acc;
        }, {});

    let snapshotData = [];

    // UPDATED LOGIC: Show a category if it has a budget OR has spending.
    const relevantCategories = [...new Set([...Object.keys(budgets), ...Object.keys(categorySpending)])];

    relevantCategories.forEach(category => {
        const budgetAmount = budgets[category] || 0;
        const spentAmount = categorySpending[category] || 0;

        if (budgetAmount > 0 || spentAmount > 0) {
            const remaining = budgetAmount - spentAmount;
            const progress = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 100;

            snapshotData.push({
                category,
                name: getCategoryInfo(category).name,
                icon: getCategoryInfo(category).icon,
                spentAmount,
                budgetAmount,
                remaining,
                progress
            });
        }
    });

    if (snapshotData.length === 0) {
        snapshotSection.style.display = 'none';
        return;
    }
    
    snapshotSection.style.display = 'block';

    const sortOrder = document.getElementById('budgetSnapshotSort').value;
    if (sortOrder === 'remaining_asc') {
        snapshotData.sort((a, b) => a.remaining - b.remaining);
    } else { // percent_desc
        snapshotData.sort((a, b) => b.progress - a.progress);
    }

    snapshotData.forEach(data => {
        let statusClass = 'good';
        if (data.progress > 100 || (data.budgetAmount === 0 && data.spentAmount > 0)) statusClass = 'over';
        else if (data.progress > 80) statusClass = 'warning';

        const item = document.createElement('div');
        item.className = `budget-snapshot-item status-${statusClass}`;
        item.innerHTML = `
            <div class="budget-snapshot-item-header">
                <h5>${data.icon} ${data.name}</h5>
                <button class="btn btn-small quick-add-btn" onclick="quickAddExpenseForCategory('${data.category}')">+</button>
            </div>
            <div class="progress-bar">
                <div class="progress-fill status-${statusClass}" style="width: ${Math.min(data.progress, 100)}%;"></div>
            </div>
            <div class="budget-snapshot-item-details">
                <span>${fmtRM(data.spentAmount)} / ${fmtRM(data.budgetAmount)}</span>
                <span class="remaining">${data.remaining >= 0 ? fmtRM(data.remaining) + ' left' : fmtRM(Math.abs(data.remaining)) + ' over'}</span>
            </div>
        `;
        container.appendChild(item);
    });

    applyTruncationTooltips('.budget-snapshot-item-header h5');
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
    
    const baseNetIncome = getNetIncome(0, false); 
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

function refreshSavingsHeader() {
    const target = +document.getElementById('targetSavings').value || 0;
    const indContainer = document.getElementById('savingsIndicatorContainer');
    const topUpBtn = document.getElementById('topUpBtn');
    const actualVsTargetLabel = document.getElementById('actualVsTargetLabel');
    const savingsActualEl = document.getElementById('savingsActual');

    const prevPeriod = getPreviousMonthPeriod(currentPayPeriod);
    const prevOTEntries = JSON.parse(localStorage.getItem(`overtimeEntries_${prevPeriod}`) || '[]');
    const totalOT = prevOTEntries.reduce((sum, e) => sum + e.amount, 0);
    const netIncomeForSavings = getNetIncome(totalOT, false);
    const totalMyShare = expenses.filter(e => !e.isExcluded).reduce((sum, e) => sum + e.myShare, 0);
    const actualSavings = netIncomeForSavings - totalMyShare;

    runAICoach(); 

    if (target === 0) {
        actualVsTargetLabel.textContent = "💡 AI Savings Suggestion";
        
        if (aiSavingsPlan && aiSavingsPlan.total > 0) {
            savingsActualEl.innerHTML = `Try saving <strong style="color: #667eea; cursor: pointer;" onclick="applyAISavingsPlan()">${fmtRM(aiSavingsPlan.total)}</strong>`;
        } else {
            savingsActualEl.textContent = `All surplus is allocated.`;
        }
        
        indContainer.style.display = 'none';

    } else {
        actualVsTargetLabel.textContent = "Actual Savings vs Target";
        savingsActualEl.textContent = fmtRM(actualSavings);
        savingsActualEl.dataset.value = actualSavings;

        indContainer.style.display = 'flex';
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
function getNetIncome(otAmount, excludeClaims = false) {
    const claims = excludeClaims ? 0 : (salaryData.claims || 0);
    const gross = (salaryData.basic || 0) + claims + (salaryData.hpAllowance || 0) + (salaryData.incentive || 0) + (salaryData.bonus || 0) + (salaryData.otherIncome || 0) + otAmount;
    const deductionsObj = calculateDeductions(salaryData, otAmount);
    const totalDeductions = deductionsObj.epf + deductionsObj.socso + deductionsObj.eis + deductionsObj.pcb + (salaryData.cashAdvance || 0) + (salaryData.otherDeductions || 0);
    return gross - totalDeductions;
}

function updateDashboard() {
    const prevPeriod = getPreviousMonthPeriod(currentPayPeriod);
    const prevOTEntries = JSON.parse(localStorage.getItem(`overtimeEntries_${prevPeriod}`) || '[]');
    const totalOT = prevOTEntries.reduce((sum, e) => sum + e.amount, 0);

    const grossIncome = (salaryData.basic || 0) + (salaryData.claims || 0) + (salaryData.hpAllowance || 0) + (salaryData.incentive || 0) + (salaryData.bonus || 0) + (salaryData.otherIncome || 0) + totalOT;
    const totalDeductions = (salaryData.epf || 0) + (salaryData.socso || 0) + (salaryData.eis || 0) + (salaryData.pcb || 0) + (salaryData.cashAdvance || 0) + (salaryData.otherDeductions || 0);
    const netIncome = grossIncome - totalDeductions;
    
    const totalMyShare = expenses.filter(e => !e.isExcluded).reduce((sum, e) => sum + e.myShare, 0);
    const netAfterExpenses = netIncome - totalMyShare;
    
    const totalBudgeted = Object.values(budgets).reduce((s, b) => s + b, 0);
    const remainingBudget = totalBudgeted - totalMyShare;

    const currentMonthName = document.getElementById('currentMonth').value.split(' ')[0];
    document.getElementById('dashboardTitle').textContent = `Current Finances (${currentMonthName})`;

    document.getElementById('netIncome').textContent = fmtRM(netIncome);
    document.getElementById('netAfterExpenses').textContent = fmtRM(netAfterExpenses);
    
    document.getElementById('dashboardOTPaid').textContent = `(+ ${fmtRM(totalOT)} OT)`;
    
    document.getElementById('dashboardSpent').textContent = fmtRM(totalMyShare);
    document.getElementById('dashboardBudgeted').textContent = fmtRM(totalBudgeted);
    const remainingEl = document.getElementById('dashboardRemaining');
    remainingEl.textContent = fmtRM(remainingBudget);
    remainingEl.style.color = remainingBudget >= 0 ? '#20c997' : '#dc3545';

    // --- NEW LOGIC FOR BUDGET WARNING ---
    const leftToAssign = netIncome - totalBudgeted;
    const budgetWarningDiv = document.getElementById('budget-warning');
    const budgetOverageEl = document.getElementById('budget-overage');

    if (leftToAssign < 0) {
        budgetOverageEl.textContent = fmtRM(Math.abs(leftToAssign));
        budgetWarningDiv.style.display = 'block';
    } else {
        budgetWarningDiv.style.display = 'none';
    }
    // --- END NEW LOGIC ---
    
    const target = parseFloat(document.getElementById('targetSavings').value) || 0;
    const savingsTargetDisplayEl = document.getElementById('savingsTargetDisplay');
    const savingsGoalCard = document.getElementById('this-months-savings-goal');
    
    if (target > 0) {
        savingsGoalCard.querySelector(".card-title").textContent = "🎯 This Month's Savings Goal";
        document.getElementById('savingsTargetLabel').textContent = "Target Savings";
        savingsTargetDisplayEl.textContent = fmtRM(target);
        document.getElementById('savingsTargetTooltip').textContent = "Your declared savings goal for the current month.";
    } else {
        savingsGoalCard.querySelector(".card-title").textContent = "💰 Savings Potential & AI Tip";
        document.getElementById('savingsTargetLabel').textContent = "Projected Savings This Month";
        savingsTargetDisplayEl.textContent = fmtRM(netAfterExpenses);
        document.getElementById('savingsTargetTooltip').textContent = "This is your potential savings based on your current income and expenses.";
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
    
    const totalSinkingFundSavings = sinkingFunds.reduce((sum, fund) => sum + (fund.savedAmount || 0), 0);
    document.getElementById('sinkingFundsTotal').textContent = fmtRM(totalSinkingFundSavings);
    
    const upcomingFunds = sinkingFunds.filter(f => !f.isArchived && new Date(f.dueDate) > new Date()).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
    if (upcomingFunds.length > 0) {
        document.getElementById('nextGoalDue').textContent = `${upcomingFunds[0].name} (${upcomingFunds[0].dueDate})`;
    } else {
        document.getElementById('nextGoalDue').textContent = 'N/A';
    }

    // --- NEW: Calculate and Display Total Gold Investment ---
    let totalGoldInvested = 0;
    const allPeriods = new Set();
    // Gather all periods from localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('expenses_')) {
            allPeriods.add(key.replace('expenses_', ''));
        }
    }
    // Ensure the current period is in the set, even if not yet saved to localStorage
    allPeriods.add(currentPayPeriod);

    allPeriods.forEach(period => {
        let expensesForPeriod;
        if (period === currentPayPeriod) {
            expensesForPeriod = expenses; // Use in-memory array for the current period
        } else {
            expensesForPeriod = JSON.parse(localStorage.getItem(`expenses_${period}`) || '[]');
        }
        
        expensesForPeriod.forEach(expense => {
            if (expense.isGoldInvestment === true) {
                 totalGoldInvested += expense.myShare || 0;
            }
        });
    });

    document.getElementById('totalGoldInvestment').textContent = fmtRM(totalGoldInvested);
}
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
        div.innerHTML = `<div class="stat-label">${getCategoryInfo(category).name}</div><div style="font-size: 1.2em; font-weight: bold;">${fmtRM(amount)}</div><div style="font-size: 0.9em; color: #666;">${(expensesToDisplay > 0 ? (amount / expensesToDisplay) * 100 : 0).toFixed(1)}% of total</div>`;
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
        aiSavingsPlan = { total: 0 };
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
        if (key.startsWith('salaryData_') || key.startsWith('overtimeEntries_') || key.startsWith('expenses_') || key.startsWith('savingsGoalsData_') || key.startsWith('budgets_') || key === 'recurringExpenses' || key === 'lastPayPeriod' || key === 'sinkingFunds' || key === 'savingsPots' || key === 'customCategories' || key === 'projectList') {
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
    event.target.value = '';
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
    updateAllDisplays();
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
        displayBudgets();
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

    const lastMonthExpenses = JSON.parse(prevExpensesData);
    const installmentPattern = /\s*\((\d+)\/(\d+)\)$/;

    // --- NEW LOGIC PART 1: Find and restore missing installments ---
    const missingInstallmentsToAdd = [];
    lastMonthExpenses.forEach(exp => {
        const match = exp.description.match(installmentPattern);
        if (match) {
            const currentNum = parseInt(match[1]);
            const totalNum = parseInt(match[2]);

            // If the installment plan is still ongoing...
            if (currentNum < totalNum) {
                const nextNum = currentNum + 1;
                const baseDescription = exp.description.replace(installmentPattern, '').trim();
                const expectedDescription = `${baseDescription} (${nextNum}/${totalNum})`;

                // Check if this expected installment ALREADY exists in the current month's list
                const alreadyExists = expenses.some(currentExp => currentExp.description === expectedDescription);

                if (!alreadyExists) {
                    // It's missing, so let's re-create it for the current month.
                    const originalDate = new Date(exp.date + 'T12:00:00Z');
                    const futureMonthDate = new Date(originalDate);
                    futureMonthDate.setUTCMonth(originalDate.getUTCMonth() + 1);

                    if (futureMonthDate.getUTCDate() < originalDate.getUTCDate()) {
                        futureMonthDate.setUTCDate(0);
                    }
                    const futureDateStr = toLocalDateString(futureMonthDate);

                    missingInstallmentsToAdd.push({
                        ...exp,
                        id: generateId(),
                        date: futureDateStr,
                        description: expectedDescription,
                        isRecurring: false,
                        isInstallment: false
                    });
                }
            }
        }
    });

    // --- EXISTING LOGIC PART 2: Filter for manual expenses to copy ---
    const expensesToCopy = lastMonthExpenses.filter(exp => !installmentPattern.test(exp.description));
    
    const totalToProcess = expensesToCopy.length + missingInstallmentsToAdd.length;
    if (totalToProcess === 0) {
        if (!isSilent) alert(`No expenses found to copy or restore from ${prevPeriod}.`);
        return false;
    }

    const proceed = isSilent ? true : confirm(`This will copy ${expensesToCopy.length} manual expense(s) and restore ${missingInstallmentsToAdd.length} missing installment(s) from ${prevPeriod}. This will replace any other manual entries. Continue?`);

    if (proceed) {
        const [currentYear, currentMonth] = currentPayPeriod.split('-').map(Number);
        
        // Map the manual expenses to the new month
        const mappedManualExpenses = expensesToCopy.map(exp => {
            const oldDate = new Date(exp.date);
            const newDay = Math.min(oldDate.getUTCDate(), new Date(currentYear, currentMonth, 0).getDate());
            const newDate = new Date(Date.UTC(currentYear, currentMonth - 1, newDay));
            
            return {
                ...exp,
                id: generateId(),
                date: newDate.toISOString().split('T')[0]
            };
        });

        // Combine the copied manual expenses with the restored installments
        expenses = [...mappedManualExpenses, ...missingInstallmentsToAdd];

        saveDataForPeriod(currentPayPeriod);
        updateAllDisplays();
        if (!isSilent) showToast(`Copied ${expensesToCopy.length} and restored ${missingInstallmentsToAdd.length} expense(s) from ${prevPeriod}.`);
        return true;
    }
    return false;
}

