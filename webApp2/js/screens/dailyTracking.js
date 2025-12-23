// Daily Tracking Screen
// Monthly daily tracking table showing budget vs actual performance

class DailyTrackingScreen {
    constructor() {
        this.data = null;
        this.targets = null;
        this.currentMonth = null;
        this.currentViewYear = null;
        this.monthPickerBound = false;
    }

    async load() {
        console.log('Loading Daily Tracking...');
        
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const date = window.datePicker?.getSelectedDate();
        
        if (!pharmacy || !date) {
            console.warn('Missing pharmacy or date selection');
            this.showEmptyState();
            return;
        }

        // Get month from selected date or localStorage
        const storedMonth = localStorage.getItem('daily_tracking_month');
        if (storedMonth) {
            this.currentMonth = storedMonth;
        } else {
            this.currentMonth = date.slice(0, 7); // YYYY-MM
        }

        // Show loading overlay
        if (window.loadingOverlay) {
            window.loadingOverlay.show('Loading daily tracking data...');
        }

        try {
            await this.loadData(pharmacy.id, this.currentMonth);
            this.render();
            this.setupMonthPicker();
        } catch (error) {
            console.error('Error loading daily tracking:', error);
            this.showError(error);
        } finally {
            // Hide loading overlay
            if (window.loadingOverlay) {
                window.loadingOverlay.hide();
            }
        }
    }

    async loadData(pharmacyId, month) {
        // Load days and targets in parallel
        const [daysData, targetsData] = await Promise.all([
            window.api.getDays(pharmacyId, month),
            window.api.getTargets(pharmacyId, month).catch(e => {
                console.warn('Could not load targets:', e);
                return { targets: [] };
            })
        ]);

        this.data = Array.isArray(daysData) ? daysData : [];
        this.targets = targetsData?.targets || [];
    }

    render() {
        const mainContent = document.querySelector('.content-area');
        if (!mainContent) return;

        // Build the normalized month data
        const normalizedData = this.buildMonthData();
        
        // Calculate totals
        const totals = this.calculateTotals(normalizedData);

        mainContent.innerHTML = `
            <div class="dashboard-container">
                <div class="daily-tracking-container">
                    <div class="daily-tracking-table-header">
                        <button id="month-picker-btn" class="month-picker-btn">
                            <span id="selected-month-display">${this.getMonthYearDisplay()}</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                    </div>
                    <div class="daily-tracking-table-container">
                        <table class="daily-tracking-table">
                            <thead>
                                <tr>
                                    <th class="col-date">DATE</th>
                                    <th class="col-num">BUDGET T/O</th>
                                    <th class="col-num">ACTUAL T/O</th>
                                    <th class="col-num col-gp">GP%</th>
                                    <th class="col-num">GP VALUE</th>
                                    <th class="col-num">BUDGET SPEND (75% OF T/O)</th>
                                    <th class="col-num">ACTUAL SPEND (75% OF T/O)</th>
                                    <th class="col-num">PURCHASES</th>
                                    <th class="col-num">PURCHASES %</th>
                                    <th class="col-num">PURCHASE BUDGET LEFT</th>
                                    <th class="col-num col-soh">STOCK ON HAND</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.renderTableRows(normalizedData)}
                            </tbody>
                            <tfoot>
                                <tr class="total-row">
                                    <td class="col-date">TOTAL</td>
                                    <td class="col-num">${this.formatNumber(totals.totalBudgetTo)}</td>
                                    <td class="col-num actual-to">${this.formatNumber(totals.totalTurnover)}</td>
                                    <td class="col-num col-gp">${this.formatPercent(totals.avgGpPct)}</td>
                                    <td class="col-num">${this.formatNumber(totals.totalGpValue)}</td>
                                    <td class="col-num">${this.formatNumber(totals.totalBudgetSpend)}</td>
                                    <td class="col-num">${this.formatNumber(totals.totalActualSpend)}</td>
                                    <td class="col-num">${this.formatNumber(totals.totalPurchases)}</td>
                                    <td class="col-num">${this.formatPercent(totals.avgPurchasesPct)}</td>
                                    <td class="col-num"></td>
                                    <td class="col-num col-soh"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
            
            <!-- Month Picker Modal -->
            <div id="month-picker-modal-overlay" class="month-picker-modal-overlay">
                <div class="month-picker-modal">
                    <div class="month-picker-header">
                        <h3>SELECT MONTH</h3>
                        <button id="month-picker-close-btn" class="month-picker-close-btn" aria-label="Close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="month-picker-content">
                        <div class="month-picker-year-nav">
                            <button id="month-picker-prev-year" class="month-picker-nav-btn" aria-label="Previous year">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                            </button>
                            <span id="month-picker-year" class="month-picker-year-display"></span>
                            <button id="month-picker-next-year" class="month-picker-nav-btn" aria-label="Next year">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="9 6 15 12 9 18"></polyline>
                                </svg>
                            </button>
                        </div>
                        <div id="month-picker-grid" class="month-picker-grid">
                        </div>
                    </div>
                    <div class="month-picker-footer">
                        <button id="month-picker-current-btn" class="month-picker-action-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="12" x2="16" y2="12"></line>
                            </svg>
                            Current Month
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    setupMonthPicker() {
        if (this.monthPickerBound) return;
        this.monthPickerBound = true;

        // Initialize the view year from current month
        const [year] = this.currentMonth.split('-').map(Number);
        this.currentViewYear = year;

        // Month picker button
        const monthBtn = document.getElementById('month-picker-btn');
        if (monthBtn) {
            monthBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const overlay = document.getElementById('month-picker-modal-overlay');
                if (overlay && overlay.classList.contains('active')) {
                    this.closeMonthPicker();
                } else {
                    this.openMonthPicker();
                }
            });
        }

        // Close button
        const closeBtn = document.getElementById('month-picker-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeMonthPicker());
        }

        // Year navigation
        const prevYearBtn = document.getElementById('month-picker-prev-year');
        const nextYearBtn = document.getElementById('month-picker-next-year');
        if (prevYearBtn) {
            prevYearBtn.addEventListener('click', () => this.navigateYear('prev'));
        }
        if (nextYearBtn) {
            nextYearBtn.addEventListener('click', () => this.navigateYear('next'));
        }

        // Current month button
        const currentMonthBtn = document.getElementById('month-picker-current-btn');
        if (currentMonthBtn) {
            currentMonthBtn.addEventListener('click', () => {
                const now = new Date();
                const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                this.selectMonth(currentMonth);
            });
        }

        // Overlay click
        const overlay = document.getElementById('month-picker-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeMonthPicker();
                }
            });
        }

        // Escape key
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') {
                const overlay = document.getElementById('month-picker-modal-overlay');
                if (overlay && overlay.classList.contains('active')) {
                    this.closeMonthPicker();
                }
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    }

    buildMonthGrid() {
        const grid = document.getElementById('month-picker-grid');
        const yearDisplay = document.getElementById('month-picker-year');
        
        if (!grid || !yearDisplay) return;

        yearDisplay.textContent = this.currentViewYear;

        const months = [
            { short: 'Jan', full: 'January', num: '01' },
            { short: 'Feb', full: 'February', num: '02' },
            { short: 'Mar', full: 'March', num: '03' },
            { short: 'Apr', full: 'April', num: '04' },
            { short: 'May', full: 'May', num: '05' },
            { short: 'Jun', full: 'June', num: '06' },
            { short: 'Jul', full: 'July', num: '07' },
            { short: 'Aug', full: 'August', num: '08' },
            { short: 'Sep', full: 'September', num: '09' },
            { short: 'Oct', full: 'October', num: '10' },
            { short: 'Nov', full: 'November', num: '11' },
            { short: 'Dec', full: 'December', num: '12' }
        ];

        const now = new Date();
        const currentMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        grid.innerHTML = months.map(m => {
            const monthValue = `${this.currentViewYear}-${m.num}`;
            const isSelected = monthValue === this.currentMonth;
            const isCurrent = monthValue === currentMonthValue;
            
            let className = 'month-picker-month';
            if (isSelected) className += ' selected';
            if (isCurrent && !isSelected) className += ' current';

            return `
                <button class="${className}" data-month="${monthValue}" title="${m.full} ${this.currentViewYear}">
                    ${m.short}
                </button>
            `;
        }).join('');

        // Add click handlers to month buttons
        grid.querySelectorAll('.month-picker-month').forEach(btn => {
            btn.addEventListener('click', () => {
                const monthValue = btn.dataset.month;
                this.selectMonth(monthValue);
            });
        });
    }

    navigateYear(direction) {
        if (direction === 'prev') {
            this.currentViewYear--;
        } else {
            this.currentViewYear++;
        }
        this.buildMonthGrid();
    }

    selectMonth(monthValue) {
        this.currentMonth = monthValue;
        localStorage.setItem('daily_tracking_month', monthValue);
        
        // Update the display
        const display = document.getElementById('selected-month-display');
        if (display) {
            display.textContent = this.getMonthYearDisplay();
        }

        this.closeMonthPicker();
        
        // Reload data for the new month
        this.monthPickerBound = false;
        this.load();
    }

    openMonthPicker() {
        // Initialize view year from current month
        const [year] = this.currentMonth.split('-').map(Number);
        this.currentViewYear = year;
        
        this.buildMonthGrid();
        
        const overlay = document.getElementById('month-picker-modal-overlay');
        const modal = document.querySelector('.month-picker-modal');
        const button = document.getElementById('month-picker-btn');
        
        if (overlay && modal && button) {
            if (!this.isMobile()) {
                const buttonRect = button.getBoundingClientRect();
                modal.style.top = `${buttonRect.bottom + 8}px`;
                modal.style.left = `${buttonRect.left}px`;
                modal.style.right = 'auto';
            }
            
            overlay.classList.add('active');
            if (this.isMobile()) {
                document.body.style.overflow = 'hidden';
            }
        }
    }

    closeMonthPicker() {
        const overlay = document.getElementById('month-picker-modal-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    isMobile() {
        return window.innerWidth <= 768;
    }

    buildMonthData() {
        // Parse the selected month to get year and month
        const [year, month] = this.currentMonth.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();

        // Create a map of existing data by date
        const dataMap = {};
        this.data.forEach(r => {
            dataMap[r.business_date] = r;
        });

        // Create a map of targets by date
        const targetsMap = {};
        this.targets.forEach(t => {
            targetsMap[t.date] = t;
        });

        // Generate complete month structure
        const normalized = [];
        let runningBudgetSpend = 0;

        // First pass: calculate total budget spend for running tally
        for (let d = 1; d <= daysInMonth; d++) {
            const jsDate = new Date(year, month - 1, d);
            const dateStr = this.formatYmdLocal(jsDate);
            const target = targetsMap[dateStr];
            const budgetTurn = target ? Number(target.value || 0) : 0;
            runningBudgetSpend += budgetTurn ? budgetTurn * 0.75 : 0;
        }

        let runningPurchaseBudgetLeft = runningBudgetSpend;

        // Second pass: build normalized data
        for (let d = 1; d <= daysInMonth; d++) {
            const jsDate = new Date(year, month - 1, d);
            const dateStr = this.formatYmdLocal(jsDate);
            const weekdayIdx = jsDate.getDay();
            const isWeekend = weekdayIdx === 0 || weekdayIdx === 6;
            const weekday = jsDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            const dayNum = jsDate.getDate();
            const monthShort = jsDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

            // Get actual data if available
            const r = dataMap[dateStr] || {};
            const hasData = !!dataMap[dateStr];

            // Get values
            const turnover = Number(r.turnover || 0);
            const gpValue = Number(r.gp_value || 0);
            const gpPct = (r.gp_pct !== undefined && r.gp_pct !== null) 
                ? Number(r.gp_pct) 
                : (turnover > 0 ? (gpValue / turnover) * 100 : null);
            const closingStock = Number(r.closing_stock || 0);
            const purchases = Number(r.purchases || r.daily_purchases || r.purchases_value || 0);

            // Get budget from targets
            const target = targetsMap[dateStr];
            const budgetTurn = target ? Number(target.value || 0) : 0;
            const budgetSpend = budgetTurn > 0 ? budgetTurn * 0.75 : null;
            const actualSpend = turnover > 0 ? turnover * 0.75 : 0;

            // Calculate purchases percentage
            const purchasesPct = turnover > 0 && purchases > 0 ? (purchases / turnover) * 100 : null;

            // Calculate running purchase budget left
            runningPurchaseBudgetLeft -= purchases;

            normalized.push({
                date: jsDate,
                dateStr,
                dateDisplay: `${weekday} ${monthShort} ${dayNum}`,
                isWeekend,
                hasData,
                turnover,
                gpValue,
                gpPct,
                closingStock,
                budgetTurn,
                budgetSpend,
                actualSpend,
                purchases,
                purchasesPct,
                purchaseBudgetLeft: runningBudgetSpend > 0 ? runningPurchaseBudgetLeft : null
            });
        }

        return normalized;
    }

    calculateTotals(normalizedData) {
        let totalBudgetTo = 0;
        let totalTurnover = 0;
        let totalGpValue = 0;
        let totalBudgetSpend = 0;
        let totalActualSpend = 0;
        let totalPurchases = 0;
        let daysWithTurnover = 0;
        let daysWithPurchases = 0;

        normalizedData.forEach(day => {
            if (day.budgetTurn > 0) totalBudgetTo += day.budgetTurn;
            totalTurnover += day.turnover;
            totalGpValue += day.gpValue;
            if (day.budgetSpend !== null) totalBudgetSpend += day.budgetSpend;
            totalActualSpend += day.actualSpend;
            totalPurchases += day.purchases;
            if (day.turnover > 0) daysWithTurnover++;
            if (day.purchases > 0) daysWithPurchases++;
        });

        // Calculate averages
        const avgGpPct = totalTurnover > 0 ? (totalGpValue / totalTurnover) * 100 : null;
        const avgPurchasesPct = totalTurnover > 0 && totalPurchases > 0 ? (totalPurchases / totalTurnover) * 100 : null;
        
        // Get final purchase budget left (last value)
        const lastDay = normalizedData[normalizedData.length - 1];
        const purchaseBudgetLeft = lastDay?.purchaseBudgetLeft ?? (totalBudgetSpend - totalPurchases);

        return {
            totalBudgetTo,
            totalTurnover,
            totalGpValue,
            totalBudgetSpend,
            totalActualSpend,
            totalPurchases,
            avgGpPct,
            avgPurchasesPct,
            purchaseBudgetLeft
        };
    }

    renderTableRows(normalizedData) {
        return normalizedData.map(day => {
            const rowClass = day.isWeekend ? 'weekend-row' : (day.hasData ? '' : 'no-data-row');
            
            // Determine purchase budget left class
            let pbLeftClass = '';
            if (day.purchaseBudgetLeft !== null) {
                pbLeftClass = day.purchaseBudgetLeft >= 0 ? 'positive' : 'negative';
            }

            return `
                <tr class="${rowClass}">
                    <td class="col-date">${day.dateDisplay}</td>
                    <td class="col-num">${day.budgetTurn > 0 ? this.formatNumber(day.budgetTurn) : '—'}</td>
                    <td class="col-num actual-to">${day.hasData ? this.formatNumber(day.turnover) : '—'}</td>
                    <td class="col-num col-gp">${day.hasData ? this.formatPercent(day.gpPct) : '—'}</td>
                    <td class="col-num">${day.hasData ? this.formatNumber(day.gpValue) : '—'}</td>
                    <td class="col-num">${day.budgetSpend !== null ? this.formatNumber(day.budgetSpend) : '—'}</td>
                    <td class="col-num">${day.hasData ? this.formatNumber(day.actualSpend) : '—'}</td>
                    <td class="col-num">${day.hasData ? this.formatNumber(day.purchases) : '—'}</td>
                    <td class="col-num">${day.purchasesPct !== null ? this.formatPercent(day.purchasesPct) : '—'}</td>
                    <td class="col-num purchase-budget-left ${pbLeftClass}">${day.purchaseBudgetLeft !== null ? this.formatNumber(day.purchaseBudgetLeft) : '—'}</td>
                    <td class="col-num col-soh">${day.hasData && day.closingStock > 0 ? this.formatNumber(day.closingStock) : '—'}</td>
                </tr>
            `;
        }).join('');
    }

    getMonthYearDisplay() {
        if (!this.currentMonth) return 'Daily Tracking';
        const [year, month] = this.currentMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    formatYmdLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatNumber(value) {
        if (value === null || value === undefined || isNaN(value)) return '—';
        return Number(value).toLocaleString('en-ZA', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
    }

    formatMoney(value) {
        if (value === null || value === undefined || isNaN(value)) return '—';
        const num = Math.round(Number(value));
        return 'R ' + num.toLocaleString('en-ZA');
    }

    formatPercent(value) {
        if (value === null || value === undefined || isNaN(value)) return '—';
        return Math.round(Number(value)) + '%';
    }

    showEmptyState(message = 'Select a pharmacy and date to view daily tracking') {
        const mainContent = document.querySelector('.content-area');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="dashboard-container">
                    <div class="empty-state">
                        <h2>Daily Tracking</h2>
                        <p>${message}</p>
                    </div>
                </div>
            `;
        }
    }

    showError(error) {
        const mainContent = document.querySelector('.content-area');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="dashboard-container">
                    <div class="error-state">
                        <h2>Error Loading Daily Tracking</h2>
                        <p>${error.message || 'An error occurred while loading data.'}</p>
                    </div>
                </div>
            `;
        }
    }
}

// Export class
window.DailyTrackingScreen = DailyTrackingScreen;

