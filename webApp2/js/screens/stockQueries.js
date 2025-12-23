// Stock Queries Screen
// Product search, overstocked products, and negative stock queries

class StockQueriesScreen {
    constructor() {
        this.searchResults = [];
        this.expandedProducts = new Set();
        this.productDetails = {};
        this.searchTimeout = null;
        this.overstockedResults = [];
        this.negativeStockResults = [];
        this.overstockedFilters = {
            daysThreshold: 30,
            category: 'all',
            minValue: 100
        };
    }

    async load() {
        console.log('Loading Stock Queries...');
        
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const date = window.datePicker?.getSelectedDate();
        
        if (!pharmacy || !date) {
            console.warn('Missing pharmacy or date selection');
            this.showEmptyState();
            return;
        }

        this.render();
        // Create modals after render
        this.createModals();
        this.initEventHandlers();
    }

    render() {
        const mainContent = document.querySelector('.content-area');
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div class="stock-queries-container">
                <!-- Stock Lookup Section -->
                <section class="stock-queries-section">
                    <div class="section-header" id="stock-lookup-header">
                        <button class="section-toggle-btn" aria-label="Toggle Stock Lookup">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <h2 class="section-title">Stock Lookup</h2>
                    </div>
                    
                    <div class="section-content" id="stock-lookup-content">
                        <!-- Search Input -->
                        <div class="stock-search-wrapper">
                            <svg class="stock-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35"></path>
                            </svg>
                            <input 
                                type="text" 
                                id="stock-search-input" 
                                class="stock-search-input" 
                                placeholder="Search by product name or code..."
                                autocomplete="off"
                            />
                            <div id="stock-search-loading" class="stock-search-loading" style="display: none;">
                                <div class="spinner-small"></div>
                            </div>
                        </div>
                        <div id="stock-search-error" class="stock-search-error" style="display: none;"></div>
                        
                        <!-- Search Results -->
                        <div id="stock-search-results" class="stock-search-results" style="display: none;">
                            <div class="stock-results-header">
                                <span id="stock-results-count" class="stock-results-count"></span>
                            </div>
                            <div id="stock-results-list" class="stock-results-list"></div>
                        </div>
                    </div>
                </section>
                
                <!-- Overstocked Section -->
                <section class="stock-queries-section">
                    <div class="section-header collapsed" id="overstocked-header">
                        <button class="section-toggle-btn collapsed" aria-label="Toggle Over Stocked">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <h2 class="section-title">Over Stocked</h2>
                    </div>
                    
                    <div class="section-content collapsed" id="overstocked-content">
                        <!-- Filters -->
                        <div class="stock-filters-row">
                            <div class="stock-filter-group">
                                <label class="stock-filter-label">Days Threshold:</label>
                                <button class="stock-filter-btn" id="days-threshold-btn" type="button" data-filter="days">
                                    <span class="stock-filter-btn-text">30+ days</span>
                                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M1 1L6 6L11 1"></path>
                                    </svg>
                                </button>
                            </div>
                            
                            <div class="stock-filter-group">
                                <label class="stock-filter-label">Category:</label>
                                <button class="stock-filter-btn" id="category-btn" type="button" data-filter="category">
                                    <span class="stock-filter-btn-text">All Categories</span>
                                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M1 1L6 6L11 1"></path>
                                    </svg>
                                </button>
                            </div>
                            
                            <div class="stock-filter-group">
                                <label class="stock-filter-label">Min Value:</label>
                                <button class="stock-filter-btn" id="min-value-btn" type="button" data-filter="value">
                                    <span class="stock-filter-btn-text">R 100+</span>
                                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M1 1L6 6L11 1"></path>
                                    </svg>
                                </button>
                            </div>
                            
                            <button id="overstocked-load-btn" class="stock-load-btn" style="margin-left: auto;">
                                Load Over Stocked Products
                            </button>
                        </div>
                        
                        <!-- Loading State -->
                        <div id="overstocked-loading" class="stock-loading-state" style="display: none;">
                            <div class="spinner-small"></div>
                            <span>Loading...</span>
                        </div>
                        
                        <!-- Error State -->
                        <div id="overstocked-error" class="stock-search-error" style="display: none;"></div>
                        
                        <!-- Results -->
                        <div id="overstocked-results" class="stock-search-results" style="display: none;">
                            <div class="stock-results-header">
                                <span id="overstocked-results-count" class="stock-results-count"></span>
                            </div>
                            <div id="overstocked-results-list" class="stock-results-list"></div>
                        </div>
                    </div>
                </section>
                
                <!-- Negative Stock Section -->
                <section class="stock-queries-section">
                    <div class="section-header collapsed" id="negativestock-header">
                        <button class="section-toggle-btn collapsed" aria-label="Toggle Negative Stock">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <h2 class="section-title">Negative Stock</h2>
                    </div>
                    
                    <div class="section-content collapsed" id="negativestock-content">
                        <div class="stock-filters-row" style="justify-content: flex-end;">
                            <button id="negativestock-load-btn" class="stock-load-btn">
                                Load Negative Stock Products
                            </button>
                        </div>
                        
                        <!-- Loading State -->
                        <div id="negativestock-loading" class="stock-loading-state" style="display: none;">
                            <div class="spinner-small"></div>
                            <span>Loading...</span>
                        </div>
                        
                        <!-- Error State -->
                        <div id="negativestock-error" class="stock-search-error" style="display: none;"></div>
                        
                        <!-- Results -->
                        <div id="negativestock-results" class="stock-search-results" style="display: none;">
                            <div class="stock-results-header">
                                <span id="negativestock-results-count" class="stock-results-count"></span>
                            </div>
                            <div id="negativestock-results-list" class="stock-results-list"></div>
                        </div>
                    </div>
                </section>
            </div>
        `;
    }

    createModals() {
        // Create modals container if it doesn't exist
        let modalsContainer = document.getElementById('stock-filter-modals-container');
        if (!modalsContainer) {
            modalsContainer = document.createElement('div');
            modalsContainer.id = 'stock-filter-modals-container';
            document.body.appendChild(modalsContainer);
        }

        modalsContainer.innerHTML = `
            <!-- Days Threshold Modal -->
            <div class="pharmacy-picker-modal-overlay" id="days-threshold-modal-overlay">
                <div class="pharmacy-picker-modal">
                    <div class="pharmacy-picker-header">
                        <h3>Days Threshold</h3>
                    </div>
                    <div class="pharmacy-picker-list" id="days-threshold-list">
                        <button class="pharmacy-option" data-value="7">7+ days</button>
                        <button class="pharmacy-option" data-value="14">14+ days</button>
                        <button class="pharmacy-option" data-value="21">21+ days</button>
                        <button class="pharmacy-option selected" data-value="30">30+ days</button>
                    </div>
                    <div class="pharmacy-picker-footer">
                        <button class="btn-primary" data-close-modal="days-threshold">Done</button>
                    </div>
                </div>
            </div>
            
            <!-- Category Modal -->
            <div class="pharmacy-picker-modal-overlay" id="category-modal-overlay">
                <div class="pharmacy-picker-modal">
                    <div class="pharmacy-picker-header">
                        <h3>Category</h3>
                    </div>
                    <div class="pharmacy-picker-list" id="category-list">
                        <button class="pharmacy-option selected" data-value="all">All Categories</button>
                        <button class="pharmacy-option" data-value="dispensary">Dispensary</button>
                        <button class="pharmacy-option" data-value="self-medication">Self-Medication</button>
                        <button class="pharmacy-option" data-value="git">GIT</button>
                        <button class="pharmacy-option" data-value="vitamins">Vitamins</button>
                        <button class="pharmacy-option" data-value="first-aid">First Aid</button>
                        <button class="pharmacy-option" data-value="sports">Sports</button>
                        <button class="pharmacy-option" data-value="health-foods">Health Foods</button>
                        <button class="pharmacy-option" data-value="beauty">Beauty</button>
                        <button class="pharmacy-option" data-value="bath-body">Bath & Body</button>
                        <button class="pharmacy-option" data-value="baby">Baby</button>
                        <button class="pharmacy-option" data-value="gifts">Gifts</button>
                        <button class="pharmacy-option" data-value="other">Other</button>
                    </div>
                    <div class="pharmacy-picker-footer">
                        <button class="btn-primary" data-close-modal="category">Done</button>
                    </div>
                </div>
            </div>
            
            <!-- Min Value Modal -->
            <div class="pharmacy-picker-modal-overlay" id="min-value-modal-overlay">
                <div class="pharmacy-picker-modal">
                    <div class="pharmacy-picker-header">
                        <h3>Min Value</h3>
                    </div>
                    <div class="pharmacy-picker-list" id="min-value-list">
                        <button class="pharmacy-option" data-value="10">R 10+</button>
                        <button class="pharmacy-option selected" data-value="100">R 100+</button>
                        <button class="pharmacy-option" data-value="200">R 200+</button>
                        <button class="pharmacy-option" data-value="300">R 300+</button>
                        <button class="pharmacy-option" data-value="400">R 400+</button>
                        <button class="pharmacy-option" data-value="500">R 500+</button>
                        <button class="pharmacy-option" data-value="600">R 600+</button>
                        <button class="pharmacy-option" data-value="700">R 700+</button>
                        <button class="pharmacy-option" data-value="800">R 800+</button>
                        <button class="pharmacy-option" data-value="900">R 900+</button>
                        <button class="pharmacy-option" data-value="1000">R 1000+</button>
                    </div>
                    <div class="pharmacy-picker-footer">
                        <button class="btn-primary" data-close-modal="min-value">Done</button>
                    </div>
                </div>
            </div>
        `;
    }

    initEventHandlers() {
        // Search input handler
        const searchInput = document.getElementById('stock-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                
                if (this.searchTimeout) {
                    clearTimeout(this.searchTimeout);
                }
                
                this.searchTimeout = setTimeout(() => {
                    this.performSearch(query);
                }, 300);
            });
        }

        // Section toggle handlers
        this.initSectionToggle('stock-lookup');
        this.initSectionToggle('overstocked');
        this.initSectionToggle('negativestock');

        // Modal handlers
        this.initModals();

        // Load buttons
        const overstockedLoadBtn = document.getElementById('overstocked-load-btn');
        if (overstockedLoadBtn) {
            overstockedLoadBtn.addEventListener('click', () => this.loadOverstocked());
        }

        const negativeStockLoadBtn = document.getElementById('negativestock-load-btn');
        if (negativeStockLoadBtn) {
            negativeStockLoadBtn.addEventListener('click', () => this.loadNegativeStock());
        }
    }

    initSectionToggle(sectionId) {
        const header = document.getElementById(`${sectionId}-header`);
        const content = document.getElementById(`${sectionId}-content`);
        
        if (header && content) {
            header.addEventListener('click', () => {
                const toggleBtn = header.querySelector('.section-toggle-btn');
                const isCollapsed = content.classList.contains('collapsed');
                
                if (isCollapsed) {
                    content.classList.remove('collapsed');
                    header.classList.remove('collapsed');
                    toggleBtn?.classList.remove('collapsed');
                } else {
                    content.classList.add('collapsed');
                    header.classList.add('collapsed');
                    toggleBtn?.classList.add('collapsed');
                }
            });
        }
    }

    initModals() {
        // Map filter types to modal IDs and button IDs
        const filterConfig = {
            days: {
                modalId: 'days-threshold-modal-overlay',
                buttonId: 'days-threshold-btn',
                listId: 'days-threshold-list',
                options: [
                    { value: '7', label: '7+ days' },
                    { value: '14', label: '14+ days' },
                    { value: '21', label: '21+ days' },
                    { value: '30', label: '30+ days' }
                ],
                defaultValue: '30'
            },
            category: {
                modalId: 'category-modal-overlay',
                buttonId: 'category-btn',
                listId: 'category-list',
                options: [
                    { value: 'all', label: 'All Categories' },
                    { value: 'dispensary', label: 'Dispensary' },
                    { value: 'self-medication', label: 'Self-Medication' },
                    { value: 'git', label: 'GIT' },
                    { value: 'vitamins', label: 'Vitamins' },
                    { value: 'first-aid', label: 'First Aid' },
                    { value: 'sports', label: 'Sports' },
                    { value: 'health-foods', label: 'Health Foods' },
                    { value: 'beauty', label: 'Beauty' },
                    { value: 'bath-body', label: 'Bath & Body' },
                    { value: 'baby', label: 'Baby' },
                    { value: 'gifts', label: 'Gifts' },
                    { value: 'other', label: 'Other' }
                ],
                defaultValue: 'all'
            },
            value: {
                modalId: 'min-value-modal-overlay',
                buttonId: 'min-value-btn',
                listId: 'min-value-list',
                options: [
                    { value: '10', label: 'R 10+' },
                    { value: '100', label: 'R 100+' },
                    { value: '200', label: 'R 200+' },
                    { value: '300', label: 'R 300+' },
                    { value: '400', label: 'R 400+' },
                    { value: '500', label: 'R 500+' },
                    { value: '600', label: 'R 600+' },
                    { value: '700', label: 'R 700+' },
                    { value: '800', label: 'R 800+' },
                    { value: '900', label: 'R 900+' },
                    { value: '1000', label: 'R 1000+' }
                ],
                defaultValue: '100'
            }
        };

        // Initialize each filter button
        Object.keys(filterConfig).forEach(filterType => {
            const config = filterConfig[filterType];
            const button = document.getElementById(config.buttonId);
            const overlay = document.getElementById(config.modalId);
            const list = document.getElementById(config.listId);
            const modal = overlay?.querySelector('.pharmacy-picker-modal');

            if (!button || !overlay || !list) return;

            // Open modal on button click
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openFilterModal(filterType, config, button);
            });

            // Close modal handlers
            const closeBtn = overlay.querySelector(`[data-close-modal="${filterType}"]`);
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.closeFilterModal(config.modalId);
                });
            }

            // Overlay click to close
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeFilterModal(config.modalId);
                }
            });

            // Escape key to close
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && overlay.classList.contains('active')) {
                    this.closeFilterModal(config.modalId);
                }
            });

            // Option click handlers
            list.querySelectorAll('.pharmacy-option').forEach(option => {
                option.addEventListener('click', () => {
                    const value = option.getAttribute('data-value');
                    this.selectFilterOption(filterType, value, config, button);
                });
            });

            // Desktop positioning
            if (!this.isMobile()) {
                window.addEventListener('resize', () => {
                    if (overlay.classList.contains('active') && modal && button) {
                        this.repositionFilterModal(modal, button);
                    }
                });
            }
        });
    }

    openFilterModal(filterType, config, button) {
        const overlay = document.getElementById(config.modalId);
        const modal = overlay?.querySelector('.pharmacy-picker-modal');
        const list = document.getElementById(config.listId);

        if (!overlay || !modal || !list) return;

        // Update selection highlight
        const currentValue = this.getCurrentFilterValue(filterType);
        list.querySelectorAll('.pharmacy-option').forEach(option => {
            const value = option.getAttribute('data-value');
            if (value === currentValue) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });

        // Position modal
        if (!this.isMobile()) {
            this.repositionFilterModal(modal, button);
        }

        overlay.classList.add('active');
        if (this.isMobile()) {
            document.body.style.overflow = 'hidden';
        }
    }

    closeFilterModal(modalId) {
        const overlay = document.getElementById(modalId);
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    selectFilterOption(filterType, value, config, button) {
        // Update filter value
        this.updateFilter(filterType, value);

        // Update button text
        const selectedOption = config.options.find(opt => opt.value === value);
        if (selectedOption && button) {
            const textEl = button.querySelector('.stock-filter-btn-text');
            if (textEl) {
                textEl.textContent = selectedOption.label;
            }
        }

        // Update selection in modal
        const list = document.getElementById(config.listId);
        if (list) {
            list.querySelectorAll('.pharmacy-option').forEach(option => {
                const optionValue = option.getAttribute('data-value');
                if (optionValue === value) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            });
        }

        // Close modal
        this.closeFilterModal(config.modalId);
    }

    getCurrentFilterValue(filterType) {
        switch (filterType) {
            case 'days':
                return String(this.overstockedFilters.daysThreshold);
            case 'category':
                return this.overstockedFilters.category;
            case 'value':
                return String(this.overstockedFilters.minValue);
            default:
                return '';
        }
    }

    repositionFilterModal(modal, button) {
        const buttonRect = button.getBoundingClientRect();
        modal.style.top = `${buttonRect.bottom + 8}px`;
        modal.style.right = `${window.innerWidth - buttonRect.right}px`;
        modal.style.left = 'auto';
    }

    isMobile() {
        return window.innerWidth <= 768;
    }

    updateFilter(type, value) {
        switch (type) {
            case 'days':
                this.overstockedFilters.daysThreshold = parseInt(value, 10);
                break;
            case 'category':
                this.overstockedFilters.category = value;
                break;
            case 'value':
                this.overstockedFilters.minValue = parseInt(value, 10);
                break;
        }
    }

    async performSearch(query) {
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        if (!pharmacy) {
            this.searchResults = [];
            this.renderSearchResults();
            return;
        }

        const loadingEl = document.getElementById('stock-search-loading');
        const errorEl = document.getElementById('stock-search-error');
        const resultsEl = document.getElementById('stock-search-results');

        // Require at least 3 characters
        if (!query || query.length < 3) {
            this.searchResults = [];
            if (loadingEl) loadingEl.style.display = 'none';
            if (errorEl) {
                errorEl.style.display = 'none';
                errorEl.textContent = '';
            }
            if (resultsEl) resultsEl.style.display = 'none';
            return;
        }

        if (loadingEl) loadingEl.style.display = 'flex';
        if (errorEl) {
            errorEl.style.display = 'none';
            errorEl.textContent = '';
        }

        try {
            const data = await window.api.searchProducts(query, 1, 200);
            
            // Handle multiple response structures
            let items = [];
            if (Array.isArray(data)) {
                items = data;
            } else if (data.items && Array.isArray(data.items)) {
                items = data.items;
            } else if (data.products && Array.isArray(data.products)) {
                items = data.products;
            } else if (data.data && Array.isArray(data.data)) {
                items = data.data;
            }
            
            // Sort results
            const searchLower = query.toLowerCase();
            const sortedItems = items.sort((a, b) => {
                const aCode = (a.product_code || a.stock_code || a.code || a.sku || '').toLowerCase();
                const aDesc = (a.description || a.product_name || a.name || a.title || '').toLowerCase();
                const bCode = (b.product_code || b.stock_code || b.code || b.sku || '').toLowerCase();
                const bDesc = (b.description || b.product_name || b.name || b.title || '').toLowerCase();
                
                // Priority ordering
                if (aCode === searchLower && bCode !== searchLower) return -1;
                if (bCode === searchLower && aCode !== searchLower) return 1;
                if (aDesc === searchLower && bDesc !== searchLower) return -1;
                if (bDesc === searchLower && aDesc !== searchLower) return 1;
                if (aCode.startsWith(searchLower) && !bCode.startsWith(searchLower)) return -1;
                if (bCode.startsWith(searchLower) && !aCode.startsWith(searchLower)) return 1;
                if (aDesc.startsWith(searchLower) && !bDesc.startsWith(searchLower)) return -1;
                if (bDesc.startsWith(searchLower) && !aDesc.startsWith(searchLower)) return 1;
                
                return aDesc.length - bDesc.length;
            });
            
            this.searchResults = sortedItems;
            this.renderSearchResults();
            
        } catch (e) {
            console.error('Stock search error:', e);
            if (errorEl) {
                errorEl.textContent = 'Failed to search products: ' + e.message;
                errorEl.style.display = 'block';
            }
            this.searchResults = [];
            this.renderSearchResults();
        } finally {
            if (loadingEl) loadingEl.style.display = 'none';
        }
    }

    renderSearchResults() {
        const resultsEl = document.getElementById('stock-search-results');
        const resultsListEl = document.getElementById('stock-results-list');
        const resultsCountEl = document.getElementById('stock-results-count');

        if (!resultsEl || !resultsListEl) return;

        if (this.searchResults.length === 0) {
            resultsEl.style.display = 'none';
            return;
        }

        resultsEl.style.display = 'block';

        if (resultsCountEl) {
            const count = this.searchResults.length;
            resultsCountEl.textContent = `Found ${count} product${count === 1 ? '' : 's'}`;
        }

        resultsListEl.innerHTML = '';

        this.searchResults.forEach((item, index) => {
            const productCode = item.product_code || item.stock_code || item.code || item.sku || 'N/A';
            const productName = item.description || item.product_name || item.name || item.title || 'Unknown Product';
            const productId = item.id || index;
            const expandedKey = `${productId}-${productCode}`;
            const isExpanded = this.expandedProducts.has(expandedKey);

            const resultItem = document.createElement('div');
            resultItem.className = 'stock-result-item';

            const itemContent = document.createElement('div');
            itemContent.className = 'stock-result-item-content';

            itemContent.innerHTML = `
                <div class="stock-result-item-info">
                    <div class="stock-result-item-name">${this.escapeHtml(productName)}</div>
                    <div class="stock-result-item-code">${this.escapeHtml(productCode)}</div>
                </div>
                <div class="stock-expand-arrow${isExpanded ? ' expanded' : ''}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>
            `;

            itemContent.addEventListener('click', () => {
                this.toggleProductDetails(productId, productCode, item);
            });

            resultItem.appendChild(itemContent);

            // Add expanded details if applicable
            if (isExpanded) {
                const detailsContainer = this.createProductDetails(productId, productCode);
                if (detailsContainer) {
                    resultItem.appendChild(detailsContainer);
                }
            }

            resultsListEl.appendChild(resultItem);
        });
    }

    async toggleProductDetails(productId, productCode, item) {
        const expandedKey = `${productId}-${productCode}`;
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const date = window.datePicker?.getSelectedDate();

        if (this.expandedProducts.has(expandedKey)) {
            // Collapse
            this.expandedProducts.delete(expandedKey);
            delete this.productDetails[expandedKey];
            this.renderSearchResults();
        } else {
            // Expand
            this.expandedProducts.add(expandedKey);
            
            // Show loading state
            this.productDetails[expandedKey] = {
                loading: true,
                data: null,
                error: null,
                chartLoading: true,
                onHand: 0
            };
            this.renderSearchResults();

            try {
                // Fetch SOH and sales details in parallel
                const [sohData, details] = await Promise.all([
                    window.api.getProductStock(productCode, pharmacy.id, date).catch(e => ({ on_hand: 0 })),
                    this.fetchProductDetails(productCode, pharmacy.id, date, false)
                ]);

                const onHand = Number(sohData.on_hand || 0);

                // Update details with SOH
                if (details && details.summary) {
                    details.summary.on_hand = onHand;
                }

                // Update with quick data, keep chart loading
                this.productDetails[expandedKey] = {
                    loading: false,
                    data: details,
                    error: details ? null : 'No sales data for selected period',
                    chartLoading: true,
                    onHand: onHand
                };
                this.renderSearchResults();

                // Now fetch monthly data separately
                const monthlyData = await this.fetchMonthlyData(productCode, pharmacy.id, date);

                if (this.productDetails[expandedKey] && this.productDetails[expandedKey].data) {
                    this.productDetails[expandedKey].data.monthly = monthlyData;
                    this.productDetails[expandedKey].chartLoading = false;
                    this.renderSearchResults();
                }
            } catch (e) {
                console.error('Error fetching product details:', e);
                this.productDetails[expandedKey] = {
                    loading: false,
                    data: null,
                    error: e.message,
                    chartLoading: false,
                    onHand: 0
                };
                this.renderSearchResults();
            }
        }
    }

    async fetchProductDetails(productCode, pharmacyId, endDate, includeMonthly = true) {
        try {
            // Calculate date range (last 3 months)
            const endDateObj = new Date(endDate + 'T00:00:00');
            const startDateObj = new Date(endDateObj);
            startDateObj.setMonth(startDateObj.getMonth() - 3);
            const startDate = this.formatYmdLocal(startDateObj);

            const raw = await window.api.getProductSales(productCode, startDate, endDate, pharmacyId);

            // Parse daily data
            let daily = [];
            if (Array.isArray(raw.daily)) {
                daily = raw.daily;
            } else if (Array.isArray(raw.items)) {
                daily = raw.items;
            } else if (Array.isArray(raw)) {
                daily = raw;
            }

            // Extract summary fields
            let totalQty = raw.summary?.total_qty_sold ?? raw.total_qty_sold ?? 0;
            let totalSales = raw.summary?.total_sales_value ?? raw.total_sales_value ?? 0;
            let totalCost = raw.summary?.total_cost_of_sales ?? raw.total_cost_of_sales ?? 0;
            let totalGp = raw.summary?.total_gp_value ?? raw.total_gp_value ?? 0;
            let avgGpPct = raw.summary?.avg_gp_percentage ?? raw.avg_gp_percentage ?? 0;

            // Compute from daily data if needed
            if (!totalQty) {
                totalQty = daily.reduce((sum, d) => sum + (Number(d.qty_sold || d.quantity || 0) || 0), 0);
            }
            if (!totalSales) {
                totalSales = daily.reduce((sum, d) => sum + (Number(d.sales_val || d.sales_value || 0) || 0), 0);
            }
            if (!totalCost) {
                totalCost = daily.reduce((sum, d) => sum + (Number(d.cost_of_sales || d.cost || 0) || 0), 0);
            }
            if (!totalGp) {
                totalGp = daily.reduce((sum, d) => sum + (Number(d.gp_value || d.gp || 0) || 0), 0);
            }
            if (!avgGpPct && totalSales > 0) {
                avgGpPct = (totalGp / totalSales) * 100;
            }

            // Calculate 180-day average
            const avg180 = await this.computeAvgQtyOverDays(productCode, pharmacyId, 180, endDate);

            const result = {
                summary: {
                    total_qty_sold: Number(totalQty) || 0,
                    total_sales_value: Number(totalSales) || 0,
                    total_cost_of_sales: Number(totalCost) || 0,
                    total_gp_value: Number(totalGp) || 0,
                    avg_gp_percentage: Number(Math.round((avgGpPct + Number.EPSILON) * 100) / 100) || 0,
                    on_hand: 0
                },
                daily: daily,
                avg_180d_qty: Number(avg180) || 0
            };

            if (includeMonthly) {
                result.monthly = await this.fetchMonthlyData(productCode, pharmacyId, endDate);
            }

            return result;
        } catch (e) {
            console.error('Error fetching product details:', e);
            return null;
        }
    }

    async fetchMonthlyData(productCode, pharmacyId, endDate) {
        try {
            const endDateObj = new Date(endDate + 'T00:00:00');
            const monthlyData = [];

            for (let i = 11; i >= 0; i--) {
                const monthDate = new Date(endDateObj);
                monthDate.setMonth(monthDate.getMonth() - i);

                const year = monthDate.getFullYear();
                const month = monthDate.getMonth();
                const firstDay = new Date(year, month, 1);
                let lastDay = new Date(year, month + 1, 0);

                if (lastDay > endDateObj) {
                    lastDay = endDateObj;
                }

                const fromStr = this.formatYmdLocal(firstDay);
                const toStr = this.formatYmdLocal(lastDay);

                let monthlyQty = 0;

                try {
                    const data = await window.api.getProductSales(productCode, fromStr, toStr, pharmacyId);

                    if (data.summary?.total_qty_sold !== undefined) {
                        monthlyQty = Number(data.summary.total_qty_sold) || 0;
                    } else if (data.total_qty_sold !== undefined) {
                        monthlyQty = Number(data.total_qty_sold) || 0;
                    } else {
                        let dailyArr = [];
                        if (Array.isArray(data.daily)) dailyArr = data.daily;
                        else if (Array.isArray(data.items)) dailyArr = data.items;
                        else if (Array.isArray(data)) dailyArr = data;

                        monthlyQty = dailyArr.reduce((sum, d) => sum + (Number(d.qty_sold || d.quantity || 0) || 0), 0);
                    }
                } catch (e) {
                    console.log('Failed to fetch month data:', e);
                }

                const monthNum = month + 1;
                const yearShort = year.toString().slice(-2);
                const monthLabel = String(monthNum).padStart(2, '0') + '/' + yearShort;

                monthlyData.push({
                    month: monthLabel,
                    qty: monthlyQty
                });
            }

            return monthlyData;
        } catch (e) {
            console.error('Error fetching monthly data:', e);
            return [];
        }
    }

    async computeAvgQtyOverDays(productCode, pharmacyId, numDays, endDate) {
        try {
            const endDateObj = new Date(endDate + 'T00:00:00');
            const startDateObj = new Date(endDateObj);
            startDateObj.setDate(startDateObj.getDate() - (numDays - 1));
            const fromStr = this.formatYmdLocal(startDateObj);

            const data = await window.api.getProductSales(productCode, fromStr, endDate, pharmacyId);

            let dailyArr = [];
            if (Array.isArray(data.daily)) dailyArr = data.daily;
            else if (Array.isArray(data.items)) dailyArr = data.items;
            else if (Array.isArray(data)) dailyArr = data;

            const totalFromDaily = dailyArr.reduce((sum, d) => sum + (Number(d.qty_sold || d.quantity || 0) || 0), 0);
            const summaryQty = Number(data.summary?.total_qty_sold || data.total_qty_sold || 0);
            const pickedTotal = (dailyArr.length > 0 ? totalFromDaily : 0) || summaryQty || 0;

            if (pickedTotal > 0) {
                return pickedTotal / numDays;
            }

            return 0;
        } catch (e) {
            return 0;
        }
    }

    createProductDetails(productId, productCode) {
        const expandedKey = `${productId}-${productCode}`;
        const details = this.productDetails[expandedKey];

        if (!details) return null;

        const container = document.createElement('div');
        container.className = 'stock-product-details-container';

        if (details.loading) {
            container.innerHTML = '<div class="stock-details-loading">Loading details...</div>';
            return container;
        }

        if (details.error) {
            container.innerHTML = `<div class="stock-details-error">${this.escapeHtml(details.error)}</div>`;
            return container;
        }

        if (!details.data) {
            container.innerHTML = '<div class="stock-details-error">No data available</div>';
            return container;
        }

        const data = details.data;
        const summary = data.summary || {};
        const daily = Array.isArray(data.daily) ? data.daily : (Array.isArray(data.items) ? data.items : []);

        const detailsContent = document.createElement('div');
        detailsContent.className = 'stock-details-content';

        // Create wrapper for chart and summary grid
        const chartSummaryWrapper = document.createElement('div');
        chartSummaryWrapper.className = 'stock-chart-summary-wrapper';

        // Summary Grid
        const summaryGrid = document.createElement('div');
        summaryGrid.className = 'stock-details-summary-grid';

        const qtyForCalc = Number(summary.total_qty_sold) || 0;
        const unitPrice = qtyForCalc > 0 ? (Number(summary.total_sales_value) || 0) / qtyForCalc : 0;
        const unitCost = qtyForCalc > 0 ? (Number(summary.total_cost_of_sales) || 0) / qtyForCalc : 0;

        summaryGrid.innerHTML = `
            <div class="stock-summary-card soh-card">
                <div class="stock-summary-label">SOH</div>
                <div class="stock-summary-value">${Number(summary.on_hand || 0).toFixed(1)}</div>
            </div>
            <div class="stock-summary-card sales-card">
                <div class="stock-summary-label">Unit Price</div>
                <div class="stock-summary-value">R ${unitPrice.toFixed(2)}</div>
            </div>
            <div class="stock-summary-card daily-avg-card">
                <div class="stock-summary-label">Daily Avg</div>
                <div class="stock-summary-value">${Number(data.avg_180d_qty || 0).toFixed(1)}</div>
            </div>
            <div class="stock-summary-card gp-card">
                <div class="stock-summary-label">GP%</div>
                <div class="stock-summary-value">${Number(summary.avg_gp_percentage || 0).toFixed(2)}%</div>
            </div>
            <div class="stock-summary-card cost-card">
                <div class="stock-summary-label">Unit Cost</div>
                <div class="stock-summary-value">R ${unitCost.toFixed(2)}</div>
            </div>
            <div class="stock-summary-card month-avg-card">
                <div class="stock-summary-label">Mnth Avg</div>
                <div class="stock-summary-value">${(Number(data.avg_180d_qty || 0) * 30).toFixed(1)}</div>
            </div>
        `;

        chartSummaryWrapper.appendChild(summaryGrid);

        // Bar chart
        const chartLoading = details.chartLoading === true;
        if (chartLoading) {
            const loadingChart = this.createBarChartLoading();
            chartSummaryWrapper.appendChild(loadingChart);
        } else if (data.monthly && Array.isArray(data.monthly) && data.monthly.length > 0) {
            const chartContainer = this.createBarChart(data.monthly);
            if (chartContainer) {
                chartSummaryWrapper.appendChild(chartContainer);
            }
        }

        detailsContent.appendChild(chartSummaryWrapper);

        // Daily breakdown
        if (daily.length > 0) {
            const dailyContainer = document.createElement('div');
            dailyContainer.className = 'stock-daily-breakdown';

            daily.slice(0, 14).forEach(detail => {
                const detailItem = document.createElement('div');
                detailItem.className = 'stock-detail-item';
                const dateStr = detail.date || detail.business_date || 'Date';
                const qty = Number(detail.qty_sold || detail.quantity || 0);
                detailItem.innerHTML = `
                    <div class="stock-detail-label">${dateStr}</div>
                    <div class="stock-detail-value">${qty}</div>
                `;
                dailyContainer.appendChild(detailItem);
            });

            detailsContent.appendChild(dailyContainer);
        }

        container.appendChild(detailsContent);
        return container;
    }

    createBarChartLoading() {
        const card = document.createElement('div');
        card.className = 'stock-monthly-chart-card';

        card.innerHTML = `
            <div class="stock-chart-header">
                <span class="stock-chart-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="4" height="18"></rect>
                        <rect x="10" y="8" width="4" height="13"></rect>
                        <rect x="17" y="12" width="4" height="9"></rect>
                    </svg>
                </span>
                <h3 class="stock-chart-title">Monthly Sales</h3>
            </div>
            <div class="stock-chart-loading">
                <div class="spinner-small"></div>
                <span>Loading Data...</span>
            </div>
        `;

        return card;
    }

    createBarChart(monthlyData) {
        if (!monthlyData || monthlyData.length === 0) return null;

        const card = document.createElement('div');
        card.className = 'stock-monthly-chart-card';

        const header = document.createElement('div');
        header.className = 'stock-chart-header';
        header.innerHTML = `
            <span class="stock-chart-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="4" height="18"></rect>
                    <rect x="10" y="8" width="4" height="13"></rect>
                    <rect x="17" y="12" width="4" height="9"></rect>
                </svg>
            </span>
            <h3 class="stock-chart-title">Monthly Sales</h3>
        `;

        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'stock-bar-chart-wrapper';

        const maxQty = Math.max(...monthlyData.map(d => d.qty || 0)) || 1;

        monthlyData.forEach(monthData => {
            const barGroup = document.createElement('div');
            barGroup.className = 'stock-bar-group';

            const barContainer = document.createElement('div');
            barContainer.className = 'stock-bar-container';

            const bar = document.createElement('div');
            bar.className = 'stock-bar';
            const heightPercent = maxQty > 0 ? (monthData.qty / maxQty) * 100 : 0;
            bar.style.height = `${heightPercent}%`;
            bar.style.minHeight = monthData.qty > 0 ? '3px' : '0';

            const tooltip = document.createElement('div');
            tooltip.className = 'stock-bar-tooltip';
            tooltip.textContent = monthData.qty;

            barContainer.appendChild(bar);
            barContainer.appendChild(tooltip);
            barGroup.appendChild(barContainer);

            const label = document.createElement('div');
            label.className = 'stock-bar-label';
            label.textContent = monthData.month;
            barGroup.appendChild(label);

            // Touch handlers for mobile
            let touchTimeout = null;
            barGroup.addEventListener('touchstart', (e) => {
                e.preventDefault();
                barGroup.classList.add('touched');
                clearTimeout(touchTimeout);
                touchTimeout = setTimeout(() => barGroup.classList.remove('touched'), 2000);
            });

            barGroup.addEventListener('touchend', (e) => {
                e.preventDefault();
                clearTimeout(touchTimeout);
                touchTimeout = setTimeout(() => barGroup.classList.remove('touched'), 2000);
            });

            chartWrapper.appendChild(barGroup);
        });

        card.appendChild(header);
        card.appendChild(chartWrapper);
        return card;
    }

    async loadOverstocked() {
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const date = window.datePicker?.getSelectedDate();
        
        if (!pharmacy || !date) return;

        const loadingEl = document.getElementById('overstocked-loading');
        const errorEl = document.getElementById('overstocked-error');
        const resultsEl = document.getElementById('overstocked-results');
        const resultsCountEl = document.getElementById('overstocked-results-count');
        const resultsListEl = document.getElementById('overstocked-results-list');

        if (loadingEl) loadingEl.style.display = 'flex';
        if (errorEl) errorEl.style.display = 'none';
        if (resultsEl) resultsEl.style.display = 'none';

        try {
            // Step 1: Fetch stock activity data from external pharmacy API
            // Uses: GET /pharmacies/{pid}/stock-activity/by-quantity?date=YYYY-MM-DD&limit=100
            // (Same endpoint as old app's /api/best-sellers)
            console.log('Fetching best sellers for overstocked analysis...');
            const stockData = await window.api.getBestSellers(pharmacy.id, date, null, null, 100);
            console.log('Best sellers response:', stockData);
            
            // Parse response
            let items = [];
            if (Array.isArray(stockData)) {
                items = stockData;
            } else if (stockData.best_sellers && Array.isArray(stockData.best_sellers)) {
                items = stockData.best_sellers;
            } else if (stockData.items && Array.isArray(stockData.items)) {
                items = stockData.items;
            }
            
            console.log('Parsed stock activity items:', items.length);

            // Step 2: Build usage map from 180d averages
            const usageMap = {};
            
            try {
                const usageRes = await window.api.getUsageTop180d(pharmacy.id, 200);
                const usageArr = Array.isArray(usageRes) ? usageRes : (usageRes.items || []);
                
                usageArr.forEach(u => {
                    if (u && u.product_code && typeof u.avg_qty_180d === 'number') {
                        usageMap[u.product_code] = u.avg_qty_180d;
                    }
                });
            } catch (e) {
                console.warn('Failed to fetch usage data:', e);
            }

            // Step 3: Fetch missing product usage individually
            const missingCodes = Array.from(new Set(
                items
                    .map(p => p.product_code || p.stock_code || p.code)
                    .filter(c => c && usageMap[c] === undefined)
            ));

            if (missingCodes.length > 0) {
                const perProductResults = await Promise.allSettled(
                    missingCodes.map(code => 
                        window.api.getProductUsage(pharmacy.id, code).catch(() => null)
                    )
                );
                
                perProductResults.forEach((res, idx) => {
                    if (res.status === 'fulfilled' && res.value && typeof res.value.avg_qty_180d === 'number') {
                        usageMap[missingCodes[idx]] = res.value.avg_qty_180d;
                    }
                });
            }

            // Step 4: Fetch monthly sales data for current month
            const dateObj = new Date(date + 'T00:00:00');
            const currentYear = dateObj.getFullYear();
            const currentMonth = dateObj.getMonth();
            const monthStart = new Date(currentYear, currentMonth, 1);
            const monthStartStr = this.formatYmdLocal(monthStart);
            const monthEndStr = date;

            // Fetch monthly sales for all products
            const monthlySalesPromises = items.map(product => {
                const code = product.product_code || product.stock_code || product.code || '';
                if (!code) return Promise.resolve({ code, monthlyQty: 0 });
                
                return window.api.getProductSales(code, monthStartStr, monthEndStr, pharmacy.id)
                    .then(data => {
                        let monthlyQty = 0;
                        if (data.summary?.total_qty_sold !== undefined) {
                            monthlyQty = Number(data.summary.total_qty_sold) || 0;
                        } else if (data.total_qty_sold !== undefined) {
                            monthlyQty = Number(data.total_qty_sold) || 0;
                        } else {
                            let dailyArr = [];
                            if (Array.isArray(data.daily)) dailyArr = data.daily;
                            else if (Array.isArray(data.items)) dailyArr = data.items;
                            else if (Array.isArray(data)) dailyArr = data;
                            
                            monthlyQty = dailyArr.reduce((sum, d) => sum + (Number(d.qty_sold || d.quantity || 0) || 0), 0);
                        }
                        return { code, monthlyQty };
                    })
                    .catch(() => ({ code, monthlyQty: 0 }));
            });

            const monthlySalesResults = await Promise.all(monthlySalesPromises);
            const monthlySalesMap = {};
            monthlySalesResults.forEach(result => {
                monthlySalesMap[result.code] = result.monthlyQty;
            });

            // Step 5: Calculate days of stock and process data
            const { daysThreshold, category, minValue } = this.overstockedFilters;
            
            const processedData = items.map(product => {
                const code = product.product_code || product.stock_code || product.code || '';
                
                // Extract stock on hand
                const onHandRaw = product.on_hand !== undefined ? product.on_hand : (product.currentSOH !== undefined ? product.currentSOH : 0);
                const onHand = Number(onHandRaw);
                
                // Get 180-day average daily usage
                const avg180 = usageMap[code] || 0;
                const avgDailyUsage = typeof avg180 === 'number' && isFinite(avg180) ? avg180 : 0;
                
                // Calculate unit cost
                const qtySold = Number(product.qty_sold || product.sales_qty || 0);
                const costOfSales = Number(product.cost_of_sales || 0);
                const unitCost = qtySold > 0 ? costOfSales / qtySold : 0;
                
                // Calculate days of stock
                const days = (avgDailyUsage > 0.1) ? (onHand / avgDailyUsage) : 0;
                
                // Round SOH to 1 decimal place
                const roundedSOH = isFinite(onHand) ? Math.round(onHand * 10) / 10 : 0;
                
                // Calculate stock value
                const stockValue = unitCost * roundedSOH;
                
                return {
                    ...product,
                    currentSOH: roundedSOH,
                    daysOfStock: Math.min(Math.round(days), 45),
                    costPerUnit: unitCost,
                    departmentCode: product.department_code || product.departmentCode || '',
                    description: product.description || product.productName || product.name || 'Unknown Product',
                    stock_code: code,
                    avgDailyUsage: avgDailyUsage,
                    stock_value: stockValue
                };
            });

            // Step 6: Filter by days threshold
            let filteredItems = processedData.filter(product => {
                return (product.daysOfStock || 0) >= daysThreshold;
            });

            // Step 7: Apply category and value filters
            filteredItems = filteredItems.filter(product => {
                // Category filter
                if (category !== 'all') {
                    const itemCategory = this.getDepartmentCategory(product.departmentCode || '');
                    if (itemCategory !== category) return false;
                }
                
                // Value filter
                const stockValue = product.stock_value || 0;
                const meetsThreshold = stockValue >= minValue;
                
                // Special case: PDST products always included
                const isPDST = (product.departmentCode || '').toUpperCase().startsWith('PDST');
                if (isPDST) return true;
                
                return meetsThreshold;
            });

            // Step 8: Sort by days of stock (descending)
            filteredItems.sort((a, b) => {
                return (b.daysOfStock || 0) - (a.daysOfStock || 0);
            });

            // Step 9: Limit to 200 items
            if (filteredItems.length > 200) {
                filteredItems = filteredItems.slice(0, 200);
            }

            this.overstockedResults = filteredItems;
            
            // Render results
            if (resultsCountEl) {
                resultsCountEl.textContent = `Found ${filteredItems.length} overstocked product${filteredItems.length === 1 ? '' : 's'}`;
            }
            
            if (resultsListEl) {
                resultsListEl.innerHTML = '';
                
                filteredItems.forEach((item, index) => {
                    const productCode = item.product_code || item.stock_code || item.code || 'N/A';
                    const productName = item.description || item.product_name || item.name || 'Unknown';
                    const daysOfStock = Number(item.daysOfStock || 0);
                    const stockValue = Number(item.stock_value || 0);
                    
                    const resultItem = document.createElement('div');
                    resultItem.className = 'stock-result-item simple';
                    resultItem.innerHTML = `
                        <div class="stock-result-item-info">
                            <div class="stock-result-item-name">${this.escapeHtml(productName)}</div>
                            <div class="stock-result-item-code">${this.escapeHtml(productCode)}</div>
                        </div>
                        <div class="stock-result-item-stats">
                            <div class="stock-result-item-value warning">${daysOfStock} days</div>
                            <div class="stock-result-item-subvalue">R ${stockValue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                    `;
                    resultsListEl.appendChild(resultItem);
                });
            }
            
            if (resultsEl) resultsEl.style.display = 'block';
            
        } catch (e) {
            console.error('Error loading overstocked:', e);
            if (errorEl) {
                errorEl.textContent = 'Failed to load overstocked products: ' + e.message;
                errorEl.style.display = 'block';
            }
        } finally {
            if (loadingEl) loadingEl.style.display = 'none';
        }
    }

    async loadNegativeStock() {
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        const date = window.datePicker?.getSelectedDate();
        
        if (!pharmacy || !date) return;

        const loadingEl = document.getElementById('negativestock-loading');
        const errorEl = document.getElementById('negativestock-error');
        const resultsEl = document.getElementById('negativestock-results');
        const resultsCountEl = document.getElementById('negativestock-results-count');
        const resultsListEl = document.getElementById('negativestock-results-list');

        if (loadingEl) loadingEl.style.display = 'flex';
        if (errorEl) errorEl.style.display = 'none';
        if (resultsEl) resultsEl.style.display = 'none';

        try {
            const data = await window.api.getNegativeStock(pharmacy.id, date, 200);
            
            // Parse response
            let items = [];
            if (Array.isArray(data)) {
                items = data;
            } else if (data.negative_stock) {
                items = data.negative_stock;
            } else if (data.items) {
                items = data.items;
            }

            this.negativeStockResults = items;
            
            // Render results
            if (resultsCountEl) {
                resultsCountEl.textContent = `Found ${items.length} product${items.length === 1 ? '' : 's'} with negative stock`;
            }
            
            if (resultsListEl) {
                resultsListEl.innerHTML = '';
                
                items.forEach((item, index) => {
                    const productCode = item.product_code || item.stock_code || item.code || 'N/A';
                    const productName = item.description || item.product_name || item.name || 'Unknown';
                    const onHand = Number(item.on_hand || item.soh || item.qty || 0);
                    
                    const resultItem = document.createElement('div');
                    resultItem.className = 'stock-result-item simple';
                    resultItem.innerHTML = `
                        <div class="stock-result-item-info">
                            <div class="stock-result-item-name">${this.escapeHtml(productName)}</div>
                            <div class="stock-result-item-code">${this.escapeHtml(productCode)}</div>
                        </div>
                        <div class="stock-result-item-stats">
                            <div class="stock-result-item-value negative">${onHand.toFixed(1)}</div>
                        </div>
                    `;
                    resultsListEl.appendChild(resultItem);
                });
            }
            
            if (resultsEl) resultsEl.style.display = 'block';
            
        } catch (e) {
            console.error('Error loading negative stock:', e);
            if (errorEl) {
                errorEl.textContent = 'Failed to load negative stock: ' + e.message;
                errorEl.style.display = 'block';
            }
        } finally {
            if (loadingEl) loadingEl.style.display = 'none';
        }
    }

    getDepartmentCategory(departmentCode) {
        if (!departmentCode) return 'other';
        const code = departmentCode.toUpperCase();
        
        if (code.startsWith('PDST')) return 'dispensary';
        if (code.startsWith('PDOB')) return 'self-medication';
        if (code.startsWith('GIT') || code.includes('GIT')) return 'git';
        if (code.includes('VIT') || code.includes('VITAMIN')) return 'vitamins';
        if (code.includes('FIRST') || code.includes('AID') || code.includes('FA')) return 'first-aid';
        if (code.includes('SPORT')) return 'sports';
        if (code.includes('HEALTH') || code.includes('FOOD')) return 'health-foods';
        if (code.includes('BEAUTY') || code.includes('COSMETIC')) return 'beauty';
        if (code.includes('BATH') || code.includes('BODY')) return 'bath-body';
        if (code.includes('BABY') || code.includes('INFANT')) return 'baby';
        if (code.includes('GIFT')) return 'gifts';
        
        return 'other';
    }

    formatYmdLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    showEmptyState(message = 'Please select a pharmacy and date to view stock queries') {
        const mainContent = document.querySelector('.content-area');
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <h3>Stock Queries</h3>
                <p>${message}</p>
            </div>
        `;
    }

    showError(error) {
        const mainContent = document.querySelector('.content-area');
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div class="error-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3>Error Loading Data</h3>
                <p>${error.message || 'An unexpected error occurred'}</p>
            </div>
        `;
    }
}

// Export for use in app.js
window.StockQueriesScreen = StockQueriesScreen;

