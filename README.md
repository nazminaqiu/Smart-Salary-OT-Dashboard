# 💼 Advanced Smart Salary & Overtime Tracker

A **browser-based financial management tool** that helps you track
salary, expenses, savings, and smart overtime (OT) allocation with
AI-powered planning.

This project is built as a single HTML application with embedded
JavaScript and CSS, designed for personal finance tracking without
requiring a backend server.

------------------------------------------------------------------------

## 🚀 Features

-   **Salary & Auto-Deductions**
    -   Input salary, claims, allowances, incentives, bonuses, and other
        income.\
    -   Auto-calculates EPF, SOCSO, EIS, and PCB.
-   **Savings Targets & Emergency Funds**
    -   Set monthly savings goals.\
    -   AI Coach suggests ways to optimize savings.\
    -   Mini-simulator to test "what-if" expense reductions.
-   **Expenses Tracker**
    -   Track daily expenses with split profiles (mine, partner, 50/50,
        custom).\
    -   Categorized expenses with recurring option.\
    -   Import, copy last month's expenses, and export as CSV/PDF.
-   **Smart Overtime Allocator**
    -   Plan OT hours across weekdays, weekends, rest days, and public
        holidays.\
    -   Supports strategies (balanced, front-load weekends, back-load,
        etc.).\
    -   Preview, auto-generate, and adjust allocations dynamically.\
    -   Calendar view with inline OT adjustments.
-   **Financial Summary Dashboard**
    -   Visual summary of income, deductions, expenses, and savings.\
    -   Breakdown by category, OT projections, and household coverage.
-   **Export & Backup**
    -   Export/Import data in JSON, CSV, and PDF formats.\
    -   Generate detailed financial reports (full, expenses-only,
        OT-only).
-   **UI/UX Enhancements**
    -   Light/Dark theme toggle.\
    -   Responsive design for mobile & desktop.\
    -   Sticky OT summary and calendar heatmap.

------------------------------------------------------------------------

## 🛠️ Technologies Used

-   **HTML5, CSS3, JavaScript (Vanilla)**\
-   [Flatpickr](https://flatpickr.js.org/) -- date picker\
-   [FullCalendar](https://fullcalendar.io/) -- calendar scheduling\
-   [jsPDF + AutoTable](https://github.com/parallax/jsPDF) -- PDF
    export\
-   [html2canvas](https://html2canvas.hertzen.com/) -- screenshot-based
    PDF rendering

------------------------------------------------------------------------

## 📂 Project Structure

    salary-tracker-system-V2-final.html   # Main application (single-page app)

*(All logic and styling are embedded in this HTML file)*

------------------------------------------------------------------------

## ▶️ How to Use

1.  Download or clone the repository:

    ``` bash
    git clone https://github.com/your-username/salary-tracker-system.git
    cd salary-tracker-system
    ```

2.  Open `salary-tracker-system-V2-final.html` in your browser.

    -   No installation required (runs entirely client-side).

3.  Start tracking your salary, OT, and expenses!

------------------------------------------------------------------------

## 📤 Export & Backup

-   **Full Backup (.json)** → re-import anytime.\
-   **Expenses (.csv)** → detailed expenses list.\
-   **Overtime (.csv)** → OT entries.\
-   **Reports (.pdf)** → financial summaries, expenses-only, or OT-only.

------------------------------------------------------------------------

## 🔮 Future Enhancements

-   Cloud sync with Google Drive / Firebase.\
-   Mobile PWA version.\
-   Multi-user household mode.\
-   AI-powered expense categorization.

------------------------------------------------------------------------

## 📜 License

This project is licensed under the **MIT License** -- feel free to use,
modify, and distribute.
