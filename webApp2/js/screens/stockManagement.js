// Stock Management Screen
// Stock overview with KPI cards matching monthly summary style

class StockManagementScreen {
    constructor() {
        this.data = null;
    }

    async load() {
        console.log('Loading Stock Management...');
        
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const date = window.datePicker?.getSelectedDate();
        
        if (!pharmacy || !date) {
            console.warn('Missing pharmacy or date selection');
            this.showEmptyState();
            return;
        }

        // Show loading overlay
        if (window.loadingOverlay) {
            window.loadingOverlay.show('Loading stock management data...');
        }

        try {
            await this.loadData(pharmacy.id, date);
            this.render();
        } catch (error) {
            console.error('Error loading stock management:', error);
            this.showError(error);
        } finally {
            // Hide loading overlay
            if (window.loadingOverlay) {
                window.loadingOverlay.hide();
            }
        }
    }

    async loadData(pharmacyId, date) {
        // Calculate month for MTD data
        const month = date.slice(0, 7); // YYYY-MM format
        
        // Calculate date range for best sellers and worst GP (first day of month to selected date)
        const fromDate = `${month}-01`;
        const toDate = date;
        
        // Load current stock value, previous month opening stock, MTD data, targets data, negative stock, best sellers, and worst GP in parallel
        const [currentStockValue, previousMonthOpeningStock, mtdData, targetsData, negativeStock, bestSellersData, worstGpData] = await Promise.all([
            this.getCurrentStockValue(pharmacyId, date),
            this.getPreviousMonthOpeningStock(pharmacyId, date),
            window.api.getMTD(pharmacyId, month, date).catch(e => {
                console.error('MTD data error:', e);
                return { purchases: 0, cost_of_sales: 0 };
            }),
            window.api.getTargets(pharmacyId, month).catch(e => {
                console.error('Targets data error:', e);
                return { targets: [] };
            }),
            window.api.getNegativeStock(pharmacyId, date, 200).catch(e => {
                console.error('Negative stock error:', e);
                return [];
            }),
            window.api.getBestSellers(pharmacyId, null, fromDate, toDate, 10).catch(e => { 
                console.error('Best sellers error:', e); 
                return []; 
            }),
            window.api.getWorstGP(pharmacyId, null, fromDate, toDate, 50, 20, true).catch(e => { 
                console.error('Worst GP error:', e); 
                return []; 
            })
        ]);
        
        // Parse best sellers and worst GP data
        let bestSellers = this.parseApiListResponse(bestSellersData, ['best_sellers', 'stock_activity', 'items', 'data']);
        let worstGpProducts = this.parseApiListResponse(worstGpData, ['worst_gp_products', 'low_gp_products', 'items', 'data']);

        // Parse negative stock response
        let negativeStockItems = this.parseApiListResponse(negativeStock, ['negative_stock', 'items', 'data']);

        // Extract purchases, cost of sales, GP value, and GP percentage from MTD data
        const purchases = Number(mtdData.purchases || 0);
        const costOfSales = Number(mtdData.cost_of_sales || 0);
        const turnover = Number(mtdData.turnover || 0);
        const gpValue = Number(mtdData.gp_value || mtdData.gp || mtdData.gross_profit || 0);
        // Calculate GP percentage if not provided
        let gpPercent = Number(mtdData.gp_percentage || mtdData.gp_pct || 0);
        if (gpPercent === 0 && turnover > 0 && gpValue > 0) {
            gpPercent = (gpValue / turnover) * 100;
        }

        // Get daily data for current day purchases
        const dailyData = await this.getDailyData(pharmacyId, date).catch(e => {
            console.error('Daily data error:', e);
            return { purchases: 0 };
        });
        const dailyPurchases = Number(dailyData.purchases || 0);

        // Calculate days of inventory and average cost of sales (now that we have currentStockValue and mtdData)
        const [daysOfInventory, avgCostOfSales] = await Promise.all([
            this.calculateDaysOfInventory(pharmacyId, date, currentStockValue).catch(e => {
                console.error('Days of inventory error:', e);
                return 0;
            }),
            this.calculateAvgCostOfSales(pharmacyId, date, mtdData).catch(e => {
                console.error('Average cost of sales error:', e);
                return 0;
            })
        ]);

        // Calculate stock change
        const stockChange = currentStockValue - previousMonthOpeningStock;
        const changePercent = previousMonthOpeningStock > 0 ? ((stockChange / previousMonthOpeningStock) * 100) : 0;

        // DIRECTLY calculate budgets from targets - same as dashboard
        console.log('=== CALCULATING BUDGETS FROM TARGETS ===');
        console.log('Targets data:', targetsData);
        
        // Calculate full month turnover target (sum of all daily targets)
        let turnoverTargetFullMonth = 0;
        let turnoverTargetMTD = 0;
        
        if (targetsData && targetsData.targets) {
            if (Array.isArray(targetsData.targets)) {
                // Array format: [{date: "2025-12-01", value: 50000}, ...]
                console.log('Targets is array with', targetsData.targets.length, 'entries');
                for (const t of targetsData.targets) {
                    const val = Number(t.value || 0);
                    if (t.date && t.date.startsWith(month)) {
                        turnoverTargetFullMonth += val;
                        if (t.date <= date) {
                            turnoverTargetMTD += val;
                        }
                    }
                }
            } else if (typeof targetsData.targets === 'object') {
                // Object format: {"2025-12-01": 50000, ...}
                console.log('Targets is object');
                for (const [targetDate, value] of Object.entries(targetsData.targets)) {
                    const val = Number(value || 0);
                    if (targetDate.startsWith(month)) {
                        turnoverTargetFullMonth += val;
                        if (targetDate <= date) {
                            turnoverTargetMTD += val;
                        }
                    }
                }
            }
        }
        
        console.log('Turnover targets - Full month:', turnoverTargetFullMonth, 'MTD:', turnoverTargetMTD);
        
        // Purchase budget = 75% of turnover target (SAME AS DASHBOARD)
        let fullMonthBudget = turnoverTargetFullMonth * 0.75;
        let mtdBudget = turnoverTargetMTD * 0.75;
        
        console.log('Purchase budgets (75% of turnover) - Full month:', fullMonthBudget, 'MTD:', mtdBudget);
        
        // Fallback to 6% growth if no targets
        if (fullMonthBudget === 0) {
            console.log('No targets found, using 6% growth fallback');
            const prevYear = new Date(date + 'T00:00:00').getFullYear() - 1;
            const prevYearMonth = `${prevYear}-${month.slice(5)}`;
            const prevYearMtdData = await window.api.getMTD(pharmacyId, prevYearMonth, `${prevYear}-${date.slice(5)}`).catch(() => null);
            if (prevYearMtdData && prevYearMtdData.purchases > 0) {
                fullMonthBudget = prevYearMtdData.purchases * 1.06;
                const daysInMonth = new Date(new Date(date).getFullYear(), new Date(date).getMonth() + 1, 0).getDate();
                const mtdDay = new Date(date + 'T00:00:00').getDate();
                mtdBudget = (fullMonthBudget / daysInMonth) * mtdDay;
                console.log('6% growth budget - Full:', fullMonthBudget, 'MTD:', mtdBudget);
            }
        }
        
        console.log('=== FINAL BUDGETS ===');
        console.log('Full month budget:', fullMonthBudget);
        console.log('MTD budget:', mtdBudget);

        this.data = {
            currentStockValue,
            previousMonthOpeningStock,
            stockChange,
            changePercent,
            purchases,
            dailyPurchases,
            costOfSales,
            daysOfInventory,
            avgCostOfSales,
            gpPercent,
            gpValue,
            fullMonthBudget,
            mtdBudget,
            negativeStockCount: negativeStockItems.length,
            bestSellers,
            worstGpProducts,
            fromDate,
            toDate,
            date,
            pharmacyId
        };
    }

    async getDailyData(pharmacyId, date) {
        try {
            const data = await window.api.getDays(pharmacyId, date.slice(0, 7));
            if (Array.isArray(data) && data.length > 0) {
                const record = data.find(d => (d.business_date || d.date || d.bdate) === date) || data[0];
                return {
                    purchases: record.purchases || 0
                };
            }
            return { purchases: 0 };
        } catch (error) {
            console.error('Error loading daily data:', error);
            return { purchases: 0 };
        }
    }

    // Calculate monthly target - SAME LOGIC AS DASHBOARD
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

    async calculateBudgets(targetsData, date, month, purchases, pharmacyId) {
        let fullMonthBudget = 0;
        let mtdBudget = 0;

        try {
            console.log('Budget calculation - month:', month, 'throughDate:', date);
            
            const dateObj = new Date(date + 'T00:00:00');
            const mtdDay = dateObj.getDate();
            
            // Calculate turnover targets using SAME logic as dashboard
            const turnoverTargetFullMonth = this.calculateMonthlyTarget(targetsData, month, null);
            const turnoverTargetMTD = this.calculateMonthlyTarget(targetsData, month, date);
            
            console.log('Turnover targets - Full month:', turnoverTargetFullMonth, 'MTD:', turnoverTargetMTD);
            
            // Calculate purchase budgets as 75% of turnover targets (same as dashboard)
            if (turnoverTargetFullMonth > 0) {
                fullMonthBudget = turnoverTargetFullMonth * 0.75;
                console.log('FULL MONTH purchase budget:', fullMonthBudget, '(75% of', turnoverTargetFullMonth, ')');
            }
            
            if (turnoverTargetMTD > 0) {
                mtdBudget = turnoverTargetMTD * 0.75;
                console.log('MTD purchase budget:', mtdBudget, '(75% of', turnoverTargetMTD, ')');
            }

            // If no targets set, calculate 6% growth from previous year as fallback
            if (fullMonthBudget === 0) {
                console.log('No targets set, calculating 6% growth from previous year');
                try {
                    const selYear = dateObj.getFullYear();
                    const selMonthIdx = dateObj.getMonth();
                    
                    // Calculate previous year month and through date
                    const prevYear = selYear - 1;
                    const prevYearMonthKey = `${prevYear}-${String(selMonthIdx + 1).padStart(2, '0')}`;
                    
                    // Calculate previous year's MTD day (handle month length differences)
                    const prevYearDate = new Date(prevYear, selMonthIdx, 1);
                    const prevYearMonthDays = new Date(prevYearDate.getFullYear(), prevYearDate.getMonth() + 1, 0).getDate();
                    const prevYearMTDDay = Math.min(mtdDay, prevYearMonthDays);
                    const prevYearThroughDate = `${prevYear}-${String(selMonthIdx + 1).padStart(2, '0')}-${String(prevYearMTDDay).padStart(2, '0')}`;
                    
                    console.log('Fetching previous year MTD - monthKey:', prevYearMonthKey, 'throughDate:', prevYearThroughDate);
                    
                    // Fetch previous year MTD data
                    const prevYearMtdData = await window.api.getMTD(pharmacyId, prevYearMonthKey, prevYearThroughDate).catch(() => null);
                    
                    if (prevYearMtdData) {
                        const prevYearPurchases = Number(prevYearMtdData.purchases || 0);
                        console.log('Previous year MTD purchases:', prevYearPurchases);
                        
                        // Calculate 6% growth: previous year purchases * 1.06
                        if (prevYearPurchases > 0) {
                            fullMonthBudget = prevYearPurchases * 1.06;
                            console.log('Calculated full month budget (6% growth):', fullMonthBudget);
                            
                            // Calculate MTD budget proportionally
                            if (mtdBudget === 0) {
                                const daysInMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate();
                                mtdBudget = (fullMonthBudget / daysInMonth) * mtdDay;
                                console.log('Calculated MTD budget:', mtdBudget);
                            }
                        } else {
                            console.log('Previous year purchases is 0, cannot calculate budget');
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch previous year data for budget calculation:', error);
                }
            }
        } catch (error) {
            console.error('Error calculating budgets:', error);
        }

        console.log('=== FINAL BUDGETS ===');
        console.log('Full month:', fullMonthBudget, 'MTD:', mtdBudget, 'purchases:', purchases);
        return { fullMonthBudget, mtdBudget };
    }

    async calculateDaysOfInventory(pharmacyId, date, currentStockValue) {
        if (!currentStockValue || currentStockValue <= 0) {
            return 0;
        }

        try {
            // Calculate last 30 days range (including today)
            const dateObj = new Date(date + 'T00:00:00');
            const last30Start = new Date(dateObj);
            last30Start.setDate(last30Start.getDate() - 29); // 30 days including today
            const last30StartStr = this.formatYmdLocal(last30Start);
            const last30EndStr = date;

            // Get months to fetch (may span two months)
            const startMonth = last30StartStr.slice(0, 7);
            const endMonth = last30EndStr.slice(0, 7);
            const monthsToFetch = startMonth !== endMonth ? [startMonth, endMonth] : [startMonth];

            // Fetch all required months
            const all30DayData = [];
            for (const month of monthsToFetch) {
                const monthData = await window.api.getDays(pharmacyId, month);
                if (Array.isArray(monthData)) {
                    all30DayData.push(...monthData);
                }
            }

            // Filter to only include dates within the 30-day range
            const filtered30Days = all30DayData.filter(day => {
                const dayDate = day.business_date || day.date || day.bdate || '';
                return dayDate >= last30StartStr && dayDate <= last30EndStr;
            });

            // Calculate average daily turnover
            const totalTurnover = filtered30Days.reduce((acc, day) => {
                return acc + (Number(day.turnover) || 0);
            }, 0);

            const avgDailyTurnover = filtered30Days.length > 0 ? totalTurnover / filtered30Days.length : 0;

            // Calculate days of inventory
            // Formula: Days of Inventory = Current Stock Value / Average Daily Turnover
            if (avgDailyTurnover > 0) {
                return currentStockValue / avgDailyTurnover;
            }

            return 0;
        } catch (error) {
            console.error('Error calculating days of inventory:', error);
            return 0;
        }
    }

    async calculateAvgCostOfSales(pharmacyId, date, mtdData) {
        try {
            const costOfSales = Number(mtdData.cost_of_sales || 0);
            if (costOfSales <= 0) {
                return 0;
            }

            // Calculate number of days from start of month to selected date
            const dateObj = new Date(date + 'T00:00:00');
            const dayOfMonth = dateObj.getDate(); // 1-31

            // Average cost of sales = MTD Cost of Sales / number of days
            return dayOfMonth > 0 ? costOfSales / dayOfMonth : 0;
        } catch (error) {
            console.error('Error calculating average cost of sales:', error);
            return 0;
        }
    }

    formatYmdLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async getCurrentStockValue(pharmacyId, date) {
        try {
            const data = await window.api.getDays(pharmacyId, date.slice(0, 7));
            if (Array.isArray(data) && data.length > 0) {
                const record = data.find(d => (d.business_date || d.date || d.bdate) === date) || data[0];
                return parseFloat(record.closing_stock || 0);
            }
            return 0;
        } catch (error) {
            console.error('Error loading current stock value:', error);
            return 0;
        }
    }

    async getPreviousMonthOpeningStock(pharmacyId, date) {
        try {
            // Calculate previous month
            const dateObj = new Date(date + 'T00:00:00');
            const prevMonth = new Date(dateObj);
            prevMonth.setMonth(prevMonth.getMonth() - 1);
            const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
            
            // Get the last day of the previous month
            const lastDayOfPrevMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate();
            
            // Get days data for previous month
            const daysData = await window.api.getDays(pharmacyId, prevMonthStr);
            if (!Array.isArray(daysData) || daysData.length === 0) {
                // Try going back further months if no data found
                return await this.findLastValidClosingStock(pharmacyId, prevMonth, 3); // Try up to 3 months back
            }

            // Start from the last day of previous month and go backwards day by day
            for (let day = lastDayOfPrevMonth; day >= 1; day--) {
                const checkDate = `${prevMonthStr}-${String(day).padStart(2, '0')}`;
                const dayRecord = daysData.find(d => {
                    const recordDate = d.business_date || d.date || d.bdate || '';
                    return recordDate === checkDate;
                });
                
                if (dayRecord) {
                    const closingStock = parseFloat(dayRecord.closing_stock || 0);
                    if (closingStock > 0) {
                        return closingStock;
                    }
                }
            }

            // If no valid closing stock found in previous month, try going back further months
            return await this.findLastValidClosingStock(pharmacyId, prevMonth, 3);
        } catch (error) {
            console.error('Error loading previous month opening stock:', error);
            return 0;
        }
    }

    async findLastValidClosingStock(pharmacyId, startMonth, maxMonthsBack) {
        // Try going back month by month until we find a valid closing stock
        for (let i = 1; i <= maxMonthsBack; i++) {
            const checkMonth = new Date(startMonth);
            checkMonth.setMonth(checkMonth.getMonth() - i);
            const checkMonthStr = `${checkMonth.getFullYear()}-${String(checkMonth.getMonth() + 1).padStart(2, '0')}`;
            
            try {
                const daysData = await window.api.getDays(pharmacyId, checkMonthStr);
                if (Array.isArray(daysData) && daysData.length > 0) {
                    // Sort by date descending to get the last day first
                    const sortedDays = [...daysData].sort((a, b) => {
                        const dateA = a.business_date || a.date || a.bdate || '';
                        const dateB = b.business_date || b.date || b.bdate || '';
                        return dateB.localeCompare(dateA);
                    });

                    // Find the last valid closing stock value
                    for (const day of sortedDays) {
                        const closingStock = parseFloat(day.closing_stock || 0);
                        if (closingStock > 0) {
                            return closingStock;
                        }
                    }
                }
            } catch (error) {
                // Continue to next month if this one fails
                continue;
            }
        }
        
        return 0;
    }

    // Parse API responses that may have different structures
    parseApiListResponse(data, possibleKeys) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        
        for (const key of possibleKeys) {
            if (data[key] && Array.isArray(data[key])) {
                return data[key];
            }
        }
        return [];
    }

    render() {
        const mainContent = document.querySelector('.content-area');
        if (!mainContent) return;

        if (!this.data) {
            this.showEmptyState('No stock data available for selected date');
            return;
        }

        const { currentStockValue, previousMonthOpeningStock, stockChange, changePercent, purchases, dailyPurchases, costOfSales, daysOfInventory, avgCostOfSales, gpPercent, gpValue, fullMonthBudget, mtdBudget, negativeStockCount, bestSellers, worstGpProducts } = this.data;

        // Format cards with badges and secondary text
        const stockValueCard = this.formatStockValueCard(previousMonthOpeningStock, changePercent);
        const purchasesCard = this.formatPurchasesCard(costOfSales);
        const daysOfInventoryCard = this.formatDaysOfInventoryCard(avgCostOfSales);
        const gpCard = this.formatGpCard(gpValue);

        mainContent.innerHTML = `
            <div class="dashboard-container">
                <div class="dashboard-top-cards">
                    ${this.renderTopCard('Stock Value', currentStockValue, 'currency', stockValueCard)}
                    ${this.renderTopCard('Purchases', purchases, 'currency', purchasesCard)}
                    ${this.renderTopCard('Days of stock', daysOfInventory, 'number', daysOfInventoryCard)}
                    ${this.renderTopCard('GP%', gpPercent, 'percentage', gpCard)}
                </div>
                ${fullMonthBudget > 0 || mtdBudget > 0 ? `
                <div class="dashboard-bottom-cards">
                    ${this.renderBudgetCard(purchases, fullMonthBudget)}
                    ${this.renderMTDBudgetCard(purchases, mtdBudget)}
                </div>
                ` : `
                <div class="dashboard-bottom-cards">
                    <div class="dashboard-bottom-card purchase-budget-card no-budget-card">
                        <h3 class="dashboard-bottom-card-title">
                            <span class="dashboard-top-card-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                            </span>
                            BUDGET INFO
                        </h3>
                        <div class="no-budget-message">
                            <p>No budget targets have been set for this month.</p>
                            <p class="no-budget-hint">Set targets in the Targets screen to see budget vs purchases comparison.</p>
                        </div>
                    </div>
                </div>
                `}
                <div class="dashboard-bottom-cards">
                    ${this.renderTopSellersCard(bestSellers)}
                    ${this.renderLowGpCard(worstGpProducts)}
                </div>
            </div>
        `;

        // Setup pie chart animations after render
        setTimeout(() => {
            this.updateBudgetCharts();
        }, 100);
        
        // Setup expand button handlers
        this.setupExpandButtons();
    }

    renderTopCard(title, value, format = 'number', cardData = null) {
        // Show "—" for zero or null values (matching dashboard behavior)
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
        
        // Build badge HTML (square percentage indicator or warning icon)
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
            <div class="dashboard-top-card">
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

    formatStockValueCard(previousMonthOpeningStock, changePercent) {
        let badge = null;
        let secondary = { text: '', className: '' };
        
        if (previousMonthOpeningStock && previousMonthOpeningStock > 0) {
            const formattedAmount = new Intl.NumberFormat('en-ZA', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(previousMonthOpeningStock));
            
            secondary = { 
                text: `Opening: R ${formattedAmount}`,
                className: ''
            };
            
            if (changePercent !== null && changePercent !== 0) {
                const isPositive = changePercent >= 0;
                badge = {
                    text: isPositive ? `+${Math.round(changePercent)}%` : `${Math.round(changePercent)}%`,
                    className: 'neutral'
                };
            }
        } else {
            secondary = { text: 'No opening stock data', className: '' };
        }
        
        return { badge, secondary };
    }

    formatPurchasesCard(costOfSales) {
        let secondary = { text: '—', className: '' };
        
        if (costOfSales && costOfSales > 0) {
            const formattedCostOfSales = new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(costOfSales));
            
            secondary = { 
                text: `Cost of Sales: ${formattedCostOfSales}`,
                className: ''
            };
        } else {
            secondary = { text: 'Cost of Sales: —', className: '' };
        }
        
        return { badge: null, secondary };
    }

    formatDaysOfInventoryCard(avgCostOfSales) {
        let secondary = { text: '—', className: '' };
        
        if (avgCostOfSales && avgCostOfSales > 0) {
            const formattedAvgCostOfSales = new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(avgCostOfSales));
            
            secondary = { 
                text: `Avg Cost of Sales: ${formattedAvgCostOfSales}`,
                className: ''
            };
        } else {
            secondary = { text: 'Avg Cost of Sales: —', className: '' };
        }
        
        return { badge: null, secondary };
    }

    formatGpCard(gpValue) {
        let secondary = { text: '—', className: '' };
        
        if (gpValue && gpValue > 0) {
            const formattedGpValue = new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(gpValue));
            
            secondary = { 
                text: `GP: ${formattedGpValue}`,
                className: ''
            };
        } else {
            secondary = { text: 'GP: —', className: '' };
        }
        
        return { badge: null, secondary };
    }

    getCardIcon(title) {
        const icons = {
            'Stock Value': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>`,
            'Purchases': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>`,
            'Days of stock': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>`,
            'GP%': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>`
        };
        return icons[title] || '';
    }

    showEmptyState(message = 'No stock data available') {
        const mainContent = document.querySelector('.content-area');
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div class="dashboard-container">
                <div class="empty-state">
                    <h2>Stock Management</h2>
                    <p>${message}</p>
                    <p>Please select a pharmacy and date to view stock information.</p>
                </div>
            </div>
        `;
    }

    renderBudgetCard(purchases, fullMonthBudget) {
        const purchasesFormatted = purchases > 0 ? 
            new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(purchases)) : '—';
        
        const budgetFormatted = fullMonthBudget > 0 ?
            new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(fullMonthBudget)) : '—';
        
        // Calculate percentage used
        let percentage = 0;
        if (fullMonthBudget > 0 && purchases > 0) {
            percentage = Math.round((purchases / fullMonthBudget) * 100);
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
                    BUDGET
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
                    </div>
                    <div class="purchase-chart-wrapper">
                        <svg class="purchase-chart-svg" viewBox="0 0 120 120">
                            <defs>
                                <linearGradient id="budgetPieGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" style="stop-color:#10B981;stop-opacity:1" />
                                    <stop offset="100%" style="stop-color:#34D399;stop-opacity:1" />
                                </linearGradient>
                            </defs>
                            <circle cx="60" cy="60" r="50" fill="none" stroke="#E5E7EB" stroke-width="20"/>
                            <circle cx="60" cy="60" r="50" fill="none" stroke="url(#budgetPieGradient)" stroke-width="20" 
                                stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" 
                                style="transition: stroke-dashoffset 1s ease; stroke-linecap: round;" 
                                class="purchase-chart-segment" id="stock-budget-chart-segment"/>
                        </svg>
                        <div class="purchase-chart-center">
                            <span class="purchase-chart-percentage" id="stock-budget-percentage">${fullMonthBudget > 0 && purchases > 0 ? percentage + '%' : '0%'}</span>
                            <span class="purchase-chart-label">USED</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderMTDBudgetCard(purchases, mtdBudget, dailyPurchases, date) {
        const purchasesFormatted = purchases > 0 ? 
            new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(purchases)) : '—';
        
        const budgetFormatted = mtdBudget > 0 ?
            new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(mtdBudget)) : '—';
        
        // Calculate percentage used for MTD
        let mtdPercentage = 0;
        if (mtdBudget > 0 && purchases > 0) {
            mtdPercentage = Math.round((purchases / mtdBudget) * 100);
        }
        
        // Calculate circular progress
        const circumference = 2 * Math.PI * 50;
        const visualPct = Math.min(mtdPercentage, 100);
        const offset = circumference - (visualPct / 100) * circumference;
        
        return `
            <div class="dashboard-bottom-card purchase-budget-card">
                <h3 class="dashboard-bottom-card-title">
                    <span class="dashboard-top-card-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                            <line x1="1" y1="10" x2="23" y2="10"></line>
                        </svg>
                    </span>
                    MTD BUDGET
                </h3>
                <div class="purchase-card-content">
                    <div class="purchase-metrics">
                        <div class="purchase-metric-item">
                            <div class="purchase-metric-label">PURCHASES</div>
                            <div class="purchase-metric-value">${purchasesFormatted}</div>
                        </div>
                        <div class="purchase-metric-item">
                            <div class="purchase-metric-label">MTD BUDGET</div>
                            <div class="purchase-metric-value">${budgetFormatted}</div>
                        </div>
                    </div>
                    <div class="purchase-chart-wrapper">
                        <svg class="purchase-chart-svg" viewBox="0 0 120 120">
                            <defs>
                                <linearGradient id="mtdBudgetPieGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" style="stop-color:#8B5CF6;stop-opacity:1" />
                                    <stop offset="100%" style="stop-color:#A78BFA;stop-opacity:1" />
                                </linearGradient>
                            </defs>
                            <circle cx="60" cy="60" r="50" fill="none" stroke="#E5E7EB" stroke-width="20"/>
                            <circle cx="60" cy="60" r="50" fill="none" stroke="url(#mtdBudgetPieGradient)" stroke-width="20" 
                                stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" 
                                style="transition: stroke-dashoffset 1s ease; stroke-linecap: round;" 
                                class="purchase-chart-segment" id="stock-mtd-budget-chart-segment"/>
                        </svg>
                        <div class="purchase-chart-center">
                            <span class="purchase-chart-percentage" id="stock-mtd-budget-percentage">${mtdBudget > 0 && purchases > 0 ? mtdPercentage + '%' : '0%'}</span>
                            <span class="purchase-chart-label">USED</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    updateBudgetCharts() {
        const { purchases, fullMonthBudget, mtdBudget } = this.data;
        
        // Update Budget card chart
        const budgetSegment = document.getElementById('stock-budget-chart-segment');
        const budgetPercentage = document.getElementById('stock-budget-percentage');
        if (budgetSegment && budgetPercentage && fullMonthBudget > 0) {
            const percentage = Math.round((purchases / fullMonthBudget) * 100);
            const circumference = 2 * Math.PI * 50;
            const visualPct = Math.min(percentage, 100);
            const offset = circumference - (visualPct / 100) * circumference;
            
            budgetSegment.style.strokeDashoffset = offset;
            budgetPercentage.textContent = percentage + '%';
            if (percentage > 100) {
                budgetPercentage.style.color = '#ef4444';
            } else {
                budgetPercentage.style.color = '';
            }
        }
        
        // Update MTD Budget card chart
        const mtdSegment = document.getElementById('stock-mtd-budget-chart-segment');
        const mtdPercentage = document.getElementById('stock-mtd-budget-percentage');
        if (mtdSegment && mtdPercentage && mtdBudget > 0) {
            const percentage = Math.round((purchases / mtdBudget) * 100);
            const circumference = 2 * Math.PI * 50;
            const visualPct = Math.min(percentage, 100);
            const offset = circumference - (visualPct / 100) * circumference;
            
            mtdSegment.style.strokeDashoffset = offset;
            mtdPercentage.textContent = percentage + '%';
            if (percentage > 100) {
                mtdPercentage.style.color = '#ef4444';
            } else {
                mtdPercentage.style.color = '';
            }
        }
    }
    
    renderTopSellersCard(bestSellers) {
        const items = bestSellers && bestSellers.length > 0 
            ? bestSellers.slice(0, 5) 
            : [];
        
        let itemsHtml = '';
        if (items.length === 0) {
            itemsHtml = `
                <div class="product-list-item">
                    <div class="product-list-details">
                        <div class="product-list-name">No data for this period</div>
                        <div class="product-list-code">—</div>
                    </div>
                </div>
            `;
        } else {
            itemsHtml = items.map(item => {
                const productName = item.product_description || item.description || item.product_name || item.name || 'Unknown Product';
                const productCode = item.product_code || item.code || item.nappi_code || '';
                const quantity = item.qty_sold || item.quantity_sold || item.qty || item.quantity || item.total_quantity || item.units_sold || 0;
                const gpPercent = item.gp_pct || item.gp_percent || item.margin_pct || 0;
                
                return `
                    <div class="product-list-item">
                        <div class="product-list-details">
                            <div class="product-list-name">${this.escapeHtml(productName)}</div>
                            <div class="product-list-code">${this.escapeHtml(productCode)}</div>
                        </div>
                        <div class="product-list-stats">
                            <div class="product-list-qty">${quantity} units</div>
                            <div class="product-list-gp">${gpPercent.toFixed(1)}% GP</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="dashboard-bottom-card product-list-card">
                <div class="product-list-header">
                    <h3 class="dashboard-bottom-card-title">
                        <span class="dashboard-top-card-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                                <polyline points="17 6 23 6 23 12"></polyline>
                            </svg>
                        </span>
                        TOP SELLERS
                    </h3>
                    <button class="product-list-expand-btn" id="top-sellers-expand-btn" title="View all">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="8" y1="6" x2="21" y2="6"></line>
                            <line x1="8" y1="12" x2="21" y2="12"></line>
                            <line x1="8" y1="18" x2="21" y2="18"></line>
                            <line x1="3" y1="6" x2="3.01" y2="6"></line>
                            <line x1="3" y1="12" x2="3.01" y2="12"></line>
                            <line x1="3" y1="18" x2="3.01" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="product-list-content">
                    ${itemsHtml}
                </div>
            </div>
        `;
    }
    
    renderLowGpCard(worstGpProducts) {
        const items = worstGpProducts && worstGpProducts.length > 0 
            ? worstGpProducts.slice(0, 5) 
            : [];
        
        let itemsHtml = '';
        if (items.length === 0) {
            itemsHtml = `
                <div class="product-list-item">
                    <div class="product-list-details">
                        <div class="product-list-name">No low GP items for this period</div>
                        <div class="product-list-code">—</div>
                    </div>
                </div>
            `;
        } else {
            itemsHtml = items.map(item => {
                const productName = item.product_name || item.product_description || item.description || item.name || 'Unknown Product';
                const productCode = item.nappi_code || item.product_code || item.code || '';
                const quantity = item.quantity_sold || item.qty_sold || item.qty || item.quantity || item.total_quantity || item.units_sold || 0;
                const gpPercent = item.gp_percent || item.gp_pct || item.margin_pct || 0;
                
                return `
                    <div class="product-list-item">
                        <div class="product-list-details">
                            <div class="product-list-name">${this.escapeHtml(productName)}</div>
                            <div class="product-list-code">${this.escapeHtml(productCode)}</div>
                        </div>
                        <div class="product-list-stats low-gp">
                            <div class="product-list-gp-value">${gpPercent.toFixed(1)}%</div>
                            <div class="product-list-qty-small">${quantity} units</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="dashboard-bottom-card product-list-card">
                <div class="product-list-header">
                    <h3 class="dashboard-bottom-card-title">
                        <span class="dashboard-top-card-icon warning-icon-title">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                        </span>
                        LOW GP PRODUCTS
                    </h3>
                    <button class="product-list-expand-btn" id="low-gp-expand-btn" title="View all">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="8" y1="6" x2="21" y2="6"></line>
                            <line x1="8" y1="12" x2="21" y2="12"></line>
                            <line x1="8" y1="18" x2="21" y2="18"></line>
                            <line x1="3" y1="6" x2="3.01" y2="6"></line>
                            <line x1="3" y1="12" x2="3.01" y2="12"></line>
                            <line x1="3" y1="18" x2="3.01" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="product-list-content">
                    ${itemsHtml}
                </div>
            </div>
        `;
    }
    
    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
    
    setupExpandButtons() {
        const topSellersBtn = document.getElementById('top-sellers-expand-btn');
        const lowGpBtn = document.getElementById('low-gp-expand-btn');
        
        if (topSellersBtn) {
            topSellersBtn.addEventListener('click', () => this.openTopSellersModal());
        }
        
        if (lowGpBtn) {
            lowGpBtn.addEventListener('click', () => this.openLowGpModal());
        }
    }
    
    // State for Low GP modal filtering
    lowGpExcludePdst = true;
    lowGpThreshold = 20;
    currentLowGpData = [];
    currentTopSellersData = [];
    
    // Create and show modal
    showModal(title, contentHtml, modalId, toolbarHtml = '') {
        // Remove existing modal if any
        const existingModal = document.getElementById(modalId);
        if (existingModal) {
            existingModal.remove();
        }
        
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'product-list-modal-overlay active';
        modalOverlay.id = modalId;
        
        modalOverlay.innerHTML = `
            <div class="product-list-modal">
                <div class="product-list-modal-header">
                    <h3 class="product-list-modal-title">${title}</h3>
                    <button class="product-list-modal-close" aria-label="Close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                ${toolbarHtml}
                <div class="product-list-modal-content">
                    ${contentHtml}
                </div>
            </div>
        `;
        
        document.body.appendChild(modalOverlay);
        document.body.style.overflow = 'hidden';
        
        // Close button handler
        const closeBtn = modalOverlay.querySelector('.product-list-modal-close');
        closeBtn.addEventListener('click', () => this.closeModal(modalId));
        
        // Overlay click to close
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.closeModal(modalId);
            }
        });
        
        // Escape key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modalId);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        return modalOverlay;
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 200);
        }
        document.body.style.overflow = '';
    }
    
    async openTopSellersModal() {
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const { fromDate, toDate } = this.data;
        
        if (!pharmacy || !fromDate || !toDate) return;
        
        // Toolbar with PDF download button
        const toolbarHtml = `
            <div class="product-list-modal-toolbar">
                <span class="product-list-modal-count" id="top-sellers-count">Loading...</span>
                <button class="product-list-modal-btn" id="top-sellers-download-pdf" title="Download PDF">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    PDF
                </button>
            </div>
        `;
        
        // Show loading state with toolbar
        this.showModal('Top Sellers', '<div class="product-list-modal-loading">Loading...</div>', 'top-sellers-modal', toolbarHtml);
        
        try {
            // Fetch more items for modal (top 20)
            const bestSellersData = await window.api.getBestSellers(pharmacy.id, null, fromDate, toDate, 20);
            const bestSellers = this.parseApiListResponse(bestSellersData, ['best_sellers', 'stock_activity', 'items', 'data']);
            this.currentTopSellersData = bestSellers;
            
            const contentHtml = this.renderTopSellersModalContent(bestSellers);
            
            // Update modal content and count
            const modalContent = document.querySelector('#top-sellers-modal .product-list-modal-content');
            const countEl = document.getElementById('top-sellers-count');
            if (modalContent) {
                modalContent.innerHTML = contentHtml;
            }
            if (countEl) {
                countEl.textContent = `${bestSellers.length} products`;
            }
        } catch (error) {
            console.error('Error loading top sellers:', error);
            const modalContent = document.querySelector('#top-sellers-modal .product-list-modal-content');
            if (modalContent) {
                modalContent.innerHTML = '<div class="product-list-modal-error">Error loading data</div>';
            }
        }
    }
    
    async openLowGpModal() {
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const { fromDate, toDate } = this.data;
        
        if (!pharmacy || !fromDate || !toDate) return;
        
        // Reset state
        this.lowGpThreshold = 20;
        this.lowGpExcludePdst = true;
        
        // Toolbar with filtering and PDF download
        const toolbarHtml = `
            <div class="product-list-modal-toolbar">
                <div class="product-list-modal-filter-row">
                    <label class="product-list-modal-filter-label">GP% below:</label>
                    <div class="product-list-modal-filter-input-group">
                        <input type="number" id="low-gp-threshold" min="0" max="100" step="1" value="20" class="product-list-modal-input" />
                        <span class="product-list-modal-input-suffix">%</span>
                    </div>
                    <button class="product-list-modal-btn primary" id="low-gp-apply">Apply</button>
                    <button class="product-list-modal-btn ${!this.lowGpExcludePdst ? 'active' : ''}" id="low-gp-sep">SEP</button>
                    <button class="product-list-modal-btn ${this.lowGpExcludePdst ? 'active' : ''}" id="low-gp-no-sep">NO SEP</button>
                    <button class="product-list-modal-btn" id="low-gp-download-pdf" title="Download PDF">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        PDF
                    </button>
                </div>
                <span class="product-list-modal-count" id="low-gp-count">Loading...</span>
            </div>
        `;
        
        // Show loading state with toolbar
        this.showModal('Low GP Products', '<div class="product-list-modal-loading">Loading...</div>', 'low-gp-modal', toolbarHtml);
        
        // Setup filter handlers
        this.setupLowGpFilterHandlers();
        
        // Load initial data
        await this.loadLowGpData();
    }
    
    setupLowGpFilterHandlers() {
        const applyBtn = document.getElementById('low-gp-apply');
        const sepBtn = document.getElementById('low-gp-sep');
        const noSepBtn = document.getElementById('low-gp-no-sep');
        const thresholdInput = document.getElementById('low-gp-threshold');
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.lowGpThreshold = parseFloat(thresholdInput?.value || 20);
                this.loadLowGpData();
            });
        }
        
        if (sepBtn) {
            sepBtn.addEventListener('click', () => {
                this.lowGpExcludePdst = false;
                this.lowGpThreshold = parseFloat(thresholdInput?.value || 20);
                this.updateSepButtonStates();
                this.loadLowGpData();
            });
        }
        
        if (noSepBtn) {
            noSepBtn.addEventListener('click', () => {
                this.lowGpExcludePdst = true;
                this.lowGpThreshold = parseFloat(thresholdInput?.value || 20);
                this.updateSepButtonStates();
                this.loadLowGpData();
            });
        }
        
        if (thresholdInput) {
            thresholdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.lowGpThreshold = parseFloat(thresholdInput.value || 20);
                    this.loadLowGpData();
                }
            });
        }
    }
    
    updateSepButtonStates() {
        const sepBtn = document.getElementById('low-gp-sep');
        const noSepBtn = document.getElementById('low-gp-no-sep');
        
        if (sepBtn) {
            sepBtn.classList.toggle('active', !this.lowGpExcludePdst);
        }
        if (noSepBtn) {
            noSepBtn.classList.toggle('active', this.lowGpExcludePdst);
        }
    }
    
    async loadLowGpData() {
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const { fromDate, toDate } = this.data;
        
        if (!pharmacy || !fromDate || !toDate) return;
        
        const modalContent = document.querySelector('#low-gp-modal .product-list-modal-content');
        const countEl = document.getElementById('low-gp-count');
        
        if (modalContent) {
            modalContent.innerHTML = '<div class="product-list-modal-loading">Loading...</div>';
        }
        
        try {
            const worstGpData = await window.api.getWorstGP(pharmacy.id, null, fromDate, toDate, 100, this.lowGpThreshold, this.lowGpExcludePdst);
            const worstGpProducts = this.parseApiListResponse(worstGpData, ['worst_gp_products', 'low_gp_products', 'items', 'data']);
            this.currentLowGpData = worstGpProducts;
            
            const contentHtml = this.renderLowGpModalContent(worstGpProducts);
            
            if (modalContent) {
                modalContent.innerHTML = contentHtml;
            }
            if (countEl) {
                countEl.textContent = `${worstGpProducts.length} products`;
            }
        } catch (error) {
            console.error('Error loading low GP data:', error);
            if (modalContent) {
                modalContent.innerHTML = '<div class="product-list-modal-error">Error loading data</div>';
            }
        }
    }
    
    renderTopSellersModalContent(bestSellers) {
        if (!bestSellers || bestSellers.length === 0) {
            return '<div class="product-list-modal-empty">No data for this period</div>';
        }
        
        return bestSellers.map((item, index) => {
            const productName = item.product_description || item.description || item.product_name || item.name || 'Unknown Product';
            const productCode = item.product_code || item.code || item.nappi_code || '';
            const quantity = item.qty_sold || item.quantity_sold || item.qty || item.quantity || item.total_quantity || item.units_sold || 0;
            const gpPercent = item.gp_pct || item.gp_percent || item.margin_pct || 0;
            
            return `
                <div class="product-list-modal-item">
                    <div class="product-list-modal-rank">${index + 1}</div>
                    <div class="product-list-modal-details">
                        <div class="product-list-modal-name">${this.escapeHtml(productName)}</div>
                        <div class="product-list-modal-code">${this.escapeHtml(productCode)}</div>
                    </div>
                    <div class="product-list-modal-stats">
                        <div class="product-list-modal-qty">${quantity} units</div>
                        <div class="product-list-modal-gp">${gpPercent.toFixed(1)}% GP</div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    renderLowGpModalContent(worstGpProducts) {
        if (!worstGpProducts || worstGpProducts.length === 0) {
            return '<div class="product-list-modal-empty">No low GP items for this period</div>';
        }
        
        return worstGpProducts.map((item, index) => {
            const productName = item.product_name || item.product_description || item.description || item.name || 'Unknown Product';
            const productCode = item.nappi_code || item.product_code || item.code || '';
            const quantity = item.quantity_sold || item.qty_sold || item.qty || item.quantity || item.total_quantity || item.units_sold || 0;
            const gpPercent = item.gp_percent || item.gp_pct || item.margin_pct || 0;
            
            return `
                <div class="product-list-modal-item">
                    <div class="product-list-modal-rank">${index + 1}</div>
                    <div class="product-list-modal-details">
                        <div class="product-list-modal-name">${this.escapeHtml(productName)}</div>
                        <div class="product-list-modal-code">${this.escapeHtml(productCode)}</div>
                    </div>
                    <div class="product-list-modal-stats low-gp">
                        <div class="product-list-modal-gp-value">${gpPercent.toFixed(1)}%</div>
                        <div class="product-list-modal-qty-small">${quantity} units</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    showError(error) {
        const mainContent = document.querySelector('.content-area');
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div class="dashboard-container">
                <div class="error-state">
                    <h2>Error Loading Stock Data</h2>
                    <p>${error.message || 'An error occurred while loading stock information.'}</p>
                </div>
            </div>
        `;
    }
}
