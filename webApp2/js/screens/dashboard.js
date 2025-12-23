// Dashboard Screen
// Main dashboard view with overview metrics

class DashboardScreen {
    constructor() {
        this.data = null;
        this.viewMode = 'daily'; // 'daily' or 'monthly'
        this.insightsLoaded = false;
        this.chartLoaded = false;
        this.lastPharmacyId = null;
        this.lastDate = null;
        this.lastGroupViewMode = null; // Track last view mode used for group view
        this.insightsContent = null;
        this.chartData = null;
        this.currentInsightsData = null;
        this.groupViewData = {}; // Store group view data: { [pharmacyId]: { turnover, purchases, gp, basket } }
        this.setupToggleHandlers();
    }
    
    setupToggleHandlers() {
        // Setup view mode button click handler (desktop - in top bar)
        const viewModeBtn = document.getElementById('view-mode-btn');
        if (viewModeBtn) {
            viewModeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openViewModeModal();
            });
        }
        
        // Setup floating view mode button click handler (mobile - fixed position)
        const floatingViewModeBtn = document.getElementById('floating-view-mode-btn');
        if (floatingViewModeBtn) {
            floatingViewModeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openViewModeModal();
            });
        }

        // Close button
        const closeBtn = document.getElementById('view-mode-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeViewModeModal());
        }

        // Overlay click
        const overlay = document.getElementById('view-mode-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeViewModeModal();
                }
            });
        }

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const overlay = document.getElementById('view-mode-modal-overlay');
                if (overlay && overlay.classList.contains('active')) {
                    this.closeViewModeModal();
                }
            }
        });

        // Click outside handler for desktop
        document.addEventListener('click', (e) => {
            if (!this.isMobile()) {
                const overlay = document.getElementById('view-mode-modal-overlay');
                const button = document.getElementById('view-mode-btn');
                const floatingButton = document.getElementById('floating-view-mode-btn');
                const modal = overlay?.querySelector('.pharmacy-picker-modal');
                
                if (overlay && overlay.classList.contains('active')) {
                    const isClickInsideModal = modal && modal.contains(e.target);
                    const isClickOnButton = (button && button.contains(e.target)) || (floatingButton && floatingButton.contains(e.target));
                    
                    if (!isClickInsideModal && !isClickOnButton) {
                        this.closeViewModeModal();
                    }
                }
            }
        });

        // Window resize handler for desktop positioning
        window.addEventListener('resize', () => {
            if (!this.isMobile()) {
                const overlay = document.getElementById('view-mode-modal-overlay');
                const modal = overlay?.querySelector('.pharmacy-picker-modal');
                const button = document.getElementById('view-mode-btn');
                
                if (overlay && overlay.classList.contains('active') && modal && button) {
                    this.repositionViewModeModal(modal, button);
                }
            }
        });
    }
    
    openViewModeModal() {
        this.populateViewModeList();
        this.updateViewModeSelection();

        const overlay = document.getElementById('view-mode-modal-overlay');
        const modal = overlay?.querySelector('.pharmacy-picker-modal');
        const button = document.getElementById('view-mode-btn');

        if (overlay && modal && button) {
            if (!this.isMobile()) {
                this.repositionViewModeModal(modal, button);
            }
            overlay.classList.add('active');
            if (this.isMobile()) {
                document.body.style.overflow = 'hidden';
            }
        }
    }

    closeViewModeModal() {
        const overlay = document.getElementById('view-mode-modal-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    populateViewModeList() {
        const list = document.getElementById('view-mode-list');
        if (!list) return;

        const modes = [
            { id: 'daily', name: 'Daily' },
            { id: 'monthly', name: 'Monthly' }
        ];

        list.innerHTML = modes.map(mode => {
            const isSelected = this.viewMode === mode.id;

            return `
                <button class="pharmacy-option ${isSelected ? 'selected' : ''}" 
                        data-mode="${mode.id}">
                    <span class="pharmacy-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                    </span>
                    <span>${mode.name}</span>
                </button>
            `;
        }).join('');

        // Add click handlers
        list.querySelectorAll('.pharmacy-option').forEach(option => {
            option.addEventListener('click', () => {
                const mode = option.getAttribute('data-mode');
                if (mode) {
                    this.setViewMode(mode);
                }
            });
        });
    }

    updateViewModeSelection() {
        this.populateViewModeList();
    }

    repositionViewModeModal(modal, button) {
        const buttonRect = button.getBoundingClientRect();
        modal.style.top = `${buttonRect.bottom + 8}px`;
        modal.style.right = `${window.innerWidth - buttonRect.right}px`;
        modal.style.left = 'auto';
    }

    isMobile() {
        return window.innerWidth <= 768;
    }
    
    setViewMode(mode) {
        if (this.viewMode === mode) {
            this.closeViewModeModal();
            return;
        }
        
        this.viewMode = mode;
        
        // Update both display elements (top bar and floating button)
        const displayText = mode === 'daily' ? 'Daily' : 'Monthly';
        
        const display = document.getElementById('selected-view-mode-display');
        if (display) {
            display.textContent = displayText;
        }
        
        const floatingDisplay = document.getElementById('floating-view-mode-display');
        if (floatingDisplay) {
            floatingDisplay.textContent = displayText;
        }
        
        // Close modal
        this.closeViewModeModal();
        
        // Check if we're in group view mode - if so, need to reload data
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const groupViewEnabled = pharmacy?.groupView || false;
        
        if (groupViewEnabled) {
            // For group view, we need to reload data with the new view mode
            this.load();
        } else if (this.data) {
            // For single pharmacy view, just re-render with existing data
            this.render();
        }
    }

    async load() {
        console.log('Loading Dashboard...');
        
        // Setup view mode handlers if not already set up
        this.setupToggleHandlers();
        
        // Update view mode display (both top bar and floating button)
        const displayText = this.viewMode === 'daily' ? 'Daily' : 'Monthly';
        
        const display = document.getElementById('selected-view-mode-display');
        if (display) {
            display.textContent = displayText;
        }
        
        const floatingDisplay = document.getElementById('floating-view-mode-display');
        if (floatingDisplay) {
            floatingDisplay.textContent = displayText;
        }
        
        // Wait a bit for components to initialize if needed
        let attempts = 0;
        while (attempts < 10 && (!window.pharmacyPicker || !window.datePicker)) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        // Get selected pharmacy and date
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const date = window.datePicker?.getSelectedDate();
        const groupViewEnabled = pharmacy?.groupView || false;
        
        console.log('Dashboard load - Pharmacy:', pharmacy, 'Date:', date, 'Group View:', groupViewEnabled);
        
        // Handle group view mode
        if (groupViewEnabled) {
            const dateChanged = this.lastDate !== date;
            const viewModeChanged = this.lastGroupViewMode !== this.viewMode;
            const shouldReloadData = dateChanged || viewModeChanged || !this.groupViewData;
            
            if (!date) {
                console.warn('Missing date selection for group view');
                this.renderGroupView({});
                return;
            }
            
            if (shouldReloadData) {
                // Show loading overlay
                if (window.loadingOverlay) {
                    window.loadingOverlay.show('Loading group view data...');
                }
                
                try {
                    await this.loadGroupViewData(date);
                    this.lastGroupViewMode = this.viewMode;
                    this.renderGroupView(this.groupViewData);
                } catch (error) {
                    console.error('Error loading group view:', error);
                    this.renderGroupView({});
                } finally {
                    if (window.loadingOverlay) {
                        window.loadingOverlay.hide();
                    }
                }
            } else {
                this.renderGroupView(this.groupViewData);
            }
            return;
        }
        
        // Regular single pharmacy view
        // Check if pharmacy or date changed (need to reload data)
        const pharmacyId = pharmacy?.id;
        const dateChanged = this.lastDate !== date;
        const pharmacyChanged = this.lastPharmacyId !== pharmacyId;
        const shouldReloadData = pharmacyChanged || dateChanged || !this.data;
        
        if (!pharmacy?.id || !date) {
            console.warn('Missing pharmacy or date selection', { pharmacy, date });
            // Show layout with placeholder/zero values
            this.data = {
                dayData: null,
                target: null,
                basketSize: 0,
                gpPercent: 0,
                date: date || new Date().toISOString().slice(0, 10),
                month: date?.slice(0, 7) || new Date().toISOString().slice(0, 7)
            };
            this.render();
            return;
        }

        // Only show loading overlay and reload data if pharmacy/date changed
        if (shouldReloadData) {
            // Reset loaded flags when pharmacy/date changes
            this.insightsLoaded = false;
            this.chartLoaded = false;
            this.insightsContent = null;
            this.chartData = null;
            // Clear headline when resetting
            const headlineTitleEl = document.getElementById('insights-headline-title');
            if (headlineTitleEl) headlineTitleEl.innerHTML = '';
            
            // Show loading overlay
            if (window.loadingOverlay) {
                window.loadingOverlay.show('Loading dashboard data...');
            }

            try {
                // Load dashboard data
                await this.loadData(pharmacy.id, date);
                this.render();
            } catch (error) {
                console.error('Error loading dashboard:', error);
                // Show layout with zero values on error
                this.data = {
                    dayData: null,
                    target: null,
                    basketSize: 0,
                    gpPercent: 0,
                    date,
                    month: date.slice(0, 7)
                };
                this.render();
            } finally {
                // Hide loading overlay
                if (window.loadingOverlay) {
                    window.loadingOverlay.hide();
                }
            }
        } else {
            // Just re-render with existing data (view mode change)
            this.render();
        }
    }

    async loadData(pharmacyId, date) {
        console.log('Loading dashboard data for pharmacy:', pharmacyId, 'date:', date);
        const startTime = performance.now();
        
        // Check if API service is available
        if (!window.api) {
            throw new Error('API service is not initialized. Please refresh the page.');
        }
        
        // Get month from date (YYYY-MM)
        const month = date.slice(0, 7);
        
        // Calculate previous year month for fallback target
        // Using local time to match old app's logic
        const currentDate = new Date(date + 'T00:00:00');
        const prevYearDate = new Date(currentDate);
        prevYearDate.setFullYear(currentDate.getFullYear() - 1);
        // Use local time format for month (YYYY-MM)
        const prevYearMonth = `${prevYearDate.getFullYear()}-${String(prevYearDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Load ALL data in parallel for speed
        const [daysResult, targetsResult, prevYearResult] = await Promise.allSettled([
            window.api.getDays(pharmacyId, month),
            window.api.getTargets(pharmacyId, month),
            window.api.getDays(pharmacyId, prevYearMonth) // For target fallback
        ]);
        
        console.log(`API calls completed in ${(performance.now() - startTime).toFixed(0)}ms`);
        
        // Process days data
        let daysData = [];
        if (daysResult.status === 'fulfilled' && Array.isArray(daysResult.value)) {
            daysData = daysResult.value;
            console.log('Days data loaded:', daysData.length, 'records');
        }
        
        // Find data for selected date
        const dayData = daysData.find(d => d.business_date === date) || null;
        if (dayData) {
            console.log('Turnover:', dayData.turnover, 'GP%:', dayData.gp_pct || dayData.gp_percentage);
        }
        
        // Process targets
        let target = null;
        if (targetsResult.status === 'fulfilled') {
            const targetsData = targetsResult.value;
            if (Array.isArray(targetsData?.targets)) {
                target = targetsData.targets.find(t => t.date === date) || null;
            } else if (targetsData?.targets && typeof targetsData.targets === 'object') {
                const targetValue = targetsData.targets[date];
                if (targetValue) {
                    target = { date, value: targetValue };
                }
            }
        }
        
        // Get previous year day data for comparisons
        let prevYearDayData = null;
        if (prevYearResult.status === 'fulfilled') {
            const prevYearDaysData = prevYearResult.value || [];
            const currentWeekday = currentDate.getDay();
            prevYearDayData = this.findMatchingWeekday(prevYearDaysData, prevYearDate, currentWeekday);
        }
        
        // Calculate target with fallback (10% growth from previous year)
        let targetValue = target?.value || 0;
        if (targetValue === 0 && prevYearDayData) {
            const prevYearTurnover = Number(prevYearDayData.turnover || 0);
            if (prevYearTurnover > 0) {
                targetValue = prevYearTurnover * 1.10; // 10% growth
            }
        }
        
        // Calculate GP% and GP Value - check multiple field names (gp_pct, gp_percentage)
        let gpPercent = 0;
        let gpValue = 0;
        if (dayData) {
            // Get GP value (Rand amount)
            gpValue = Number(dayData.gp_value || dayData.gp || 0);
            
            // Get GP percentage
            if (dayData.gp_pct !== undefined && dayData.gp_pct !== null) {
                gpPercent = Number(dayData.gp_pct);
            } else if (dayData.gp_percentage !== undefined && dayData.gp_percentage !== null) {
                gpPercent = Number(dayData.gp_percentage);
            } else {
                const turnover = Number(dayData.turnover || 0);
                gpPercent = turnover ? (gpValue / turnover) * 100 : 0;
            }
        }
        
        // Calculate basket size and get transaction count
        let basketSize = 0;
        let transactionCount = 0;
        if (dayData) {
            // Get transaction count
            transactionCount = Number(
                dayData.transaction_count ||
                dayData.transactions ||
                dayData.txn_count ||
                0
            );
            
            // Try avg_basket first (pre-calculated)
            if (dayData.avg_basket !== undefined && dayData.avg_basket !== null && dayData.avg_basket > 0) {
                basketSize = Number(dayData.avg_basket);
            } else {
                const turnover = Number(dayData.turnover || 0);
                if (transactionCount > 0) {
                    basketSize = turnover / transactionCount;
                }
            }
        }
        
        // Calculate turnover growth vs previous year
        const currentTurnover = dayData ? Number(dayData.turnover || 0) : 0;
        const prevYearTurnover = prevYearDayData ? Number(prevYearDayData.turnover || 0) : 0;
        let turnoverGrowthPct = null;
        if (prevYearTurnover > 0 && currentTurnover > 0) {
            turnoverGrowthPct = ((currentTurnover - prevYearTurnover) / prevYearTurnover) * 100;
        }
        
        // Calculate target achievement percentage
        let targetAchievementPct = null;
        if (targetValue > 0 && currentTurnover > 0) {
            targetAchievementPct = (currentTurnover / targetValue) * 100;
        }
        
        // Get purchases from dayData (check multiple field names)
        let purchases = 0;
        if (dayData) {
            purchases = Number(
                dayData.purchases ||
                dayData.daily_purchases ||
                dayData.purchases_value ||
                0
            );
        }
        
        // Calculate purchase budget (75% of target turnover)
        const purchaseBudget = targetValue > 0 ? targetValue * 0.75 : 0;
        
        // Get previous year days data for monthly comparison
        let prevYearDaysData = [];
        if (prevYearResult.status === 'fulfilled' && Array.isArray(prevYearResult.value)) {
            prevYearDaysData = prevYearResult.value;
        }
        
        this.data = {
            dayData,
            daysData, // Store all days data for MTD calculation
            prevYearDaysData, // Store previous year days data for monthly comparison
            target: targetValue > 0 ? { date, value: targetValue } : null,
            targetsResult, // Store targets result for monthly target calculation
            basketSize,
            gpPercent,
            gpValue,
            transactionCount,
            prevYearTurnover,
            prevYearYear: prevYearDate.getFullYear(),
            turnoverGrowthPct,
            targetAchievementPct,
            purchases,
            purchaseBudget,
            currentTurnover,
            date,
            month
        };
        
        console.log(`Dashboard data ready in ${(performance.now() - startTime).toFixed(0)}ms`);
    }
    
    // Helper to find matching weekday in previous year data
    // Logic matches old web app's getPreviousYearWeekdayData function
    findMatchingWeekday(daysData, prevYearDate, targetWeekday) {
        if (!Array.isArray(daysData) || daysData.length === 0) return null;
        
        // Adjust date to match the target weekday (same logic as old app)
        const adjustedDate = new Date(prevYearDate);
        const weekdayDiff = adjustedDate.getDay() - targetWeekday;
        if (weekdayDiff !== 0) {
            adjustedDate.setDate(adjustedDate.getDate() - weekdayDiff);
        }
        
        // Use local time format (same as old app's formatYmdLocal)
        const targetDateStr = this.formatYmdLocal(adjustedDate);
        return daysData.find(d => d.business_date === targetDateStr) || null;
    }
    
    // Format date as YYYY-MM-DD using local time (matches old app's formatYmdLocal)
    formatYmdLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // Calculate monthly totals from daysData array (efficient - uses already loaded data)
    // If throughDate is provided, only includes days up to that date (MTD)
    calculateMonthlyTotals(daysData, month, throughDate = null) {
        if (!daysData || !Array.isArray(daysData) || daysData.length === 0) {
            return {
                turnover: 0,
                gpValue: 0,
                gpPercent: 0,
                purchases: 0,
                transactionCount: 0,
                basketSize: 0
            };
        }
        
        // Filter days for the selected month, optionally up to throughDate
        const monthDays = daysData.filter(day => {
            if (!day.business_date) return false;
            if (!day.business_date.startsWith(month)) return false;
            
            // If throughDate is provided, only include days up to that date
            if (throughDate && day.business_date > throughDate) return false;
            
            return true;
        });
        
        // Sum all values
        let turnover = 0;
        let gpValue = 0;
        let purchases = 0;
        let transactionCount = 0;
        
        for (const day of monthDays) {
            turnover += Number(day.turnover || 0);
            gpValue += Number(day.gp_value || day.gp || 0);
            purchases += Number(day.purchases || day.daily_purchases || day.purchases_value || 0);
            transactionCount += Number(
                day.transaction_count ||
                day.transactions ||
                day.txn_count ||
                0
            );
        }
        
        // Calculate GP percentage
        const gpPercent = turnover > 0 ? (gpValue / turnover) * 100 : 0;
        
        // Calculate basket size
        const basketSize = transactionCount > 0 ? turnover / transactionCount : 0;
        
        return {
            turnover,
            gpValue,
            gpPercent,
            purchases,
            transactionCount,
            basketSize
        };
    }
    
    // Calculate monthly target (sum of all targets in the month, optionally up to throughDate)
    calculateMonthlyTarget(targetsData, month, throughDate = null) {
        if (!targetsData || !targetsData.targets) return 0;
        
        let monthlyTarget = 0;
        
        if (Array.isArray(targetsData.targets)) {
            // Sum targets for the month, optionally up to throughDate
            monthlyTarget = targetsData.targets
                .filter(t => {
                    if (!t.date || !t.date.startsWith(month)) return false;
                    if (throughDate && t.date > throughDate) return false;
                    return true;
                })
                .reduce((sum, t) => sum + Number(t.value || 0), 0);
        } else if (typeof targetsData.targets === 'object') {
            // Object format: { "2024-01-01": 1000, ... }
            for (const [date, value] of Object.entries(targetsData.targets)) {
                if (date.startsWith(month)) {
                    if (throughDate && date > throughDate) continue;
                    monthlyTarget += Number(value || 0);
                }
            }
        }
        
        return monthlyTarget;
    }
    
    // Get previous year month string (YYYY-MM)
    getPreviousYearMonth(month) {
        if (!month) return null;
        const [year, monthNum] = month.split('-');
        const prevYear = parseInt(year) - 1;
        return `${prevYear}-${monthNum}`;
    }

    render() {
        const mainContent = document.querySelector('main');
        if (!mainContent) return;

        if (!this.data) {
            this.showEmptyState();
            return;
        }

        const { 
            dayData, target, basketSize, gpPercent, gpValue,
            transactionCount, prevYearTurnover, prevYearYear,
            turnoverGrowthPct, targetAchievementPct, daysData, date,
            purchases, purchaseBudget, currentTurnover, month, targetsResult: storedTargetsResult
        } = this.data;

        // Determine which data to use based on view mode
        let displayData;
        
        if (this.viewMode === 'monthly') {
            // Calculate monthly totals (MTD - up to selected date)
            const monthlyTotals = this.calculateMonthlyTotals(daysData || [], month, date);
            
            // Calculate previous year monthly totals for comparison (MTD - up to same day of month)
            // Handle edge case where previous year month might have fewer days (e.g., Feb 29 vs Feb 28)
            const selectedDateObj = new Date(date + 'T00:00:00');
            const mtdDay = selectedDateObj.getDate();
            const prevYearMonth = this.getPreviousYearMonth(month);
            
            // Calculate previous year month boundaries to handle months with different day counts
            const prevYearDate = new Date(selectedDateObj);
            prevYearDate.setFullYear(prevYearDate.getFullYear() - 1);
            const prevYearMonthDays = new Date(prevYearDate.getFullYear(), prevYearDate.getMonth() + 1, 0).getDate();
            const prevYearMTDDay = Math.min(mtdDay, prevYearMonthDays);
            
            // Create a date string for the correct day in previous year month (handles edge cases)
            const prevYearThroughDate = `${prevYearMonth}-${String(prevYearMTDDay).padStart(2, '0')}`;
            const prevYearMonthlyTotals = this.calculateMonthlyTotals(this.data.prevYearDaysData || [], prevYearMonth, prevYearThroughDate);
            
            console.log('Monthly view - MTD totals:', {
                current: monthlyTotals.turnover,
                prevYear: prevYearMonthlyTotals.turnover,
                prevYearMonth,
                prevYearThroughDate,
                prevYearDaysDataCount: (this.data.prevYearDaysData || []).length
            });
            
            // Calculate monthly growth percentage
            const monthlyGrowthPct = prevYearMonthlyTotals.turnover > 0 && monthlyTotals.turnover > 0
                ? ((monthlyTotals.turnover - prevYearMonthlyTotals.turnover) / prevYearMonthlyTotals.turnover) * 100
                : null;
            
            // Calculate MTD target (only targets up to selected date) - matching old app logic
            // Handle case where targets API failed (401, etc.) - targetsResult will be null or have rejected status
            const targetsData = storedTargetsResult?.status === 'fulfilled' ? storedTargetsResult.value : null;
            let monthlyTargetMTD = this.calculateMonthlyTarget(targetsData, month, date);
            
            console.log('Monthly view - Target calculation:', {
                targetsDataStatus: storedTargetsResult?.status,
                monthlyTargetMTD,
                prevYearTurnover: prevYearMonthlyTotals.turnover
            });
            
            // If no budget exists, calculate as 10% more than previous year MTD (same day count)
            // This ensures 10% growth target and uses day-to-day MTD calculation (matching old app)
            if (monthlyTargetMTD === 0 && prevYearMonthlyTotals.turnover > 0) {
                monthlyTargetMTD = prevYearMonthlyTotals.turnover * 1.10; // 10% growth based on MTD
                console.log('Using fallback MTD target (10% growth from previous year):', monthlyTargetMTD, 'from', prevYearMonthlyTotals.turnover);
            } else if (monthlyTargetMTD === 0) {
                console.warn('No MTD target available and no previous year data for fallback');
            }
            
            // Calculate monthly target achievement (MTD target vs MTD actual)
            const monthlyTargetAchievementPct = monthlyTargetMTD > 0 && monthlyTotals.turnover > 0
                ? (monthlyTotals.turnover / monthlyTargetMTD) * 100
                : null;
            
            // Calculate monthly purchase budget (75% of monthly MTD target)
            const monthlyPurchaseBudget = monthlyTargetMTD > 0 ? monthlyTargetMTD * 0.75 : 0;
            
            displayData = {
                turnover: monthlyTotals.turnover,
                target: monthlyTargetMTD, // Use MTD target, not full month target
                gpPercent: monthlyTotals.gpPercent,
                gpValue: monthlyTotals.gpValue,
                basketSize: monthlyTotals.basketSize,
                transactionCount: monthlyTotals.transactionCount,
                purchases: monthlyTotals.purchases,
                purchaseBudget: monthlyPurchaseBudget,
                prevYearTurnover: prevYearMonthlyTotals.turnover,
                turnoverGrowthPct: monthlyGrowthPct,
                targetAchievementPct: monthlyTargetAchievementPct
            };
        } else {
            // Use daily data
            displayData = {
                turnover: dayData?.turnover || 0,
                target: target?.value || 0,
                gpPercent: gpPercent || 0,
                gpValue: gpValue || 0,
                basketSize: basketSize || 0,
                transactionCount: transactionCount || 0,
                purchases: purchases || 0,
                purchaseBudget: purchaseBudget || 0,
                prevYearTurnover: prevYearTurnover || 0,
                turnoverGrowthPct: turnoverGrowthPct,
                targetAchievementPct: targetAchievementPct
            };
        }

        // Build card data with badge and secondary line
        const turnoverCard = this.formatTurnoverCard(displayData.prevYearTurnover, prevYearYear, displayData.turnoverGrowthPct);
        const targetCard = this.formatTargetCard(displayData.turnover, displayData.target, displayData.targetAchievementPct);
        const gpCard = this.formatGpCard(displayData.gpValue, displayData.gpPercent);
        const basketCard = this.formatBasketCard(displayData.transactionCount);

        // Calculate MTD (Month-to-Date) turnover (only for daily view)
        const mtdTurnover = this.viewMode === 'daily' ? this.calculateMTD(daysData || [], date) : 0;
        const mtdCard = this.formatMTDCard(mtdTurnover);

        // Check if pharmacy or date changed (need to reload insights/chart)
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const pharmacyId = pharmacy?.id;
        const dateChanged = this.lastDate !== date;
        const pharmacyChanged = this.lastPharmacyId !== pharmacyId;
        const shouldReloadInsights = pharmacyChanged || dateChanged || !this.insightsLoaded;
        const shouldReloadChart = pharmacyChanged || dateChanged || !this.chartLoaded;
        
        // Store current pharmacy and date
        this.lastPharmacyId = pharmacyId;
        this.lastDate = date;
        
        mainContent.innerHTML = `
            <div class="dashboard-container">
                <div class="dashboard-top-cards">
                    ${this.renderTopCard('Turnover', displayData.turnover, 'currency', turnoverCard)}
                    ${this.renderTopCard('Target', displayData.target, 'currency', targetCard)}
                    ${this.renderTopCard('GP%', displayData.gpPercent, 'percentage', gpCard)}
                    ${this.renderTopCard('Basket', displayData.basketSize, 'currency', basketCard)}
                </div>
                <div class="dashboard-bottom-cards">
                    ${this.renderPurchaseVsBudgetCard(displayData.purchases, displayData.purchaseBudget)}
                    ${this.renderPurchaseVsTurnoverCard(displayData.purchases, displayData.turnover)}
                </div>
                <div class="dashboard-chart-cards">
                    <div class="turnover-chart-card">
                        <h3 class="turnover-chart-title">
                            <svg class="turnover-chart-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="20" x2="18" y2="10"></line>
                                <line x1="12" y1="20" x2="12" y2="4"></line>
                                <line x1="6" y1="20" x2="6" y2="14"></line>
                            </svg>
                            14 DAY TURNOVER
                        </h3>
                        <div class="turnover-chart-container">
                            <canvas id="turnover-chart" class="turnover-chart-canvas"></canvas>
                        </div>
                    </div>
                    <div class="insights-card" id="insights-card">
                        <div class="insights-card-header">
                            <h3 class="insights-card-title">
                                <svg class="insights-card-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                                MTD INSIGHTS
                            </h3>
                            <div class="insights-headline-title" id="insights-headline-title"></div>
                        </div>
                        <div class="insights-card-content" id="insights-content">
                            ${this.insightsContent || `
                                <div class="insights-loading">
                                    <div class="insights-skeleton-line"></div>
                                    <div class="insights-skeleton-line short"></div>
                                    <div class="insights-skeleton-line"></div>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Only reload chart if pharmacy/date changed or not loaded yet
        if (shouldReloadChart) {
            setTimeout(() => {
                this.loadTurnoverChart();
            }, 100);
        } else if (this.chartData) {
            // Restore chart if already loaded
            setTimeout(() => {
                const canvas = document.getElementById('turnover-chart');
                if (canvas && this.chartData) {
                    this.drawTurnoverBarChart(canvas, this.chartData);
                }
            }, 100);
        }
        
        // Only reload insights if pharmacy/date changed or not loaded yet
        if (shouldReloadInsights && pharmacyId) {
            this.loadMTDInsights(pharmacyId, date);
        } else if (this.insightsContent) {
            // Restore insights content if already loaded
            const contentEl = document.getElementById('insights-content');
            if (contentEl) {
                contentEl.innerHTML = this.insightsContent;
                // Reattach event handlers for insights cards and modals
                this.reattachInsightsHandlers(contentEl);
            }
        }
    }
    
    // Reattach event handlers for insights when restoring content
    reattachInsightsHandlers(container) {
        if (!container || !this.currentInsightsData) return;
        
        // Attach click handler for "view more" link
        const viewMoreLink = container.querySelector('#insights-view-more');
        if (viewMoreLink) {
            viewMoreLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openViewMoreModal(this.currentInsightsData, this.data);
            });
        }
        
        // Attach click handlers for expandable cards
        const insights = this.currentInsightsData?.insights || [];
        insights.forEach((insight) => {
            const cardEl = container.querySelector(`[data-insight-id="${insight.id}"]`);
            if (cardEl) {
                cardEl.addEventListener('click', () => this.openInsightModal(insight));
            }
        });
    }
    
    // Load MTD insights into the insights card (structured format)
    async loadMTDInsights(pharmacyId, date) {
        const contentEl = document.getElementById('insights-content');
        if (!contentEl) return;
        
        // Show loading state with shimmer skeleton lines and label
        contentEl.innerHTML = `
            <div class="insights-loading-wrapper">
                <div class="insights-loading-skeletons">
                    <div class="insights-skeleton-line"></div>
                    <div class="insights-skeleton-line short" style="animation-delay: 0.1s"></div>
                    <div class="insights-skeleton-line medium" style="animation-delay: 0.2s"></div>
                    <div class="insights-skeleton-line" style="animation-delay: 0.3s"></div>
                    <div class="insights-skeleton-line short" style="animation-delay: 0.4s"></div>
                </div>
                <div class="insights-loading-label">insights by PharmaSight</div>
            </div>
        `;
        
        try {
            console.log('Loading MTD insights for pharmacy:', pharmacyId, 'date:', date);
            const insightsData = await window.api.getDashboardInsights(pharmacyId, date);
            
            let insightsHtml = '';
            
            // Handle new structured format
            if (insightsData.summary && insightsData.insights) {
                // Store insights data for reattaching handlers
                this.currentInsightsData = insightsData;
                
                // Create a temporary container to render into
                const tempContainer = document.createElement('div');
                this.renderStructuredInsights(tempContainer, insightsData);
                insightsHtml = tempContainer.innerHTML;
            } else if (insightsData.mtd?.status === 'ready' && insightsData.mtd?.insights_markdown) {
                // Fallback to old format - clear headline
                const headlineTitleEl = document.getElementById('insights-headline-title');
                if (headlineTitleEl) headlineTitleEl.innerHTML = '';
                insightsHtml = `<div class="insights-text">${this.parseInsightsMarkdown(insightsData.mtd.insights_markdown)}</div>`;
                this.currentInsightsData = null;
            } else if (insightsData.mtd?.status === 'not_ready') {
                // Clear headline when not ready
                const headlineTitleEl = document.getElementById('insights-headline-title');
                if (headlineTitleEl) headlineTitleEl.innerHTML = '';
                insightsHtml = `<div class="insights-empty">No insights available yet for this month.</div>`;
                this.currentInsightsData = null;
            } else {
                // Clear headline when unable to load
                const headlineTitleEl = document.getElementById('insights-headline-title');
                if (headlineTitleEl) headlineTitleEl.innerHTML = '';
                insightsHtml = `<div class="insights-empty">Unable to load insights.</div>`;
                this.currentInsightsData = null;
            }
            
            // Store insights content for reuse
            this.insightsContent = insightsHtml;
            this.insightsLoaded = true;
            
            // Update the content element
            if (contentEl) {
                contentEl.innerHTML = insightsHtml;
                // Reattach handlers if structured insights
                if (this.currentInsightsData) {
                    this.reattachInsightsHandlers(contentEl);
                }
            }
        } catch (error) {
            console.error('Error loading MTD insights:', error);
            // Clear headline on error
            const headlineTitleEl = document.getElementById('insights-headline-title');
            if (headlineTitleEl) headlineTitleEl.innerHTML = '';
            const errorHtml = `<div class="insights-empty">Unable to load insights.</div>`;
            this.insightsContent = errorHtml;
            if (contentEl) {
                contentEl.innerHTML = errorHtml;
            }
        }
    }
    
    // Render structured insights with cards and modals
    renderStructuredInsights(container, data) {
        const { summary, insights, period } = data;
        
        // Update the headline in the title area
        const headlineTitleEl = document.getElementById('insights-headline-title');
        if (headlineTitleEl && summary.headline) {
            headlineTitleEl.innerHTML = this.escapeHtml(summary.headline);
        }
        
        // Start with empty content since headline is now in the title area
        let html = '';
        
        if (insights && insights.length > 0) {
            // Prioritize displaying at least one of each severity type
            const prioritizedInsights = this.prioritizeInsightsBySeverity(insights);
            
            // Always display exactly 3 cards
            const displayInsights = prioritizedInsights.slice(0, 3);
            
            html += '<div class="insights-cards">';
            displayInsights.forEach((insight, index) => {
                html += this.renderInsightCard(insight, index);
            });
            html += '</div>';
            
            // Add footer with note and "view more" link
            html += `
                <div class="insights-footer">
                    <span class="insights-footer-note">Other KPIs in line with requirements and group averages</span>
                    <a href="#" class="insights-view-more" id="insights-view-more">View more</a>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Store insights data for view more modal
        this.currentInsightsData = data;
        
        // Attach click handler for "view more" link
        const viewMoreLink = container.querySelector('#insights-view-more');
        if (viewMoreLink) {
            viewMoreLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openViewMoreModal(data, this.data);
            });
        }
        
        // Attach click handlers for expandable cards
        insights?.forEach((insight, index) => {
            const cardEl = container.querySelector(`[data-insight-id="${insight.id}"]`);
            if (cardEl) {
                cardEl.addEventListener('click', () => this.openInsightModal(insight));
            }
        });
    }
    
    // Prioritize insights to show at least one of each severity type when available
    prioritizeInsightsBySeverity(insights) {
        if (!insights || insights.length === 0) {
            return [];
        }
        
        // Separate insights by severity
        const critical = insights.filter(i => i.severity === 'critical');
        const warning = insights.filter(i => i.severity === 'warning');
        const positive = insights.filter(i => i.severity === 'positive');
        const info = insights.filter(i => i.severity === 'info');
        
        // Build prioritized list: ensure at least one of each type if available
        const prioritized = [];
        
        // Add at least one critical (red) if available
        if (critical.length > 0) {
            prioritized.push(critical[0]);
        }
        
        // Add at least one warning (orange) if available
        if (warning.length > 0) {
            prioritized.push(warning[0]);
        }
        
        // Add at least one positive (green) if available
        if (positive.length > 0) {
            prioritized.push(positive[0]);
        }
        
        // Add remaining insights in priority order (critical, warning, positive, info)
        // Skip ones we've already added
        if (critical.length > 1) {
            prioritized.push(...critical.slice(1));
        }
        if (warning.length > 1) {
            prioritized.push(...warning.slice(1));
        }
        if (positive.length > 1) {
            prioritized.push(...positive.slice(1));
        }
        prioritized.push(...info);
        
        return prioritized;
    }
    
    // Render a single insight card
    renderInsightCard(insight, index) {
        const severityClass = `insight-${insight.severity}`;
        
        return `
            <div class="insight-card ${severityClass}" data-insight-id="${insight.id}" data-index="${index}">
                <div class="insight-card-content">
                    <div class="insight-text-wrapper">
                        <div class="insight-title">${this.escapeHtml(insight.title)}</div>
                        <div class="insight-summary">${this.escapeHtml(insight.summary)}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Open modal with detailed insight
    openInsightModal(insight) {
        // Remove existing modal if any
        const existingModal = document.getElementById('insight-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.id = 'insight-modal';
        modal.className = 'insight-modal-overlay';
        modal.innerHTML = `
            <div class="insight-modal">
                <div class="insight-modal-header">
                    <div class="insight-modal-title-group">
                        <div class="insight-icon insight-${insight.severity}">${this.getIconSvg(insight.icon, insight.severity)}</div>
                        <h3 class="insight-modal-title">${this.escapeHtml(insight.title)}</h3>
                    </div>
                    <button class="insight-modal-close" aria-label="Close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="insight-modal-body">
                    <div class="insight-modal-detail">${this.escapeHtml(insight.detail)}</div>
                    ${insight.suggested_actions && insight.suggested_actions.length > 0 ? `
                        <div class="insight-modal-actions">
                            <h4>Suggested Actions</h4>
                            <ul>
                                ${insight.suggested_actions.map(action => `<li>${this.escapeHtml(action)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Activate modal (trigger animation)
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
        
        // Close handlers
        const closeBtn = modal.querySelector('.insight-modal-close');
        const overlay = modal;
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 200);
        };
        
        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
        
        // ESC key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }
    
    // Open the View More modal showing all KPIs evaluated
    openViewMoreModal(insightsData, dashboardData = null) {
        // Remove existing modal if any
        const existingModal = document.getElementById('view-more-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Get the detailed analysis and metric evaluations from the API response
        const detailedAnalysis = insightsData.summary?.paragraphs?.[0] || 
            'Your pharmacy is performing within expected parameters. Continue monitoring key metrics and maintaining current strategies.';
        
        // Get metric evaluations from API response (new format)
        const metricEvaluations = insightsData.metric_evaluations || [];
        
        const modal = document.createElement('div');
        modal.id = 'view-more-modal';
        modal.className = 'insight-modal-overlay';
        modal.innerHTML = `
            <div class="insight-modal view-more-modal">
                <div class="insight-modal-header">
                    <div class="insight-modal-title-group">
                        <div class="insight-icon view-more-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                            </svg>
                        </div>
                        <h3 class="insight-modal-title">Complete KPI Evaluation</h3>
                    </div>
                    <button class="insight-modal-close" aria-label="Close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="insight-modal-body">
                    <div class="view-more-analysis">
                        <p>${detailedAnalysis}</p>
                    </div>
                    <div class="view-more-divider"></div>
                    <h4 class="view-more-metrics-title">Metrics Overview</h4>
                    <div class="view-more-metrics">
                        ${metricEvaluations.map(metric => this.renderMetricEvaluation(metric)).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Activate modal (trigger animation)
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
        
        // Close handlers
        const closeBtn = modal.querySelector('.insight-modal-close');
        const overlay = modal;
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 200);
        };
        
        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
        
        // ESC key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }
    
    // Generate KPI evaluations based on insights data and dashboard metrics
    generateKPIEvaluations(insightsData, dashboardData = null) {
        const { insights = [] } = insightsData;
        
        // Extract metrics from dashboard data or insights
        const metrics = this.extractMetrics(dashboardData, insights);
        
        // Define all KPIs we evaluate with their metric values
        const allKPIs = [
            {
                id: 'turnover',
                name: 'Turnover Performance',
                icon: 'trend_up',
                category: 'Revenue',
                value: metrics.turnover,
                format: 'currency',
                threshold: { good: 0, warning: -5 }, // % vs last year
                comparison: metrics.prevYearTurnover
            },
            {
                id: 'target_achievement',
                name: 'Target Achievement',
                icon: 'target',
                category: 'Revenue',
                value: metrics.targetAchievementPct,
                format: 'percentage',
                threshold: { good: 100, warning: 95 },
                comparison: metrics.target
            },
            {
                id: 'gross_profit',
                name: 'Gross Profit Percentage',
                icon: 'chart',
                category: 'Profitability',
                value: metrics.gpPercent,
                format: 'percentage',
                threshold: { good: 26, warning: 24, critical: 22 },
                comparison: null
            },
            {
                id: 'basket_size',
                name: 'Average Basket Size',
                icon: 'basket',
                category: 'Customer',
                value: metrics.basketSize,
                format: 'currency',
                threshold: { good: 0, warning: 0 },
                comparison: null
            },
            {
                id: 'transaction_count',
                name: 'Transaction Volume',
                icon: 'transactions',
                category: 'Customer',
                value: metrics.transactionCount,
                format: 'number',
                threshold: { good: 0, warning: 0 },
                comparison: null
            },
            {
                id: 'purchase_budget',
                name: 'Purchase vs Budget',
                icon: 'purchase',
                category: 'Inventory',
                value: metrics.purchases,
                format: 'currency',
                threshold: { good: metrics.purchaseBudget, warning: metrics.purchaseBudget * 1.15 },
                comparison: metrics.purchaseBudget
            },
            {
                id: 'stock_turnover',
                name: 'Stock Turnover',
                icon: 'stock',
                category: 'Inventory',
                value: null, // Not available in current data
                format: 'number',
                threshold: { good: 0, warning: 0 },
                comparison: null
            },
            {
                id: 'yoy_growth',
                name: 'Year-on-Year Growth',
                icon: 'growth',
                category: 'Growth',
                value: metrics.turnoverGrowthPct,
                format: 'percentage',
                threshold: { good: 5, warning: -5 },
                comparison: metrics.prevYearTurnover
            }
        ];
        
        // Check each KPI against insights to determine status and calculate values
        return allKPIs.map(kpi => {
            // Find if there's an insight matching this KPI
            const relatedInsight = insights.find(i => 
                i.id === kpi.id || 
                i.title?.toLowerCase().includes(kpi.name.toLowerCase().split(' ')[0])
            );
            
            // Determine status from insight or calculate from thresholds
            let status = 'positive';
            if (relatedInsight) {
                status = relatedInsight.severity;
            } else {
                status = this.calculateKPIStatus(kpi, metrics);
            }
            
            return {
                ...kpi,
                status: status,
                message: this.generateKPIMessage(kpi, status, relatedInsight, metrics)
            };
        });
    }
    
    // Extract metrics from dashboard data and insights
    extractMetrics(dashboardData, insights) {
        // Start with dashboard data (daily metrics)
        const metrics = dashboardData ? {
            turnover: dashboardData.currentTurnover || 0,
            prevYearTurnover: dashboardData.prevYearTurnover || 0,
            turnoverGrowthPct: dashboardData.turnoverGrowthPct || 0,
            target: dashboardData.target?.value || 0,
            targetAchievementPct: dashboardData.targetAchievementPct || 0,
            gpPercent: dashboardData.gpPercent || 0,
            gpValue: dashboardData.gpValue || 0,
            basketSize: dashboardData.basketSize || 0,
            transactionCount: dashboardData.transactionCount || 0,
            purchases: dashboardData.purchases || 0,
            purchaseBudget: dashboardData.purchaseBudget || 0
        } : {};
        
        // Override with MTD metrics from insights if available (more accurate for MTD evaluation)
        insights.forEach(insight => {
            if (insight.metrics) {
                // Map insight metrics to our metric names
                if (insight.metrics.turnover_current !== undefined) {
                    metrics.turnover = insight.metrics.turnover_current;
                }
                if (insight.metrics.turnover_last_year !== undefined) {
                    metrics.prevYearTurnover = insight.metrics.turnover_last_year;
                }
                if (insight.metrics.turnover_pharmacy_growth_pct !== undefined) {
                    metrics.turnoverGrowthPct = insight.metrics.turnover_pharmacy_growth_pct;
                }
                if (insight.metrics.gp_percentage !== undefined) {
                    metrics.gpPercent = insight.metrics.gp_percentage;
                }
                if (insight.metrics.gp_target !== undefined) {
                    // Use as reference, not override
                }
            }
        });
        
        return metrics;
    }
    
    // Calculate KPI status based on thresholds
    calculateKPIStatus(kpi, metrics) {
        if (!kpi.value && kpi.value !== 0) return 'info';
        
        const { threshold } = kpi;
        
        // For percentage-based KPIs
        if (kpi.format === 'percentage') {
            if (kpi.id === 'gross_profit') {
                if (kpi.value < threshold.critical) return 'critical';
                if (kpi.value < threshold.warning) return 'warning';
                if (kpi.value >= threshold.good) return 'positive';
                return 'positive'; // Between warning and good is still acceptable
            }
            if (kpi.id === 'target_achievement') {
                if (kpi.value >= threshold.good) return 'positive';
                if (kpi.value >= threshold.warning) return 'warning';
                return 'critical';
            }
            if (kpi.id === 'yoy_growth') {
                if (kpi.value >= threshold.good) return 'positive';
                if (kpi.value >= threshold.warning) return 'warning';
                return 'warning';
            }
        }
        
        // For currency-based KPIs with comparisons
        if (kpi.format === 'currency' && kpi.comparison) {
            if (kpi.id === 'purchase_budget') {
                const ratio = (kpi.value / kpi.comparison) * 100;
                if (ratio <= 100) return 'positive';
                if (ratio <= 115) return 'warning';
                return 'critical';
            }
        }
        
        // Default to positive if no specific logic
        return 'positive';
    }
    
    // Generate AI message for each KPI based on its status, including values and explanations
    generateKPIMessage(kpi, status, insight, metrics) {
        const formatValue = (value, format) => {
            if (value === null || value === undefined) return 'N/A';
            if (format === 'currency') {
                return new Intl.NumberFormat('en-ZA', {
                    style: 'currency',
                    currency: 'ZAR',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(Math.round(value));
            }
            if (format === 'percentage') {
                return `${value.toFixed(1)}%`;
            }
            if (format === 'number') {
                return new Intl.NumberFormat('en-ZA').format(Math.round(value));
            }
            return value;
        };
        
        const formattedValue = formatValue(kpi.value, kpi.format);
        
        // Build messages with actual values and explanations
        const messages = {
            turnover: {
                positive: `Your turnover of ${formattedValue} is performing well. ${kpi.comparison ? `Compared to last year's ${formatValue(kpi.comparison, 'currency')}, this represents ${kpi.value > kpi.comparison ? 'growth' : 'stable performance'}. ` : ''}This is acceptable because it shows consistent revenue generation and aligns with expected performance levels.`,
                warning: insight?.summary || `Turnover of ${formattedValue} is slightly below expectations. ${kpi.comparison ? `Last year's turnover was ${formatValue(kpi.comparison, 'currency')}, showing a decline. ` : ''}Consider reviewing promotional activities and customer engagement to improve performance.`,
                critical: insight?.summary || `Turnover of ${formattedValue} requires immediate attention. ${kpi.comparison ? `This is significantly below last year's ${formatValue(kpi.comparison, 'currency')}. ` : ''}Urgent action needed to address the shortfall.`
            },
            target_achievement: {
                positive: `You're achieving ${formattedValue} of your target, which is excellent. ${kpi.comparison ? `Your target is ${formatValue(kpi.comparison, 'currency')} and you're on track to meet or exceed it. ` : ''}This is acceptable because it demonstrates strong performance against your goals and indicates effective sales execution.`,
                warning: insight?.summary || `Target achievement is at ${formattedValue}, which is below the ideal 100% threshold. ${kpi.comparison ? `With a target of ${formatValue(kpi.comparison, 'currency')}, a focused push in the remaining days could help close the gap. ` : ''}`,
                critical: insight?.summary || `Target achievement of ${formattedValue} shows a significant gap. ${kpi.comparison ? `Your target is ${formatValue(kpi.comparison, 'currency')}. ` : ''}Review your strategy and consider intensive promotional activities.`
            },
            gross_profit: {
                positive: `Your GP% of ${formattedValue} is healthy and above the 25% target. This is acceptable because it indicates effective margin management, proper pricing strategies, and good control over cost of sales. A GP% above 26% shows strong profitability while remaining competitive.`,
                warning: insight?.summary || `GP% of ${formattedValue} is below the 24% warning threshold but above the 22% critical level. This warrants monitoring as it may indicate pricing pressure or cost increases. Review pricing and supplier terms for improvement opportunities.`,
                critical: insight?.summary || `GP% of ${formattedValue} is critically low, below the 22% threshold. Immediate review of pricing strategy and cost management required. This level of margin compression directly impacts profitability.`
            },
            basket_size: {
                positive: `Average basket size of ${formattedValue} is strong, indicating good cross-selling and upselling performance. This is acceptable because it shows your team is effectively increasing transaction value, which directly contributes to revenue growth. A healthy basket size suggests customers are finding value in additional products.`,
                warning: insight?.summary || `Basket size of ${formattedValue} could be improved. Consider training staff on suggestive selling techniques and reviewing product placement to encourage additional purchases.`,
                critical: insight?.summary || `Basket size of ${formattedValue} is significantly below average. Implement cross-selling strategies urgently to improve transaction value.`
            },
            transaction_count: {
                positive: `Transaction volume of ${formattedValue.toLocaleString('en-ZA')} transactions is healthy, showing consistent customer footfall and engagement. This is acceptable because it indicates strong customer traffic, which is the foundation of retail success. Healthy transaction counts suggest good store visibility and customer satisfaction.`,
                warning: insight?.summary || `Transaction count of ${formattedValue.toLocaleString('en-ZA')} is lower than expected. Review marketing efforts to drive more store traffic and consider promotional activities to attract customers.`,
                critical: insight?.summary || `Customer traffic of ${formattedValue.toLocaleString('en-ZA')} transactions is significantly down. Urgent marketing and promotional action needed to restore footfall.`
            },
            purchase_budget: {
                positive: `Purchases of ${formattedValue} are well-controlled and within budget parameters (budget: ${formatValue(kpi.comparison, 'currency')}). This is acceptable because it shows disciplined inventory management, preventing overstocking while maintaining adequate stock levels. Staying within budget protects cash flow and reduces the risk of obsolescence.`,
                warning: insight?.summary || `Purchases of ${formattedValue} are trending above budget (${formatValue(kpi.comparison, 'currency')}). Monitor inventory levels to avoid overstocking and review ordering patterns to align with sales trends.`,
                critical: insight?.summary || `Purchase spending of ${formattedValue} significantly exceeds budget (${formatValue(kpi.comparison, 'currency')}). Review ordering practices immediately to prevent cash flow issues and excess inventory.`
            },
            stock_turnover: {
                positive: `Stock turnover is at a healthy rate, indicating inventory freshness is being maintained well. This is acceptable because it shows products are moving efficiently, reducing the risk of obsolescence and ensuring customers have access to fresh stock.`,
                warning: insight?.summary || `Stock turnover is slower than ideal. Review slow-moving items for clearance opportunities and adjust ordering patterns to match sales velocity.`,
                critical: insight?.summary || `Stock is not turning fast enough, creating risk of obsolescence. Take immediate action on slow movers through promotions or clearance.`
            },
            yoy_growth: {
                positive: `Year-on-year growth of ${formattedValue} shows positive performance compared to last year (${formatValue(kpi.comparison, 'currency')}). This is acceptable because it demonstrates business expansion, effective strategies, and market share growth. Positive growth indicates the business is trending in the right direction.`,
                warning: insight?.summary || `Growth of ${formattedValue} is flat compared to last year (${formatValue(kpi.comparison, 'currency')}). Look for opportunities to expand sales through new products, services, or marketing initiatives.`,
                critical: insight?.summary || `Performance is declining by ${Math.abs(kpi.value).toFixed(1)}% versus last year (${formatValue(kpi.comparison, 'currency')}). Strategic review needed to reverse the trend and identify the root causes.`
            }
        };
        
        return messages[kpi.id]?.[status] || `This metric (${formattedValue}) is being monitored and evaluated.`;
    }
    
    // Render a single KPI item in the view more modal
    renderKPIItem(kpi) {
        const statusColors = {
            positive: { bg: 'rgba(34, 197, 94, 0.15)', icon: '#22c55e', text: '#22c55e' },
            warning: { bg: 'rgba(243, 122, 32, 0.15)', icon: '#F37A20', text: '#F37A20' },
            critical: { bg: 'rgba(239, 68, 68, 0.15)', icon: '#ef4444', text: '#ef4444' },
            info: { bg: 'rgba(59, 130, 246, 0.15)', icon: '#3b82f6', text: '#3b82f6' }
        };
        
        const statusIcons = {
            positive: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>`,
            warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>`,
            critical: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>`,
            info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>`
        };
        
        const colors = statusColors[kpi.status] || statusColors.info;
        const statusIcon = statusIcons[kpi.status] || statusIcons.info;
        const statusLabel = kpi.status === 'positive' ? 'On Track' : 
                           kpi.status === 'warning' ? 'Needs Attention' : 
                           kpi.status === 'critical' ? 'Critical' : 'Info';
        
        // Format the value for display
        const formatValue = (value, format) => {
            if (value === null || value === undefined) return 'N/A';
            if (format === 'currency') {
                return new Intl.NumberFormat('en-ZA', {
                    style: 'currency',
                    currency: 'ZAR',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(Math.round(value));
            }
            if (format === 'percentage') {
                return `${value.toFixed(1)}%`;
            }
            if (format === 'number') {
                return new Intl.NumberFormat('en-ZA').format(Math.round(value));
            }
            return value;
        };
        
        const formattedValue = formatValue(kpi.value, kpi.format);
        const showValue = kpi.value !== null && kpi.value !== undefined;
        
        return `
            <div class="view-more-kpi-item">
                <div class="view-more-kpi-header">
                    <div class="view-more-kpi-status" style="background: ${colors.bg}; color: ${colors.icon};">
                        ${statusIcon}
                    </div>
                    <div class="view-more-kpi-title-group">
                        <span class="view-more-kpi-name">${this.escapeHtml(kpi.name)}</span>
                        <span class="view-more-kpi-category">${this.escapeHtml(kpi.category)}</span>
                    </div>
                    ${showValue ? `<div class="view-more-kpi-value" style="color: ${colors.text}; font-weight: 600;">${formattedValue}</div>` : ''}
                    <span class="view-more-kpi-badge" style="background: ${colors.bg}; color: ${colors.text};">${statusLabel}</span>
                </div>
                <p class="view-more-kpi-message">${this.escapeHtml(kpi.message)}</p>
            </div>
        `;
    }
    
    // Render a single metric evaluation from the API response
    // Status: 1 = Green (good), 2 = Orange (warning), 3 = Red (critical)
    renderMetricEvaluation(metric) {
        const statusConfig = {
            1: { 
                color: '#22c55e', 
                bgColor: 'rgba(34, 197, 94, 0.12)', 
                borderColor: 'rgba(34, 197, 94, 0.3)',
                label: 'Good',
                icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>`
            },
            2: { 
                color: '#F37A20', 
                bgColor: 'rgba(243, 122, 32, 0.12)', 
                borderColor: 'rgba(243, 122, 32, 0.3)',
                label: 'Warning',
                icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>`
            },
            3: { 
                color: '#ef4444', 
                bgColor: 'rgba(239, 68, 68, 0.12)', 
                borderColor: 'rgba(239, 68, 68, 0.3)',
                label: 'Critical',
                icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>`
            }
        };
        
        const status = metric.status || 1;
        const config = statusConfig[status] || statusConfig[1];
        
        return `
            <div class="metric-eval-item" style="background: ${config.bgColor};">
                <div class="metric-eval-header">
                    <div class="metric-eval-icon" style="color: ${config.color};">
                        ${config.icon}
                    </div>
                    <span class="metric-eval-label">${this.escapeHtml(metric.label || metric.metric)}</span>
                    <span class="metric-eval-value" style="color: ${config.color};">${this.escapeHtml(metric.value || 'N/A')}</span>
                </div>
                <p class="metric-eval-feedback">${this.escapeHtml(metric.feedback || '')}</p>
            </div>
        `;
    }
    
    // Get icon SVG based on icon name and severity
    getIconSvg(iconName, severity) {
        const icons = {
            'trend_up': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                <polyline points="17 6 23 6 23 12"></polyline>
            </svg>`,
            'trend_down': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
                <polyline points="17 18 23 18 23 12"></polyline>
            </svg>`,
            'alert': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                <path d="M12 9v3"></path>
                <path d="M12 17h.01"></path>
            </svg>`,
            'check': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>`,
            'info': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>`
        };
        
        return icons[iconName] || icons['info'];
    }
    
    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Parse markdown for insights (simple version for paragraphs) - kept for fallback
    parseInsightsMarkdown(markdown) {
        if (!markdown) return '';
        
        return markdown
            // Escape HTML
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Convert double newlines to paragraph breaks
            .split('\n\n')
            .filter(p => p.trim())
            .map(p => `<p>${p.trim()}</p>`)
            .join('');
    }

    // Format Turnover card: badge shows YoY growth %, secondary shows vs last year amount
    formatTurnoverCard(prevYearTurnover, prevYearYear, growthPct) {
        let badge = null;
        let secondary = { text: '', className: '' };
        
        if (prevYearTurnover && prevYearTurnover > 0) {
            const formattedAmount = new Intl.NumberFormat('en-ZA', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(prevYearTurnover));
            
            secondary = { 
                text: `vs ${prevYearYear}: R ${formattedAmount}`,
                className: ''
            };
            
            if (growthPct !== null) {
                const isPositive = growthPct >= 0;
                badge = {
                    text: isPositive ? `+${Math.round(growthPct)}%` : `${Math.round(growthPct)}%`,
                    className: isPositive ? 'positive' : 'negative'
                };
            }
        } else {
            secondary = { text: 'No previous year data', className: '' };
        }
        
        return { badge, secondary };
    }
    
    // Format Target card: badge shows achievement %, secondary shows over/under amount
    formatTargetCard(currentTurnover, targetValue, achievementPct) {
        let badge = null;
        let secondary = { text: '—', className: '' };
        
        if (targetValue > 0 && currentTurnover > 0) {
            const difference = currentTurnover - targetValue;
            const isOver = difference >= 0;
            
            const formattedDiff = new Intl.NumberFormat('en-ZA', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.abs(Math.round(difference)));
            
            secondary = { 
                text: `R ${formattedDiff} ${isOver ? 'over' : 'under'}`,
                className: ''  // No color on secondary text
            };
            
            if (achievementPct !== null) {
                const isPositive = achievementPct >= 100;
                // Show relative to 100% (e.g., -30% means 70% of target)
                const displayPct = Math.round(achievementPct - 100);
                badge = {
                    text: displayPct >= 0 ? `+${displayPct}%` : `${displayPct}%`,
                    className: isPositive ? 'positive' : 'negative'
                };
            }
        }
        
        return { badge, secondary };
    }
    
    // Format GP card: no badge, secondary shows GP value in Rands
    formatGpCard(gpValue, gpPercent) {
        let secondary = { text: '—', className: '' };
        let badge = null;
        
        if (gpValue && gpValue > 0) {
            const formattedAmount = new Intl.NumberFormat('en-ZA', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(gpValue));
            
            secondary = { 
                text: `GP: R ${formattedAmount}`,
                className: ''
            };
        }
        
        // Add warning badge if GP% is below 25%
        if (gpPercent > 0 && gpPercent < 25) {
            badge = {
                text: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
                className: 'warning-icon'
            };
        }
        
        return { badge, secondary };
    }
    
    // Format Basket card: no badge, secondary shows transaction count
    formatBasketCard(transactionCount) {
        let secondary = { text: '—', className: '' };
        
        if (transactionCount && transactionCount > 0) {
            const formattedCount = new Intl.NumberFormat('en-ZA').format(transactionCount);
            secondary = { 
                text: `${formattedCount} Transactions`,
                className: ''
            };
        }
        
        return { badge: null, secondary };
    }
    
    // Calculate Month-to-Date (MTD) turnover
    calculateMTD(daysData, selectedDate) {
        if (!daysData || !Array.isArray(daysData) || daysData.length === 0) {
            return 0;
        }
        
        // Parse selected date
        const selected = new Date(selectedDate + 'T00:00:00');
        const selectedYear = selected.getFullYear();
        const selectedMonth = selected.getMonth();
        
        // Sum all turnover from the start of the month up to and including selected date
        let mtdTotal = 0;
        for (const day of daysData) {
            if (!day.business_date) continue;
            
            const dayDate = new Date(day.business_date + 'T00:00:00');
            const dayYear = dayDate.getFullYear();
            const dayMonth = dayDate.getMonth();
            
            // Include days from the same month and year, up to selected date
            if (dayYear === selectedYear && 
                dayMonth === selectedMonth && 
                dayDate <= selected) {
                mtdTotal += Number(day.turnover || 0);
            }
        }
        
        return mtdTotal;
    }
    
    // Format MTD card: no badge, secondary shows period info
    formatMTDCard(mtdValue) {
        let secondary = { text: '—', className: '' };
        
        if (mtdValue && mtdValue > 0) {
            secondary = { 
                text: 'Month to date',
                className: ''
            };
        }
        
        return { badge: null, secondary };
    }

    renderTopCard(title, value, format = 'number', cardData = null, cardClass = 'dashboard-top-card') {
        // Show "—" for zero or null values (matching old app behavior)
        const numValue = Number(value) || 0;
        let formattedValue;
        
        if (numValue === 0) {
            formattedValue = '—';
        } else if (format === 'currency') {
            formattedValue = new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(numValue));
        } else if (format === 'percentage') {
            formattedValue = `${numValue.toFixed(1)}%`;
        } else {
            formattedValue = new Intl.NumberFormat('en-ZA', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(numValue));
        }

        // Get icon for each card type
        const icon = this.getCardIcon(title);
        
        // Build badge HTML (square percentage indicator)
        let badgeHtml = '';
        if (cardData?.badge) {
            const badgeClass = cardData.badge.className || '';
            badgeHtml = `<span class="dashboard-top-card-badge ${badgeClass}">${cardData.badge.text}</span>`;
        }
        
        // Build secondary line HTML
        let secondaryHtml = '';
        if (cardData?.secondary?.text) {
            const classAttr = cardData.secondary.className ? ` ${cardData.secondary.className}` : '';
            secondaryHtml = `<p class="dashboard-top-card-secondary${classAttr}">${cardData.secondary.text}</p>`;
        }

        return `
            <div class="${cardClass}">
                <h3 class="dashboard-top-card-title">
                    <span class="dashboard-top-card-icon">${icon}</span>
                    ${title}
                </h3>
                <div class="dashboard-top-card-value-row">
                <p class="dashboard-top-card-value">${formattedValue}</p>
                    ${badgeHtml}
                </div>
                ${secondaryHtml}
            </div>
        `;
    }

    renderPurchaseVsBudgetCard(purchases, purchaseBudget) {
        const purchasesFormatted = purchases > 0 ? 
            new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(purchases)) : '—';
        
        const budgetFormatted = purchaseBudget > 0 ?
            new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(purchaseBudget)) : '—';
        
        // Calculate difference and percentage
        let diffValue = 0;
        let diffLabel = 'Difference';
        let diffFormatted = '—';
        let diffColor = '';
        let percentage = 0;
        let percentageColor = '';
        
        if (purchaseBudget > 0 && purchases > 0) {
            diffValue = purchases - purchaseBudget;
            const absDiff = Math.abs(diffValue);
            diffFormatted = new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(absDiff));
            
            if (diffValue > 0) {
                diffLabel = 'Above Budget';
                diffColor = 'var(--statusError, #ef4444)';
            } else if (diffValue < 0) {
                diffLabel = 'Below Budget';
                diffColor = 'var(--statusSuccess, #22c55e)';
            } else {
                diffLabel = 'On Budget';
                diffColor = '';
            }
            
            percentage = Math.round((purchases / purchaseBudget) * 100);
            // percentageColor not used - pie center value is always dark grey
        }
        
        // Calculate circular progress (circumference = 2 * π * r, r = 50)
        const circumference = 2 * Math.PI * 50;
        const visualPct = Math.min(percentage, 100);
        const offset = circumference - (visualPct / 100) * circumference;
        
        return `
            <div class="dashboard-bottom-card purchase-budget-card">
                <h3 class="dashboard-bottom-card-title">
                    <span class="dashboard-top-card-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="9" cy="21" r="1"></circle>
                            <circle cx="20" cy="21" r="1"></circle>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                        </svg>
                    </span>
                    PURCHASE VS BUDGET SPEND
                </h3>
                <div class="purchase-card-content">
                    <div class="purchase-metrics">
                        <div class="purchase-metric-item">
                            <div class="purchase-metric-label">PURCHASES</div>
                            <div class="purchase-metric-value">${purchasesFormatted}</div>
                        </div>
                        <div class="purchase-metric-item">
                            <div class="purchase-metric-label">BUDGET</div>
                            <div class="purchase-metric-value">${budgetFormatted}</div>
                        </div>
                        <div class="purchase-metric-item">
                            <div class="purchase-metric-label">${diffLabel}</div>
                            <div class="purchase-metric-value" style="color: ${diffColor};">${diffFormatted}</div>
                        </div>
                    </div>
                    <div class="purchase-chart-wrapper">
                        <svg class="purchase-chart-svg" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="#E5E7EB" stroke-width="20"/>
                            <circle cx="60" cy="60" r="50" fill="none" stroke="#22c55e" stroke-width="20" 
                                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" 
                                style="transition: stroke-dashoffset 1s ease; stroke-linecap: round;" 
                                class="purchase-chart-segment"/>
                        </svg>
                        <div class="purchase-chart-center">
                            <span class="purchase-chart-percentage">${purchaseBudget > 0 && purchases > 0 ? percentage + '%' : '0%'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderPurchaseVsTurnoverCard(purchases, turnover) {
        const purchasesFormatted = purchases > 0 ? 
            new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(purchases)) : '—';
        
        const turnoverFormatted = turnover > 0 ?
            new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(turnover)) : '—';
        
        // Calculate percentage of turnover
        let percentage = 0;
        if (turnover > 0 && purchases > 0) {
            percentage = Math.round((purchases / turnover) * 100);
        }
        
        // Calculate circular progress
        const circumference = 2 * Math.PI * 50;
        const visualPct = Math.min(percentage, 100);
        const offset = circumference - (visualPct / 100) * circumference;
        
        return `
            <div class="dashboard-bottom-card purchase-turnover-card">
                <h3 class="dashboard-bottom-card-title">
                    <span class="dashboard-top-card-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="9" cy="21" r="1"></circle>
                            <circle cx="20" cy="21" r="1"></circle>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                        </svg>
                    </span>
                    PURCHASE VS TURNOVER
                </h3>
                <div class="purchase-card-content">
                    <div class="purchase-metrics">
                        <div class="purchase-metric-item">
                            <div class="purchase-metric-label">PURCHASES</div>
                            <div class="purchase-metric-value">${purchasesFormatted}</div>
                        </div>
                        <div class="purchase-metric-item">
                            <div class="purchase-metric-label">TURNOVER</div>
                            <div class="purchase-metric-value">${turnoverFormatted}</div>
                        </div>
                        <div class="purchase-metric-item">
                            <div class="purchase-metric-label">% OF TURNOVER</div>
                            <div class="purchase-metric-value">${percentage > 0 ? percentage + '%' : '—'}</div>
                        </div>
                    </div>
                    <div class="purchase-chart-wrapper">
                        <svg class="purchase-chart-svg" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="#E5E7EB" stroke-width="20"/>
                            <circle cx="60" cy="60" r="50" fill="none" stroke="#F37A20" stroke-width="20" 
                                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" 
                                style="transition: stroke-dashoffset 1s ease; stroke-linecap: round;" 
                                class="purchase-chart-segment"/>
                        </svg>
                        <div class="purchase-chart-center">
                            <span class="purchase-chart-percentage">${turnover > 0 && purchases > 0 ? percentage + '%' : '0%'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getCardIcon(title) {
        const icons = {
            'Turnover': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="2" x2="12" y2="22"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>`,
            'Target': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="6"></circle>
                <circle cx="12" cy="12" r="2"></circle>
            </svg>`,
            'GP%': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>`,
            'Basket': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>`,
            'MTD Turnover': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>`,
            'Stock Value': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>`
        };
        return icons[title] || '';
    }

    async loadTurnoverChart() {
        const canvas = document.getElementById('turnover-chart');
        if (!canvas) {
            console.warn('Turnover chart canvas not found');
            return;
        }
        
        try {
            const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
            const pharmacyId = pharmacy?.id || pharmacy?.pharmacy_id;
            const selectedDate = this.data?.date;
            
            console.log('Loading turnover chart for pharmacy:', pharmacyId, 'date:', selectedDate);
            
            if (!pharmacyId || !selectedDate) {
                console.warn('Missing pharmacy or date for chart:', { pharmacyId, selectedDate });
                this.drawEmptyChart(canvas);
                return;
            }
            
            // Look back 45 days to find 14 trading days
            const maxLookbackDays = 45;
            const candidateDates = [];
            const currentDate = new Date(selectedDate + 'T00:00:00');
            
            for (let i = 0; i < maxLookbackDays; i++) {
                const d = new Date(currentDate);
                d.setDate(d.getDate() - i);
                candidateDates.push(d);
            }
            
            // Get all months needed for the range
            const monthsToFetch = this.getMonthsInRange(candidateDates[candidateDates.length - 1], candidateDates[0]);
            const allData = [];
            
            for (const monthStr of monthsToFetch) {
                try {
                    const data = await window.api.getDays(pharmacyId, monthStr);
                    if (Array.isArray(data)) {
                        allData.push(...data);
                    }
                } catch (error) {
                    console.warn('Error fetching days for month:', monthStr, error);
                }
            }
            
            // Map data by business_date
            const currentYearMap = new Map();
            allData.forEach(d => {
                currentYearMap.set(d.business_date, Number(d.turnover) || 0);
            });
            
            // Select 14 trading days (days with turnover > 0)
            const selectedCurrentDatesDesc = [];
            for (const d of candidateDates) {
                const ds = this.formatYmdLocal(d);
                const val = currentYearMap.get(ds) || 0;
                if (val > 0) {
                    selectedCurrentDatesDesc.push(d);
                }
                if (selectedCurrentDatesDesc.length === 14) break;
            }
            
            const selectedCurrentDates = selectedCurrentDatesDesc.slice().reverse();
            
            if (selectedCurrentDates.length === 0) {
                this.drawEmptyChart(canvas);
                return;
            }
            
            // Get corresponding previous year dates using the same logic as turnover card
            // Calculate the date range for previous year (same logic as turnover card)
            const firstDate = selectedCurrentDates[0];
            const lastDate = selectedCurrentDates[selectedCurrentDates.length - 1];
            const firstDateObj = new Date(firstDate);
            const lastDateObj = new Date(lastDate);
            
            // Calculate previous year month range (same as turnover card logic)
            const prevYearFirstDate = new Date(firstDateObj);
            prevYearFirstDate.setFullYear(firstDateObj.getFullYear() - 1);
            const prevYearLastDate = new Date(lastDateObj);
            prevYearLastDate.setFullYear(lastDateObj.getFullYear() - 1);
            
            // Fetch previous year data for the month range
            const prevMonthsToFetch = this.getMonthsInRange(prevYearFirstDate, prevYearLastDate);
            const prevAllData = [];
            
            for (const monthStr of prevMonthsToFetch) {
                try {
                    const data = await window.api.getDays(pharmacyId, monthStr);
                    if (Array.isArray(data)) {
                        prevAllData.push(...data);
                    }
                } catch (error) {
                    console.warn('Error fetching previous year days for month:', monthStr, error);
                }
            }
            
            // Format chart data using the same findMatchingWeekday logic as turnover card
            // Check if we're on a small screen to determine label format
            const isSmallScreen = window.innerWidth <= 768;
            
            const chartData = selectedCurrentDates.map((d) => {
                const ds = this.formatYmdLocal(d);
                const currentTurnover = currentYearMap.get(ds) || 0;
                
                // Use the same logic as turnover card to find matching weekday
                const currentWeekday = d.getDay();
                const prevYearDate = new Date(d);
                prevYearDate.setFullYear(prevYearDate.getFullYear() - 1);
                
                // Find matching weekday in previous year data (same as turnover card)
                const prevYearDayData = this.findMatchingWeekday(prevAllData, prevYearDate, currentWeekday);
                const previousTurnover = prevYearDayData ? Number(prevYearDayData.turnover || 0) : 0;
                
                // Use first letter only on small screens, full short name on larger screens
                const fullLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
                const label = isSmallScreen ? fullLabel.charAt(0) : fullLabel;
                
                return { 
                    date: d, 
                    currentTurnover, 
                    previousTurnover, 
                    label,
                    businessDate: ds
                };
            });
            
            console.log('Chart data prepared:', chartData.length, 'days');
            
            // Store chart data for reuse
            this.chartData = chartData;
            this.chartLoaded = true;
            
            this.drawTurnoverBarChart(canvas, chartData);
        } catch (error) {
            console.error('Error loading turnover chart:', error);
            this.drawEmptyChart(canvas);
            this.chartData = null;
        }
    }
    
    getMonthsInRange(startDate, endDate) {
        const months = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const current = new Date(start.getFullYear(), start.getMonth(), 1);
        const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
        
        while (current <= endMonth) {
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            months.push(`${year}-${month}`);
            current.setMonth(current.getMonth() + 1);
        }
        
        return months;
    }
    
    drawTurnoverBarChart(canvas, data) {
        if (!canvas || !data || data.length === 0) {
            this.drawEmptyChart(canvas);
            return;
        }
        
        // Store chart data globally for tooltip
        window.turnoverChartData = data;
        
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        const width = rect.width;
        // Responsive height based on screen size
        const isMobile = window.innerWidth <= 768;
        const isSmallMobile = window.innerWidth <= 640;
        const height = isSmallMobile ? 180 : (isMobile ? 200 : 300);
        
        // Scale for high-DPI displays
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);
        
        ctx.clearRect(0, 0, width, height);
        
        const padding = { top: 20, right: 20, bottom: 50, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        // Calculate max value for scaling
        const maxValue = Math.max(...data.flatMap(d => [d.currentTurnover, d.previousTurnover]), 1);
        
        const barWidth = (chartWidth / data.length) * 0.7;
        const barSpacing = chartWidth / data.length;
        const radius = 4;
        
        // Store bar data for tooltip interaction
        window.turnoverBarData = data.map((d, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const currentHeight = (d.currentTurnover / maxValue) * chartHeight;
            const currentY = padding.top + chartHeight - currentHeight;
            const isHigher = d.currentTurnover >= d.previousTurnover;
            const currentColor = isHigher ? '#22c55e' : '#F37A20';
            
            return {
                x, y: currentY, width: barWidth, height: currentHeight,
                currentColor, data: d, index
            };
        });
        
        // Setup tooltip listeners (only once)
        if (!canvas.hasAttribute('data-tooltip-setup')) {
            this.setupChartTooltip(canvas, padding);
            canvas.setAttribute('data-tooltip-setup', 'true');
        }
        
        // Draw bars
        data.forEach((d, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            
            // Previous year bar (background)
            const prevHeight = (d.previousTurnover / maxValue) * chartHeight;
            const prevY = padding.top + chartHeight - prevHeight;
            
            // Current year bar
            const currentHeight = (d.currentTurnover / maxValue) * chartHeight;
            const currentY = padding.top + chartHeight - currentHeight;
            
            // Color based on growth (green if higher, orange if lower)
            const isHigher = d.currentTurnover >= d.previousTurnover;
            const currentColor = isHigher ? '#22c55e' : '#F37A20';
            
            // Draw previous year bar (grey background) with rounded corners
            ctx.fillStyle = '#E5E7EB';
            ctx.globalAlpha = 0.5;
            this.drawRoundedRect(ctx, x, prevY, barWidth, prevHeight, radius);
            ctx.fill();
            
            // Draw current year bar with rounded corners
            ctx.globalAlpha = 1;
            ctx.fillStyle = currentColor;
            this.drawRoundedRect(ctx, x, currentY, barWidth, currentHeight, radius);
            ctx.fill();
            
            // Draw day labels
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            // Use smaller font and first letter only on small screens
            const isSmallScreen = window.innerWidth <= 768;
            ctx.font = isSmallScreen ? '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            // Use first letter only on small screens to prevent overlap
            const displayLabel = isSmallScreen ? d.label.charAt(0) : d.label;
            ctx.fillText(displayLabel, x + barWidth / 2, padding.top + chartHeight + 20);
        });
        
        // Draw Y-axis labels
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        
        const labelCount = 5;
        for (let i = 0; i <= labelCount; i++) {
            const value = (maxValue * i) / labelCount;
            const y = padding.top + chartHeight - (chartHeight * i / labelCount);
            const label = this.formatCurrencyAbbreviated(value);
            ctx.fillText(label, padding.left - 4, y + 3);
        }
        
        // Draw tooltip if hovering
        if (window.turnoverTooltip) {
            this.drawTurnoverTooltip(ctx, window.turnoverTooltip, padding, width, height);
        }
    }
    
    setupChartTooltip(canvas, padding) {
        if (!canvas) return;
        
        const self = this;
        
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const x = (e.clientX - rect.left) * dpr;
            const y = (e.clientY - rect.top) * dpr;
            const displayX = e.clientX - rect.left;
            const displayY = e.clientY - rect.top;
            
            // Find which bar is being hovered (use display coordinates)
            const barData = window.turnoverBarData?.find(bar => {
                const barRight = bar.x + bar.width;
                const barTop = padding.top;
                const barBottom = padding.top + 300 - padding.bottom;
                return displayX >= bar.x && displayX <= barRight &&
                       displayY >= barTop && displayY <= barBottom;
            });
            
            if (barData) {
                window.turnoverTooltip = {
                    x: displayX,
                    y: displayY,
                    data: barData.data
                };
                // Redraw chart with tooltip
                if (window.turnoverChartData) {
                    self.drawTurnoverBarChart(canvas, window.turnoverChartData);
                }
            } else {
                window.turnoverTooltip = null;
                // Redraw chart without tooltip
                if (window.turnoverChartData) {
                    self.drawTurnoverBarChart(canvas, window.turnoverChartData);
                }
            }
        });
        
        canvas.addEventListener('mouseleave', () => {
            window.turnoverTooltip = null;
            if (window.turnoverChartData) {
                self.drawTurnoverBarChart(canvas, window.turnoverChartData);
            }
        });
    }
    
    drawTurnoverTooltip(ctx, tooltip, padding, width, height) {
        const { x, y, data } = tooltip;
        const percent = data.previousTurnover > 0 ? 
            ((data.currentTurnover - data.previousTurnover) / data.previousTurnover * 100) : 0;
        const isHigher = data.currentTurnover >= data.previousTurnover;
        const color = isHigher ? '#22c55e' : '#F37A20';
        
        // Format values
        const currentFormatted = new Intl.NumberFormat('en-ZA', {
            style: 'currency',
            currency: 'ZAR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Math.round(data.currentTurnover));
        
        const prevFormatted = new Intl.NumberFormat('en-ZA', {
            style: 'currency',
            currency: 'ZAR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Math.round(data.previousTurnover));
        
        const dateFormatted = data.date.toLocaleDateString('en-ZA', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        });
        
        // Tooltip dimensions
        const tooltipWidth = 180;
        const tooltipHeight = 100;
        const tooltipX = Math.max(padding.left, Math.min(x - tooltipWidth / 2, width - tooltipWidth - padding.right));
        const tooltipY = Math.max(padding.top, y - tooltipHeight - 10);
        
        // Draw tooltip background - matching pharmacy picker modal style
        ctx.fillStyle = 'rgba(64, 64, 64, 0.95)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        this.drawRoundedRect(ctx, tooltipX, tooltipY, tooltipWidth, tooltipHeight, 20);
        ctx.fill();
        ctx.stroke();
        
        // Draw tooltip content - white text matching pharmacy picker modal
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(dateFormatted, tooltipX + 12, tooltipY + 20);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Current:', tooltipX + 12, tooltipY + 40);
        ctx.fillText('Previous:', tooltipX + 12, tooltipY + 55);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(currentFormatted, tooltipX + tooltipWidth - 12, tooltipY + 40);
        ctx.fillText(prevFormatted, tooltipX + tooltipWidth - 12, tooltipY + 55);
        
        // Draw percentage change
        if (data.previousTurnover > 0) {
            ctx.fillStyle = color;
            ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            const changeText = percent >= 0 ? `+${percent.toFixed(1)}%` : `${percent.toFixed(1)}%`;
            ctx.fillText(changeText, tooltipX + tooltipWidth / 2, tooltipY + 80);
        }
    }
    
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    
    formatCurrencyAbbreviated(value) {
        if (value >= 1000000) {
            return `R${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
            return `R${(value / 1000).toFixed(0)}k`;
        } else {
            return `R${Math.round(value)}`;
        }
    }
    
    drawEmptyChart(canvas) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        const width = rect.width;
        const height = 300;
        
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);
        
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', width / 2, height / 2);
    }

    showEmptyState() {
        const mainContent = document.querySelector('main');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="empty-state">
                    <h2>Welcome to PharmaSight</h2>
                    <p>This is the new dashboard design. Navigation items are ready, but functionality will be added soon.</p>
                </div>
            `;
        }
    }

    showError(error) {
        const mainContent = document.querySelector('main');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="error-state">
                    <h2>Error Loading Dashboard</h2>
                    <p>${error.message || 'An error occurred while loading data.'}</p>
                </div>
            `;
        }
    }
    
    async loadGroupViewData(date) {
        console.log('Loading group view data for date:', date);
        const month = date.slice(0, 7);
        const pharmacies = window.pharmacyPicker?.pharmacies || [];
        
        this.groupViewData = {};
        
        // Load data for all pharmacies in parallel
        const promises = pharmacies.map(async (pharmacy) => {
            const pharmacyId = pharmacy.pharmacy_id || pharmacy.id;
            const pharmacyName = pharmacy.pharmacy_name || pharmacy.name;
            
            try {
                // Load data similar to single pharmacy view
                const monthData = await window.api.getDays(pharmacyId, month);
                const targetsData = await window.api.getTargets(pharmacyId, month);
                
                const currentDate = new Date(date + 'T00:00:00');
                const year = currentDate.getFullYear();
                const monthIdx = currentDate.getMonth();
                const selectedDay = currentDate.getDate();
                
                // Filter data based on view mode:
                // - Daily: only the selected day
                // - Monthly: all days from start of month to selected date (MTD)
                const filteredData = (monthData || []).filter(d => {
                    const dDate = new Date((d.business_date || d.date || d.bdate) + 'T00:00:00');
                    if (dDate.getFullYear() !== year || dDate.getMonth() !== monthIdx) {
                        return false;
                    }
                    if (this.viewMode === 'daily') {
                        // Only include the selected day
                        return dDate.getDate() === selectedDay;
                    } else {
                        // Monthly: include all days up to selected date (MTD)
                        return dDate.getDate() <= selectedDay;
                    }
                });
                
                // Calculate totals from filtered data
                const turnover = filteredData.reduce((sum, d) => sum + (Number(d.turnover) || 0), 0);
                const purchases = filteredData.reduce((sum, d) => sum + (Number(d.purchases || d.daily_purchases || d.purchases_value) || 0), 0);
                const gpValue = filteredData.reduce((sum, d) => sum + (Number(d.gp_value || d.gp) || 0), 0);
                const gpPercent = turnover > 0 ? (gpValue / turnover) * 100 : 0;
                const transactions = filteredData.reduce((sum, d) => sum + (Number(d.transactions || d.transaction_count) || 0), 0);
                const basket = transactions > 0 ? turnover / transactions : 0;
                
                // Get previous year data for comparison
                const prevYearMonth = `${year - 1}-${String(monthIdx + 1).padStart(2, '0')}`;
                const prevYearData = await window.api.getDays(pharmacyId, prevYearMonth);
                
                // Calculate comparable day for previous year (handle different month lengths)
                const prevYearMonthDays = new Date(year - 1, monthIdx + 1, 0).getDate();
                const comparableDay = Math.min(selectedDay, prevYearMonthDays);
                
                let prevYearFilteredData = [];
                let prevYearTurnover = 0;
                
                if (this.viewMode === 'daily') {
                    // For daily view, use the SAME WEEKDAY matching logic as single pharmacy view
                    // This matches the corresponding day of week (Monday to Monday, etc.)
                    const prevYearDate = new Date(currentDate);
                    prevYearDate.setFullYear(year - 1);
                    const currentWeekday = currentDate.getDay();
                    
                    // Use the existing findMatchingWeekday helper
                    const matchedDayData = this.findMatchingWeekday(prevYearData || [], prevYearDate, currentWeekday);
                    
                    if (matchedDayData) {
                        prevYearFilteredData = [matchedDayData];
                        prevYearTurnover = Number(matchedDayData.turnover) || 0;
                        const matchedDate = matchedDayData.business_date || matchedDayData.date || matchedDayData.bdate;
                        console.log(`[${pharmacyName}] Matched weekday ${currentWeekday} → ${matchedDate}, turnover: R${prevYearTurnover.toFixed(0)}`);
                    } else {
                        console.log(`[${pharmacyName}] No matching weekday data found for prev year`);
                    }
                } else {
                    // Monthly: include all days up to equivalent date (MTD)
                    prevYearFilteredData = (prevYearData || []).filter(d => {
                        const dDate = new Date((d.business_date || d.date || d.bdate) + 'T00:00:00');
                        if (dDate.getFullYear() !== year - 1 || dDate.getMonth() !== monthIdx) {
                            return false;
                        }
                        return dDate.getDate() <= comparableDay;
                    });
                    prevYearTurnover = prevYearFilteredData.reduce((sum, d) => sum + (Number(d.turnover) || 0), 0);
                }
                
                // Calculate purchase budget (75% of target or 75% of 110% of prev year)
                const targets = targetsData?.targets || [];
                const cutoffDateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
                let targetTurnover = targets.reduce((sum, t) => {
                    if (this.viewMode === 'daily') {
                        // Only include target for the selected day
                        if (t.date && t.date === cutoffDateStr) {
                            return sum + (Number(t.value) || 0);
                        }
                    } else {
                        // Monthly: include all targets up to selected date
                        if (t.date && t.date <= cutoffDateStr) {
                            return sum + (Number(t.value) || 0);
                        }
                    }
                    return sum;
                }, 0);
                
                if (targetTurnover === 0 && prevYearTurnover > 0) {
                    targetTurnover = prevYearTurnover * 1.10;
                }
                
                const purchaseBudget = targetTurnover * 0.75;
                
                // Calculate growth percentage
                const turnoverGrowth = prevYearTurnover > 0 
                    ? Math.round(((turnover - prevYearTurnover) / prevYearTurnover) * 100)
                    : null;
                
                // Calculate purchase comparison
                const purchaseDiff = purchases - purchaseBudget;
                const purchasePct = purchaseBudget > 0 
                    ? Math.round((purchases / purchaseBudget) * 100)
                    : null;
                
                this.groupViewData[pharmacyId] = {
                    id: pharmacyId,
                    name: pharmacyName,
                    turnover,
                    prevYearTurnover,
                    turnoverGrowth,
                    purchases,
                    purchaseBudget,
                    purchaseDiff,
                    purchasePct,
                    gpPercent,
                    gpValue,
                    basket,
                    transactions
                };
            } catch (error) {
                console.error(`Error loading data for pharmacy ${pharmacyId}:`, error);
                // Set empty data
                this.groupViewData[pharmacyId] = {
                    id: pharmacyId,
                    name: pharmacyName,
                    turnover: 0,
                    prevYearTurnover: 0,
                    turnoverGrowth: null,
                    purchases: 0,
                    purchaseBudget: 0,
                    purchaseDiff: 0,
                    purchasePct: null,
                    gpPercent: 0,
                    gpValue: 0,
                    basket: 0,
                    transactions: 0
                };
            }
        });
        
        await Promise.all(promises);
        this.lastDate = date;
    }
    
    renderGroupView(data) {
        const mainContent = document.querySelector('main');
        if (!mainContent) return;
        
        const pharmacies = Object.values(data || {});
        
        // Format currency
        const formatCurrency = (value) => {
            if (value === null || value === undefined || value === 0) return '—';
            return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        };
        
        // Format percentage
        const formatPercent = (value) => {
            if (value === null || value === undefined) return '—';
            return `${value >= 0 ? '+' : ''}${value}%`;
        };
        
        // Format currency same as single pharmacy view (rounded)
        const formatValue = (value) => {
            if (!value || value === 0) return '—';
            return `R ${Math.round(value).toLocaleString('en-ZA')}`;
        };
        
        // Build pharmacy rows for MTD Turnover card
        const turnoverRows = pharmacies.map((pharmacy, index) => {
            const badge = pharmacy.turnoverGrowth !== null 
                ? `<span class="group-view-badge ${pharmacy.turnoverGrowth >= 0 ? 'positive' : 'negative'}">${formatPercent(pharmacy.turnoverGrowth)}</span>`
                : '';
            const isLast = index === pharmacies.length - 1;
            return `
                <div class="group-view-row ${isLast ? '' : 'has-border'}">
                    <div class="group-view-row-name">${pharmacy.name}</div>
                    <div class="group-view-row-value-row">
                        <span class="group-view-row-value">${formatValue(pharmacy.turnover)}</span>
                        ${badge}
                    </div>
                    <div class="group-view-row-secondary">${pharmacy.prevYearTurnover > 0 ? `vs last year: ${formatValue(pharmacy.prevYearTurnover)}` : '—'}</div>
                </div>
            `;
        }).join('');
        
        // Build pharmacy rows for Purchases card
        const purchasesRows = pharmacies.map((pharmacy, index) => {
            const badge = pharmacy.purchasePct !== null 
                ? `<span class="group-view-badge ${pharmacy.purchasePct <= 100 ? 'positive' : 'negative'}">${formatPercent(pharmacy.purchasePct - 100)}</span>`
                : '';
            const isLast = index === pharmacies.length - 1;
            return `
                <div class="group-view-row ${isLast ? '' : 'has-border'}">
                    <div class="group-view-row-name">${pharmacy.name}</div>
                    <div class="group-view-row-value-row">
                        <span class="group-view-row-value">${formatValue(pharmacy.purchases)}</span>
                        ${badge}
                    </div>
                    <div class="group-view-row-secondary">${pharmacy.purchaseDiff !== 0 ? `${formatValue(Math.abs(pharmacy.purchaseDiff))} ${pharmacy.purchaseDiff > 0 ? 'over' : 'under'}` : '—'}</div>
                </div>
            `;
        }).join('');
        
        // Build pharmacy rows for GP card
        const gpRows = pharmacies.map((pharmacy, index) => {
            const isLast = index === pharmacies.length - 1;
            // Show warning badge if GP is below 25%
            const gpWarningBadge = pharmacy.gpPercent > 0 && pharmacy.gpPercent < 25 
                ? `<span class="group-view-badge warning">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </span>`
                : '';
            return `
                <div class="group-view-row ${isLast ? '' : 'has-border'}">
                    <div class="group-view-row-name">${pharmacy.name}</div>
                    <div class="group-view-row-value-row">
                        <span class="group-view-row-value">${pharmacy.gpPercent > 0 ? `${pharmacy.gpPercent.toFixed(1)}%` : '—'}</span>
                        ${gpWarningBadge}
                    </div>
                    <div class="group-view-row-secondary">${pharmacy.gpValue > 0 ? formatValue(pharmacy.gpValue) : '—'}</div>
                </div>
            `;
        }).join('');
        
        // Build pharmacy rows for Basket card
        const basketRows = pharmacies.map((pharmacy, index) => {
            const isLast = index === pharmacies.length - 1;
            return `
                <div class="group-view-row ${isLast ? '' : 'has-border'}">
                    <div class="group-view-row-name">${pharmacy.name}</div>
                    <div class="group-view-row-value-row">
                        <span class="group-view-row-value">${pharmacy.basket > 0 ? formatValue(pharmacy.basket) : '—'}</span>
                    </div>
                    <div class="group-view-row-secondary">${pharmacy.transactions > 0 ? `${pharmacy.transactions.toLocaleString('en-ZA')} transactions` : '—'}</div>
                </div>
            `;
        }).join('');
        
        // Card header changes based on view mode
        const turnoverHeader = this.viewMode === 'daily' ? 'DAILY TURNOVER' : 'MTD TURNOVER';
        const purchasesHeader = this.viewMode === 'daily' ? 'DAILY PURCHASES' : 'MTD PURCHASES';
        const gpHeader = 'GP';
        const basketHeader = 'BASKET';
        
        mainContent.innerHTML = `
            <div class="dashboard-container">
                <div class="dashboard-top-cards group-view-grid">
                    <!-- Turnover Card -->
                    <div class="dashboard-top-card group-view-list-card">
                        <div class="group-view-card-header">
                            <span class="dashboard-top-card-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="1" x2="12" y2="23"></line>
                                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                </svg>
                            </span>
                            ${turnoverHeader}
                        </div>
                        <div class="group-view-rows">
                            ${turnoverRows}
                        </div>
                    </div>
                    
                    <!-- Purchases Card -->
                    <div class="dashboard-top-card group-view-list-card">
                        <div class="group-view-card-header">
                            <span class="dashboard-top-card-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="9" cy="21" r="1"></circle>
                                    <circle cx="20" cy="21" r="1"></circle>
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                                </svg>
                            </span>
                            ${purchasesHeader}
                        </div>
                        <div class="group-view-rows">
                            ${purchasesRows}
                        </div>
                    </div>
                    
                    <!-- GP Card -->
                    <div class="dashboard-top-card group-view-list-card">
                        <div class="group-view-card-header">
                            <span class="dashboard-top-card-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                                </svg>
                            </span>
                            GP
                        </div>
                        <div class="group-view-rows">
                            ${gpRows}
                        </div>
                    </div>
                    
                    <!-- Basket Card -->
                    <div class="dashboard-top-card group-view-list-card">
                        <div class="group-view-card-header">
                            <span class="dashboard-top-card-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                                    <line x1="3" y1="6" x2="21" y2="6"></line>
                                    <path d="M16 10a4 4 0 0 1-8 0"></path>
                                </svg>
                            </span>
                            BASKET
                        </div>
                        <div class="group-view-rows">
                            ${basketRows}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Export class
window.DashboardScreen = DashboardScreen;

