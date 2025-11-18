// --- CALENDAR LOGIC ---
function initializeCalendar() {
    const calendarEl = document.getElementById('otCalendar');
    otCalendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        firstDay: 1,
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

// NEW: keep calendar centered on the current OT window
function focusCalendarOnCurrentOTWindow() {
    if (!otCalendar || typeof getCurrentOTWindow !== 'function') return;

    const win = getCurrentOTWindow();
    if (!win || !win.start) return;

    const start = new Date(win.start);
    if (isNaN(start.getTime())) return;

    // This tells FullCalendar to show the month that contains the OT start date
    otCalendar.gotoDate(start);
}

function adjustOTFromCalendar(entryId, amount) {
    const entryIndex = overtimeEntries.findIndex(e => e.id === entryId);
    if (entryIndex === -1) return;

    const entry = overtimeEntries[entryIndex];
    const newHours = round2(entry.hours + amount);

    if (newHours < 0) return;

    entry.hours = newHours;

    const hourlyRate = getHourlyRate();
    if (hourlyRate > 0) {
        entry.amount = round2(entry.hours * entry.rate * hourlyRate);
    }

    if (entry.startTime) {
        entry.endTime = addHoursToTime(entry.startTime, entry.hours);
    }

    if (entry.hours === 0) {
        if (confirm("Hours are zero. Do you want to delete this entry?")) {
            overtimeEntries.splice(entryIndex, 1);
        } else {
            entry.hours = round2(entry.hours - amount);
            return;
        }
    }

    saveDataForPeriod(currentPayPeriod);
    displayOTEntries();
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
    if (currentPercentages.reduce((a, b) => a + b, 0) !== 100) {
        if (!isSilent) alert("OT allocation percentages must sum to 100%. Please adjust the values.");
        return;
    }

    const totalTargetEarnings = parseFloat(document.getElementById('targetOTEarnings').value) || 0;
    
    const projectSelect = document.getElementById('defaultProject');
    const selectedProjects = Array.from(projectSelect.selectedOptions).map(option => option.value);

    if (selectedProjects.length === 0) {
        alert('Please select at least one Project/Task Name.');
        return;
    }
    
    // Save the latest selection for persistence
    lastSelectedProjects = selectedProjects;
    localStorage.setItem('lastSelectedProjects', JSON.stringify(lastSelectedProjects));

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
            const entriesForRate = allocateOTHours(targetForRate, selectedProjects, startDate, endDate, strategy, rate, dayType, isSilent, randomizeDuration);
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
    const dateStr = toLocalDateString(date);
    const year = date.getFullYear().toString();

    if (salaryData.customPublicHolidays && salaryData.customPublicHolidays.includes(dateStr)) {
        return 'publicHoliday';
    }

    if (publicHolidays[year] && publicHolidays[year].includes(dateStr)) {
        return 'publicHoliday';
    }
    
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

function allocateOTHours(targetAmount, selectedProjects, startDateStr, endDateStr, strategy, specificRate, dayType, isSilent, randomizeDuration = true) {
    const hourlyRate = getHourlyRate();
    if (hourlyRate <= 0) return [];
    
    const limits = readHourLimits();

    let potentialDays = [];
    let currentDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    while (currentDate <= endDate) {
        const currentDayType = getDayTypeFromDate(new Date(currentDate));
        let rate;
        let isWeekend;

        switch(currentDayType) {
            case 'publicHoliday':
                rate = 2.0;
                isWeekend = true;
                break;
            case 'sunday':
                rate = 0.5;
                isWeekend = true;
                break;
            case 'saturday':
                rate = 1.5;
                isWeekend = true;
                break;
            default: // weekday
                rate = 1.5;
                isWeekend = false;
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

    const entries = potentialDays.map(day => {
        const randomProject = selectedProjects[Math.floor(Math.random() * selectedProjects.length)];
        return {
            id: generateId(),
            date: day.date.toISOString().split('T')[0],
            dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.date.getDay()],
            rate: day.rate,
            isWeekend: day.isWeekend,
            hours: 0,
            amount: 0,
            remarks: `${randomProject} - [${generateTicketId()}] ${generateTaskDescription()}`,
            limit: day.limit
        };
    });

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

// --- Advanced Task Description Generation ---

const taskTemplates = {
    investigation: [
        "Investigating performance bottleneck in {SYSTEM}",
        "Troubleshooting {ISSUE} related to the {SYSTEM}",
        "Analyzing logs for {ISSUE} on the production server",
        "Replicating customer-reported bug in {SYSTEM}",
        "Performing root cause analysis for outage on {SYSTEM}"
    ],
    development: [
        "Implementing new {FEATURE} feature for the {SYSTEM}",
        "Refactoring the {SYSTEM} to improve performance",
        "Writing unit tests for the {MODULE} module",
        "Developing API endpoints for the new {FEATURE}",
        "Integrating third-party service into the {SYSTEM}"
    ],
    maintenance: [
        "Applying security patch {CVE} to production servers",
        "Running database maintenance scripts on {SYSTEM}",
        "Updating dependencies for the {MODULE} module",
        "Clearing down application cache on the {SYSTEM}",
        "Performing scheduled system health checks"
    ],
    deployment: [
        "Deploying version {VERSION} of {SYSTEM} to staging environment",
        "Preparing production release for the new {FEATURE}",
        "Rolling back failed deployment of {MODULE}",
        "Monitoring post-deployment metrics for {SYSTEM}",
        "Updating deployment pipeline configurations"
    ]
};

const taskComponents = {
    SYSTEM: ["authentication service", "API gateway", "PostgreSQL database", "user dashboard", "reporting engine", "payment processor"],
    ISSUE: ["intermittent 503 errors", "a memory leak", "a slow database query", "incorrect data rendering", "a security vulnerability"],
    FEATURE: ["user profile page", "data export functionality", "two-factor authentication", "search filter enhancements"],
    MODULE: ["user authentication", "data processing", "notification service", "billing"],
    CVE: ["CVE-2025-1011", "CVE-2025-2435", "CVE-2025-3891"],
    VERSION: ["2.1.5", "3.0.1", "1.9.8"]
};

function generateTicketId() {
    const prefixes = ["PROJ", "JIRA", "TASK", "SUP"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const number = Math.floor(Math.random() * 9000) + 1000;
    return `${prefix}-${number}`;
}

function generateTaskDescription() {
    const categories = Object.keys(taskTemplates);
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const templates = taskTemplates[randomCategory];
    let description = templates[Math.floor(Math.random() * templates.length)];

    // Find and replace all placeholders
    const placeholders = description.match(/{(\w+)}/g);
    if (placeholders) {
        placeholders.forEach(placeholder => {
            const key = placeholder.replace(/[{}]/g, '');
            if (taskComponents[key]) {
                const options = taskComponents[key];
                const randomOption = options[Math.floor(Math.random() * options.length)];
                description = description.replace(placeholder, randomOption);
            }
        });
    }
    return description;
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
        // NEW: follow the OT window (month of OT start date)
        focusCalendarOnCurrentOTWindow();
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
                break;
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
    
    updateOTModalCalculations(); // Calculate initial earnings display
    
    const totalOTEarnings = overtimeEntries.reduce((total, currentEntry) => total + (currentEntry.amount || 0), 0);
    const totalEarningsDisplay = document.getElementById('otEditTotalEarningsDisplay');
    if (totalEarningsDisplay) {
        totalEarningsDisplay.textContent = fmtRM(totalOTEarnings);
    }
    
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
    updateOTModalCalculations('hours');
}

function updateOTModalCalculations(source) {
    const startTimeInput = document.getElementById('otEditStartTime');
    const endTimeInput = document.getElementById('otEditEndTime');
    const hoursInput = document.getElementById('otEditHours');
    const rate = parseFloat(document.getElementById('otEditRate').value) || 1.5;
    const earningsDisplay = document.getElementById('otEditEarningsDisplay');
    const totalEarningsDisplay = document.getElementById('otEditTotalEarningsDisplay');

    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;
    let hours = parseFloat(hoursInput.value) || 0;

    if (source === 'time' && startTime && endTime) {
        const start = new Date(`1970-01-01T${startTime}`);
        const end = new Date(`1970-01-01T${endTime}`);
        
        if (end < start) { // Handle overnight case
            end.setDate(end.getDate() + 1);
        }
        
        const diffMs = end - start;
        const rawHours = diffMs / (1000 * 60 * 60);
        hours = Math.round(rawHours * 4) / 4; // Round to nearest 15 minutes
        hoursInput.value = hours.toFixed(2);
    } else if (source === 'hours' && startTime && hours >= 0) {
        const newEndTime = addHoursToTime(startTime, hours);
        endTimeInput.value = newEndTime;
    }
    
    const hourlyRate = getHourlyRate();
    const amountForThisEntry = hours * rate * hourlyRate;
    
    if (earningsDisplay) {
        earningsDisplay.textContent = fmtRM(amountForThisEntry);
    }

    if (totalEarningsDisplay) {
        const entryId = document.getElementById('otEditId').value;
        
        const otherEntriesTotal = overtimeEntries
            .filter(entry => entry.id !== entryId)
            .reduce((total, currentEntry) => total + (currentEntry.amount || 0), 0);
            
        const newGrandTotal = otherEntriesTotal + amountForThisEntry;
        
        totalEarningsDisplay.textContent = fmtRM(newGrandTotal);
    }
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
    
    // Fallback calculation, though the modal should be correct already
    if (entry.startTime && entry.endTime) {
        const start = new Date(`${entry.date}T${entry.startTime}:00`);
        const end = new Date(`${entry.date}T${entry.endTime}:00`);
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

