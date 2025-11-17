// --- REPORTS & MODALS ---

function updateLastCloudSaveDisplay() {
    const textEl = document.getElementById('lastCloudSaveText');
    if (!textEl) return;

    let iso = null;
    try {
        iso = localStorage.getItem('lastCloudSaveTime');
    } catch (e) {
        console.warn('Could not read lastCloudSaveTime from localStorage:', e);
    }

    if (!iso) {
        textEl.textContent = 'never';
        return;
    }

    const d = new Date(iso);
    if (isNaN(d.getTime())) {
        textEl.textContent = 'unknown';
        return;
    }

    textEl.textContent = d.toLocaleString();
}


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
    
    const sortedEntries = [...overtimeEntries].sort((a, b) => new Date(a.date) - new Date(b.date));

    const dataToExport = sortedEntries.map(e => ({
        Date: e.date,
        Day: e.dayName,
        StartTime: e.startTime || '',
        EndTime: e.endTime || '',
        Hours: e.hours.toFixed(2),
        Duration: formatHoursDuration(e.hours),
        Rate: `${e.rate}x`,
        Earnings: e.amount.toFixed(2),
        Remarks: e.remarks || ''
    }));

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

async function createSummaryCardImage(title, items, themeColor, pdf) {
    let itemHTML = '';
    items.forEach(item => {
        const valueColor = item.valueColor || '#333';
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
            width: 720px;
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

    const imgWidth = pdf.internal.pageSize.getWidth() - 80;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    return { imgData, imgWidth, imgHeight };
}

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
        .map(([value, amount]) => `<li>${getCategoryInfo(value).name}: <strong>${fmtRM(amount)}</strong></li>`)
        .join('');
        
    const infographicContainer = document.createElement('div');
    infographicContainer.id = 'pdf-infographic-container';
    infographicContainer.style.cssText = `
        position: absolute; left: -9999px; width: 800px; padding: 40px;
        background-color: #f8f9fa; font-family: 'Segoe UI', sans-serif;
        color: #333;
    `;

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

    const canvas = await html2canvas(infographicContainer, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    document.body.removeChild(infographicContainer);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    if (overtimeEntries.length > 0) {
        pdf.addPage();
        pdf.setFontSize(18);
        pdf.setTextColor(themeColor);
        pdf.text('Overtime Entry Details', 40, 60);

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
            `${e.startTime || ''} - ${e.endTime || ''}`,
            e.hours.toFixed(2),
            `${e.rate}x`,
            fmtRM(e.amount),
            e.remarks || ''
        ]);

        pdf.autoTable({
            head: [['Date', 'Day', 'Time', 'Hours', 'Rate', 'Earnings', 'Remarks']],
            body: otBody,
            startY: otSummaryCard.imgHeight + 90,
            headStyles: { fillColor: themeColor }
        });
    }

    if (expensesForReport.length > 0) {
        pdf.addPage();
        pdf.setFontSize(18);
        pdf.setTextColor(themeColor);
        pdf.text('Expense Details', 40, 60);

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
            return valB - valA;
        });

        const expenseBody = expensesForTable.map(e => [
            e.date,
            getCategoryInfo(e.category).name,
            e.description || '',
            fmtRM(e.myShare),
            fmtRM(e.partnerShare || 0),
            fmtRM(e.fullAmount)
        ]);

        pdf.autoTable({
            head: [['Date', 'Category', 'Description', 'My Share', 'Partner\'s Share', 'Full Amount']],
            body: expenseBody,
            startY: expenseSummaryCard.imgHeight + 90,
            headStyles: { fillColor: themeColor }
        });
    }
    
    pdf.save(`${reportTitle.replace(/ /g, '_')}.pdf`);
    closeDetailedPDFModal();
}

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
            return valB - valA;
        });

        const expenseBody = expensesForTable.map(e => [
            e.date,
            getCategoryInfo(e.category).name,
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
    const icon = document.getElementById('fundIcon').value;

    if (!name || !totalAmount || !dueDate) {
        alert('Please fill out all fields for the new goal.');
        return;
    }

    const newFund = {
        id: generateId(),
        name,
        icon,
        totalAmount,
        dueDate,
        savedAmount: 0,
        allocations: {},
        contributionHistory: [],
        isArchived: false
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
    const archivedContainer = document.getElementById('archivedSinkingFundsContainer');
    container.innerHTML = '';
    archivedContainer.innerHTML = '';
    
    const activeFunds = sinkingFunds.filter(f => !f.isArchived);
    const archivedFunds = sinkingFunds.filter(f => f.isArchived);

    if (activeFunds.length === 0) {
        container.innerHTML = '<p>No active goals. Add one above or unarchive a goal to start planning!</p>';
    } else {
        activeFunds.forEach(fund => renderSinkingFundCard(fund, container));
    }

    if (showArchived) {
        if (archivedFunds.length === 0) {
            archivedContainer.innerHTML = '<p>No archived goals.</p>';
        } else {
            archivedFunds.forEach(fund => renderSinkingFundCard(fund, archivedContainer));
        }
        archivedContainer.style.display = 'grid';
    } else {
        archivedContainer.style.display = 'none';
    }
}

function renderSinkingFundCard(fund, container) {
    const today = new Date();
    const due = new Date(fund.dueDate);
    const monthsLeft = Math.max(0, (due.getFullYear() - today.getFullYear()) * 12 + (due.getMonth() - today.getMonth()));
    const remaining = fund.totalAmount - (fund.savedAmount || 0);
    const monthlyContribution = monthsLeft > 0 ? remaining / monthsLeft : remaining;
    const progress = fund.totalAmount > 0 ? ((fund.savedAmount || 0) / fund.totalAmount) * 100 : 0;
    
    const hasAllocatedThisMonth = fund.allocations && fund.allocations[currentPayPeriod];

    const card = document.createElement('div');
    card.className = `sinking-fund-card ${fund.isArchived ? 'is-archived' : ''}`;
    card.innerHTML = `
        <h4><span class="icon">${fund.icon || '💰'}</span> ${fund.name}</h4>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress.toFixed(1)}%; background: linear-gradient(90deg, #20c997, #28a745);">${progress.toFixed(1)}%</div>
        </div>
        <div class="sinking-fund-details">
            <span>Saved: <strong>${fmtRM(fund.savedAmount || 0)} / ${fmtRM(fund.totalAmount)}</strong></span>
            <span>Due: <strong>${fund.dueDate}</strong></span>
        </div>
        <div class="sinking-fund-details">
            <span>Monthly: <strong>${fmtRM(monthlyContribution)}</strong></span>
            <span>Months Left: <strong>${monthsLeft}</strong></span>
        </div>
        <div class="sinking-fund-actions">
            ${!fund.isArchived ? `
                ${hasAllocatedThisMonth 
                    ? `<button class="btn btn-small btn-danger" onclick="unallocateContribution('${fund.id}')">Unallocate</button>`
                    : `<button class="btn btn-small btn-success" onclick="allocateSingleGoal('${fund.id}')">✅ Allocate</button>`
                }
                <button class="btn btn-small" onclick="launchExtraContributionModal('${fund.id}')">+ Add Extra</button>
                <button class="btn btn-small btn-info" onclick="displayContributionHistory('${fund.id}')">History</button>
                <button class="btn btn-small btn-secondary" onclick="openSinkingFundEditModal('${fund.id}')">Edit</button>
                <button class="btn btn-small btn-warning" onclick="toggleArchiveGoal('${fund.id}')">Archive</button>
            ` : `
                <button class="btn btn-small btn-success" onclick="toggleArchiveGoal('${fund.id}')">Unarchive</button>
                <button class="btn btn-small btn-info" onclick="displayContributionHistory('${fund.id}')">History</button>
                <button class="btn btn-small btn-danger" onclick="deleteSinkingFund('${fund.id}')">Delete</button>
            `}
        </div>
    `;
    container.appendChild(card);
}


function allocateContribution(fundId, amount, type = 'monthly', description = '') {
    const fundIndex = sinkingFunds.findIndex(f => f.id === fundId);
    if (fundIndex === -1) return false;

    const fund = sinkingFunds[fundIndex];
    if (amount <= 0) return false;
    
    fund.savedAmount = round2((fund.savedAmount || 0) + amount);
    if (!fund.allocations) fund.allocations = {};
    if (type === 'monthly') {
        fund.allocations[currentPayPeriod] = true;
    }
    
    if (!fund.contributionHistory) fund.contributionHistory = [];
    fund.contributionHistory.push({
        date: new Date().toISOString().split('T')[0],
        amount,
        type,
        description: description || `Sinking Fund: ${fund.name}`
    });

    const newExpense = {
        id: generateId(),
        date: `${currentPayPeriod}-01`,
        category: 'savings_investments',
        myShare: amount,
        partnerShare: 0,
        fullAmount: amount,
        description: description || `Sinking Fund: ${fund.name}`,
        isRecurring: false,
        splitProfile: 'mine100',
        isExcluded: false,
        isSinkingFund: true,
        fundId: fund.id
    };
    expenses.push(newExpense);
    return true;
}


function unallocateContribution(fundId) {
    if (!confirm("Are you sure you want to unallocate this month's contribution? This will remove the saved amount and the corresponding expense record.")) {
        return;
    }

    const fundIndex = sinkingFunds.findIndex(f => f.id === fundId);
    if (fundIndex === -1) {
        console.error("Fund not found for unallocation");
        return;
    }
    const fund = sinkingFunds[fundIndex];

    const expenseIndex = expenses.findIndex(e => 
        e.isSinkingFund && 
        e.fundId === fundId && 
        e.description === `Sinking Fund: ${fund.name}`
    );
    
    if (expenseIndex === -1) {
        showToast("Could not find the associated expense to remove.", "danger");
        delete fund.allocations[currentPayPeriod];
        saveDataForPeriod(currentPayPeriod);
        updateAllDisplays();
        return;
    }

    const amountToUnallocate = expenses[expenseIndex].myShare;
    expenses.splice(expenseIndex, 1);

    fund.savedAmount = round2(fund.savedAmount - amountToUnallocate);
    delete fund.allocations[currentPayPeriod];

    const historyIndex = fund.contributionHistory.map(h => h.type === 'monthly' && h.amount === amountToUnallocate).lastIndexOf(true);
    if (historyIndex > -1) {
        fund.contributionHistory.splice(historyIndex, 1);
    }
    
    saveDataForPeriod(currentPayPeriod);
    updateAllDisplays();
    showToast(`Unallocated ${fmtRM(amountToUnallocate)} from "${fund.name}".`);
}

function allocateSingleGoal(fundId) {
    const fund = sinkingFunds.find(f => f.id === fundId);
    if (!fund) return;
    
    const today = new Date();
    const due = new Date(fund.dueDate);
    const monthsLeft = Math.max(1, (due.getFullYear() - today.getFullYear()) * 12 + (due.getMonth() - today.getMonth()));
    const remaining = fund.totalAmount - (fund.savedAmount || 0);
    const monthlyContribution = remaining > 0 && monthsLeft > 0 ? round2(remaining / monthsLeft) : 0;
    
    if (monthlyContribution <= 0) {
        showToast("This goal is already fully funded or has no amount remaining!", "info");
        return;
    }

    if (confirm(`This will allocate ${fmtRM(monthlyContribution)} to "${fund.name}" for this month. Continue?`)) {
        if (allocateContribution(fund.id, monthlyContribution, 'monthly')) {
            saveDataForPeriod(currentPayPeriod);
            updateAllDisplays();
            showToast(`Allocated ${fmtRM(monthlyContribution)} to "${fund.name}"!`);
        }
    }
}


function deleteSinkingFund(fundId) {
    if (confirm("Are you sure you want to permanently delete this goal? This cannot be undone.")) {
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
    document.getElementById('fundEditIcon').value = fund.icon || '💰';
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
    const icon = document.getElementById('fundEditIcon').value;

    if (!name || !totalAmount || !dueDate) {
        alert('Please fill out all fields.');
        return;
    }

    sinkingFunds[fundIndex].name = name;
    sinkingFunds[fundIndex].totalAmount = totalAmount;
    sinkingFunds[fundIndex].dueDate = dueDate;
    sinkingFunds[fundIndex].icon = icon;

    if (sinkingFunds[fundIndex].savedAmount > totalAmount) {
        sinkingFunds[fundIndex].savedAmount = totalAmount;
        showToast("Saved amount adjusted to match new total.", "warning");
    }

    saveDataForPeriod(currentPayPeriod);
    updateAllDisplays();
    closeSinkingFundEditModal();
    showToast('Goal details updated successfully!');
}

function allocateAllGoals() {
    if (!confirm("This will allocate the suggested monthly contribution to all active, unallocated goals for this month. Continue?")) return;
    
    let allocatedCount = 0;
    const activeFunds = sinkingFunds.filter(f => !f.isArchived && !(f.allocations && f.allocations[currentPayPeriod]));

    activeFunds.forEach(fund => {
        const today = new Date();
        const due = new Date(fund.dueDate);
        const monthsLeft = Math.max(1, (due.getFullYear() - today.getFullYear()) * 12 + (due.getMonth() - today.getMonth()));
        const remaining = fund.totalAmount - (fund.savedAmount || 0);
        const monthlyContribution = remaining > 0 && monthsLeft > 0 ? round2(remaining / monthsLeft) : 0;
        
        if (monthlyContribution > 0) {
            if (allocateContribution(fund.id, monthlyContribution, 'monthly')) {
                allocatedCount++;
            }
        }
    });

    if (allocatedCount > 0) {
        saveDataForPeriod(currentPayPeriod);
        updateAllDisplays();
        showToast(`${allocatedCount} goal(s) have been funded for this month!`);
    } else {
        showToast("All active goals are already funded for this month.", "info");
    }
}

function launchExtraContributionModal(fundId) {
    document.getElementById('fundExtraContributionId').value = fundId;
    const fund = sinkingFunds.find(f => f.id === fundId);
    if(fund) {
         document.getElementById('extraContributionTitle').textContent = `Add to "${fund.name}"`;
    }
    document.getElementById('extra-contribution-modal').style.display = 'flex';
}
function closeExtraContributionModal() {
    document.getElementById('extra-contribution-modal').style.display = 'none';
    document.getElementById('fundExtraAmount').value = '';
    document.getElementById('fundExtraDescription').value = '';
}
function addExtraContribution() {
    const fundId = document.getElementById('fundExtraContributionId').value;
    const amount = parseFloat(document.getElementById('fundExtraAmount').value);
    const description = document.getElementById('fundExtraDescription').value;

    if (!amount || amount <= 0) {
        alert("Please enter a valid amount.");
        return;
    }
    
    if (allocateContribution(fundId, amount, 'extra', description)) {
        saveDataForPeriod(currentPayPeriod);
        updateAllDisplays();
        showToast(`Extra contribution of ${fmtRM(amount)} added!`);
        closeExtraContributionModal();
    }
}

function displayContributionHistory(fundId) {
    const fund = sinkingFunds.find(f => f.id === fundId);
    if (!fund) return;
    
    const contentDiv = document.getElementById('contributionHistoryContent');
    document.getElementById('contributionHistoryTitle').textContent = `History for "${fund.name}"`;
    contentDiv.innerHTML = '';

    if (!fund.contributionHistory || fund.contributionHistory.length === 0) {
        contentDiv.innerHTML = '<p>No contributions have been recorded for this goal yet.</p>';
    } else {
        const list = document.createElement('ul');
        [...fund.contributionHistory].reverse().forEach(entry => {
            const item = document.createElement('li');
            item.innerHTML = `
                <div>
                    <div class="history-meta">${entry.date} - ${entry.type}</div>
                    <div>${entry.description}</div>
                </div>
                <div class="history-amount">${fmtRM(entry.amount)}</div>
            `;
            list.appendChild(item);
        });
        contentDiv.appendChild(list);
    }

    document.getElementById('contribution-history-modal').style.display = 'flex';
}
function closeContributionHistoryModal() {
    document.getElementById('contribution-history-modal').style.display = 'none';
}

function toggleArchiveGoal(fundId) {
    const fundIndex = sinkingFunds.findIndex(f => f.id === fundId);
    if (fundIndex === -1) return;
    
    sinkingFunds[fundIndex].isArchived = !sinkingFunds[fundIndex].isArchived;
    saveDataForPeriod(currentPayPeriod);
    displaySinkingFunds();
    showToast(`Goal ${sinkingFunds[fundIndex].isArchived ? 'archived' : 'unarchived'}.`);
}

function toggleShowArchived() {
    showArchived = !showArchived;
    document.getElementById('toggleArchivedBtn').textContent = showArchived ? '🙈 Hide Archived' : '👁️ Show Archived';
    displaySinkingFunds();
}


// --- WORKFLOW ENHANCEMENTS ---
function createOTPlan() {
    const otRequiredText = document.getElementById('otRequired').textContent;
    const otAmount = parseFloat(otRequiredText.replace(/[^0-9.-]+/g,""));

    if (otAmount > 0) {
        switchTab('overtime');
        
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
        
        switchTab('salary');
        
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
    const hoursNeeded = otRequired / (hourlyRate * 1.5);

    if (confirm(`To cover the ${fmtRM(shortfall)} shortfall next month, you'll need to plan for approximately ${hoursNeeded.toFixed(1)} more hours of OT this period. Would you like to add this to your OT target?`)) {
         const targetInput = document.getElementById('targetOTEarnings');
        const currentOTEarnings = parseFloat(targetInput.value) || 0;
        const newTargetOTEarnings = currentOTEarnings + otRequired;

        switchTab('overtime');
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
            option.textContent = getCategoryInfo(cat).name;
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

// --- SAVINGS POTS ---
function addSavingsPot() {
    const name = document.getElementById('potName').value;
    const totalAmount = parseFloat(document.getElementById('potTotal').value);

    if (!name || !totalAmount) {
        alert('Please provide a name and target amount for the pot.');
        return;
    }
    savingsPots.push({
        id: generateId(),
        name,
        totalAmount,
        savedAmount: 0
    });
    saveDataForPeriod(currentPayPeriod);
    displaySavingsPots();
    document.getElementById('potName').value = '';
    document.getElementById('potTotal').value = '';
}
function displaySavingsPots() {
    const container = document.getElementById('savingsPotsContainer');
    container.innerHTML = '';
    if (savingsPots.length === 0) {
        container.innerHTML = '<p>No savings pots created yet. Add one to start saving for smaller goals!</p>';
        return;
    }
    savingsPots.forEach(pot => {
        const progress = pot.totalAmount > 0 ? (pot.savedAmount / pot.totalAmount) * 100 : 0;
        const card = document.createElement('div');
        card.className = 'sinking-fund-card';
        card.innerHTML = `
            <h4>🍯 ${pot.name}</h4>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress.toFixed(1)}%;">${progress.toFixed(1)}%</div>
            </div>
            <div class="sinking-fund-details">
                <span>Saved: <strong>${fmtRM(pot.savedAmount)} / ${fmtRM(pot.totalAmount)}</strong></span>
            </div>
            <div class="sinking-fund-actions">
                <button class="btn btn-small btn-success" onclick="launchAddFundsToPotModal('${pot.id}')">+ Add Funds</button>
                <button class="btn btn-small btn-danger" onclick="deleteSavingsPot('${pot.id}')">Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}
function launchAddFundsToPotModal(potId) {
    document.getElementById('potAddFundsId').value = potId;
    const pot = savingsPots.find(p => p.id === potId);
    if (pot) {
        document.getElementById('addFundsToPotTitle').textContent = `Add Funds to "${pot.name}"`;
    }
    document.getElementById('add-funds-pot-modal').style.display = 'flex';
}
function closeAddFundsToPotModal() {
    document.getElementById('add-funds-pot-modal').style.display = 'none';
    document.getElementById('potAddFundsAmount').value = '';
}
function addFundsToPot() {
    const potId = document.getElementById('potAddFundsId').value;
    const amount = parseFloat(document.getElementById('potAddFundsAmount').value);
    const potIndex = savingsPots.findIndex(p => p.id === potId);

    if (potIndex === -1 || !amount || amount <= 0) {
        alert('Invalid amount or pot not found.');
        return;
    }

    savingsPots[potIndex].savedAmount = round2(savingsPots[potIndex].savedAmount + amount);
    
    const newExpense = {
        id: generateId(),
        date: new Date().toISOString().split('T')[0],
        category: 'savings_investments',
        myShare: amount, partnerShare: 0, fullAmount: amount,
        description: `Contribution to Pot: ${savingsPots[potIndex].name}`,
        isRecurring: false, splitProfile: 'mine100', isExcluded: false
    };
    expenses.push(newExpense);
    
    saveDataForPeriod(currentPayPeriod);
    updateAllDisplays();
    closeAddFundsToPotModal();
    showToast(`${fmtRM(amount)} added to "${savingsPots[potIndex].name}"!`);
}
function deleteSavingsPot(potId) {
    if (confirm("Are you sure you want to delete this savings pot?")) {
        savingsPots = savingsPots.filter(p => p.id !== potId);
        saveDataForPeriod(currentPayPeriod);
        displaySavingsPots();
    }
}
function logSavingsAsExpense() {
    const prevPeriod = getPreviousMonthPeriod(currentPayPeriod);
    const prevOTEntries = JSON.parse(localStorage.getItem(`overtimeEntries_${prevPeriod}`) || '[]');
    const totalOT = prevOTEntries.reduce((sum, e) => sum + e.amount, 0);
    const netIncome = getNetIncome(totalOT, false);
    const totalMyShare = expenses.filter(e => !e.isExcluded).reduce((sum, e) => sum + e.myShare, 0);
    const surplus = netIncome - totalMyShare;

    if (surplus <= 0) {
        alert("There is no surplus to log this month.");
        return;
    }
    
    const existingLog = expenses.find(e => e.description === 'Logged Monthly Savings');
    if (existingLog) {
        if (!confirm("You've already logged your savings this month. Do you want to overwrite it with the new surplus amount?")) {
            return;
        }
        existingLog.myShare = surplus;
        existingLog.fullAmount = surplus;
    } else {
        const newExpense = {
            id: generateId(),
            date: `${currentPayPeriod}-${new Date(currentPayPeriod + '-01T12:00:00Z').getUTCDate()}`,
            category: 'savings_investments',
            myShare: surplus, partnerShare: 0, fullAmount: surplus,
            description: 'Logged Monthly Savings',
            isRecurring: false, splitProfile: 'mine100', isExcluded: false
        };
        expenses.push(newExpense);
    }
    
    saveDataForPeriod(currentPayPeriod);
    updateAllDisplays();
    showToast(`Surplus of ${fmtRM(surplus)} has been logged as a savings expense.`);
}

// --- GOLD INVESTMENT FUNCTIONS (NEW & UPDATED) ---
function logGoldInvestment() {
    const amountInput = document.getElementById('goldInvestmentAmount');
    const investmentAmount = parseFloat(amountInput.value);
    
    if (!investmentAmount || investmentAmount <= 0) {
        alert("Please enter a valid investment amount.");
        return;
    }

    const description = `Gold Investment - ${currentPayPeriod}`;

    // Check if an investment has already been logged for this month
    const alreadyLogged = expenses.some(e => e.isGoldInvestment === true);
    if (alreadyLogged) {
        alert("You have already logged your gold investment for this month. To change the amount, please find and edit the entry in the expenses list.");
        return;
    }

    const newExpense = {
        id: generateId(),
        date: new Date().toISOString().split('T')[0],
        category: 'savings_investments',
        myShare: investmentAmount,
        partnerShare: 0,
        fullAmount: investmentAmount,
        description: description,
        isRecurring: false, // This is no longer a fixed recurring expense
        splitProfile: 'mine100',
        isExcluded: false,
        isGoldInvestment: true // Custom flag to identify this type of investment
    };

    expenses.push(newExpense);
    saveDataForPeriod(currentPayPeriod);
    updateAllDisplays();
    showToast(`${fmtRM(investmentAmount)} Gold Investment logged successfully!`);
    amountInput.value = ''; // Clear the input after logging
}

function updateGoldInvestmentStatus() {
    const logButton = document.getElementById('logGoldInvestmentBtn');
    const amountInput = document.getElementById('goldInvestmentAmount');
    const loggedInvestment = expenses.find(e => e.isGoldInvestment === true);

    if (loggedInvestment) {
        amountInput.value = loggedInvestment.myShare.toFixed(2);
        amountInput.disabled = true;
        logButton.disabled = true;
    } else {
        amountInput.disabled = false;
        logButton.disabled = false;
        amountInput.value = ''; // Ensure it's clear if not logged
    }
}


// --- BUDGETING FUNCTIONS ---
function saveBudget(category, value) {
    const amount = parseFloat(value) || 0;
    if (amount > 0) {
        budgets[category] = amount;
    } else {
        delete budgets[category]; // This removes the budget if the input is cleared
    }
    saveDataForPeriod(currentPayPeriod);
    displayBudgets(); 
    updateDashboard(); // Update dashboard card when a budget is changed
    displayBudgetSnapshot();
}

function handleBudgetInputKeydown(event) {
    if (event.key === 'Enter') {
        event.target.blur(); // Blurring the element will trigger the 'onchange' event
    }
}

// --- NEW: Clear Individual Budget Function ---
function clearAndSaveBudget(category) {
    if (budgets[category]) {
        delete budgets[category];
        saveDataForPeriod(currentPayPeriod);
        displayBudgets();
        updateDashboard();
        displayBudgetSnapshot();
    }
}

// --- NEW: Clear All Budgets Function ---
function clearAllBudgets() {
    if (confirm("Are you sure you want to clear ALL budgets for this month? Your expense entries will not be affected.")) {
        budgets = {};
        saveDataForPeriod(currentPayPeriod);
        updateAllDisplays();
        showToast("All budgets for this month have been cleared.");
    }
}

// --- UPDATED: Function to fix over-budget categories with a simpler confirmation ---
function fixOverBudget(category) {
    const spentAmount = expenses
        .filter(e => !e.isExcluded && e.category === category)
        .reduce((sum, e) => sum + e.myShare, 0);

    const budgetAmount = budgets[category] || 0;
    const overage = spentAmount - budgetAmount;

    if (overage <= 0) return;
    
    const confirmationMessage = `This will increase your budget for "${getCategoryInfo(category).name}" to match your spending (${fmtRM(spentAmount)}).

Your "Left to Assign" value already reflects this overspending. This action simply formalizes the change. Do you want to proceed?`;

    if (confirm(confirmationMessage)) {
        const newBudget = spentAmount;
        saveBudget(category, newBudget); // This function already calls all necessary updates.
        showToast(`Budget for "${getCategoryInfo(category).name}" updated!`, 'success');
    }
}


function displayBudgets() {
    const container = document.getElementById('budgetContainer');
    const summaryContainer = document.getElementById('budgetSummary');
    const overbudgetCard = document.getElementById('overbudget-preview-card');
    container.innerHTML = '';

    const categorySpending = expenses
        .filter(e => !e.isExcluded)
        .reduce((acc, expense) => {
            acc[expense.category] = (acc[expense.category] || 0) + expense.myShare;
            return acc;
        }, {});

    let budgetCardsData = [];
    const allCategoryOptions = [...Object.entries(categoryConfig), ...customCategories.map(c => [c.value, c])];
    
    allCategoryOptions.forEach(([value, info]) => {
        const category = value;
        const categoryName = `${info.icon} ${info.name}`;
        const budgetAmount = budgets[category] || 0;
        const spentAmount = categorySpending[category] || 0;
        
        const remaining = budgetAmount - spentAmount;
        const progress = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;
        
        budgetCardsData.push({
            category,
            categoryName,
            budgetAmount,
            spentAmount,
            remaining,
            progress,
            isUnbudgetedAndSpent: budgetAmount === 0 && spentAmount > 0
        });
    });

    const sortOrder = document.getElementById('budgetSortOrder').value;
    switch (sortOrder) {
        case 'overspent':
            budgetCardsData.sort((a, b) => a.remaining - b.remaining);
            break;
        case 'percent_desc':
            budgetCardsData.sort((a, b) => b.progress - a.progress);
            break;
        case 'remaining_asc':
             budgetCardsData.sort((a, b) => a.remaining - b.remaining);
            break;
    }
    
    budgetCardsData.forEach(data => {
        let statusClass = 'good';
        if (data.progress > 100) statusClass = 'over';
        else if (data.progress > 75) statusClass = 'warning';
        
        const remainingText = data.remaining >= 0 
            ? `<span class="budget-status remaining">${fmtRM(data.remaining)} left</span>`
            : `<div class="tooltip-container">
                   <span class="budget-status overspent" onclick="fixOverBudget('${data.category}')">
                       ${fmtRM(Math.abs(data.remaining))} over
                   </span>
                   <span class="tooltip-text">Click to increase budget to match spending. This will use funds from "Left To Assign".</span>
               </div>`;
        
        const relevantExpenses = expenses.filter(e => e.category === data.category && !e.isExcluded);
        let tooltipContent = '';
        if (relevantExpenses.length > 0) {
            tooltipContent = '<ul>';
            relevantExpenses.forEach(exp => {
                const description = exp.description || 'Unspecified Expense';
                tooltipContent += `<li><span>${description}</span> <strong>${fmtRM(exp.myShare)}</strong></li>`;
            });
            tooltipContent += '</ul>';
        } else {
            tooltipContent = 'No expenses recorded for this category yet.';
        }

        const titleHTML = `
            <div class="tooltip-container">
                <h5>${data.categoryName}</h5>
                <span class="tooltip-text">${tooltipContent}</span>
            </div>
        `;

        const card = document.createElement('div');
        card.id = `budget-card-${data.category}`;
        card.className = `budget-card ${data.isUnbudgetedAndSpent ? 'unbudgeted' : ''}`;
        card.innerHTML = `
            <div class="budget-card-header">
                ${titleHTML}
                <div class="budget-input-wrapper ${data.budgetAmount > 0 ? 'has-value' : ''}">
                    <input 
                        type="number" 
                        class="form-group budget-input" 
                        placeholder="Set Budget" 
                        value="${data.budgetAmount > 0 ? data.budgetAmount : ''}"
                        oninput="this.parentElement.classList.toggle('has-value', this.value !== '')"
                        onchange="saveBudget('${data.category}', this.value)"
                        onkeydown="handleBudgetInputKeydown(event)"
                    >
                    <span class="budget-clear-icon" onclick="clearAndSaveBudget('${data.category}')">&times;</span>
                </div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill status-${statusClass}" style="width: ${Math.min(data.progress, 100)}%;">
                    ${data.progress > 0 || data.budgetAmount > 0 ? data.progress.toFixed(0) + '%' : ''}
                </div>
            </div>
            <div class="budget-details">
                <span>Spent: ${fmtRM(data.spentAmount)} of ${fmtRM(data.budgetAmount)}</span>
                ${remainingText}
            </div>
        `;
        container.appendChild(card);
    });
    
    // --- START: MODIFIED/FIXED SUMMARY CALCULATION LOGIC ---
    const totalBudgeted = Object.values(budgets).reduce((sum, b) => sum + b, 0);
    const totalSpent = Object.values(categorySpending).reduce((sum, s) => sum + s, 0);
    
    const prevPeriod = getPreviousMonthPeriod(currentPayPeriod);
    const prevOTEntries = JSON.parse(localStorage.getItem(`overtimeEntries_${prevPeriod}`) || '[]');
    const totalOT = prevOTEntries.reduce((sum, e) => sum + e.amount, 0);
    const netIncome = getNetIncome(totalOT, false);

    // Main summary values (Planned View)
    const remainingInPlannedBudget = totalBudgeted - totalSpent;
    const plannedLeftToAssign = netIncome - totalBudgeted;

    // Detailed calculations for "Real" and "Effective" values
    let totalOverspend = 0;
    let realRemainingInPositiveCategories = 0;
    const allRelevantCategories = new Set([...Object.keys(budgets), ...Object.keys(categorySpending)]);

    allRelevantCategories.forEach(category => {
        const spent = categorySpending[category] || 0;
        const budget = budgets[category] || 0;
        const remaining = budget - spent;

        if (remaining < 0) {
            totalOverspend += Math.abs(remaining);
        } else if (budget > 0) { // Only count remaining from categories that actually have a budget
            realRemainingInPositiveCategories += remaining;
        }
    });

    // Update the main summary cards with the PLANNED values
    const summaryItems = summaryContainer.querySelectorAll('.summary-item');
    summaryItems[0].querySelector('div[style*="font-size: 1.8em"]').textContent = fmtRM(totalBudgeted);
    summaryItems[1].querySelector('div[style*="font-size: 1.8em"]').textContent = fmtRM(totalSpent);
    const remainingDiv = summaryItems[2].querySelector('div[style*="font-size: 1.8em"]');
    remainingDiv.textContent = fmtRM(remainingInPlannedBudget);
    remainingDiv.style.color = remainingInPlannedBudget >= 0 ? '#28a745' : '#dc3545';
    const leftToAssignDiv = summaryItems[3].querySelector('div[style*="font-size: 1.8em"]');
    leftToAssignDiv.textContent = fmtRM(plannedLeftToAssign);
    leftToAssignDiv.style.color = plannedLeftToAssign >= 0 ? '#6c757d' : '#dc3545';


    // Now, handle the conditional "Overbudget Impact" card (Real View)
    if (totalOverspend > 0) {
        const effectiveLeftToAssign = plannedLeftToAssign - totalOverspend;
        
        document.getElementById('expectedRemainingBudget').textContent = fmtRM(realRemainingInPositiveCategories);
        document.getElementById('expectedRemainingBudget').style.color = realRemainingInPositiveCategories >= 0 ? '#28a745' : '#dc3545';
        
        document.getElementById('expectedLeftToAssign').textContent = fmtRM(effectiveLeftToAssign);
        document.getElementById('expectedLeftToAssign').style.color = effectiveLeftToAssign >= 0 ? '#28a745' : '#dc3545';
        
        overbudgetCard.style.display = 'grid';
    } else {
        overbudgetCard.style.display = 'none';
    }
    // --- END: MODIFIED/FIXED SUMMARY CALCULATION LOGIC ---

    applyTruncationTooltips('.budget-card-header h5');
}


function quickAddExpenseForCategory(category) {
    // Switch to the expenses tab
    switchTab('expenses');
    // Switch to the expenses tracker sub-tab
    switchSubTab('expenses-tracker', 'expenses-tab');
    
    // Set the category dropdown value
    document.getElementById('expenseCategory').value = category;
    
    // Focus the amount input field to streamline data entry
    document.getElementById('myShare').focus();
}

function quickSetUnbudgetedBudgets() {
    if (!confirm("This will create a budget for each unbudgeted category, setting the budget equal to the amount already spent. This is a great way to adjust your plan to reality. Continue?")) {
        return;
    }
    
    const categorySpending = expenses
        .filter(e => !e.isExcluded)
        .reduce((acc, expense) => {
            acc[expense.category] = (acc[expense.category] || 0) + expense.myShare;
            return acc;
        }, {});
        
    let categoriesFixed = 0;
    for (const category in categorySpending) {
        const spentAmount = categorySpending[category];
        const budgetAmount = budgets[category] || 0;
        
        if (spentAmount > 0 && budgetAmount === 0) {
            budgets[category] = spentAmount;
            categoriesFixed++;
        }
    }
    
    if (categoriesFixed > 0) {
        saveDataForPeriod(currentPayPeriod);
        displayBudgets();
        updateDashboard();
        displayBudgetSnapshot(); // Refresh the snapshot on the other tab
        showToast(`${categoriesFixed} unbudgeted categor(y/ies) have been updated!`);
    }
}

function addBudgetCategoryCard() {
    const select = document.getElementById('addBudgetCategory');
    const category = select.value;
    if (!category) return;

    if (document.getElementById(`budget-card-${category}`)) {
        showToast("This category is already displayed.", "info");
        return;
    }
    
    if (!budgets[category]) {
        budgets[category] = 0; // Temporarily add to budgets to make it appear
    }
    displayBudgets();

    const newCardInput = document.querySelector(`#budget-card-${category} .budget-input`);
    if (newCardInput) {
        newCardInput.focus();
        newCardInput.select();
    }
}


function copyLastMonthBudgets() {
    const prevPeriod = getPreviousMonthPeriod(currentPayPeriod);
    const prevBudgets = localStorage.getItem(`budgets_${prevPeriod}`);

    if (!prevBudgets) {
        alert(`No budget data found for the previous month (${prevPeriod}).`);
        return;
    }

    if (confirm(`This will overwrite your current budgets for this month with the data from ${prevPeriod}. Continue?`)) {
        budgets = JSON.parse(prevBudgets);
        saveDataForPeriod(currentPayPeriod);
        displayBudgets();
        updateDashboard();
        showToast(`Budgets from ${prevPeriod} have been copied.`);
    }
}

// --- ALLOCATION PLANNER ---
function launchAllocationPlanner() {
    const modal = document.getElementById('allocation-modal');
    const grid = document.getElementById('allocationGrid');
    const netIncomeEl = document.getElementById('allocNetIncome');
    grid.innerHTML = '';

    const prevPeriod = getPreviousMonthPeriod(currentPayPeriod);
    const prevOTEntries = JSON.parse(localStorage.getItem(`overtimeEntries_${prevPeriod}`) || '[]');
    const totalOT = prevOTEntries.reduce((sum, e) => sum + e.amount, 0);
    const netIncome = getNetIncome(totalOT, false);
    netIncomeEl.textContent = fmtRM(netIncome);

    const allCategories = [...Object.entries(categoryConfig), ...customCategories.map(c => [c.value, c])];

    allCategories.forEach(([value, { name, icon }]) => {
        const currentBudget = budgets[value] || 0;
        const item = document.createElement('div');
        item.className = 'allocation-item';
        item.innerHTML = `
            <label for="alloc-${value}">${icon} ${name}</label>
            <input type="number" id="alloc-${value}" data-category="${value}" class="form-group" value="${currentBudget > 0 ? currentBudget : ''}" placeholder="0.00" oninput="updateAllocationTotals()">
        `;
        grid.appendChild(item);
    });

    updateAllocationTotals();
    modal.style.display = 'flex';
}

function updateAllocationTotals() {
    const netIncome = parseFloat(document.getElementById('allocNetIncome').textContent.replace(/[^0-9.-]+/g,""));
    const assignedEl = document.getElementById('allocAssigned');
    const remainingEl = document.getElementById('allocRemaining');

    let totalAssigned = 0;
    document.querySelectorAll('#allocationGrid input').forEach(input => {
        totalAssigned += parseFloat(input.value) || 0;
    });

    const remaining = netIncome - totalAssigned;

    assignedEl.textContent = fmtRM(totalAssigned);
    remainingEl.textContent = fmtRM(remaining);

    remainingEl.classList.remove('positive', 'negative');
    if (Math.abs(remaining) < 0.01) {
        remainingEl.classList.add('positive');
    } else if (remaining < 0) {
        remainingEl.classList.add('negative');
    }
}

function applyAllocation() {
    const newBudgets = {};
    document.querySelectorAll('#allocationGrid input').forEach(input => {
        const amount = parseFloat(input.value) || 0;
        if (amount > 0) {
            newBudgets[input.dataset.category] = amount;
        }
    });
    budgets = newBudgets;
    saveDataForPeriod(currentPayPeriod);
    displayBudgets();
    updateDashboard();
    closeAllocationModal();
    showToast('Monthly budget plan has been applied!');
}

function closeAllocationModal() {
    document.getElementById('allocation-modal').style.display = 'none';
}

function switchSubTab(subTabName, mainContainerId) {
    const mainContainer = document.getElementById(mainContainerId);
    if (!mainContainer) return;

    // Deactivate all sub-tabs and content within this main tab
    mainContainer.querySelectorAll('.sub-tab').forEach(tab => tab.classList.remove('active'));
    mainContainer.querySelectorAll('.sub-tab-content').forEach(content => content.classList.remove('active'));

    // Activate the selected one
    mainContainer.querySelector(`#sub-tab-btn-${subTabName}`).classList.add('active');
    mainContainer.querySelector(`#${subTabName}-sub-tab-content`).classList.add('active');
    
    // BUG FIX: If switching to the budgeting view, re-apply tooltips after the content is visible.
    if (subTabName === 'budgeting-view') {
        // Use a minimal timeout to allow the browser to render the now-visible elements
        setTimeout(() => {
            applyTruncationTooltips('.budget-card-header h5');
        }, 0);
    }
}

// --- PATCH ---
// This function handles importing data from a file.
// Instead of reloading the page, it now uses our robust `fullAppRefresh` function
// for a seamless update without a full page reload.
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
                event.target.value = ''; // Reset file input
                return;
            }
            
            localStorage.clear();
            
            for (const key in importedData) {
                if (Object.prototype.hasOwnProperty.call(importedData, key)) {
                    localStorage.setItem(key, importedData[key]);
                }
            }
            
            showToast('Data imported successfully! Refreshing UI...');
            
            // --- The Fix ---
            // Instead of reloading the whole page, we call the master refresh function.
            // This is faster, avoids cache issues, and provides a better user experience.
            fullAppRefresh();
            
        } catch (error) {
            alert('Error parsing JSON file. Please make sure it is a valid backup file.');
            console.error("Import error:", error);
        } finally {
            event.target.value = ''; // Reset file input
        }
    };
    reader.readAsText(file);
}