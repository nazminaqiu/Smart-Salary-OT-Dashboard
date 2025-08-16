// --- Global Variables ---
    let publicHolidays = [];
    let calculatedDailyHours = [];
    let lastGeneratedRates = {};
    let lastGeneratedAllHolidays = [];
    let expensePieChart;
    let months = [];
    let expenseSort = { key: 'date', order: 'desc' };
    let editingExpenseId = null;
    let editingPatternId = null;
    let activeSplitMode = 'i-paid';

    // --- Static Data ---
    const expenseCategories = ["Food & Dining", "Transportation", "Bills & Utilities", "Housing", "Shopping", "Entertainment", "Health & Fitness", "Personal Care", "Education", "Miscellaneous"];

    const categoryKeywords = {
        'Bills & Utilities': ['tnb', 'air selangor', 'indah water', 'wifi', 'unifi', 'time', 'celcom', 'maxis', 'digi', 'u mobile', 'postpaid', 'bill'],
        'Food & Dining': ['food', 'grabfood', 'foodpanda', 'mcdonalds', 'kfc', 'starbucks', 'coffee', 'grocer', 'jaya grocer', 'tesco', 'aeon', 'giant', 'groceries', 'restaurant', 'lunch', 'dinner', 'breakfast'],
        'Transportation': ['petrol', 'shell', 'petronas', 'caltex', 'bhp', 'mrt', 'lrt', 'ktm', 'grab', 'touch n go', 'parking', 'toll'],
        'Shopping': ['shopee', 'lazada', 'zalora', 'uniqlo', 'ikea', 'mr diy', 'decathlon', 'fashion', 'clothes'],
        'Health & Fitness': ['gym', 'fitness', 'pharmacy', 'caring', 'watsons', 'guardian', 'clinic', 'hospital', 'doctor'],
        'Entertainment': ['netflix', 'spotify', 'youtube', 'disney+', 'cinema', 'tgv', 'gsc', 'movie', 'concert'],
        'Housing': ['rent', 'maintenance', 'coway', 'cuckoo'],
        'Personal Care': ['haircut', 'salon', 'barber'],
        'Miscellaneous': ['pengasuh', 'babysitter', 'donation', 'duit raya']
    };


    // --- OT Pattern Data ---
    const otPatterns = {
        predefined: [
            { id: 'crunch', name: '🚀 Project Crunch Week', pattern: [4, 5, 6, 5, 4, 0, 0], description: 'High intensity on weekdays to meet project deadlines. Weekends are free.' },
            { id: 'warrior', name: '⚡ Weekend Warrior', pattern: [0, 0, 0, 0, 0, 8, 8], description: 'Focuses all overtime on Saturday and Sunday for maximum impact with free weekdays.' },
            { id: 'steady', name: '🌱 Steady Grind', pattern: [3, 3, 3, 3, 3, 4, 0], description: 'A balanced approach with moderate, consistent overtime on weekdays and a short Saturday.' },
            { id: 'maximizer', name: '🆘 Emergency Sprint', pattern: [4, 4, 4, 4, 4, 8, 8], description: 'Maximum effort. High hours every day of the week to maximize earnings quickly.' }
        ],
        custom: [] // Loaded from localStorage
    };

    // --- Data Model & Persistence ---
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
    
    months = generateMonths(2024, 2027);

    const defaultParams = {
      basic: 3700.00,
      claims: 0.00,
      hpAllow: 80.00,
      incentive: 500.00,
      advance: 500.00,
      hourly: 3700.00 / 208,
      incomeGoal: 9500.00,
      desiredSavings: 1500.00,
      smartGoalEnabled: false,
      epf: 407.00,
      socso: 29.75,
      pcb: 534.30,
      eis: 11.90,
      epf_pct: 3.73,
      socso_pct: 0.27,
      pcb_pct: 4.89,
      eis_pct: 0.11,
      deductionMode: 'actual',
      payPeriodStart: '',
      payPeriodEnd: ''
    };

    const mockHolidayAPI = {
        "2025": [ { date: '2025-01-01', name: 'New Year\'s Day' }, { date: '2025-01-21', name: 'Thaipusam' }, { date: '2025-01-29', name: 'Chinese New Year' }, { date: '2025-01-30', name: 'Chinese New Year Day 2' }, { date: '2025-03-29', name: 'Nuzul Al-Quran' }, { date: '2025-03-31', name: 'Hari Raya Aidilfitri' }, { date: '2025-04-01', name: 'Hari Raya Aidilfitri Day 2' }, { date: '2025-05-01', name: 'Labour Day' }, { date: '2025-05-12', name: 'Wesak Day' }, { date: '2025-06-02', name: 'Agong\'s Birthday' }, { date: '2025-06-07', name: 'Hari Raya Haji' }, { date: '2025-06-27', name: 'Awal Muharram' }, { date: '2025-08-31', name: 'Merdeka Day Holiday' }, { date: '2025-09-01', name: 'Merdeka Day' }, { date: '2025-09-05', name: 'Prophet Muhammad\'s Birthday' }, { date: '2025-09-16', name: 'Malaysia Day' }, { date: '2025-10-20', name: 'Deepavali' }, { date: '2025-12-11', name: 'Sultan of Selangor\'s Birthday' }, { date: '2025-12-25', name: 'Christmas Day' } ],
        "2026": [ { date: '2026-01-01', name: 'New Year\'s Day' }, { date: '2026-02-17', name: 'Chinese New Year' }, { date: '2026-02-18', name: 'Chinese New Year Day 2' }, { date: '2026-03-20', name: 'Hari Raya Aidilfitri' }, { date: '2026-03-21', name: 'Hari Raya Aidilfitri Day 2' }, { date: '2026-05-01', name: 'Labour Day' }, { date: '2026-05-02', name: 'Wesak Day' }, { date: '2026-05-28', name: 'Hari Raya Haji' }, { date: '2026-06-01', name: 'Agong\'s Birthday' }, { date: '2026-07-16', name: 'Awal Muharram' }, { date: '2026-08-31', name: 'Merdeka Day' }, { date: '2026-09-16', name: 'Malaysia Day' }, { date: '2026-09-24', name: 'Prophet Muhammad\'s Birthday' }, { date: '2026-11-08', name: 'Deepavali' }, { date: '2026-12-11', name: 'Sultan of Selangor\'s Birthday' }, { date: '2026-12-25', name: 'Christmas Day' } ],
        "2027": [ { date: '2027-01-01', name: 'New Year\'s Day' }, { date: '2027-02-06', name: 'Chinese New Year' }, { date: '2027-02-07', name: 'Chinese New Year Day 2' }, { date: '2027-03-10', name: 'Hari Raya Aidilfitri' }, { date: '2027-03-11', name: 'Hari Raya Aidilfitri Day 2' }, { date: '2027-05-01', name: 'Labour Day' }, { date: '2027-05-18', name: 'Hari Raya Haji' }, { date: '2027-05-21', name: 'Wesak Day' }, { date: '2027-06-07', name: 'Agong\'s Birthday' }, { date: '2027-07-06', name: 'Awal Muharram' }, { date: '2027-08-31', name: 'Merdeka Day' }, { date: '2027-09-14', name: 'Prophet Muhammad\'s Birthday' }, { date: '2027-09-16', name: 'Malaysia Day' }, { date: '2027-10-28', name: 'Deepavali' }, { date: '2027-12-11', name: 'Sultan of Selangor\'s Birthday' }, { date: '2027-12-25', name: 'Christmas Day' } ]
    };

    function loadState() {
      const raw = localStorage.getItem('salary-ot-state-v5');
      let parsedState;
      try { parsedState = JSON.parse(raw); } catch(e) { parsedState = null; }

      if (!parsedState) {
        const state = { params: {}, ot: {}, expenses: {}, customPatterns: [], budgets: {}, expensesInitialized: {} };
        months.forEach(m => {
          state.params[m.key] = { ...defaultParams };
        });
        return state;
      }
      
      months.forEach(m => {
        if (!parsedState.params[m.key]) {
            parsedState.params[m.key] = { ...defaultParams };
        } else {
            parsedState.params[m.key] = { ...defaultParams, ...parsedState.params[m.key] };
        }

        if (!parsedState.params[m.key].payPeriodStart || !parsedState.params[m.key].payPeriodEnd) {
            const [year, month] = m.key.split('-').map(Number);
            const startDate = new Date(year, month - 3, 26);
            const endDate = new Date(year, month - 2, 25);
            parsedState.params[m.key].payPeriodStart = formatDateToYyyyMmDd(startDate);
            parsedState.params[m.key].payPeriodEnd = formatDateToYyyyMmDd(endDate);
        }
        
        if (!parsedState.ot[m.key]) parsedState.ot[m.key] = [];
        if (!parsedState.expenses) parsedState.expenses = {};
        if (!parsedState.expenses[m.key]) parsedState.expenses[m.key] = [];
        else {
             parsedState.expenses[m.key].forEach(exp => {
                if (typeof exp.wifeShare !== 'undefined') {
                    exp.partnerShare = exp.wifeShare;
                    delete exp.wifeShare;
                }
             });
        }
        
        if (!parsedState.budgets) parsedState.budgets = {};
        if (!parsedState.budgets[m.key]) parsedState.budgets[m.key] = {};
      });

      if (!parsedState.customPatterns) parsedState.customPatterns = [];
      otPatterns.custom = parsedState.customPatterns;
      
      if (!parsedState.expensesInitialized) parsedState.expensesInitialized = {};

      return parsedState;
    }
    
    function saveState() { 
      state.customPatterns = otPatterns.custom;
      localStorage.setItem('salary-ot-state-v5', JSON.stringify(state));
    }

    let state = loadState();

    // --- UI Elements ---
    const monthSelect = document.getElementById('monthSelect');
    const monthLabel = document.getElementById('monthLabel');
    const expensesMonthLabel = document.getElementById('expensesMonthLabel');
    const basic = document.getElementById('basic');
    const claims = document.getElementById('claims');
    const hpAllow = document.getElementById('hpAllow');
    const incentive = document.getElementById('incentive');
    const advance = document.getElementById('advance');
    const hourly = document.getElementById('hourly');
    const incomeGoal = document.getElementById('incomeGoal');
    const desiredSavings = document.getElementById('desiredSavings');
    const smartGoalToggle = document.getElementById('smartGoalToggle');
    const epf = document.getElementById('epf');
    const socso = document.getElementById('socso');
    const pcb = document.getElementById('pcb');
    const eis = document.getElementById('eis');
    const epfLabel = document.getElementById('epfLabel');
    const socsoLabel = document.getElementById('socsoLabel');
    const pcbLabel = document.getElementById('pcbLabel');
    const eisLabel = document.getElementById('eisLabel');
    const saveParamsBtn = document.getElementById('saveParams');
    const copyLastMonthBtn = document.getElementById('copyLastMonth');
    const saveMessage = document.getElementById('saveMessage');
    const addRowBtn = document.getElementById('addRow');
    const clearRowsBtn = document.getElementById('clearRows');
    const otTableBody = document.querySelector('#otTable tbody');
    const payPeriodStart = document.getElementById('payPeriodStart');
    const payPeriodEnd = document.getElementById('payPeriodEnd');
    const grossOut = document.getElementById('grossOut');
    const deductOut = document.getElementById('deductOut');
    const netOut = document.getElementById('netOut');
    const expensesOut = document.getElementById('expensesOut');
    const balanceOut = document.getElementById('balanceOut');
    const incomeGoalVisualizer = document.getElementById('incomeGoalVisualizer');
    const progressBarFill = document.getElementById('progressBarFill');
    const progressBarText = document.getElementById('progressBarText');
    const hoursToGoalHelper = document.getElementById('hoursToGoalHelper');
    const b = { basic: document.getElementById('bBasic'), claims: document.getElementById('bClaims'), hp: document.getElementById('bHP'), inc: document.getElementById('bIncen'), ot: document.getElementById('bOT'), gross: document.getElementById('bGross'), epf: document.getElementById('bEPF'), socso: document.getElementById('bSOCSO'), pcb: document.getElementById('bPCB'), eis: document.getElementById('bEIS'), adv: document.getElementById('bAdv'), deduct: document.getElementById('bDeduct'), net: document.getElementById('bNet'), expenses: document.getElementById('bExpenses'), balance: document.getElementById('bBalance') };

    // --- Tab Management ---
    function switchTab(tabName, element) {
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      document.getElementById(tabName + '-tab').classList.add('active');
      element.classList.add('active');
      if (tabName === 'expenses') {
        manageRecurringExpenses(monthSelect.value);
        refresh(); // Refresh to show newly added pending expenses
      }
    }

    // --- Utility Functions ---
    function fmt(n) { return (Number(n)||0).toFixed(2); }
    function fmtDisplay(n) { return `RM ${fmt(n)}`; }
    function formatDateToYyyyMmDd(date) { 
      if (!date || isNaN(date.getTime())) return '';
      const year = date.getFullYear(); 
      const month = String(date.getMonth() + 1).padStart(2, '0'); 
      const day = String(date.getDate()).padStart(2, '0'); 
      return `${year}-${month}-${day}`; 
    }

    // --- Payroll Date Range Functions ---
    function getOtDateRangeObjects(monthKey) {
        const p = state.params[monthKey];
        if (p && p.payPeriodStart && p.payPeriodEnd) {
            return { startDate: new Date(p.payPeriodStart + 'T00:00:00'), endDate: new Date(p.payPeriodEnd + 'T00:00:00') };
        }
        const [year, month] = monthKey.split('-').map(Number);
        const startDate = new Date(year, month - 3, 26);
        const endDate = new Date(year, month - 2, 25);
        return { startDate, endDate };
    }

    function getOtDateRange(monthKey) {
        const { startDate, endDate } = getOtDateRangeObjects(monthKey);
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        return `${startDate.toLocaleDateString('en-GB', options)} - ${endDate.toLocaleDateString('en-GB', options)}`;
    }

    function updateSmartCalculatorDates(monthKey) {
        const { startDate, endDate } = getOtDateRangeObjects(monthKey);
        if (document.getElementById('startDate')._flatpickr) { document.getElementById('startDate')._flatpickr.setDate(startDate, true); }
        if (document.getElementById('endDate')._flatpickr) { document.getElementById('endDate')._flatpickr.setDate(endDate, false); }
    }

    // --- General Utility Functions ---
    function getDayOfWeek(date) { return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()]; }
    function getOvertimeTypeClass(type) { 
      if (type.includes('Rest Day')) return 'ot-restday'; 
      if (type.includes('Public Holiday')) return 'ot-holiday'; 
      if (type.includes('Off Day') || type.includes('Saturday')) return 'ot-weekend'; 
      return 'ot-weekday'; 
    }
    function roundToNearestFiveMinutes(hour, minute) { 
      let totalMinutes = hour * 60 + minute; 
      let roundedMinutes = Math.round(totalMinutes / 5) * 5; 
      return [Math.floor(roundedMinutes / 60) % 24, roundedMinutes % 60]; 
    }
    function generateRandomStartTime(dayOfWeek) { 
      let startHour = (dayOfWeek === 0 || dayOfWeek === 6) ? Math.floor(Math.random() * 9) + 9 : Math.floor(Math.random() * 6) + 18; 
      let startMinute = Math.floor(Math.random() * 60); 
      [startHour, startMinute] = roundToNearestFiveMinutes(startHour, startMinute); 
      return `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`; 
    }
    function calculateEndTime(startTime, otHours) { 
      if (!startTime) return '';
      const [startHour, startMinute] = startTime.split(':').map(Number); 
      let totalMinutes = startHour * 60 + startMinute + (otHours * 60); 
      let [endHour, endMinute] = roundToNearestFiveMinutes(0, totalMinutes); 
      return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`; 
    }
    function calculateDuration(startTime, endTime) {
        if (!startTime || !endTime) return 0;
        const start = new Date(`1970-01-01T${startTime}:00`);
        const end = new Date(`1970-01-01T${endTime}:00`);
        if (end < start) { end.setDate(end.getDate() + 1); }
        const diffMs = end - start;
        const diffHours = diffMs / (1000 * 60 * 60);
        return Math.round(diffHours * 4) / 4;
    }
    function getAllHolidays() {
        const checkedHolidays = Array.from(document.querySelectorAll('input[name="predefinedHolidays"]:checked')).map(cb => cb.value);
        return [...new Set([...publicHolidays, ...checkedHolidays])];
    }

    // --- Manual Tab Functions ---
    function showSaveMessage(message, isSuccess = true) {
      saveMessage.innerHTML = `<div class="success-message">${message}</div>`;
      saveMessage.style.display = 'block';
      setTimeout(() => { saveMessage.style.display = 'none'; }, 3000);
    }

    function loadParams(key) {
      const p = state.params[key];
      basic.value = p.basic; 
      claims.value = p.claims; 
      hpAllow.value = p.hpAllow; 
      incentive.value = p.incentive; 
      advance.value = p.advance;
      hourly.value = p.hourly.toFixed(4); 
      incomeGoal.value = p.incomeGoal;
      desiredSavings.value = p.desiredSavings;
      smartGoalToggle.checked = p.smartGoalEnabled;
      payPeriodStart._flatpickr.setDate(p.payPeriodStart, false);
      payPeriodEnd._flatpickr.setDate(p.payPeriodEnd, false);
      updateDeductionUI(p.deductionMode);
      updateSmartGoalUI();
    }
    
    function saveParams(key) {
      const params = state.params[key];
      params.basic = Number(basic.value||0);
      params.claims = Number(claims.value||0);
      params.hpAllow = Number(hpAllow.value||0);
      params.incentive = Number(incentive.value||0);
      params.advance = Number(advance.value||0);
      params.hourly = Number(hourly.value||0);
      params.incomeGoal = Number(incomeGoal.value||0);
      params.desiredSavings = Number(desiredSavings.value || 0);
      params.smartGoalEnabled = smartGoalToggle.checked;
      params.payPeriodStart = formatDateToYyyyMmDd(payPeriodStart._flatpickr.selectedDates[0]);
      params.payPeriodEnd = formatDateToYyyyMmDd(payPeriodEnd._flatpickr.selectedDates[0]);

      if (params.deductionMode === 'actual') {
        params.epf = Number(epf.value||0);
        params.socso = Number(socso.value||0);
        params.pcb = Number(pcb.value||0);
        params.eis = Number(eis.value||0);
      } else {
        params.epf_pct = Number(epf.value||0);
        params.socso_pct = Number(socso.value||0);
        params.pcb_pct = Number(pcb.value||0);
        params.eis_pct = Number(eis.value||0);
      }
      
      saveState();
      showSaveMessage('✅ Settings saved successfully!');
      refresh();
    }

    function renderOT(key) {
      otTableBody.innerHTML = '';
      const p = state.params[key];
      const rows = state.ot[key] || [];
      const { startDate, endDate } = getOtDateRangeObjects(key);

      if (rows.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td colspan="8" style="text-align: center; padding: 40px; color: var(--muted);">
            <div style="font-size: 48px; margin-bottom: 16px;">⏰</div>
            <h4 style="color: var(--text); margin: 0 0 8px 0;">No Overtime Yet</h4>
            <p style="margin: 0;">Click '➕ Add Row' or a 'Quick Add' button to log your first session.</p>
          </td>
        `;
        otTableBody.appendChild(tr);
        document.getElementById('otTotal').textContent = fmtDisplay(0);
        return;
      }
      
      rows.forEach((r, idx) => {
        const tr = document.createElement('tr');
        const otPay = (r.hours || 0) * (r.mult || 0) * (p.hourly || 0);
        tr.innerHTML = `
          <td data-label="Date"><input type="text" value="${r.date||''}" data-idx="${idx}" data-field="date"></td>
          <td data-label="Start"><input type="time" class="time-input" value="${r.start||''}" data-idx="${idx}" data-field="start"></td>
          <td data-label="End"><input type="time" class="time-input" value="${r.end||''}" data-idx="${idx}" data-field="end"></td>
          <td data-label="Hours">
            <div class="hour-adjuster">
                <input type="number" step="0.25" value="${r.hours||0}" data-idx="${idx}" data-field="hours" min="0">
                 <div class="hour-adjuster-buttons">
                    <button data-idx="${idx}" data-action="increase">▲</button>
                    <button data-idx="${idx}" data-action="decrease">▼</button>
                </div>
            </div>
          </td>
          <td data-label="Multiplier">
            <select data-idx="${idx}" data-field="mult">
              <option value="1.0" ${r.mult==1.0?'selected':''}>1.0× Rest Day</option>
              <option value="1.5" ${r.mult==1.5?'selected':''}>1.5× Working/Off Day</option>
              <option value="2" ${r.mult==2?'selected':''}>2.0× Public Holiday</option>
            </select>
          </td>
          <td data-label="OT Pay" class="otpay" style="font-weight: 600; color: var(--accent)">${fmtDisplay(otPay)}</td>
          <td data-label="Notes"><input type="text" value="${r.notes || ''}" data-idx="${idx}" data-field="notes" placeholder="e.g., Project deployment"></td>
          <td data-label="Actions"><button class="btn ghost" data-del="${idx}" title="Remove this entry">🗑️</button></td>
        `;
        otTableBody.appendChild(tr);
      });
      
      otTableBody.querySelectorAll('input,select').forEach(el => {
        const eventType = (el.tagName === 'SELECT' || el.dataset.field === 'notes' || el.type === 'time') ? 'change' : 'input';
        el.addEventListener(eventType, e => {
          const i = Number(e.target.dataset.idx);
          const field = e.target.dataset.field;
          if (!state.ot[key][i]) return;
          
          state.ot[key][i][field] = e.target.value || '';
          
          if (field === 'date') {
              const allHolidays = getAllHolidays();
              const selectedDate = new Date(e.target.value + 'T00:00:00');
              if (!isNaN(selectedDate.getTime())) {
                  const dayOfWeek = selectedDate.getDay();
                  let newMultiplier = 1.5;
                  if (allHolidays.includes(e.target.value)) newMultiplier = 2.0;
                  else if (dayOfWeek === 0) newMultiplier = 0.5;
                  state.ot[key][i].mult = newMultiplier;
              }
          }

          if (field === 'start' || field === 'end') {
              const row = e.target.closest('tr');
              const startVal = row.querySelector('input[data-field="start"]').value;
              const endVal = row.querySelector('input[data-field="end"]').value;
              if (startVal && endVal) {
                  const duration = calculateDuration(startVal, endVal);
                  state.ot[key][i].hours = duration;
              }
          }
          
          saveState();
          refresh();
        });
      });
      
      otTableBody.querySelectorAll('.hour-adjuster-buttons button').forEach(btn => {
          btn.addEventListener('click', e => {
              const key = monthSelect.value;
              const idx = Number(e.target.dataset.idx);
              if (!state.ot[key][idx]) return;

              const action = e.target.dataset.action;
              
              let currentHours = parseFloat(state.ot[key][idx].hours) || 0;
              if (action === 'increase') {
                  currentHours += 0.25;
              } else if (action === 'decrease') {
                  currentHours -= 0.25;
              }
              const newHours = Math.max(0, currentHours);
              state.ot[key][idx].hours = newHours;
              
              const startTime = state.ot[key][idx].start;
              if (startTime) {
                  const newEndTime = calculateEndTime(startTime, newHours);
                  state.ot[key][idx].end = newEndTime;
              }

              saveState();
              refresh();
          });
      });
      
      otTableBody.querySelectorAll('button[data-del]').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.del);
          if (confirm('Are you sure you want to remove this OT entry?')) {
            state.ot[key].splice(i,1);
            saveState();
            refresh();
          }
        });
      });

      otTableBody.querySelectorAll('input[data-field="date"]').forEach(dateInput => {
        flatpickr(dateInput, {
            dateFormat: "Y-m-d", altInput: true, altFormat: "d M, Y",
            minDate: startDate,
            maxDate: endDate,
            onChange: (selectedDates, dateStr, instance) => instance.element.dispatchEvent(new Event('input', { bubbles: true }))
        });
      });
    }

    function totalsFor(key, previousKey = null) {
      const p = state.params[key] || defaultParams;
      const rows = state.ot[key] || [];
      const expenses = state.expenses[key] || [];
      
      const otPay = rows.reduce((s, r) => s + (Number(r.hours||0) * Number(r.mult||0) * Number(p.hourly||0)), 0);
      const gross = Number(p.basic) + Number(p.claims) + Number(p.hpAllow) + Number(p.incentive) + otPay;
      
      let epfAmt, socsoAmt, pcbAmt, eisAmt;

      if (p.deductionMode === 'estimate') {
        epfAmt = gross * (Number(p.epf_pct)/100);
        socsoAmt = gross * (Number(p.socso_pct)/100);
        pcbAmt = gross * (Number(p.pcb_pct)/100);
        eisAmt = gross * (Number(p.eis_pct)/100);
      } else { // 'actual' mode
        epfAmt = Number(p.epf);
        socsoAmt = Number(p.socso);
        pcbAmt = Number(p.pcb);
        eisAmt = Number(p.eis);
      }
      
      const deductions = epfAmt + socsoAmt + pcbAmt + eisAmt + Number(p.advance);
      const net = gross - deductions;
      
      const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount)||0), 0);
      const totalPartnerExpenses = expenses.reduce((s, e) => s + (Number(e.partnerShare)||0), 0);
      
      const balance = net - totalExpenses;
      
      let previousTotalExpenses = 0;
      if (previousKey && state.expenses[previousKey]) {
          previousTotalExpenses = state.expenses[previousKey].reduce((s, e) => s + (Number(e.amount)||0), 0);
      }

      return { otPay, gross, epfAmt, socsoAmt, pcbAmt, eisAmt, deductions, net, totalExpenses, totalPartnerExpenses, balance, previousTotalExpenses };
    }

    function refresh() {
      const key = monthSelect.value;
      const curIdx = months.findIndex(m => m.key === key);
      const prevKey = curIdx > 0 ? months[curIdx-1].key : null;
      const cur = months[curIdx];
      
      const dateRange = getOtDateRange(key);
      monthLabel.innerHTML = cur ? `${cur.fullLabel} <span class="muted small" style="font-weight: 400;">(${dateRange})</span>` : 'Unknown Month';
      expensesMonthLabel.textContent = cur ? cur.fullLabel : 'Unknown Month';
      
      updateSmartCalculatorDates(key);
      
      loadParams(key);
      renderOT(key);
      renderExpenses(key);
      renderExpenseAnalysis(key);
      generateSpendingInsights(key);

      const { otPay, gross, epfAmt, socsoAmt, pcbAmt, eisAmt, deductions, net, totalExpenses, totalPartnerExpenses, balance, previousTotalExpenses } = totalsFor(key, prevKey);
      
      document.getElementById('otTotal').textContent = fmtDisplay(otPay);
      grossOut.innerHTML = `<span class="currency">RM</span> ${fmt(gross)}`;
      deductOut.innerHTML = `<span class="currency">RM</span> ${fmt(deductions)}`;
      netOut.innerHTML = `<span class="currency">RM</span> ${fmt(net)}`;
      expensesOut.innerHTML = `<span class="currency">RM</span> ${fmt(totalExpenses)}`;
      balanceOut.innerHTML = `<span class="currency">RM</span> ${fmt(balance)}`;


      const p = state.params[key] || defaultParams;
      b.basic.textContent = fmtDisplay(p.basic);
      b.claims.textContent = fmtDisplay(p.claims);
      b.hp.textContent = fmtDisplay(p.hpAllow);
      b.inc.textContent = fmtDisplay(p.incentive);
      b.ot.textContent = fmtDisplay(otPay);
      b.gross.textContent = fmtDisplay(gross);
      b.epf.textContent = fmtDisplay(epfAmt);
      b.socso.textContent = fmtDisplay(socsoAmt);
      b.pcb.textContent = fmtDisplay(pcbAmt);
      b.eis.textContent = fmtDisplay(eisAmt);
      b.adv.textContent = fmtDisplay(p.advance);
      b.deduct.textContent = fmtDisplay(deductions);
      b.net.textContent = fmtDisplay(net);
      b.expenses.textContent = fmtDisplay(totalExpenses);
      b.balance.textContent = fmtDisplay(balance);
      
      document.getElementById('expensesMyTotal').textContent = fmtDisplay(totalExpenses);
      document.getElementById('expensesPartnerTotal').textContent = fmtDisplay(totalPartnerExpenses);

      updateSmartGoal(); 
      const updatedGoal = Number(state.params[key].incomeGoal) || 0;

      if (updatedGoal > 0) {
          incomeGoalVisualizer.style.display = 'block';
          const progress = Math.min((net / updatedGoal) * 100, 100);
          progressBarFill.style.width = `${progress}%`;
          progressBarText.textContent = `${fmtDisplay(net)} / ${fmtDisplay(updatedGoal)} (${progress.toFixed(1)}%)`;

          const remaining = updatedGoal - net;
          if (remaining > 0) {
              const hourlyRate = Number(p.hourly) || 0;
              if (hourlyRate > 0) {
                  const hours1_5x = remaining / (hourlyRate * 1.5);
                  const hours2_0x = remaining / (hourlyRate * 2.0);
                  const hours1_0x = remaining / (hourlyRate * 1.0);
                  hoursToGoalHelper.innerHTML = `You're <strong>${fmtDisplay(remaining)}</strong> away! You need ~<strong>${hours1_5x.toFixed(1)}h</strong> at 1.5x, <strong>${hours2_0x.toFixed(1)}h</strong> at 2.0x, or <strong>${hours1_0x.toFixed(1)}h</strong> at 1.0x to reach your goal. <br> <button class="btn success" style="margin-top: 8px; padding: 6px 12px; font-size: 12px;" onclick="autoScheduleToGoal()">🚀 Auto-Schedule to Goal</button>`;
                  hoursToGoalHelper.style.display = 'block';
              }
          } else {
              hoursToGoalHelper.innerHTML = '🎉 Goal Achieved!';
              hoursToGoalHelper.style.display = 'block';
          }

      } else {
          incomeGoalVisualizer.style.display = 'none';
      }
      
      updateManualHourAdjusters();
      calculateForecast();
    }

    function setDeductionMode(mode) {
        const key = monthSelect.value;
        state.params[key].deductionMode = mode;
        updateDeductionUI(mode);
        saveState();
        refresh();
    }
    
    function updateSmartGoalUI() {
        const key = monthSelect.value;
        const params = state.params[key];
        const container = document.getElementById('desiredSavingsContainer');
        const analysisBox = document.getElementById('whatIfGoalAnalysis');
        
        if (params.smartGoalEnabled) {
            container.style.display = 'block';
            analysisBox.style.display = 'block';
            incomeGoal.readOnly = true;
            incomeGoal.style.cursor = 'not-allowed';
            incomeGoal.style.color = 'var(--muted)';
        } else {
            container.style.display = 'none';
            analysisBox.style.display = 'none';
            incomeGoal.readOnly = false;
            incomeGoal.style.cursor = 'text';
            incomeGoal.style.color = 'var(--text)';
        }
    }
    
    function updateSmartGoal() {
        const key = monthSelect.value;
        const params = state.params[key];
        const analysisBox = document.getElementById('whatIfGoalAnalysis');
        
        if (params.smartGoalEnabled) {
            const { totalExpenses, net } = totalsFor(key);
            const savings = Number(params.desiredSavings) || 0;
            const newGoal = totalExpenses + savings;
            
            incomeGoal.value = newGoal.toFixed(2);

            const remainingNet = newGoal - net;
            if (remainingNet > 0) {
                const totalDeductionPct = (Number(p.epf_pct) + Number(p.socso_pct) + Number(p.pcb_pct) + Number(p.eis_pct)) / 100;
                const requiredGrossOT = remainingNet / (1 - totalDeductionPct);
                document.getElementById('goalOtValue').textContent = fmtDisplay(requiredGrossOT);
            } else {
                 document.getElementById('goalOtValue').textContent = fmtDisplay(0);
            }

            analysisBox.style.display = 'block';

            if (state.params[key].incomeGoal !== newGoal) {
                 state.params[key].incomeGoal = newGoal;
                 saveState();
                 const { net } = totalsFor(key);
                 const progress = Math.min((net / newGoal) * 100, 100);
                 progressBarFill.style.width = `${progress}%`;
                 progressBarText.textContent = `${fmtDisplay(net)} / ${fmtDisplay(newGoal)} (${progress.toFixed(1)}%)`;
            }
        } else {
            analysisBox.style.display = 'none';
        }
    }

    function updateDeductionUI(mode) {
        const key = monthSelect.value;
        const params = state.params[key];
        const estimateBtn = document.getElementById('deductionModeEstimate');
        const actualBtn = document.getElementById('deductionModeActual');

        if (mode === 'estimate') {
            estimateBtn.classList.add('active');
            actualBtn.classList.remove('active');
            epfLabel.innerHTML = '🏦 EPF (%)';
            socsoLabel.innerHTML = '🛡️ SOCSO (%)';
            pcbLabel.innerHTML = '📊 PCB (%)';
            eisLabel.innerHTML = '⚡ EIS (%)';
            epf.value = params.epf_pct;
            socso.value = params.socso_pct;
            pcb.value = params.pcb_pct;
            eis.value = params.eis_pct;
        } else { // 'actual'
            estimateBtn.classList.remove('active');
            actualBtn.classList.add('active');
            epfLabel.innerHTML = '🏦 EPF (RM)';
            socsoLabel.innerHTML = '🛡️ SOCSO (RM)';
            pcbLabel.innerHTML = '📊 PCB (RM)';
            eisLabel.innerHTML = '⚡ EIS (RM)';
            epf.value = params.epf;
            socso.value = params.socso;
            pcb.value = params.pcb;
            eis.value = params.eis;
        }
    }

    // --- Expenses Tab Functions ---
    function suggestCategory(description) {
        const lowerDesc = description.toLowerCase();
        for (const category in categoryKeywords) {
            for (const keyword of categoryKeywords[category]) {
                if (lowerDesc.includes(keyword)) {
                    return category;
                }
            }
        }
        return ''; // No match found
    }

    function calculateSplit() {
        const totalCost = parseFloat(document.getElementById('expenseTotalCost').value) || 0;
        const myShareInput = document.getElementById('expenseMyShare');
        const partnerShareInput = document.getElementById('expensePartnerShare');

        if (activeSplitMode === '50-50') {
            myShareInput.value = (totalCost / 2).toFixed(2);
            partnerShareInput.value = (totalCost / 2).toFixed(2);
        } else if (activeSplitMode === 'i-paid') {
            myShareInput.value = totalCost.toFixed(2);
            partnerShareInput.value = '0.00';
        } else if (activeSplitMode === 'p-paid') {
            myShareInput.value = '0.00';
            partnerShareInput.value = totalCost.toFixed(2);
        }
    }

    function updateSplitButtons() {
        document.querySelectorAll('.split-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.split === activeSplitMode);
        });
    }

    function generateSpendingInsights(key) {
        const insightsList = document.getElementById('insightsList');
        const insights = [];

        // Data setup
        const currentIndex = months.findIndex(m => m.key === key);
        if (currentIndex === -1) return;

        const currentExpenses = state.expenses[key] || [];
        const currentBudgets = state.budgets[key] || {};
        
        const lastMonthKey = currentIndex > 0 ? months[currentIndex - 1].key : null;
        const lastMonthExpenses = lastMonthKey ? (state.expenses[lastMonthKey] || []) : [];

        const categoryTotalsCurrent = currentExpenses.reduce((acc, exp) => {
            const category = exp.category || 'Miscellaneous';
            acc[category] = (acc[category] || 0) + exp.amount;
            return acc;
        }, {});

        const categoryTotalsLastMonth = lastMonthExpenses.reduce((acc, exp) => {
            const category = exp.category || 'Miscellaneous';
            acc[category] = (acc[category] || 0) + exp.amount;
            return acc;
        }, {});


        // 1. Budget Alerts
        for (const category in currentBudgets) {
            const budget = currentBudgets[category];
            const spent = categoryTotalsCurrent[category] || 0;
            
            if (budget > 0 && spent > 0) {
                const percentage = (spent / budget) * 100;
                if (percentage >= 100) {
                    insights.push({ type: 'danger', icon: '🚨', text: `You've exceeded your <strong>${category}</strong> budget by ${fmtDisplay(spent - budget)}.` });
                } else if (percentage >= 85) {
                    insights.push({ type: 'warning', icon: '💡', text: `You've used <strong>${percentage.toFixed(0)}%</strong> of your <strong>${category}</strong> budget.` });
                }
            }
        }

        // 2. Category Trend Analysis (vs. last month)
        const combinedCategories = [...new Set([...Object.keys(categoryTotalsCurrent), ...Object.keys(categoryTotalsLastMonth)])];

        combinedCategories.forEach(category => {
            const currentSpent = categoryTotalsCurrent[category] || 0;
            const lastMonthSpent = categoryTotalsLastMonth[category] || 0;
            const diff = currentSpent - lastMonthSpent;
            
            if (lastMonthSpent > 20 && Math.abs(diff) > (lastMonthSpent * 0.2)) { 
                 if (diff > 0) {
                     insights.push({ type: 'warning', icon: '📈', text: `Spending on <strong>${category}</strong> is up by ${fmtDisplay(diff)} compared to last month.` });
                 } else {
                     insights.push({ type: 'good', icon: '📉', text: `Spending on <strong>${category}</strong> is down by ${fmtDisplay(Math.abs(diff))} from last month.` });
                 }
            }
        });

        // Render insights
        if (insights.length > 0) {
            insightsList.innerHTML = insights.map(insight => `
                <div class="insight-item ${insight.type}">
                    <span class="icon">${insight.icon}</span>
                    <span>${insight.text}</span>
                </div>
            `).join('');
        } else {
            insightsList.innerHTML = '<p class="muted" style="text-align:center;">No specific insights for this month yet. Keep tracking!</p>';
        }
    }

    function renderExpenseAnalysis(key) {
        const container = document.getElementById('expenseInfographicContainer');
        const expenses = state.expenses[key] || [];
        const budgets = state.budgets[key] || {};
        
        const analysisData = expenses.reduce((acc, exp) => {
            const cat = exp.category || 'Uncategorized';
            if (!acc[cat]) {
                acc[cat] = { myTotal: 0, partnerTotal: 0 };
            }
            acc[cat].myTotal += exp.amount;
            acc[cat].partnerTotal += exp.partnerShare;
            return acc;
        }, {});

        const sortedCategories = Object.keys(analysisData).sort((a,b) => {
            const totalA = analysisData[a].myTotal + analysisData[a].partnerTotal;
            const totalB = analysisData[b].myTotal + analysisData[b].partnerTotal;
            return totalB - totalA;
        });
        
        if (expensePieChart) {
            expensePieChart.data.labels = sortedCategories;
            expensePieChart.data.datasets[0].data = sortedCategories.map(cat => analysisData[cat].myTotal);
            expensePieChart.update('none');
        }

        if (sortedCategories.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--muted);">No expenses logged for this month.</p>';
            return;
        }

        let infographicHTML = '';
        sortedCategories.forEach(cat => {
            const data = analysisData[cat];
            const total = data.myTotal + data.partnerTotal;
            const myPercent = total > 0 ? (data.myTotal / total) * 100 : 0;
            const partnerPercent = total > 0 ? (data.partnerTotal / total) * 100 : 0;
            
            const budget = budgets[cat] || 0;
            let budgetHTML = '';
            if (budget > 0) {
                const budgetSpentPct = Math.min((total / budget) * 100, 100);
                let barColor = 'var(--success)';
                if (budgetSpentPct > 75) barColor = 'var(--warning)';
                if (budgetSpentPct >= 100) barColor = 'var(--danger)';

                budgetHTML = `
                    <div class="budget-progress-bar-container">
                        <div class="budget-progress-bar-fill" style="width: ${budgetSpentPct}%; background-color: ${barColor};"></div>
                    </div>
                    <div class="category-breakdown" style="font-size: 11px;">
                        <span>Spent: <strong style="color:var(--text)">${fmtDisplay(total)}</strong></span>
                        <span>Budget: <strong style="color:var(--muted)">${fmtDisplay(budget)}</strong></span>
                    </div>
                `;
            }


            infographicHTML += `
                <div class="category-item">
                    <div class="category-header">
                        <span>${cat}</span>
                        <span class="category-total">${fmtDisplay(total)}</span>
                    </div>
                    <div class="progress-bar-wrapper">
                        <div class="progress-bar-user" style="width: ${myPercent}%" title="My Cost: ${fmtDisplay(data.myTotal)}"></div>
                        <div class="progress-bar-partner" style="width: ${partnerPercent}%" title="Partner's Cost: ${fmtDisplay(data.partnerTotal)}"></div>
                    </div>
                    <div class="category-breakdown">
                        <span>My Cost: <strong style="color:var(--warning)">${fmtDisplay(data.myTotal)}</strong></span>
                        <span>Partner's Cost: <strong style="color:var(--accent)">${fmtDisplay(data.partnerTotal)}</strong></span>
                    </div>
                    ${budgetHTML}
                </div>
            `;
        });

        container.innerHTML = infographicHTML;
    }

    function renderExpenses(key) {
        const expensesTableBody = document.querySelector('#expensesTable tbody');
        const searchTerm = document.getElementById('expenseSearch').value.toLowerCase();
        expensesTableBody.innerHTML = '';
        
        let expenses = state.expenses[key] || [];

        if (searchTerm) {
            expenses = expenses.filter(exp => 
                exp.desc.toLowerCase().includes(searchTerm) ||
                exp.category.toLowerCase().includes(searchTerm) ||
                (exp.notes && exp.notes.toLowerCase().includes(searchTerm))
            );
        }

        expenses.sort((a, b) => {
            if (a.isPending && !b.isPending) return -1;
            if (!a.isPending && b.isPending) return 1;
            
            let valA = a[expenseSort.key];
            let valB = b[expenseSort.key];

            if (expenseSort.key === 'isRecurring') {
                valA = a.isRecurring ? 1 : 0;
                valB = b.isRecurring ? 1 : 0;
            } else if (expenseSort.key === 'date') {
                return expenseSort.order === 'asc' ? new Date(valA) - new Date(valB) : new Date(valB) - new Date(valA);
            }

            if (valA < valB) return expenseSort.order === 'asc' ? -1 : 1;
            if (valA > valB) return expenseSort.order === 'asc' ? 1 : -1;
            return 0;
        });

        expenses.forEach(expense => {
            const tr = document.createElement('tr');
            if (expense.isPending) {
                tr.classList.add('pending-expense');
            }
            
            let actionButtonsHTML;
            if (expense.isPending) {
                actionButtonsHTML = `
                    <button class="btn confirm" onclick="confirmExpense('${expense.id}')" title="Confirm & Edit">✔</button>
                    <button class="btn ghost" onclick="deleteExpense('${expense.id}')" title="Delete">🗑️</button>
                `;
            } else {
                actionButtonsHTML = `<button class="btn ghost" onclick="deleteExpense('${expense.id}')" title="Delete">🗑️</button>`;
            }

            tr.innerHTML = `
                <td><input type="text" class="inline-edit-input flatpickr-inline" data-id="${expense.id}" data-field="date" value="${expense.date}"></td>
                <td><input type="text" class="inline-edit-input" data-id="${expense.id}" data-field="desc" value="${expense.desc}"></td>
                <td><input type="text" class="inline-edit-input" list="expenseCategories" data-id="${expense.id}" data-field="category" value="${expense.category}"></td>
                <td data-label="Recurring">${expense.isRecurring ? 'Yes' : 'No'}</td>
                <td class="readonly" data-col="fullAmount">${fmtDisplay(expense.fullAmount)}</td>
                <td><input type="number" step="0.01" class="inline-edit-input" data-id="${expense.id}" data-field="amount" value="${fmt(expense.amount)}"></td>
                <td><input type="number" step="0.01" class="inline-edit-input" data-id="${expense.id}" data-field="partnerShare" value="${fmt(expense.partnerShare)}"></td>
                <td><input type="text" class="inline-edit-input" data-id="${expense.id}" data-field="notes" value="${expense.notes || ''}" placeholder="-"></td>
                <td>
                    <div class="action-buttons">
                        ${actionButtonsHTML}
                    </div>
                </td>
            `;
            expensesTableBody.appendChild(tr);
        });

        // Re-initialize flatpickr for new date inputs and add event listeners
        expensesTableBody.querySelectorAll('.flatpickr-inline').forEach(dateInput => {
            flatpickr(dateInput, {
                dateFormat: "Y-m-d", altInput: true, altFormat: "d M, Y",
                onChange: (selectedDates, dateStr, instance) => {
                    instance.element.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });
        
        expensesTableBody.querySelectorAll('.inline-edit-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const field = e.target.dataset.field;
                const value = e.target.value;
                updateExpenseField(id, field, value);
            });
        });
    }
    
    function updateExpenseField(expenseId, field, value) {
        const key = monthSelect.value;
        const expense = state.expenses[key].find(exp => exp.id === expenseId);
        if (!expense) return;

        if (field === 'amount' || field === 'partnerShare') {
            expense[field] = Number(value) || 0;
        } else {
            expense[field] = value;
        }

        expense.fullAmount = (expense.amount || 0) + (expense.partnerShare || 0);
        saveState();

        const { totalExpenses, totalPartnerExpenses, net, balance } = totalsFor(key);
        
        const row = document.querySelector(`input[data-id="${expenseId}"]`).closest('tr');
        if (row) {
            row.querySelector('[data-col="fullAmount"]').textContent = fmtDisplay(expense.fullAmount);
        }

        document.getElementById('expensesMyTotal').textContent = fmtDisplay(totalExpenses);
        document.getElementById('expensesPartnerTotal').textContent = fmtDisplay(totalPartnerExpenses);
        expensesOut.innerHTML = `<span class="currency">RM</span> ${fmt(totalExpenses)}`;
        balanceOut.innerHTML = `<span class="currency">RM</span> ${fmt(balance)}`;

        renderExpenseAnalysis(key);
        generateSpendingInsights(key);
    }

    function setExpenseSort(key) {
        if (expenseSort.key === key) {
            expenseSort.order = expenseSort.order === 'asc' ? 'desc' : 'asc';
        } else {
            expenseSort.key = key;
            expenseSort.order = (key === 'isRecurring' || key === 'amount' || key === 'date' || key === 'fullAmount' || key === 'partnerShare') ? 'desc' : 'asc';
        }
        
        document.querySelectorAll('#expensesTable th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if(th.dataset.sort === key) {
                th.classList.add(`sort-${expenseSort.order}`);
            }
        });

        renderExpenses(monthSelect.value);
    }


    function handleExpenseSubmit(e) {
        e.preventDefault();
        const key = monthSelect.value;
        const isRecurring = document.getElementById('isRecurringToggle').checked;
        const myShare = parseFloat(document.getElementById('expenseMyShare').value) || 0;
        const partnerShare = parseFloat(document.getElementById('expensePartnerShare').value) || 0;
        
        const newExpense = {
            id: editingExpenseId || `exp_${new Date().getTime()}`,
            date: document.getElementById('expenseDate').value,
            desc: document.getElementById('expenseDesc').value.trim(),
            category: document.getElementById('expenseCat').value.trim(),
            fullAmount: myShare + partnerShare,
            amount: myShare,
            partnerShare: partnerShare,
            notes: document.getElementById('expenseNotes').value.trim(),
            isRecurring: isRecurring,
            isPending: false
        };

        if (newExpense.desc && newExpense.category && newExpense.fullAmount > 0 && newExpense.date) {
            if (editingExpenseId) {
                const index = state.expenses[key].findIndex(exp => exp.id === editingExpenseId);
                state.expenses[key][index] = newExpense;
            } else {
                 if (!state.expenses[key]) state.expenses[key] = [];
                state.expenses[key].push(newExpense);
            }
            saveState();
            refresh();
            cancelEdit();
        } else {
            alert("Please fill in Date, Description, Category, and a Total Cost.");
        }
    }

    function editExpense(expenseId) {
        const key = monthSelect.value;
        const expense = state.expenses[key].find(exp => exp.id === expenseId);
        if (expense) {
            editingExpenseId = expenseId;
            document.getElementById('expenseDate')._flatpickr.setDate(expense.date, true);
            document.getElementById('expenseDesc').value = expense.desc;
            document.getElementById('expenseCat').value = expense.category;
            
            const totalCost = (expense.amount || 0) + (expense.partnerShare || 0);
            document.getElementById('expenseTotalCost').value = totalCost > 0 ? totalCost.toFixed(2) : '';
            document.getElementById('expenseMyShare').value = expense.amount;
            document.getElementById('expensePartnerShare').value = expense.partnerShare;

            if (expense.isPending || (expense.amount > 0 && expense.partnerShare === 0)) {
                activeSplitMode = 'i-paid';
            } else if (expense.amount > 0 && expense.partnerShare > 0) {
                activeSplitMode = '50-50';
            } else {
                activeSplitMode = 'p-paid';
            }
            updateSplitButtons();
            
            document.getElementById('expenseNotes').value = expense.notes || '';
            document.getElementById('isRecurringToggle').checked = expense.isRecurring || false;
            
            const addBtn = document.getElementById('addExpenseBtn');
            addBtn.textContent = '💾 Save';
            addBtn.classList.remove('primary');
            addBtn.classList.add('success');
            document.getElementById('cancelEditBtn').style.display = 'inline-flex';

            const form = document.getElementById('addExpenseForm');
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
            document.getElementById('expenseDesc').focus();
        }
    }
    
    function confirmExpense(expenseId) {
        const key = monthSelect.value;
        const expense = state.expenses[key].find(exp => exp.id === expenseId);
        if (expense) {
            expense.isPending = false;
            saveState();
            refresh();
        }
    }

    function cancelEdit() {
        editingExpenseId = null;
        document.getElementById('addExpenseForm').reset();
        document.getElementById('expenseDate')._flatpickr.setDate(new Date(), true);
        
        document.getElementById('expenseTotalCost').value = '';
        activeSplitMode = 'i-paid';
        updateSplitButtons();
        calculateSplit();

        const addBtn = document.getElementById('addExpenseBtn');
        addBtn.textContent = '➕ Add';
        addBtn.classList.remove('success');
        addBtn.classList.add('primary');
        document.getElementById('cancelEditBtn').style.display = 'none';
    }

    function deleteExpense(expenseId) {
        if (confirm('Are you sure you want to delete this expense?')) {
            const key = monthSelect.value;
            state.expenses[key] = state.expenses[key].filter(exp => exp.id !== expenseId);
            saveState();
            refresh();
        }
    }

    // --- Smart Calculator & OT Pattern Functions ---
    async function fetchHolidaysForYear(year) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(mockHolidayAPI[year] || []);
            }, 150);
        });
    }

    async function populateHolidayChecklist(year) { 
      const checklistContainer = document.getElementById('holidayChecklist'); 
      checklistContainer.innerHTML = '<p style="color: var(--muted); padding: 20px; text-align: center;">Loading holidays...</p>';
      
      const holidays = await fetchHolidaysForYear(year);
      
      if (holidays.length === 0) {
        checklistContainer.innerHTML = `<p style="color: var(--muted); padding: 20px; text-align: center;">No holiday data found for ${year}.</p>`;
        return;
      }
      
      publicHolidays = []; 

      checklistContainer.innerHTML = holidays.map(holiday => { 
        const holidayDate = new Date(holiday.date + 'T00:00:00'); 
        const dateString = holidayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); 
        return `<div class="holiday-checkbox-item">
          <label for="holiday-${holiday.date}">
            <span>${holiday.name}</span>
            <span class="date">${dateString}</span>
          </label>
          <input type="checkbox" id="holiday-${holiday.date}" name="predefinedHolidays" value="${holiday.date}" checked>
        </div>`; 
      }).join(''); 
    }

    function addHoliday() { 
      const holidayPicker = document.getElementById('holidayPicker'); 
      const selectedDate = holidayPicker._flatpickr.selectedDates[0];
      if (!selectedDate) {
        alert('Please select a date for the public holiday.');
        return;
      } 
      const dateString = formatDateToYyyyMmDd(selectedDate);
      if (publicHolidays.includes(dateString) || getAllHolidays().includes(dateString)) { 
        alert("This holiday has already been added."); 
        return; 
      } 
      publicHolidays.push(dateString); 
      updateHolidayList(); 
      holidayPicker._flatpickr.clear();
    }

    function removeHoliday(date) { 
      publicHolidays = publicHolidays.filter(holiday => holiday !== date); 
      updateHolidayList(); 
    }

    function updateHolidayList() { 
      const holidayList = document.getElementById('holidayList'); 
      publicHolidays.sort(); 
      
      if (publicHolidays.length === 0) {
        holidayList.innerHTML = '<p style="color: var(--muted); font-style: italic; margin: 10px 0;">No custom holidays added yet.</p>';
        return;
      }
      
      holidayList.innerHTML = publicHolidays.map(date => { 
        const holidayDate = new Date(date + 'T00:00:00'); 
        const dayName = getDayOfWeek(holidayDate); 
        const formattedDate = holidayDate.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }); 
        return `<div class="holiday-item">
          <div>
            <span style="color: var(--text);">${formattedDate}</span>
            <span style="color: var(--muted); font-size: 12px;">(${dayName})</span>
          </div>
          <button class="btn ghost" style="padding: 4px 8px; font-size: 12px;" onclick="removeHoliday('${date}')">&times;</button>
        </div>`; 
      }).join(''); 
    }

    function getSmartCalulatorInputs() {
        const startDate = document.getElementById('startDate')._flatpickr.selectedDates[0];
        const endDate = document.getElementById('endDate')._flatpickr.selectedDates[0];
        const basicSalary = parseFloat(document.getElementById('smartBasicSalary').value);

        if (!startDate || !endDate) { 
            alert("Please select a valid date range."); 
            return null; 
        }
        if (startDate > endDate) {
            alert("Start date cannot be after end date.");
            return null;
        }
        if (!basicSalary || basicSalary <= 0) { 
            alert('Please enter a valid Basic Salary.'); 
            return null; 
        }

        const hourlyRate = basicSalary / 208;
        const rates = { 
            restDay: hourlyRate * 1.0,
            normalOT: hourlyRate * 1.5,
            offDay: hourlyRate * 1.5,
            holiday: hourlyRate * 2.0
        };

        let daysInRange = [], currentDate = new Date(startDate);
        while (currentDate <= endDate) { 
            daysInRange.push(new Date(currentDate)); 
            currentDate.setDate(currentDate.getDate() + 1); 
        }

        const allHolidays = getAllHolidays();

        return { daysInRange, rates, allHolidays };
    }


    function applyOTPattern(pattern) {
        const inputs = getSmartCalulatorInputs();
        if (!inputs) return;

        const { daysInRange, rates, allHolidays } = inputs;
        lastGeneratedRates = rates;
        lastGeneratedAllHolidays = allHolidays;
        
        const patternHours = pattern.pattern;

        let dailyHours = [];
        daysInRange.forEach(date => {
            const dateString = formatDateToYyyyMmDd(date);
            const dayOfWeek = date.getDay();
            const patternDayIndex = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
            const hours = patternHours[patternDayIndex] || 0;

            if (hours > 0) {
                const isHoliday = allHolidays.includes(dateString);
                let overtimeType = "", rate = 0;
                
                if (isHoliday) {
                    overtimeType = "Overtime 2.0x (Public Holiday)"; 
                    rate = rates.holiday; 
                } else if (dayOfWeek === 0) {
                    overtimeType = "Rest Day OT (1.0x)"; 
                    rate = rates.restDay; 
                } else if (dayOfWeek === 6) {
                    overtimeType = "Off Day 1.5x (Saturday)"; 
                    rate = rates.offDay; 
                } else {
                    overtimeType = "Overtime 1.5x (Weekday)"; 
                    rate = rates.normalOT; 
                }

                dailyHours.push({ date: dateString, day: getDayOfWeek(date), hours: hours, pay: hours * rate, type: overtimeType, rate: rate });
            }
        });
        
        const targetPay = parseFloat(document.getElementById('targetPay').value);
        if (targetPay > 0) {
            const initialTotalPay = dailyHours.reduce((sum, day) => sum + day.pay, 0);
            if (initialTotalPay > 0) {
                const scaleFactor = targetPay / initialTotalPay;
                dailyHours.forEach(day => {
                    day.hours = Math.round((day.hours * scaleFactor) * 4) / 4;
                    day.pay = day.hours * day.rate;
                });
            }
        }
        
        dailyHours.forEach(day => {
            const dayOfWeek = new Date(day.date + 'T00:00:00').getDay();
            day.startTime = generateRandomStartTime(dayOfWeek);
            day.endTime = calculateEndTime(day.startTime, day.hours);
        });

        calculatedDailyHours = dailyHours;
        displaySmartResults(calculatedDailyHours);
    }

    function calculateSmartOT() {
        const inputs = getSmartCalulatorInputs();
        if (!inputs) return;
        const { daysInRange, rates, allHolidays } = inputs;
        lastGeneratedRates = rates;
        lastGeneratedAllHolidays = allHolidays;

        const targetPay = parseFloat(document.getElementById('targetPay').value);
        if (!targetPay || targetPay <= 0) { 
            alert('Please fill in a valid Target OT Pay!'); 
            return; 
        }
      
        const hourLimits = { weekday: { min: 2, max: 5 }, saturday: { min: 4, max: 8 }, sunday: { min: 4, max: 8 }, holiday: { min: 4, max: 8 } };
      
        let dailyHours = [];
        daysInRange.forEach(date => {
            const dateString = formatDateToYyyyMmDd(date);
            const isHoliday = allHolidays.includes(dateString);
            const dayOfWeek = date.getDay();
            
            let overtimeType = "", rate = 0, dayTypeLimits;
            
            if (isHoliday) {
                overtimeType = "Overtime 2.0x (Public Holiday)"; rate = rates.holiday; dayTypeLimits = hourLimits.holiday;
            } else if (dayOfWeek === 0) {
                overtimeType = "Rest Day OT (1.0x)"; rate = rates.restDay; dayTypeLimits = hourLimits.sunday;
            } else if (dayOfWeek === 6) {
                overtimeType = "Off Day 1.5x (Saturday)"; rate = rates.offDay; dayTypeLimits = hourLimits.saturday;
            } else {
                overtimeType = "Overtime 1.5x (Weekday)"; rate = rates.normalOT; dayTypeLimits = hourLimits.weekday;
            }
            
            let randomHours = Math.random() * (dayTypeLimits.max - dayTypeLimits.min) + dayTypeLimits.min;
            randomHours = Math.round(randomHours * 4) / 4;
            
            dailyHours.push({ date: dateString, day: getDayOfWeek(date), hours: randomHours, pay: randomHours * rate, type: overtimeType, rate: rate, startTime: generateRandomStartTime(dayOfWeek) });
        });
      
        const totalAllocatedPay = dailyHours.reduce((acc, day) => acc + day.pay, 0);
        const scaleFactor = totalAllocatedPay > 0 ? targetPay / totalAllocatedPay : 0;
      
        let finalDailyHours = dailyHours.map(day => {
            const scaledHours = day.hours * scaleFactor;
            const finalHours = Math.round(scaledHours * 4) / 4;
            return { ...day, hours: finalHours, pay: finalHours * day.rate, endTime: calculateEndTime(day.startTime, finalHours) };
        });
      
        calculatedDailyHours = finalDailyHours;
        displaySmartResults(finalDailyHours);
    }

    function displaySmartResults(dailyHours) {
      const totalHours = dailyHours.reduce((acc, day) => acc + day.hours, 0);
      const totalPay = dailyHours.reduce((acc, day) => acc + day.pay, 0);
      const totalDays = dailyHours.filter(day => day.hours > 0).length;
      const targetPay = parseFloat(document.getElementById('targetPay').value) || 0;
      
      let summaryHTML = `
        <div class="summary-item"><h4>Total OT Hours</h4><div class="value">${totalHours.toFixed(1)}h</div></div>
        <div class="summary-item"><h4>Achieved OT Pay</h4><div class="value">RM ${totalPay.toFixed(2)}</div></div>
        <div class="summary-item"><h4>Days with OT</h4><div class="value">${totalDays}</div></div>
      `;

      if (targetPay) {
        summaryHTML += `<div class="summary-item"><h4>Target Achievement</h4><div class="value">${targetPay > 0 ? ((totalPay / targetPay) * 100).toFixed(1) : '0.0'}%</div></div>`;
      }
      
      document.getElementById('smartSummary').innerHTML = summaryHTML;
      
      const adjusterContainer = document.getElementById('smartHourAdjusterContainer');
      if (dailyHours.length > 0) {
        let totals = { weekday: 0, saturday: 0, sunday: 0, holiday: 0 };
        dailyHours.forEach(day => {
            const d = new Date(day.date + 'T00:00:00');
            const dayOfWeek = d.getDay();
            const isHoliday = lastGeneratedAllHolidays.includes(day.date);

            if (isHoliday) totals.holiday += day.hours;
            else if (dayOfWeek === 0) totals.sunday += day.hours;
            else if (dayOfWeek === 6) totals.saturday += day.hours;
            else totals.weekday += day.hours;
        });

        document.getElementById('weekdayHoursTotal').value = totals.weekday.toFixed(2) + 'h';
        document.getElementById('saturdayHoursTotal').value = totals.saturday.toFixed(2) + 'h';
        document.getElementById('sundayHoursTotal').value = totals.sunday.toFixed(2) + 'h';
        document.getElementById('holidayHoursTotal').value = totals.holiday.toFixed(2) + 'h';
        document.getElementById('smartTotalOtPayAdjuster').textContent = fmtDisplay(totalPay);
        
        const progress = targetPay > 0 ? Math.min((totalPay / targetPay) * 100, 100) : 0;
        document.getElementById('fineTuneProgressBarFill').style.width = `${progress}%`;
        document.getElementById('fineTuneProgressBarText').textContent = `${fmtDisplay(totalPay)} / ${fmtDisplay(targetPay)} (${progress.toFixed(1)}%)`;


        adjusterContainer.style.display = 'block';
      } else {
        adjusterContainer.style.display = 'none';
      }


      const tableRows = dailyHours
        .filter(day => day.hours > 0)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map(day => `
          <tr>
            <td>${day.date}</td>
            <td><strong>${day.day}</strong></td>
            <td><span class="overtime-type ${getOvertimeTypeClass(day.type)}">${day.type}</span></td>
            <td>${day.startTime}</td>
            <td>${day.endTime}</td>
            <td><strong>${day.hours.toFixed(2)}h</strong></td>
            <td><strong>RM ${day.pay.toFixed(2)}</strong></td>
          </tr>
        `).join('');
      
      document.querySelector('#smartOTTable tbody').innerHTML = tableRows;
      
      document.getElementById('smartResults').style.display = 'block';
      document.getElementById('smartResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function exportToCSV() {
      if (calculatedDailyHours.length === 0) { 
        alert("No data to export. Please calculate first."); 
        return; 
      }
      
      const headers = ["Date", "Day", "OT Type", "Start Time", "End Time", "Hours", "Pay (RM)"];
      const rows = calculatedDailyHours.filter(day => day.hours > 0).map(day => [
        day.date, day.day, `"${day.type}"`, day.startTime, day.endTime, day.hours.toFixed(2), day.pay.toFixed(2)
      ].join(','));
      
      const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.join("\n");
      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute("download", "overtime_schedule.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function exportToPDF() {
      if (calculatedDailyHours.length === 0) { 
        alert("No data to export. Please calculate first."); 
        return; 
      }
      
      const { jsPDF } = window.jspdf;
      const resultsNode = document.getElementById('smartResults');
      
      html2canvas(resultsNode, { scale: 2, useCORS: true, backgroundColor: '#1a1a2e', logging: false }).then(canvas => {
        const imgData = canvas.toDataURL('image/png', 1.0);
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasAspectRatio = canvas.width / canvas.height;
        
        let imgWidth = pdfWidth - 20;
        let imgHeight = imgWidth / canvasAspectRatio;
        
        if (imgHeight > pdfHeight - 20) {
          imgHeight = pdfHeight - 20;
          imgWidth = imgHeight * canvasAspectRatio;
        }
        
        const x = (pdfWidth - imgWidth) / 2;
        const y = 10;
        
        pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
        pdf.save('overtime_schedule.pdf');
      }).catch(err => {
        console.error("PDF generation failed:", err);
        alert("❌ An error occurred while creating the PDF. Please try again.");
      });
    }

    function applyToManualTab() {
      if (calculatedDailyHours.length === 0) {
        alert("No smart calculation data to apply. Please calculate first.");
        return;
      }

      const currentMonth = monthSelect.value;
      const workingDays = calculatedDailyHours.filter(day => day.hours > 0);

      if (workingDays.length === 0) {
        alert("No overtime days found in the calculation.");
        return;
      }

      if (!confirm(`This will merge the generated hours with your existing entries for ${months.find(m => m.key === currentMonth)?.fullLabel || currentMonth}. Continue?`)) {
          return;
      }

      workingDays.forEach(day => {
        const existingEntry = state.ot[currentMonth].find(entry => entry.date === day.date);

        if (existingEntry) {
          existingEntry.hours = (Number(existingEntry.hours) || 0) + day.hours;
          if (existingEntry.start) {
            existingEntry.end = calculateEndTime(existingEntry.start, existingEntry.hours);
          }
        } else {
          let multiplier = 1.5;
          if (day.type.includes('Rest Day')) multiplier = 0.5;
          else if (day.type.includes('Public Holiday')) multiplier = 2.0;
          else if (day.type.includes('1.5x')) multiplier = 1.5;

          state.ot[currentMonth].push({
            date: day.date,
            start: day.startTime,
            end: day.endTime,
            hours: day.hours,
            mult: multiplier,
            notes: 'Generated by Smart OT'
          });
        }
      });
      
      state.ot[currentMonth].sort((a, b) => new Date(a.date) - new Date(b.date));

      saveState();
      switchTab('manual', document.querySelector('.tab[onclick*="manual"]'));
      refresh();
      alert(`✅ Schedule updated and merged successfully!`);
    }

    // --- OT Pattern Management ---
    function renderPatternTemplates() {
        const container = document.getElementById('patternListContainer');
        container.innerHTML = `
            <div class="pattern-row header">
                <div class="pattern-name">Pattern</div>
                <div class="pattern-hours">
                    <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                </div>
                <div class="pattern-actions">Actions</div>
            </div>
        `;

        // Render Predefined
        otPatterns.predefined.forEach(p => {
            const patternRow = document.createElement('div');
            patternRow.className = 'pattern-row';
            patternRow.innerHTML = `
                <div class="pattern-name" title="${p.description || ''}">${p.name}</div>
                <div class="pattern-hours">
                    ${p.pattern.map(h => `<div class="hour-box">${h}</div>`).join('')}
                </div>
                <div class="pattern-actions">
                    <button class="btn ghost apply-pattern-btn">🚀 Apply</button>
                </div>
            `;
            patternRow.querySelector('.apply-pattern-btn').addEventListener('click', () => applyOTPattern(p));
            container.appendChild(patternRow);
        });
        
        // Render Custom
        otPatterns.custom.forEach((p, index) => {
            const patternRow = document.createElement('div');
            patternRow.className = 'pattern-row custom';
            patternRow.innerHTML = `
                <div class="pattern-name">
                    <input type="text" value="${p.name}" placeholder="📝 Custom Pattern Name" class="custom-pattern-name-input" data-index="${index}">
                </div>
                <div class="pattern-hours">
                    ${p.pattern.map((h, i) => `<input type="number" class="hour-input" min="0" step="0.5" value="${h}" data-index="${index}" data-day="${i}">`).join('')}
                </div>
                <div class="pattern-actions">
                    <button class="btn ghost apply-pattern-btn">🚀 Apply</button>
                    <button class="btn danger ghost delete-pattern-btn">🗑️</button>
                </div>
            `;

            const nameInput = patternRow.querySelector('.custom-pattern-name-input');
            nameInput.addEventListener('input', (e) => {
                otPatterns.custom[index].name = e.target.value;
                saveState();
            });

            patternRow.querySelectorAll('.hour-input').forEach(input => {
                input.addEventListener('input', (e) => {
                    const dayIndex = parseInt(e.target.dataset.day);
                    otPatterns.custom[index].pattern[dayIndex] = parseFloat(e.target.value) || 0;
                    saveState();
                });
            });
            
            patternRow.querySelector('.apply-pattern-btn').addEventListener('click', () => applyOTPattern(p));
            patternRow.querySelector('.delete-pattern-btn').addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete the pattern "${p.name}"?`)) {
                    otPatterns.custom.splice(index, 1);
                    saveState();
                    renderPatternTemplates();
                }
            });

            container.appendChild(patternRow);
        });
    }

    // --- AI Suggestion Logic ---
    function aiSuggestSchedule() {
        const inputs = getSmartCalulatorInputs();
        if (!inputs) return;
        let { daysInRange, rates, allHolidays } = inputs;
        lastGeneratedRates = rates;
        lastGeneratedAllHolidays = allHolidays;

        let targetPay = parseFloat(document.getElementById('targetPay').value);
        if (!targetPay || targetPay <= 0) {
            alert('Please enter a valid Target OT Pay to generate an AI schedule!');
            return;
        }
        
        const blackoutDates = document.getElementById('blackoutDates')._flatpickr.selectedDates.map(d => formatDateToYyyyMmDd(d));
        const workStyle = document.getElementById('workStylePreference').value;
        daysInRange = daysInRange.filter(d => !blackoutDates.includes(formatDateToYyyyMmDd(d)));


        const history = { weekday: [], saturday: [], sunday: [] };
        Object.values(state.ot).flat().forEach(entry => {
            const date = new Date(entry.date + 'T00:00:00');
            const day = date.getDay();
            if (day > 0 && day < 6) history.weekday.push(entry.hours);
            else if (day === 6) history.saturday.push(entry.hours);
            else if (day === 0) history.sunday.push(entry.hours);
        });

        const getAvg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        let avgHours = {
            weekday: getAvg(history.weekday) || 4,
            saturday: getAvg(history.saturday) || 8,
            sunday: getAvg(history.sunday) || 8,
        };
        
        if (workStyle === 'long_days') {
            avgHours.weekday *= 1.25;
            avgHours.saturday *= 1.25;
            avgHours.sunday *= 1.25;
        } else if (workStyle === 'short_sessions') {
            avgHours.weekday *= 0.75;
            avgHours.saturday *= 0.75;
            avgHours.sunday *= 0.75;
        }


        let potentialSlots = daysInRange.map(date => {
            const dateString = formatDateToYyyyMmDd(date);
            const isHoliday = allHolidays.includes(dateString);
            const dayOfWeek = date.getDay();
            
            let type, rate, maxHours;
            if (isHoliday) {
                type = "Overtime 2.0x (Public Holiday)"; rate = rates.holiday; maxHours = avgHours.saturday;
            } else if (dayOfWeek === 0) {
                type = "Rest Day OT (1.0x)"; rate = rates.restDay; maxHours = avgHours.sunday;
            } else if (dayOfWeek === 6) {
                type = "Off Day 1.5x (Saturday)"; rate = rates.offDay; maxHours = avgHours.saturday;
            } else {
                type = "Overtime 1.5x (Weekday)"; rate = rates.normalOT; maxHours = avgHours.weekday;
            }
            
            return { date: dateString, day: getDayOfWeek(date), type, rate, hours: 0, maxHours };
        }).sort((a, b) => b.rate - a.rate);

        let remainingPay = targetPay;
        const hourIncrement = 0.5;

        while (remainingPay > 0) {
            let allocatedInThisLoop = false;
            for (const slot of potentialSlots) {
                if (remainingPay <= 0) break;
                if (slot.hours < slot.maxHours) {
                    const payForIncrement = hourIncrement * slot.rate;
                    if (payForIncrement > 0) {
                        slot.hours += hourIncrement;
                        remainingPay -= payForIncrement;
                        allocatedInThisLoop = true;
                    }
                }
            }
            if (!allocatedInThisLoop) break;
        }

        const finalSchedule = potentialSlots
            .filter(s => s.hours > 0)
            .map(s => ({
                ...s,
                pay: s.hours * s.rate,
                startTime: generateRandomStartTime(new Date(s.date + 'T00:00:00').getDay()),
                endTime: calculateEndTime(generateRandomStartTime(new Date(s.date + 'T00:00:00').getDay()), s.hours)
            }));
        
        calculatedDailyHours = finalSchedule;
        displaySmartResults(finalSchedule);
    }

    // --- Hour Adjuster Logic ---
    function adjustHours(rateType, amount) {
        if (calculatedDailyHours.length === 0) return;

        let relevantDays = calculatedDailyHours.filter(day => {
            const d = new Date(day.date + 'T00:00:00');
            const dayOfWeek = d.getDay();
            const isHoliday = lastGeneratedAllHolidays.includes(day.date);

            if (isHoliday) return rateType === 'holiday';
            if (rateType === 'sunday') return dayOfWeek === 0;
            if (rateType === 'saturday') return dayOfWeek === 6;
            if (rateType === 'weekday') return dayOfWeek > 0 && dayOfWeek < 6;
            return false;
        });

        if (amount > 0) {
            if (relevantDays.length > 0) {
                let dayToModify = relevantDays.reduce((prev, curr) => prev.hours < curr.hours ? prev : curr);
                dayToModify.hours += amount;
            } else {
                alert(`No ${rateType} days in the generated schedule to add hours to.`);
                return;
            }
        } else {
            let daysWithHours = relevantDays.filter(d => d.hours > 0);
            if (daysWithHours.length > 0) {
                let dayToModify = daysWithHours.reduce((prev, curr) => prev.hours > curr.hours ? prev : curr);
                dayToModify.hours += amount;
                dayToModify.hours = Math.max(0, dayToModify.hours);
            } else {
                return;
            }
        }

        calculatedDailyHours.forEach(day => {
            day.pay = day.hours * day.rate;
            day.endTime = calculateEndTime(day.startTime, day.hours);
        });
        
        calculatedDailyHours = calculatedDailyHours.filter(d => d.hours > 0);

        displaySmartResults(calculatedDailyHours);
    }


    // --- Forecast Functions ---
    function calculateForecast() {
        const currentKey = monthSelect.value;
        const currentIndex = months.findIndex(m => m.key === currentKey);
        
        let totalHours = 0;
        let monthsCount = 0;
        
        for (let i = 1; i <= 3; i++) {
            if (currentIndex - i >= 0) {
                const prevMonthKey = months[currentIndex - i].key;
                const rows = state.ot[prevMonthKey] || [];
                totalHours += rows.reduce((sum, row) => sum + (Number(row.hours) || 0), 0);
                monthsCount++;
            }
        }
        
        const avgHours = monthsCount > 0 ? totalHours / monthsCount : 0;
        document.getElementById('forecastAvgHours').textContent = `${avgHours.toFixed(1)}h`;

        const p = state.params[currentKey];
        const projectedOtPay = avgHours * (Number(p.hourly) || 0) * 1.5;
        const projectedGross = Number(p.basic) + Number(p.claims) + Number(p.hpAllow) + Number(p.incentive) + projectedOtPay;
        
        const projectedEpf = projectedGross * (Number(p.epf_pct)/100);
        const projectedSocso = projectedGross * (Number(p.socso_pct)/100);
        const projectedPcb = projectedGross * (Number(p.pcb_pct)/100);
        const projectedEis = projectedGross * (Number(p.eis_pct)/100);
        const projectedDeductions = projectedEpf + projectedSocso + projectedPcb + projectedEis + Number(p.advance);
        const projectedNet = projectedGross - projectedDeductions;

        document.getElementById('forecastGross').textContent = fmtDisplay(projectedGross);
        document.getElementById('forecastDeductions').textContent = fmtDisplay(projectedDeductions);
        document.getElementById('forecastNet').textContent = fmtDisplay(projectedNet);

        updateWhatIf(0);
    }

    function updateWhatIf(additionalHours) {
        const key = monthSelect.value;
        const p = state.params[key];
        const { gross, deductions, net } = totalsFor(key);

        const additionalOtPay = additionalHours * (Number(p.hourly) || 0) * 1.5;
        const whatIfGross = gross + additionalOtPay;

        const whatIfEpf = whatIfGross * (Number(p.epf_pct)/100);
        const whatIfSocso = whatIfGross * (Number(p.socso_pct)/100);
        const whatIfPcb = whatIfGross * (Number(p.pcb_pct)/100);
        const whatIfEis = whatIfGross * (Number(p.eis_pct)/100);
        const whatIfDeductions = whatIfEpf + whatIfSocso + whatIfPcb + whatIfEis + Number(p.advance);
        const whatIfNet = whatIfGross - whatIfDeductions;

        document.getElementById('whatIfGross').textContent = fmtDisplay(whatIfGross);
        document.getElementById('whatIfDeductions').textContent = fmtDisplay(whatIfDeductions);
        document.getElementById('whatIfNet').textContent = fmtDisplay(whatIfNet);
    }

    function autoScheduleToGoal() {
        const key = monthSelect.value;
        const { net } = totalsFor(key);
        const p = state.params[key];
        const goal = Number(p.incomeGoal) || 0;
        const remainingNet = goal - net;

        if (remainingNet <= 0) {
            alert("You've already reached your net income goal!");
            return;
        }

        const totalDeductionPct = (Number(p.epf_pct) + Number(p.socso_pct) + Number(p.pcb_pct) + Number(p.eis_pct)) / 100;
        const requiredAdditionalGrossOt = remainingNet / (1 - totalDeductionPct);
        
        switchTab('smart', document.querySelector('.tab[onclick*="smart"]'));
        
        document.getElementById('targetPay').value = requiredAdditionalGrossOt.toFixed(2);
        aiSuggestSchedule();
    }
    
    function updateManualHourAdjusters() {
        const key = monthSelect.value;
        const rows = state.ot[key] || [];
        const adjusterContainer = document.getElementById('manualHourAdjusterContainer');
        const { otPay } = totalsFor(key);

        if (rows.length > 0) {
            let totals = { weekday: 0, saturday: 0, sunday: 0, holiday: 0 };
            const allHolidays = getAllHolidays();

            rows.forEach(row => {
                const d = new Date(row.date + 'T00:00:00');
                const dayOfWeek = d.getDay();
                const isHoliday = allHolidays.includes(row.date);
                const hours = Number(row.hours) || 0;

                if (isHoliday) totals.holiday += hours;
                else if (dayOfWeek === 0) totals.sunday += hours;
                else if (dayOfWeek === 6) totals.saturday += hours;
                else totals.weekday += hours;
            });

            document.getElementById('manualWeekdayHoursTotal').value = totals.weekday.toFixed(2) + 'h';
            document.getElementById('manualSaturdayHoursTotal').value = totals.saturday.toFixed(2) + 'h';
            document.getElementById('manualSundayHoursTotal').value = totals.sunday.toFixed(2) + 'h';
            document.getElementById('manualHolidayHoursTotal').value = totals.holiday.toFixed(2) + 'h';
            document.getElementById('manualTotalOtPayAdjuster').textContent = fmtDisplay(otPay);

            adjusterContainer.style.display = 'block';
        } else {
            adjusterContainer.style.display = 'none';
        }
    }

    function adjustManualHours(rateType, amount) {
        const key = monthSelect.value;
        const allHolidays = getAllHolidays();
        let relevantDays = state.ot[key].filter(day => {
            const d = new Date(day.date + 'T00:00:00');
            const dayOfWeek = d.getDay();
            const isHoliday = allHolidays.includes(day.date);

            if (isHoliday) return rateType === 'holiday';
            if (rateType === 'sunday') return dayOfWeek === 0;
            if (rateType === 'saturday') return dayOfWeek === 6;
            if (rateType === 'weekday') return dayOfWeek > 0 && dayOfWeek < 6;
            return false;
        });

        if (amount > 0) {
            if (relevantDays.length > 0) {
                let dayToModify = relevantDays.reduce((prev, curr) => (prev.hours || 0) < (curr.hours || 0) ? prev : curr);
                dayToModify.hours = (Number(dayToModify.hours) || 0) + amount;
                if (dayToModify.start) {
                    dayToModify.end = calculateEndTime(dayToModify.start, dayToModify.hours);
                }
            } else {
                alert(`No ${rateType} days in your schedule to add hours to. Please add a relevant day first.`);
                return;
            }
        } else {
            let daysWithHours = relevantDays.filter(d => (d.hours || 0) > 0);
            if (daysWithHours.length > 0) {
                let dayToModify = daysWithHours.reduce((prev, curr) => (prev.hours || 0) > (curr.hours || 0) ? prev : curr);
                dayToModify.hours = Math.max(0, (Number(dayToModify.hours) || 0) + amount);
                 if (dayToModify.start) {
                    dayToModify.end = calculateEndTime(dayToModify.start, dayToModify.hours);
                }
            } else {
                return; 
            }
        }
        
        saveState();
        refresh();
    }


    // --- Event Handlers ---
    function initCharts() {
      const computedStyle = getComputedStyle(document.documentElement);
      const mutedColor = computedStyle.getPropertyValue('--muted').trim();
      const textColor = computedStyle.getPropertyValue('--text').trim();
      const borderColor = computedStyle.getPropertyValue('--border').trim();
      
      const tooltipOptions = {
            backgroundColor: 'rgba(22, 22, 37, 0.95)', titleColor: textColor, bodyColor: mutedColor, borderColor: borderColor, borderWidth: 1,
            cornerRadius: 8, padding: 12, titleFont: { family: "'Poppins', sans-serif" }, bodyFont: { family: "'Poppins', sans-serif" },
            callbacks: {
                label: function(context) {
                    let label = context.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed !== null) {
                        label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MYR' }).format(context.parsed);
                    }
                    return label;
                }
            }
        };
      
      expensePieChart = new Chart(document.getElementById('expensePieChart'), {
          type: 'pie',
          data: {
              labels: [],
              datasets: [{
                  data: [],
                  backgroundColor: ['#ff79c6', '#50fa7b', '#f1fa8c', '#bd93f9', '#8be9fd', '#ffb86c', '#ff5555'],
                  borderColor: 'var(--card)', borderWidth: 2,
              }]
          },
          options: {
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: {...tooltipOptions, callbacks: { label: (context) => `${context.label}: ${fmtDisplay(context.parsed)}` }} }
          }
      });
    }

    // --- Data Import/Export Functions ---
    function exportData() {
        const dataStr = JSON.stringify(state, null, 2);
        const dataBlob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.download = `salary-ot-dashboard-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        showSaveMessage('✅ Data exported successfully!');
    }

    function importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = readerEvent => {
					let importedState;
					try {
						importedState = JSON.parse(readerEvent.target.result);
					} catch (err) {
						alert("Error reading file. Please make sure it's a valid backup file.");
						console.error(err);
						return; // Stop if the file is invalid
					}

					if (importedState && importedState.params && importedState.ot) {
						if (confirm("This will overwrite all current data. Are you sure you want to proceed?")) {
							state = importedState;
							saveState();
							state = loadState(); 
							refresh();
							renderPatternTemplates();
							showSaveMessage('✅ Data imported successfully!');
						}
					} else {
						alert("Error: Invalid data file.");
					}
				}
                reader.readAsText(file);
            }
        }
        input.click();
    }
    
    // --- Modal Handling ---
    function setupModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', e => {
                if (e.target === modal || e.target.classList.contains('modal-close-btn')) {
                    modal.classList.remove('active');
                }
            });
        });
    }
    
    // --- Budgeting Functions ---
    function openBudgetModal() {
        const key = monthSelect.value;
        const form = document.getElementById('budgetForm');
        form.innerHTML = '';
        
        const currentBudgets = state.budgets[key] || {};
        
        expenseCategories.forEach(cat => {
            const value = currentBudgets[cat] || '';
            const item = document.createElement('div');
            item.className = 'budget-item';
            item.innerHTML = `<label for="budget-${cat}">${cat}</label><input type="number" id="budget-${cat}" step="0.01" placeholder="0.00" value="${value}" data-category="${cat}">`;
            form.appendChild(item);
        });
        
        document.getElementById('budgetModal').classList.add('active');
    }
    
    function saveBudgets() {
        const key = monthSelect.value;
        state.budgets[key] = {};
        document.querySelectorAll('#budgetForm input').forEach(input => {
            const category = input.dataset.category;
            const value = parseFloat(input.value);
            if (value > 0) {
                state.budgets[key][category] = value;
            }
        });
        saveState();
        document.getElementById('budgetModal').classList.remove('active');
        refresh();
        showSaveMessage('💰 Budgets saved successfully!');
    }
    
    // --- Recurring Expenses ---
    function copyRecurringExpenses() {
        const currentKey = monthSelect.value;
        const currentIndex = months.findIndex(m => m.key === currentKey);
        if (currentIndex === 0) {
            alert("Cannot copy, as this is the first month in the list.");
            return;
        }
        const lastMonthKey = months[currentIndex - 1].key;
        const recurringExpenses = (state.expenses[lastMonthKey] || []).filter(exp => exp.isRecurring && !exp.isPending);
        
        if (recurringExpenses.length === 0) {
            alert('No confirmed recurring expenses found in the previous month.');
            return;
        }
        
        let addedCount = 0;
        recurringExpenses.forEach(exp => {
            const alreadyExists = (state.expenses[currentKey] || []).some(
                currentExp => currentExp.isRecurring && currentExp.desc === exp.desc
            );
            
            if (!alreadyExists) {
                const newDate = new Date(currentKey + '-01');
                newDate.setDate(new Date(exp.date).getDate());
                if (newDate.getMonth() !== new Date(currentKey + '-01').getMonth()) {
                    newDate.setDate(0);
                }

                const newExpense = { ...exp, id: `exp_${Date.now()}_${Math.random()}`, date: formatDateToYyyyMmDd(newDate), isPending: false };
                state.expenses[currentKey].push(newExpense);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            saveState();
            refresh();
            showSaveMessage(`✅ Copied ${addedCount} recurring expense(s) from last month.`);
        } else {
            alert('All recurring expenses from last month already exist in the current month.');
        }
    }
    
    function manageRecurringExpenses(currentKey) {
        if (state.expensesInitialized[currentKey]) return;

        const currentIndex = months.findIndex(m => m.key === currentKey);
        state.expensesInitialized[currentKey] = true; 

        if (currentIndex === 0) {
            saveState();
            return;
        }

        const lastMonthKey = months[currentIndex - 1].key;
        const recurringExpenses = (state.expenses[lastMonthKey] || []).filter(exp => exp.isRecurring);

        if (recurringExpenses.length > 0) {
            let addedCount = 0;
            if (!state.expenses[currentKey]) state.expenses[currentKey] = [];

            recurringExpenses.forEach(exp => {
                const alreadyExists = state.expenses[currentKey].some(
                    currentExp => currentExp.desc === exp.desc && !currentExp.isPending
                );
                
                if (!alreadyExists) {
                    const newDate = new Date(currentKey + '-01T00:00:00');
                    const lastDate = new Date(exp.date + 'T00:00:00');
                    newDate.setDate(lastDate.getDate());

                    if (newDate.getMonth() !== new Date(currentKey + '-01T00:00:00').getMonth()) {
                       newDate.setDate(0);
                    }

                    const newExpense = { 
                        ...exp, 
                        id: `exp_${Date.now()}_${Math.random()}`, 
                        date: formatDateToYyyyMmDd(newDate),
                        isPending: true
                    };
                    state.expenses[currentKey].push(newExpense);
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                showSaveMessage(`🔮 Predicted ${addedCount} recurring expense(s) from last month.`);
            }
        }
        saveState();
    }


    // --- Annual Summary ---
    function openAnnualSummaryModal() {
        const yearSelect = document.getElementById('annualSummaryYearSelect');
        const uniqueYears = [...new Set(months.map(m => m.key.substring(0, 4)))];
        yearSelect.innerHTML = uniqueYears.map(y => `<option value="${y}">${y}</option>`).join('');
        
        const currentYear = new Date().getFullYear().toString();
        if (uniqueYears.includes(currentYear)) {
            yearSelect.value = currentYear;
        }

        generateAnnualSummary();
        document.getElementById('annualSummaryModal').classList.add('active');
    }

    function generateAnnualSummary() {
        const year = document.getElementById('annualSummaryYearSelect').value;
        const contentDiv = document.getElementById('annualSummaryContent');
        
        let totalGross = 0, totalNet = 0, totalOTHours = 0, totalDeductions = 0, totalExpenses = 0;
        const expenseCategoryTotals = {};
        
        months.filter(m => m.key.startsWith(year)).forEach(m => {
            const monthTotals = totalsFor(m.key);
            totalGross += monthTotals.gross;
            totalNet += monthTotals.net;
            totalDeductions += monthTotals.deductions;
            totalExpenses += monthTotals.totalExpenses;
            totalOTHours += (state.ot[m.key] || []).reduce((sum, row) => sum + Number(row.hours || 0), 0);
            
            (state.expenses[m.key] || []).forEach(exp => {
                const cat = exp.category || 'Uncategorized';
                expenseCategoryTotals[cat] = (expenseCategoryTotals[cat] || 0) + exp.amount;
            });
        });

        let html = `
            <div class="grid grid-3" style="margin-bottom: 24px;">
                 <div class="stat"><div class="label">Total Gross Income</div><div class="value">${fmtDisplay(totalGross)}</div></div>
                 <div class="stat"><div class="label">Total Net Income</div><div class="value" style="color:var(--success)">${fmtDisplay(totalNet)}</div></div>
                 <div class="stat"><div class="label">Total OT Hours</div><div class="value">${totalOTHours.toFixed(1)}h</div></div>
                 <div class="stat"><div class="label">Total Deductions</div><div class="value" style="color:var(--warning)">${fmtDisplay(totalDeductions)}</div></div>
                 <div class="stat"><div class="label">Total Expenses</div><div class="value" style="color:var(--danger)">${fmtDisplay(totalExpenses)}</div></div>
                 <div class="stat"><div class="label">Final Balance</div><div class="value" style="color:var(--success)">${fmtDisplay(totalNet - totalExpenses)}</div></div>
            </div>
            <h3 class="section-title" style="font-size: 20px; margin-bottom: 16px;">Expense Breakdown</h3>
        `;
        
        const sortedCategories = Object.keys(expenseCategoryTotals).sort((a,b) => expenseCategoryTotals[b] - expenseCategoryTotals[a]);
        sortedCategories.forEach(cat => {
            html += `<div class="annual-summary-item"><strong>${cat}</strong> <span>${fmtDisplay(expenseCategoryTotals[cat])}</span></div>`;
        });
        
        contentDiv.innerHTML = html;
    }

    // --- NEW: Payslip Generation ---
    function openPayslipModal() {
        const key = monthSelect.value;
        const { otPay, gross, epfAmt, socsoAmt, pcbAmt, eisAmt, deductions, net } = totalsFor(key);
        const p = state.params[key];
        const monthName = months.find(m => m.key === key)?.fullLabel || 'Payslip';
        const dateRange = getOtDateRange(key);

        const payslipHTML = `
            <div class="payslip-body">
                <div class="modal-header">
                    <h2 class="section-title">Payslip Summary</h2>
                    <button class="modal-close-btn">×</button>
                </div>
                <div class="payslip-header">
                    <h2>${monthName}</h2>
                    <p class="muted">Pay Period: ${dateRange}</p>
                </div>
                <div class="payslip-details-grid">
                    <div><strong>Basic Salary:</strong> ${fmtDisplay(p.basic)}</div>
                    <div><strong>EPF:</strong> ${fmtDisplay(epfAmt)}</div>
                    <div><strong>Claims:</strong> ${fmtDisplay(p.claims)}</div>
                    <div><strong>SOCSO:</strong> ${fmtDisplay(socsoAmt)}</div>
                    <div><strong>HP Allowance:</strong> ${fmtDisplay(p.hpAllow)}</div>
                    <div><strong>PCB:</strong> ${fmtDisplay(pcbAmt)}</div>
                    <div><strong>Incentive:</strong> ${fmtDisplay(p.incentive)}</div>
                    <div><strong>EIS:</strong> ${fmtDisplay(eisAmt)}</div>
                    <div><strong>Overtime Pay:</strong> ${fmtDisplay(otPay)}</div>
                    <div><strong>Cash Advance:</strong> ${fmtDisplay(p.advance)}</div>
                </div>
                <div class="payslip-section">
                    <div class="payslip-total" style="border: none; margin-top:0; padding-top: 0;">
                        <span class="label">GROSS INCOME</span>
                        <span>${fmtDisplay(gross)}</span>
                    </div>
                    <div class="payslip-total" style="border: none; margin-top:0; padding-top: 0;">
                        <span class="label">TOTAL DEDUCTIONS</span>
                        <span>- ${fmtDisplay(deductions)}</span>
                    </div>
                </div>
                <div class="payslip-total payslip-net-total">
                    <span class="label">NET PAY</span>
                    <span>${fmtDisplay(net)}</span>
                </div>
                <div class="payslip-footer">This is a computer-generated summary.</div>
            </div>
        `;
        
        document.getElementById('payslipContent').innerHTML = payslipHTML;
        document.getElementById('payslipModal').classList.add('active');
    }

    // --- NEW: Quick Add OT ---
    function quickAddOT(dayType, hours) {
        const key = monthSelect.value;
        const { startDate, endDate } = getOtDateRangeObjects(key);
        let currentDate = new Date(startDate);

        let targetDay;
        if(dayType === 'weekday') targetDay = [1,2,3,4,5]; // Mon-Fri
        else if(dayType === 'saturday') targetDay = [6]; // Sat

        let foundDate = null;
        while(currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            if (targetDay.includes(dayOfWeek)) {
                const dateStr = formatDateToYyyyMmDd(currentDate);
                const alreadyExists = (state.ot[key] || []).some(entry => entry.date === dateStr);
                if (!alreadyExists) {
                    foundDate = dateStr;
                    break;
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        if(!foundDate) {
            alert(`No available ${dayType} found in the current pay period to add OT.`);
            return;
        }

        let multiplier = 1.5;
        let notes = `Quick Add: ${hours}h ${dayType}`;
        
        if (!state.ot[key]) state.ot[key] = [];
        state.ot[key].push({ date: foundDate, start: '', end: '', hours: hours, mult: multiplier, notes: notes });
        state.ot[key].sort((a, b) => new Date(a.date) - new Date(b.date));
        saveState();
        refresh();
        showSaveMessage(`✅ Added ${hours}h OT for ${foundDate}.`);
    }

    // --- Initialize Everything ---
    document.addEventListener('DOMContentLoaded', function() {
      months.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.key; opt.textContent = m.fullLabel; monthSelect.appendChild(opt);
      });
      
      const today = new Date();
      const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      if (monthSelect.querySelector(`option[value="${currentMonthKey}"]`)) {
          monthSelect.value = currentMonthKey;
      } else {
          monthSelect.value = '2025-08';
      }

      flatpickr("#payPeriodStart, #payPeriodEnd, #startDate, #endDate, #holidayPicker, #expenseDate", {
        dateFormat: "Y-m-d", altInput: true, altFormat: "d M, Y"
      });
      flatpickr("#blackoutDates", { dateFormat: "Y-m-d", altInput: true, altFormat: "d M, Y", mode: "multiple" });
      document.getElementById('expenseDate')._flatpickr.setDate(new Date(), true);

      const smartSalaryInput = document.getElementById('smartBasicSalary'); 
      smartSalaryInput.value = '3700.00'; 
      smartSalaryInput.dispatchEvent(new Event('input'));

      const initialYear = new Date(monthSelect.value + '-01').getFullYear();
      populateHolidayChecklist(initialYear.toString());
      renderPatternTemplates();
      
      monthSelect.addEventListener('change', refresh);
      
      saveParamsBtn.addEventListener('click', () => {
        saveParamsBtn.classList.add('loading');
        setTimeout(() => { 
            saveParams(monthSelect.value); 
            saveParamsBtn.classList.remove('loading');
        }, 500);
      });

      copyLastMonthBtn.addEventListener('click', () => {
        const currentKey = monthSelect.value;
        const currentIndex = months.findIndex(m => m.key === currentKey);
        if (currentIndex > 0) {
            const lastMonthKey = months[currentIndex - 1].key;
            if (confirm(`This will overwrite the current settings for ${months[currentIndex].fullLabel} with the data from ${months[currentIndex - 1].fullLabel}. Are you sure?`)) {
                state.params[currentKey] = { ...state.params[lastMonthKey] };
                saveState();
                refresh();
                showSaveMessage(`✅ Settings from ${months[currentIndex - 1].fullLabel} copied.`);
            }
        } else {
            alert("Cannot copy, as this is the first month in the list.");
        }
      });
      
      addRowBtn.addEventListener('click', () => {
        const key = monthSelect.value;
        if (!state.ot[key]) state.ot[key] = [];
        const { startDate } = getOtDateRangeObjects(key);
        const todayStr = formatDateToYyyyMmDd(startDate);
        state.ot[key].push({ date: todayStr, start: '', end: '', hours: 0, mult: 1.5, notes: '' });
        saveState();
        refresh();
      });
      
      clearRowsBtn.addEventListener('click', () => {
        const key = monthSelect.value;
        const monthName = months.find(m => m.key === key)?.fullLabel || 'this month';
        if (confirm(`⚠️ Are you sure you want to clear all OT entries for ${monthName}? This cannot be undone.`)) {
          state.ot[key] = [];
          saveState();
          refresh();
        }
      });
      
      document.getElementById('resetAll').addEventListener('click', () => {
        if (confirm('⚠️ This will reset ALL data including settings, OT entries, and expenses for all months. Are you absolutely sure? This cannot be undone.')) {
          localStorage.removeItem('salary-ot-state-v5');
          state = loadState();
          showSaveMessage('🔄 All data has been reset to defaults');
          monthSelect.innerHTML = '';
          months.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.key; opt.textContent = m.fullLabel; monthSelect.appendChild(opt);
          });
          monthSelect.value = '2025-08';
          renderPatternTemplates();
          refresh();
        }
      });

      document.getElementById('exportData').addEventListener('click', exportData);
      document.getElementById('importData').addEventListener('click', importData);

      document.getElementById('whatIfSlider').addEventListener('input', (e) => {
          const hours = parseFloat(e.target.value);
          document.getElementById('whatIfHoursLabel').textContent = `${hours.toFixed(1)}h`;
          updateWhatIf(hours);
      });
      
      smartGoalToggle.addEventListener('change', () => {
        updateSmartGoalUI();
        saveParams(monthSelect.value);
      });

      desiredSavings.addEventListener('input', () => {
          clearTimeout(desiredSavings.saveTimeout);
          desiredSavings.saveTimeout = setTimeout(() => {
            state.params[monthSelect.value].desiredSavings = Number(desiredSavings.value || 0);
            saveState();
            refresh();
          }, 1000);
      });

      basic.addEventListener('input', () => {
        const basicSal = parseFloat(basic.value) || 0;
        const calculatedHourly = basicSal > 0 ? basicSal / 208 : 0;
        hourly.value = calculatedHourly.toFixed(4);
      });

      const autoSaveInputs = [basic, claims, hpAllow, incentive, advance, epf, socso, pcb, eis, incomeGoal, payPeriodStart, payPeriodEnd];
      autoSaveInputs.forEach(input => {
        const eventType = input.id.includes('Period') ? 'change' : 'input';
        input.addEventListener(eventType, () => {
          if (input.id === 'incomeGoal' && smartGoalToggle.checked) return;
          clearTimeout(input.saveTimeout);
          input.saveTimeout = setTimeout(() => { saveParams(monthSelect.value); }, 1000);
        });
      });

      document.querySelectorAll('.adjust-btn').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            const amount = Number(button.dataset.amount);
            const input = document.getElementById(targetId);
            if (input) {
                let currentValue = parseFloat(input.value) || 0;
                let newValue = currentValue + amount;
                if (newValue < 0) newValue = 0;
                input.value = newValue.toFixed(2);
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
      });

      document.getElementById('smartBasicSalary').addEventListener('input', function() { 
        const basicSalary = parseFloat(this.value) || 0; 
        const hourlyRate = basicSalary > 0 ? (basicSalary / 208).toFixed(2) : '0.00'; 
        const display = document.getElementById('smartHourlyRateDisplay'); 
        display.innerHTML = `Hourly Rate: RM <strong>${hourlyRate}</strong> | Rest Day: RM ${(hourlyRate * 0.5).toFixed(2)} | Normal/Off: RM ${(hourlyRate * 1.5).toFixed(2)} | Holiday: RM ${(hourlyRate * 2.0).toFixed(2)}`; 
        display.style.display = basicSalary > 0 ? 'block' : 'none'; 
      });

      document.getElementById('addCustomPatternBtn').addEventListener('click', () => {
        otPatterns.custom.push({
            id: `custom_${Date.now()}`,
            name: '📝 New Custom Pattern',
            pattern: [0, 0, 0, 0, 0, 0, 0]
        });
        saveState();
        renderPatternTemplates();
      });
      
      document.getElementById('addExpenseForm').addEventListener('submit', handleExpenseSubmit);
      document.getElementById('expenseDesc').addEventListener('input', e => {
          const suggestedCategory = suggestCategory(e.target.value);
          if (suggestedCategory) {
              document.getElementById('expenseCat').value = suggestedCategory;
          }
      });
      document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);
      document.getElementById('expenseSearch').addEventListener('input', () => renderExpenses(monthSelect.value));
      document.querySelectorAll('#expensesTable th[data-sort]').forEach(th => { th.addEventListener('click', () => setExpenseSort(th.dataset.sort)); });
      document.getElementById('clearExpensesBtn').addEventListener('click', () => {
        const key = monthSelect.value;
        const monthName = months.find(m => m.key === key)?.fullLabel || 'this month';
        if (confirm(`⚠️ Are you sure you want to clear all expenses for ${monthName}?`)) {
            state.expenses[key] = [];
            saveState();
            refresh();
        }
      });
      document.getElementById('copyRecurringExpensesBtn').addEventListener('click', copyRecurringExpenses);

      document.getElementById('setBudgetsBtn').addEventListener('click', openBudgetModal);
      document.getElementById('saveBudgetsBtn').addEventListener('click', saveBudgets);
      
      document.getElementById('viewAnnualSummaryBtn').addEventListener('click', openAnnualSummaryModal);
      document.getElementById('annualSummaryYearSelect').addEventListener('change', generateAnnualSummary);
      
      document.querySelectorAll('.split-btn').forEach(btn => {
          btn.addEventListener('click', () => {
              activeSplitMode = btn.dataset.split;
              updateSplitButtons();
              calculateSplit();
          });
      });
      document.getElementById('expenseTotalCost').addEventListener('input', calculateSplit);

      document.getElementById('generatePayslipBtn').addEventListener('click', openPayslipModal);
      document.getElementById('quickAddWeekday').addEventListener('click', () => quickAddOT('weekday', 2));
      document.getElementById('quickAddSat4').addEventListener('click', () => quickAddOT('saturday', 4));
      document.getElementById('quickAddSat8').addEventListener('click', () => quickAddOT('saturday', 8));

      if (!state.ot['2025-07'] || state.ot['2025-07'].length === 0) {
        state.ot['2025-07'] = [ {date:'2025-07-24', start: '19:00', end: '01:00', hours:6.00, mult:1.5, notes: ''}, {date:'2025-07-23', start: '19:00', end: '00:30', hours:5.50, mult:1.5, notes: ''}, {date:'2025-07-22', start: '19:00', end: '00:30', hours:5.50, mult:1.5, notes: ''}, {date:'2025-07-21', start: '19:00', end: '23:30', hours:4.50, mult:1.5, notes: ''}, {date:'2025-07-20', start: '10:00', end: '14:00', hours:4.00, mult:0.5, notes: ''}, {date:'2025-07-19', start: '10:00', end: '14:30', hours:4.50, mult:1.5, notes: ''}, {date:'2025-07-18', start: '19:00', end: '23:30', hours:4.50, mult:1.5, notes: ''}, {date:'2025-07-17', start: '19:00', end: '00:30', hours:5.50, mult:1.5, notes: ''}, {date:'2025-07-16', start: '19:00', end: '01:30', hours:6.50, mult:1.5, notes: ''}, {date:'2025-07-15', start: '19:00', end: '02:00', hours:7.00, mult:1.5, notes: ''}, {date:'2025-07-14', start: '19:00', end: '22:30', hours:3.50, mult:1.5, notes: ''}, {date:'2025-07-11', start: '19:00', end: '00:00', hours:5.00, mult:1.5, notes: ''}, {date:'2025-07-10', start: '19:00', end: '01:30', hours:6.50, mult:1.5, notes: ''}, {date:'2025-07-09', start: '19:00', end: '01:00', hours:6.00, mult:1.5, notes: ''}, {date:'2025-07-08', start: '19:00', end: '01:30', hours:6.50, mult:1.5, notes: ''}, {date:'2025-07-07', start: '19:00', end: '00:55', hours:5.92, mult:1.5, notes: ''}, {date:'2025-07-06', start: '10:00', end: '14:00', hours:4.00, mult:0.5, notes: ''}, {date:'2025-07-05', start: '10:00', end: '14:00', hours:4.00, mult:1.5, notes: ''}, {date:'2025-07-04', start: '19:00', end: '00:00', hours:5.00, mult:1.5, notes: ''}, {date:'2025-07-03', start: '19:00', end: '01:00', hours:6.00, mult:1.5, notes: ''}, {date:'2025-07-02', start: '19:00', end: '23:30', hours:4.50, mult:1.5, notes: ''}, {date:'2025-07-01', start: '19:00', end: '02:30', hours:7.50, mult:1.5, notes: ''} ];
        saveState();
      }

      initCharts();
      setupModals();
      refresh();
    });
