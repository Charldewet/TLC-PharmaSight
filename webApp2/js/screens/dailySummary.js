// Daily Summary Screen
// Detailed daily sales and performance metrics with KPI cards matching dashboard style

class DailySummaryScreen {
    constructor() {
        this.data = null;
    }

    async load() {
        console.log('Loading Daily Summary...');
        
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const date = window.datePicker?.getSelectedDate();
        
        if (!pharmacy || !date) {
            console.warn('Missing pharmacy or date selection');
            this.showEmptyState();
            return;
        }

        // Show loading overlay
        if (window.loadingOverlay) {
            window.loadingOverlay.show('Loading daily summary data...');
        }

        try {
            await this.loadData(pharmacy.id, date);
            this.render();
        } catch (error) {
            console.error('Error loading daily summary:', error);
            this.showError(error);
        } finally {
            // Hide loading overlay
            if (window.loadingOverlay) {
                window.loadingOverlay.hide();
            }
        }
    }

    async loadData(pharmacyId, date) {
        const month = date.slice(0, 7);
        
        // Calculate previous year month for comparison
        const currentDate = new Date(date + 'T00:00:00');
        const prevYearDate = new Date(currentDate);
        prevYearDate.setFullYear(currentDate.getFullYear() - 1);
        const prevYearMonth = `${prevYearDate.getFullYear()}-${String(prevYearDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Load current and previous year data, plus best sellers and worst GP in parallel
        const [daysData, prevYearDaysData, bestSellersData, worstGpData] = await Promise.all([
            window.api.getDays(pharmacyId, month),
            window.api.getDays(pharmacyId, prevYearMonth),
            window.api.getBestSellers(pharmacyId, date, date, date, 10).catch(e => { console.error('Best sellers error:', e); return []; }),
            window.api.getWorstGP(pharmacyId, date, date, date, 50, 20, true).catch(e => { console.error('Worst GP error:', e); return []; })
        ]);
        
        const dayData = daysData.find(d => d.business_date === date) || null;
        
        // Find matching weekday in previous year
        let prevYearDayData = null;
        if (prevYearDaysData && Array.isArray(prevYearDaysData) && prevYearDaysData.length > 0) {
            const currentWeekday = currentDate.getDay();
            prevYearDayData = this.findMatchingWeekday(prevYearDaysData, prevYearDate, currentWeekday);
        }
        
        // Parse best sellers and worst GP data (handle different response formats)
        let bestSellers = this.parseApiListResponse(bestSellersData, ['best_sellers', 'stock_activity', 'items', 'data']);
        let worstGpProducts = this.parseApiListResponse(worstGpData, ['worst_gp_products', 'low_gp_products', 'items', 'data']);
        
        this.data = {
            dayData,
            prevYearDayData,
            date,
            bestSellers,
            worstGpProducts
        };
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
    
    // Find matching weekday in previous year data (same logic as dashboard)
    findMatchingWeekday(daysData, prevYearDate, targetWeekday) {
        if (!Array.isArray(daysData) || daysData.length === 0) return null;
        
        // Adjust date to match the target weekday
        const adjustedDate = new Date(prevYearDate);
        const weekdayDiff = adjustedDate.getDay() - targetWeekday;
        if (weekdayDiff !== 0) {
            adjustedDate.setDate(adjustedDate.getDate() - weekdayDiff);
        }
        
        // Use local time format
        const targetDateStr = this.formatYmdLocal(adjustedDate);
        return daysData.find(d => d.business_date === targetDateStr) || null;
    }
    
    // Format date as YYYY-MM-DD using local time
    formatYmdLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    render() {
        const mainContent = document.querySelector('.content-area');
        if (!mainContent) return;

        if (!this.data || !this.data.dayData) {
            this.showEmptyState('No data available for selected date');
            return;
        }

        const { dayData, prevYearDayData } = this.data;

        // Calculate values for card formatting
        const turnover = Number(dayData.turnover || 0);
        const prevYearTurnover = prevYearDayData ? Number(prevYearDayData.turnover || 0) : 0;
        const prevYearYear = prevYearDayData ? new Date(prevYearDayData.business_date + 'T00:00:00').getFullYear() : null;
        
        // Calculate growth percentage
        let growthPct = null;
        if (prevYearTurnover > 0 && turnover > 0) {
            growthPct = ((turnover - prevYearTurnover) / prevYearTurnover) * 100;
        }
        
        // Get GP values
        const gpPercent = Number(dayData.gp_percentage || dayData.gp_pct || 0);
        const gpValue = Number(dayData.gp_value || dayData.gp || dayData.gross_profit || 0);
        
        // Get transaction count (matching dashboard priority order)
        const transactionCount = Number(
            dayData.transaction_count ||
            dayData.transactions ||
            dayData.txn_count ||
            0
        );
        
        // Format cards with badges and secondary text
        const turnoverCard = this.formatTurnoverCard(prevYearTurnover, prevYearYear, growthPct);
        const gpCard = this.formatGpCard(gpValue, gpPercent);
        const basketCard = this.formatBasketCard(transactionCount);

        // Get dispensary and frontshop turnover
        const dispensaryTurnover = Number(dayData.dispensary_turnover || 0);
        const frontshopTurnover = Number(dayData.frontshop_turnover || 0);
        const totalSplitTurnover = dispensaryTurnover + frontshopTurnover;
        const dispensaryPercent = totalSplitTurnover > 0 ? Math.round((dispensaryTurnover / totalSplitTurnover) * 100) : 0;

        // Get scripts data
        const scriptsQty = Number(dayData.scripts_qty || 0);
        const avgScriptValue = Number(dayData.avg_script_value || 0) || (scriptsQty > 0 ? dispensaryTurnover / scriptsQty : 0);

        // Get best sellers and worst GP data
        const { bestSellers, worstGpProducts } = this.data;

        mainContent.innerHTML = `
            <div class="dashboard-container">
                <div class="dashboard-top-cards">
                    ${this.renderTopCard('Turnover', turnover, 'currency', turnoverCard)}
                    ${this.renderPurchasesCard(dayData.purchases || 0, dayData.cost_of_sales || 0, dayData)}
                    ${this.renderTopCard('GP%', gpPercent, 'percentage', gpCard)}
                    ${this.renderTopCard('Basket', this.calculateBasketSize(dayData), 'currency', basketCard)}
                </div>
                <div class="dashboard-bottom-cards">
                    ${this.renderDispensarySplitCard(dispensaryTurnover, frontshopTurnover, dispensaryPercent)}
                    ${this.renderScriptsCard(scriptsQty, avgScriptValue)}
                </div>
                <div class="dashboard-bottom-cards">
                    ${this.renderTopSellersCard(bestSellers)}
                    ${this.renderLowGpCard(worstGpProducts)}
                </div>
            </div>
        `;
        
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
        
        // Add warning badge if GP% is below 24%
        if (gpPercent > 0 && gpPercent < 24) {
            badge = {
                text: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
                className: 'warning-icon'
            };
        }
        
        return { badge, secondary };
    }
    
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

    renderPurchasesCard(purchases, costOfSales, dayData) {
        // Format purchases value
        const purchasesNum = Number(purchases) || 0;
        const purchasesFormatted = purchasesNum === 0 ? '—' : 
            new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(purchasesNum));

        // Calculate cost of sales if not provided
        // Cost of sales = turnover - gross profit
        let costOfSalesNum = Number(costOfSales) || 0;
        if (costOfSalesNum === 0 && dayData) {
            const turnover = Number(dayData.turnover) || 0;
            const gpValue = Number(dayData.gp_value || dayData.gp || dayData.gross_profit || 0);
            costOfSalesNum = turnover > 0 && gpValue > 0 ? turnover - gpValue : 0;
        }

        // Format cost of sales value
        const costOfSalesFormatted = costOfSalesNum === 0 ? '—' : 
            new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(costOfSalesNum));

        // Get icon for Purchases card
        const icon = this.getCardIcon('Purchases');

        return `
            <div class="dashboard-top-card">
                <h3 class="dashboard-top-card-title">
                    <span class="dashboard-top-card-icon">${icon}</span>
                    Purchases
                </h3>
                <div class="dashboard-top-card-value-row">
                    <p class="dashboard-top-card-value">${purchasesFormatted}</p>
                </div>
                <p class="dashboard-top-card-secondary">Cost of Sales: ${costOfSalesFormatted}</p>
            </div>
        `;
    }

    calculateBasketSize(dayData) {
        // Try avg_basket first (pre-calculated)
        if (dayData.avg_basket !== undefined && dayData.avg_basket !== null && dayData.avg_basket > 0) {
            return Number(dayData.avg_basket);
        }
        
        // Basket size = turnover / transactions
        const turnover = Number(dayData.turnover) || 0;
        const transactions = Number(dayData.transactions || dayData.txn_count || 0);
        
        if (transactions === 0 || turnover === 0) {
            return 0;
        }
        
        return turnover / transactions;
    }

    renderDispensarySplitCard(dispensaryTurnover, frontshopTurnover, dispensaryPercent) {
        // Format values
        const dispensaryFormatted = dispensaryTurnover > 0 ? 
            new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(dispensaryTurnover)) : '—';
        
        const frontshopFormatted = frontshopTurnover > 0 ?
            new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(frontshopTurnover)) : '—';
        
        // Calculate circular progress (circumference = 2 * π * r, r = 50)
        const circumference = 2 * Math.PI * 50;
        const visualPct = Math.min(dispensaryPercent, 100);
        const offset = circumference - (visualPct / 100) * circumference;

        return `
            <div class="dashboard-bottom-card purchase-budget-card">
                <h3 class="dashboard-bottom-card-title">
                    <span class="dashboard-top-card-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="2" x2="12" y2="6"></line>
                            <line x1="12" y1="18" x2="12" y2="22"></line>
                            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                            <line x1="2" y1="12" x2="6" y2="12"></line>
                            <line x1="18" y1="12" x2="22" y2="12"></line>
                            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                        </svg>
                    </span>
                    DISPENSARY SPLIT
                </h3>
                <div class="purchase-card-content">
                    <div class="purchase-metrics">
                        <div class="purchase-metric-item">
                            <div class="purchase-metric-label">DISPENSARY TURNOVER</div>
                            <div class="purchase-metric-value">${dispensaryFormatted}</div>
                        </div>
                        <div class="purchase-metric-item">
                            <div class="purchase-metric-label">FRONTSHOP TURNOVER</div>
                            <div class="purchase-metric-value">${frontshopFormatted}</div>
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
                            <span class="purchase-chart-percentage">${dispensaryPercent}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderScriptsCard(scriptsQty, avgScriptValue) {
        // Format scripts quantity
        const scriptsFormatted = scriptsQty > 0 ? 
            new Intl.NumberFormat('en-ZA').format(scriptsQty) : '—';
        
        // Format average script value
        const avgScriptFormatted = avgScriptValue > 0 ?
            new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(avgScriptValue)) : '—';
        
        return `
            <div class="dashboard-bottom-card purchase-budget-card">
                <h3 class="dashboard-bottom-card-title">
                    <span class="dashboard-top-card-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                    </span>
                    SCRIPTS
                </h3>
                <div class="purchase-card-content">
                    <div class="purchase-metrics">
                        <div class="purchase-metric-item">
                            <div class="purchase-metric-label">NUMBER OF SCRIPTS</div>
                            <div class="purchase-metric-value">${scriptsFormatted}</div>
                        </div>
                        <div class="purchase-metric-item">
                            <div class="purchase-metric-label">AVG SCRIPT VALUE</div>
                            <div class="purchase-metric-value">${avgScriptFormatted}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
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
                        <div class="product-list-name">No data for this date</div>
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
                        <div class="product-list-name">No low GP items for this date</div>
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

    getCardIcon(title) {
        const icons = {
            'Turnover': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="2" x2="12" y2="22"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>`,
            'Purchases': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>`,
            'GP%': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>`,
            'Basket': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>`
        };
        return icons[title] || '';
    }

    showEmptyState(message = 'Select a date to view daily summary') {
        const mainContent = document.querySelector('.content-area');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="dashboard-container">
                <div class="empty-state">
                    <h2>Daily Summary</h2>
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
                    <h2>Error Loading Daily Summary</h2>
                    <p>${error.message || 'An error occurred while loading data.'}</p>
                    </div>
                </div>
            `;
        }
    }
    
    // Setup event listeners for expand buttons
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
        const date = this.data?.date;
        
        if (!pharmacy || !date) return;
        
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
            const bestSellersData = await window.api.getBestSellers(pharmacy.id, date, date, date, 20);
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
            
            // Setup PDF download handler
            const downloadBtn = document.getElementById('top-sellers-download-pdf');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => this.downloadTopSellersPdf());
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
        const date = this.data?.date;
        
        if (!pharmacy || !date) return;
        
        // Reset state
        this.lowGpThreshold = 20;
        this.lowGpExcludePdst = true;
        
        // Toolbar with filtering and PDF download - all on same line
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
        const downloadBtn = document.getElementById('low-gp-download-pdf');
        
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
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadLowGpPdf());
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
        const date = this.data?.date;
        
        if (!pharmacy || !date) return;
        
        const modalContent = document.querySelector('#low-gp-modal .product-list-modal-content');
        const countEl = document.getElementById('low-gp-count');
        
        if (modalContent) {
            modalContent.innerHTML = '<div class="product-list-modal-loading">Loading...</div>';
        }
        
        try {
            const worstGpData = await window.api.getWorstGP(
                pharmacy.id, 
                date, 
                date, 
                date, 
                100, 
                this.lowGpThreshold, 
                this.lowGpExcludePdst
            );
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
            console.error('Error loading low GP products:', error);
            if (modalContent) {
                modalContent.innerHTML = '<div class="product-list-modal-error">Error loading data</div>';
            }
        }
    }
    
    downloadTopSellersPdf() {
        if (!this.currentTopSellersData || this.currentTopSellersData.length === 0) {
            alert('No data to download');
            return;
        }
        
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const date = this.data?.date;
        const pharmacyName = pharmacy?.name || 'Unknown Pharmacy';
        
        // Create PDF using jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add title
        doc.setFontSize(16);
        doc.text(`${pharmacyName} - Top Sellers Report`, 14, 15);
        
        doc.setFontSize(10);
        doc.text(`Date: ${date}`, 14, 22);
        doc.text(`Total Products: ${this.currentTopSellersData.length}`, 14, 28);
        
        // Add table headers
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        let yPos = 40;
        doc.text('Rank', 14, yPos);
        doc.text('Product Name', 30, yPos);
        doc.text('Product Code', 110, yPos);
        doc.text('Qty', 155, yPos);
        doc.text('GP%', 175, yPos);
        
        // Add line under headers
        doc.line(14, yPos + 2, 195, yPos + 2);
        
        // Add data rows
        doc.setFont(undefined, 'normal');
        yPos += 8;
        
        this.currentTopSellersData.forEach((item, index) => {
            const productName = item.product_description || item.description || item.product_name || item.name || 'Unknown';
            const productCode = item.product_code || item.code || item.nappi_code || '';
            const quantity = item.qty_sold || item.quantity_sold || item.qty || item.quantity || 0;
            const gpPercent = item.gp_pct || item.gp_percent || item.margin_pct || 0;
            
            // Check if we need a new page
            if (yPos > 280) {
                doc.addPage();
                yPos = 15;
            }
            
            doc.text(String(index + 1), 14, yPos);
            doc.text(productName.substring(0, 45), 30, yPos); // Truncate long names
            doc.text(productCode, 110, yPos);
            doc.text(String(quantity), 155, yPos);
            doc.text(`${gpPercent.toFixed(1)}%`, 175, yPos);
            
            yPos += 6;
        });
        
        // Save the PDF
        doc.save(`top-sellers-${date}.pdf`);
    }
    
    downloadLowGpPdf() {
        if (!this.currentLowGpData || this.currentLowGpData.length === 0) {
            alert('No data to download');
            return;
        }
        
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const date = this.data?.date;
        const pharmacyName = pharmacy?.name || 'Unknown Pharmacy';
        
        // Create PDF using jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add title
        doc.setFontSize(16);
        doc.text(`${pharmacyName} - Low GP Products Report`, 14, 15);
        
        doc.setFontSize(10);
        doc.text(`Date: ${date}`, 14, 22);
        doc.text(`Threshold: Below ${this.lowGpThreshold}% GP`, 14, 28);
        doc.text(`Filter: ${this.lowGpExcludePdst ? 'NO SEP (Excludes PDST)' : 'SEP (Includes PDST)'}`, 14, 34);
        doc.text(`Total Products: ${this.currentLowGpData.length}`, 14, 40);
        
        // Add table headers
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        let yPos = 52;
        doc.text('Rank', 14, yPos);
        doc.text('Product Name', 30, yPos);
        doc.text('Product Code', 110, yPos);
        doc.text('GP%', 155, yPos);
        doc.text('Qty', 175, yPos);
        
        // Add line under headers
        doc.line(14, yPos + 2, 195, yPos + 2);
        
        // Add data rows
        doc.setFont(undefined, 'normal');
        yPos += 8;
        
        this.currentLowGpData.forEach((item, index) => {
            const productName = item.product_name || item.product_description || item.description || item.name || 'Unknown';
            const productCode = item.nappi_code || item.product_code || item.code || '';
            const quantity = item.quantity_sold || item.qty_sold || item.qty || item.quantity || 0;
            const gpPercent = item.gp_percent || item.gp_pct || item.margin_pct || 0;
            
            // Check if we need a new page
            if (yPos > 280) {
                doc.addPage();
                yPos = 15;
            }
            
            doc.text(String(index + 1), 14, yPos);
            doc.text(productName.substring(0, 45), 30, yPos); // Truncate long names
            doc.text(productCode, 110, yPos);
            doc.text(`${gpPercent.toFixed(1)}%`, 155, yPos);
            doc.text(String(quantity), 175, yPos);
            
            yPos += 6;
        });
        
        // Save the PDF
        const filename = `low-gp-products-${date}-below-${this.lowGpThreshold}percent.pdf`;
        doc.save(filename);
    }
    
    renderTopSellersModalContent(bestSellers) {
        if (!bestSellers || bestSellers.length === 0) {
            return '<div class="product-list-modal-empty">No data for this date</div>';
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
            return '<div class="product-list-modal-empty">No low GP items for this date</div>';
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
}

// Export class
window.DailySummaryScreen = DailySummaryScreen;
