// Targets Screen
// Monthly targets management - set and edit target turnovers for each day

class TargetsScreen {
    constructor() {
        this.targetsData = [];
        this.prevYearData = {};
        this.currentMonth = null;
        this.currentViewYear = null;
        this.listenersBound = false;
        this.monthPickerBound = false;
    }

    async load() {
        console.log('Loading Targets...');
        
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const date = window.datePicker?.getSelectedDate();
        
        if (!pharmacy || !date) {
            console.warn('Missing pharmacy or date selection');
            this.showEmptyState();
            return;
        }

        // Get month from selected date or localStorage
        const storedMonth = localStorage.getItem('targets_month');
        if (storedMonth) {
            this.currentMonth = storedMonth;
        } else {
            this.currentMonth = date.slice(0, 7); // YYYY-MM
        }

        // Show loading overlay
        if (window.loadingOverlay) {
            window.loadingOverlay.show('Loading targets data...');
        }

        try {
            await this.loadData(pharmacy.id, this.currentMonth);
            this.render();
            this.setupMonthPicker();
        } catch (error) {
            console.error('Error loading targets:', error);
            this.showError(error);
        } finally {
            // Hide loading overlay
            if (window.loadingOverlay) {
                window.loadingOverlay.hide();
            }
        }
    }

    async loadData(pharmacyId, month) {
        // Parse the selected month to get year and month
        const [year, mon] = month.split('-').map(Number);
        const daysInMonth = new Date(year, mon, 0).getDate();

        // Build the list of dates for this month and their previous year comparables (364 days earlier)
        const dates = [];
        const prevDates = [];
        
        for (let d = 1; d <= daysInMonth; d++) {
            const jsDate = new Date(year, mon - 1, d);
            const dateStr = this.formatYmdLocal(jsDate);
            const prevDate = this.addDays(jsDate, -364); // Keep weekday alignment
            const prevDateStr = this.formatYmdLocal(prevDate);
            
            const weekdayIdx = jsDate.getDay();
            const isWeekend = weekdayIdx === 0 || weekdayIdx === 6;
            const weekday = jsDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            const monthShort = jsDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
            const dayNum = jsDate.getDate();
            const dateLabel = jsDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
            
            dates.push({
                date: dateStr,
                prevDate: prevDateStr,
                jsDate,
                weekday,
                monthShort,
                dayNum,
                dateLabel,
                dateDisplay: `${weekday} ${monthShort} ${dayNum}`,
                isWeekend
            });
            
            prevDates.push(prevDateStr);
        }

        // Get unique months needed for previous year data
        const monthsNeeded = [...new Set(prevDates.map(d => d.slice(0, 7)))];
        const prevYearMap = {};

        // Fetch previous year data for each required month
        await Promise.all(monthsNeeded.map(async (monthStr) => {
            try {
                const data = await window.api.getDays(pharmacyId, monthStr);
                if (Array.isArray(data)) {
                    data.forEach(rec => {
                        prevYearMap[rec.business_date] = rec;
                    });
                }
            } catch (e) {
                console.error('Error loading previous year data for', monthStr, ':', e);
            }
        }));

        this.prevYearData = prevYearMap;

        // Load saved targets
        let savedTargets = {};
        try {
            const targetsResponse = await window.api.getTargets(pharmacyId, month);
            if (targetsResponse.targets && Array.isArray(targetsResponse.targets)) {
                targetsResponse.targets.forEach(target => {
                    savedTargets[target.date] = Number(target.value);
                });
            }
        } catch (e) {
            console.error('Error loading saved targets:', e);
        }

        // Build targets data array
        this.targetsData = dates.map(dateInfo => {
            const prevRec = prevYearMap[dateInfo.prevDate];
            const prevTurnover = prevRec ? Number(prevRec.turnover || 0) : null;
            const savedTarget = savedTargets[dateInfo.date];
            let growthPct = '';
            let targetTurnover = savedTarget !== undefined ? savedTarget.toFixed(2) : '';

            // Calculate growth % if we have both target and previous year data
            if (savedTarget && prevTurnover !== null && prevTurnover > 0) {
                const growth = ((savedTarget / prevTurnover) - 1) * 100;
                growthPct = growth.toFixed(2);
            }

            return {
                ...dateInfo,
                prevYearTurnover: prevTurnover,
                growthPercent: growthPct,
                targetTurnover: targetTurnover,
            };
        });
    }

    render() {
        const mainContent = document.querySelector('.content-area');
        if (!mainContent) return;

        // Calculate totals
        const totals = this.calculateTotals();

        mainContent.innerHTML = `
            <div class="dashboard-container">
                <div class="targets-container">
                    <div class="targets-table-header">
                        <button id="targets-month-picker-btn" class="month-picker-btn">
                            <span id="targets-selected-month-display">${this.getMonthYearDisplay()}</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                    </div>
                    <div class="targets-summary-cards">
                        <div class="targets-summary-card">
                            <span class="targets-card-label">TOTAL TARGET</span>
                            <span class="targets-card-value" id="summary-total-target">${this.formatMoney(totals.totalTarget)}</span>
                        </div>
                        <div class="targets-summary-card">
                            <span class="targets-card-label">PREV YEAR TOTAL</span>
                            <span class="targets-card-value" id="summary-prev-year">${this.formatMoney(totals.totalPrevYear)}</span>
                        </div>
                        <div class="targets-summary-card">
                            <span class="targets-card-label">AVG GROWTH</span>
                            <span class="targets-card-value ${totals.avgGrowth >= 0 ? 'positive' : 'negative'}" id="summary-avg-growth">${totals.avgGrowth !== null ? totals.avgGrowth.toFixed(1) + '%' : '—'}</span>
                        </div>
                    </div>
                    <div class="targets-toolbar">
                        <div class="targets-controls-group">
                            <label for="growth-percent" class="targets-label">Growth %</label>
                            <input class="targets-input" type="number" id="growth-percent" value="0" step="1" min="-100" max="1000" />
                            <button class="targets-btn primary" id="apply-growth" type="button">Apply to All</button>
                        </div>
                        <button class="targets-btn save" id="save-targets" type="button">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                            Save Targets
                        </button>
                    </div>
                    <div class="targets-table-container">
                        <table class="targets-table">
                            <thead>
                                <tr>
                                    <th class="col-date">DATE</th>
                                    <th class="col-num">PREV YEAR T/O</th>
                                    <th class="col-num col-input">% GROWTH</th>
                                    <th class="col-num col-input">TARGET T/O</th>
                                </tr>
                            </thead>
                            <tbody id="targets-tbody">
                                ${this.renderTableRows()}
                            </tbody>
                            <tfoot>
                                <tr class="total-row">
                                    <td class="col-date">TOTAL</td>
                                    <td class="col-num">${this.formatNumber(totals.totalPrevYear)}</td>
                                    <td class="col-num col-input">${totals.avgGrowth !== null ? totals.avgGrowth.toFixed(2) + '%' : '—'}</td>
                                    <td class="col-num col-input total-target">${this.formatNumber(totals.totalTarget)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
            
            <!-- Month Picker Modal -->
            <div id="targets-month-picker-modal-overlay" class="month-picker-modal-overlay">
                <div class="month-picker-modal">
                    <div class="month-picker-header">
                        <h3>SELECT MONTH</h3>
                        <button id="targets-month-picker-close-btn" class="month-picker-close-btn" aria-label="Close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="month-picker-content">
                        <div class="month-picker-year-nav">
                            <button id="targets-month-picker-prev-year" class="month-picker-nav-btn" aria-label="Previous year">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                            </button>
                            <span id="targets-month-picker-year" class="month-picker-year-display"></span>
                            <button id="targets-month-picker-next-year" class="month-picker-nav-btn" aria-label="Next year">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="9 6 15 12 9 18"></polyline>
                                </svg>
                            </button>
                        </div>
                        <div id="targets-month-picker-grid" class="month-picker-grid">
                        </div>
                    </div>
                    <div class="month-picker-footer">
                        <button id="targets-month-picker-current-btn" class="month-picker-action-btn">
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

        // Bind event listeners
        this.bindEventListeners();
    }

    renderTableRows() {
        return this.targetsData.map(day => {
            const rowClass = day.isWeekend ? 'weekend-row' : '';
            
            return `
                <tr class="${rowClass}" data-date="${day.date}" data-prev="${day.prevDate}">
                    <td class="col-date">${day.dateDisplay}</td>
                    <td class="col-num prev-year-to">${day.prevYearTurnover !== null ? this.formatNumber(day.prevYearTurnover) : '—'}</td>
                    <td class="col-num col-input">
                        <input type="number" inputmode="decimal" step="0.01" placeholder="0.00" 
                            name="growth_${day.date}" class="growth-input" value="${day.growthPercent}" />
                    </td>
                    <td class="col-num col-input">
                        <input type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" 
                            name="target_${day.date}" class="target-input" value="${day.targetTurnover}" />
                    </td>
                </tr>
            `;
        }).join('');
    }

    calculateTotals() {
        let totalTarget = 0;
        let totalPrevYear = 0;
        let daysWithBoth = 0;
        let totalGrowth = 0;

        this.targetsData.forEach(day => {
            const target = parseFloat(day.targetTurnover) || 0;
            const prevYear = day.prevYearTurnover || 0;

            totalTarget += target;
            totalPrevYear += prevYear;

            if (target > 0 && prevYear > 0) {
                daysWithBoth++;
                totalGrowth += ((target / prevYear) - 1) * 100;
            }
        });

        const avgGrowth = daysWithBoth > 0 ? totalGrowth / daysWithBoth : null;

        return {
            totalTarget,
            totalPrevYear,
            avgGrowth
        };
    }

    bindEventListeners() {
        const tbody = document.getElementById('targets-tbody');
        const applyGrowthBtn = document.getElementById('apply-growth');
        const saveTargetsBtn = document.getElementById('save-targets');
        const growthInput = document.getElementById('growth-percent');

        // Bidirectional calculation: growth <-> target
        tbody?.addEventListener('input', (e) => {
            if (e.target.classList.contains('growth-input')) {
                this.handleGrowthInput(e.target);
            } else if (e.target.classList.contains('target-input')) {
                this.handleTargetInput(e.target);
            }
            this.updateTotals();
        });

        // Apply growth to all
        applyGrowthBtn?.addEventListener('click', () => {
            // Parse growth percentage - remove any % signs or other non-numeric chars
            const growthValue = (growthInput?.value || '0').toString().replace(/[^0-9.\-]/g, '');
            const pct = parseFloat(growthValue) || 0;
            this.applyGrowthToAll(pct);
        });

        // Save targets
        saveTargetsBtn?.addEventListener('click', () => {
            this.saveTargets();
        });
    }

    handleGrowthInput(input) {
        const row = input.closest('tr');
        if (!row) return;

        const prevCell = row.querySelector('.prev-year-to');
        const targetInput = row.querySelector('.target-input');
        if (!prevCell || !targetInput) return;

        // Parse growth percentage
        const growthPct = parseFloat(input.value);
        if (isNaN(growthPct)) return;

        const prevText = prevCell.textContent || '';
        const prevNum = this.parseFormattedNumber(prevText);
        
        if (!isNaN(prevNum) && prevNum > 0) {
            // Convert percentage to multiplier: 7% = 1.07, 10% = 1.10, etc.
            const multiplier = 1 + (growthPct / 100);
            const targetValue = prevNum * multiplier;
            targetInput.value = targetValue.toFixed(2);
        }
    }

    handleTargetInput(input) {
        const row = input.closest('tr');
        if (!row) return;

        const prevCell = row.querySelector('.prev-year-to');
        const growthInput = row.querySelector('.growth-input');
        if (!prevCell || !growthInput) return;

        const targetValue = parseFloat(input.value);
        if (isNaN(targetValue) || targetValue <= 0) {
            growthInput.value = '';
            return;
        }

        const prevText = prevCell.textContent || '';
        const prevNum = this.parseFormattedNumber(prevText);
        
        if (!isNaN(prevNum) && prevNum > 0) {
            const growthPct = ((targetValue / prevNum) - 1) * 100;
            growthInput.value = growthPct.toFixed(2);
        } else {
            growthInput.value = '';
        }
    }

    applyGrowthToAll(pct) {
        if (isNaN(pct)) pct = 0;
        
        // Ensure pct is treated as a percentage (7 means 7%, not 700%)
        // Convert to decimal multiplier: 7% = 1.07, 10% = 1.10, etc.
        const multiplier = 1 + (pct / 100);
        
        const tbody = document.getElementById('targets-tbody');
        if (!tbody) return;

        tbody.querySelectorAll('tr').forEach(tr => {
            const prevCell = tr.querySelector('.prev-year-to');
            const targetInput = tr.querySelector('.target-input');
            const growthInput = tr.querySelector('.growth-input');
            
            if (!prevCell || !targetInput) return;
            
            const prevText = prevCell.textContent || '';
            const prevNum = this.parseFormattedNumber(prevText);
            
            if (!isNaN(prevNum) && prevNum > 0) {
                const target = prevNum * multiplier;
                targetInput.value = target.toFixed(2);
                if (growthInput) {
                    growthInput.value = pct.toFixed(2);
                }
            }
        });

        this.updateTotals();
    }
    
    // Parse numbers in various formats:
    // - "43,630.57" (US: comma thousand sep, period decimal)
    // - "43 630,57" (SA/EU: space thousand sep, comma decimal)
    // - "43.630,57" (EU: period thousand sep, comma decimal)
    parseFormattedNumber(text) {
        if (!text || text === '—' || text === '-') return 0;
        
        // Remove currency symbols and trim
        let cleaned = text.replace(/[R$€£]/g, '').trim();
        
        // Remove all spaces (thousand separators in SA format)
        cleaned = cleaned.replace(/\s/g, '');
        
        // Count periods and commas to determine format
        const periods = (cleaned.match(/\./g) || []).length;
        const commas = (cleaned.match(/,/g) || []).length;
        
        if (periods === 1 && commas === 0) {
            // Format: "43630.57" - period is decimal
            return parseFloat(cleaned);
        } else if (commas === 1 && periods === 0) {
            // Format: "43630,57" - comma is decimal (EU/SA)
            return parseFloat(cleaned.replace(',', '.'));
        } else if (periods >= 1 && commas === 1) {
            // Format: "43.630,57" - periods are thousand sep, comma is decimal
            return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
        } else if (commas >= 1 && periods === 1) {
            // Format: "43,630.57" - commas are thousand sep, period is decimal
            return parseFloat(cleaned.replace(/,/g, ''));
        } else if (commas > 1) {
            // Format: "43,630,000" - all commas are thousand sep
            return parseFloat(cleaned.replace(/,/g, ''));
        } else if (periods > 1) {
            // Format: "43.630.000" - all periods are thousand sep
            return parseFloat(cleaned.replace(/\./g, ''));
        }
        
        // Fallback: just try to parse
        return parseFloat(cleaned.replace(/,/g, ''));
    }

    async saveTargets() {
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        if (!pharmacy || !this.currentMonth) {
            this.showToast('Please select a pharmacy first', 'error');
            return;
        }

        const tbody = document.getElementById('targets-tbody');
        if (!tbody) return;

        // Collect targets data as object { "2024-11-01": 12345.67, ... }
        // This matches the format expected by the backend API
        const targets = {};
        tbody.querySelectorAll('tr').forEach(tr => {
            const date = tr.getAttribute('data-date');
            const input = tr.querySelector('.target-input');
            if (!input || !date) return;

            const value = parseFloat(input.value);
            if (!isNaN(value) && value > 0) {
                targets[date] = value;
            }
        });

        if (Object.keys(targets).length === 0) {
            this.showToast('No target values to save.', 'warning');
            return;
        }

        // Show loading
        if (window.loadingOverlay) {
            window.loadingOverlay.show('Saving targets...');
        }

        try {
            // Use user's auth token (not API_KEY) for write operations
            // This matches the Flask backend which uses session auth for admin actions
            const userToken = localStorage.getItem('auth_token');
            if (!userToken) {
                throw new Error('Please log in again to save targets.');
            }

            const url = `${API_BASE_URL}/admin/pharmacies/${pharmacy.id}/targets?month=${encodeURIComponent(this.currentMonth)}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify(targets)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                let errorMsg = errorData.detail || `Server error: ${response.status}`;
                
                // User-friendly error messages
                if (response.status === 403) {
                    if (errorMsg.toLowerCase().includes('write access')) {
                        errorMsg = `You do not have write access to this pharmacy. Please contact an administrator.`;
                    } else {
                        errorMsg = `Access denied: ${errorMsg}`;
                    }
                } else if (response.status === 401) {
                    errorMsg = 'Authentication failed. Please log in again.';
                }
                
                throw new Error(errorMsg);
            }

            this.showToast('Targets saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving targets:', error);
            this.showToast(error.message || 'Failed to save targets. Please try again.', 'error');
        } finally {
            if (window.loadingOverlay) {
                window.loadingOverlay.hide();
            }
        }
    }

    updateTotals() {
        // Update the internal data from DOM
        const tbody = document.getElementById('targets-tbody');
        if (!tbody) return;

        tbody.querySelectorAll('tr').forEach((tr, index) => {
            if (this.targetsData[index]) {
                const targetInput = tr.querySelector('.target-input');
                const growthInput = tr.querySelector('.growth-input');
                this.targetsData[index].targetTurnover = targetInput?.value || '';
                this.targetsData[index].growthPercent = growthInput?.value || '';
            }
        });

        // Recalculate and update footer
        const totals = this.calculateTotals();
        const tfoot = document.querySelector('.targets-table tfoot');
        if (tfoot) {
            const cells = tfoot.querySelectorAll('td');
            if (cells.length >= 4) {
                cells[1].textContent = this.formatNumber(totals.totalPrevYear);
                cells[2].textContent = totals.avgGrowth !== null ? totals.avgGrowth.toFixed(2) + '%' : '—';
                cells[3].textContent = this.formatNumber(totals.totalTarget);
            }
        }

        // Update summary cards
        const totalTargetEl = document.getElementById('summary-total-target');
        const prevYearEl = document.getElementById('summary-prev-year');
        const avgGrowthEl = document.getElementById('summary-avg-growth');
        
        if (totalTargetEl) totalTargetEl.textContent = this.formatMoney(totals.totalTarget);
        if (prevYearEl) prevYearEl.textContent = this.formatMoney(totals.totalPrevYear);
        if (avgGrowthEl) {
            avgGrowthEl.textContent = totals.avgGrowth !== null ? totals.avgGrowth.toFixed(1) + '%' : '—';
            avgGrowthEl.className = 'targets-card-value ' + (totals.avgGrowth >= 0 ? 'positive' : 'negative');
        }
    }

    showToast(message, type = 'info') {
        // Create toast element
        const existing = document.querySelector('.targets-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `targets-toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Utility functions
    addDays(dateObj, days) {
        const d = new Date(dateObj.getTime());
        d.setDate(d.getDate() + days);
        return d;
    }

    formatYmdLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    getMonthYearDisplay() {
        if (!this.currentMonth) return 'Targets';
        const [year, month] = this.currentMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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

    showEmptyState(message = 'Select a pharmacy and date to manage targets') {
        const mainContent = document.querySelector('.content-area');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="dashboard-container">
                    <div class="empty-state">
                        <h2>Targets</h2>
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
                        <h2>Error Loading Targets</h2>
                        <p>${error.message || 'An error occurred while loading data.'}</p>
                    </div>
                </div>
            `;
        }
    }

    // Month Picker Methods
    setupMonthPicker() {
        if (this.monthPickerBound) return;
        this.monthPickerBound = true;

        // Initialize the view year from current month
        const [year] = this.currentMonth.split('-').map(Number);
        this.currentViewYear = year;

        // Month picker button
        const monthBtn = document.getElementById('targets-month-picker-btn');
        if (monthBtn) {
            monthBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const overlay = document.getElementById('targets-month-picker-modal-overlay');
                if (overlay && overlay.classList.contains('active')) {
                    this.closeMonthPicker();
                } else {
                    this.openMonthPicker();
                }
            });
        }

        // Close button
        const closeBtn = document.getElementById('targets-month-picker-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeMonthPicker());
        }

        // Year navigation
        const prevYearBtn = document.getElementById('targets-month-picker-prev-year');
        const nextYearBtn = document.getElementById('targets-month-picker-next-year');
        if (prevYearBtn) {
            prevYearBtn.addEventListener('click', () => this.navigateYear('prev'));
        }
        if (nextYearBtn) {
            nextYearBtn.addEventListener('click', () => this.navigateYear('next'));
        }

        // Current month button
        const currentMonthBtn = document.getElementById('targets-month-picker-current-btn');
        if (currentMonthBtn) {
            currentMonthBtn.addEventListener('click', () => {
                const now = new Date();
                const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                this.selectMonth(currentMonth);
            });
        }

        // Overlay click
        const overlay = document.getElementById('targets-month-picker-modal-overlay');
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
                const overlay = document.getElementById('targets-month-picker-modal-overlay');
                if (overlay && overlay.classList.contains('active')) {
                    this.closeMonthPicker();
                }
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    }

    buildMonthGrid() {
        const grid = document.getElementById('targets-month-picker-grid');
        const yearDisplay = document.getElementById('targets-month-picker-year');
        
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
        localStorage.setItem('targets_month', monthValue);
        
        // Update the display
        const display = document.getElementById('targets-selected-month-display');
        if (display) {
            display.textContent = this.getMonthYearDisplay();
        }

        this.closeMonthPicker();
        
        // Reload data for the new month
        this.monthPickerBound = false;
        this.listenersBound = false;
        this.load();
    }

    openMonthPicker() {
        // Initialize view year from current month
        const [year] = this.currentMonth.split('-').map(Number);
        this.currentViewYear = year;
        
        this.buildMonthGrid();
        
        const overlay = document.getElementById('targets-month-picker-modal-overlay');
        const modal = overlay?.querySelector('.month-picker-modal');
        const button = document.getElementById('targets-month-picker-btn');
        
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
        const overlay = document.getElementById('targets-month-picker-modal-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    isMobile() {
        return window.innerWidth <= 768;
    }
}

// Export class
window.TargetsScreen = TargetsScreen;

