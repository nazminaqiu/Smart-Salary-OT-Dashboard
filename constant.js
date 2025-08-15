// --- constants.js ---

// Key for storing data in localStorage
export const STORAGE_KEY = 'salary-ot-state-v5';

// Default financial and deduction parameters
export const defaultParams = {
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

// Static data for expense categories and OT patterns
export const expenseCategories = ["Food & Dining", "Transportation", "Bills & Utilities", "Housing", "Shopping", "Entertainment", "Health & Fitness", "Personal Care", "Education", "Miscellaneous"];

export const categoryKeywords = {
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

export const otPatterns = {
    predefined: [
        { id: 'crunch', name: '🚀 Project Crunch Week', pattern: [4, 5, 6, 5, 4, 0, 0], description: 'High intensity on weekdays to meet project deadlines. Weekends are free.' },
        { id: 'warrior', name: '⚡ Weekend Warrior', pattern: [0, 0, 0, 0, 0, 8, 8], description: 'Focuses all overtime on Saturday and Sunday for maximum impact with free weekdays.' },
        { id: 'steady', name: '🌱 Steady Grind', pattern: [3, 3, 3, 3, 3, 4, 0], description: 'A balanced approach with moderate, consistent overtime on weekdays and a short Saturday.' },
        { id: 'maximizer', name: '🆘 Emergency Sprint', pattern: [4, 4, 4, 4, 4, 8, 8], description: 'Maximum effort. High hours every day of the week to maximize earnings quickly.' }
    ],
    custom: []
};

// Mock Holiday API Data
export const mockHolidayAPI = {
    "2025": [ { date: '2025-01-01', name: 'New Year\'s Day' }, /* ... other holidays ... */ ],
    "2026": [ { date: '2026-01-01', name: 'New Year\'s Day' }, /* ... other holidays ... */ ],
    "2027": [ { date: '2027-01-01', name: 'New Year\'s Day' }, /* ... other holidays ... */ ]
};