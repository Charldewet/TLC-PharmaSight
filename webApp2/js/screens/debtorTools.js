// Debtor Tools Screen
// Debtor management with statistics

class DebtorToolsScreen {
    constructor() {
        this.statistics = null;
        this.searchQuery = '';
        this.minBalance = 100;
        this.selectedAgeingBuckets = ['current', 'd30', 'd60', 'd90', 'd120', 'd150', 'd180'];
        this.allDebtors = [];
        this.sortColumn = null;
        this.sortOrder = 'asc';
    }

    async load() {
        console.log('Loading Debtor Tools...');
        
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        
        if (!pharmacy) {
            console.warn('Missing pharmacy selection');
            this.showEmptyState();
            return;
        }

        // Show loading overlay
        if (window.loadingOverlay) {
            window.loadingOverlay.show('Loading debtor statistics...');
        }

        try {
            await this.loadStatistics(pharmacy.id);
            this.render();
        } catch (error) {
            console.error('Error loading debtor tools:', error);
            this.showError(error);
        } finally {
            // Hide loading overlay
            if (window.loadingOverlay) {
                window.loadingOverlay.hide();
            }
        }
    }

    async loadStatistics(pharmacyId) {
        try {
            // Debtor API endpoints use external API with JWT Bearer token (not API key)
            const baseUrl = 'https://pharmacy-api-webservice.onrender.com';
            const url = `${baseUrl}/pharmacies/${pharmacyId}/debtors/statistics`;
            
            // Get JWT token from Auth (not API key)
            let jwtToken = null;
            if (typeof Auth !== 'undefined') {
                const authData = Auth.getAuthData();
                jwtToken = authData.token;
            }
            
            if (!jwtToken) {
                console.error('No JWT token available for debtor API');
                this.statistics = {
                    total_accounts: 0,
                    total_outstanding: 0,
                    current: 0,
                    d30: 0,
                    d60: 0,
                    d90: 0,
                    d120: 0,
                    d150: 0,
                    d180: 0
                };
                return;
            }
            
            console.log('Fetching debtor statistics from:', url);
            
            const response = await window.fetch(url, {
                headers: {
                    'Authorization': `Bearer ${jwtToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                // If 404, backend endpoints not implemented yet - this is OK
                if (response.status === 404) {
                    console.log('Debtor statistics endpoint not available yet');
                    this.statistics = {
                        total_accounts: 0,
                        total_outstanding: 0,
                        current: 0,
                        d30: 0,
                        d60: 0,
                        d90: 0,
                        d120: 0,
                        d150: 0,
                        d180: 0
                    };
                    return;
                }
                throw new Error('Failed to fetch statistics');
            }
            
            const data = await response.json();
            if (data) {
                this.statistics = data;
            } else {
                this.statistics = {
                    total_accounts: 0,
                    total_outstanding: 0,
                    current: 0,
                    d30: 0,
                    d60: 0,
                    d90: 0,
                    d120: 0,
                    d150: 0,
                    d180: 0
                };
            }
        } catch (error) {
            console.error('Failed to fetch statistics:', error);
            // Set default values on error
            this.statistics = {
                total_accounts: 0,
                total_outstanding: 0,
                current: 0,
                d30: 0,
                d60: 0,
                d90: 0,
                d120: 0,
                d150: 0,
                d180: 0
            };
        }
    }

    getCardIcon(title) {
        const icons = {
            'Outstanding Balance': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="2" x2="12" y2="22"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>`,
            'Number of Accounts': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>`,
            'Current Balance': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>`
        };
        return icons[title] || '';
    }

    renderTopCard(title, value, format = 'number') {
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
        } else {
            formattedValue = new Intl.NumberFormat('en-ZA', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(numValue));
        }

        const icon = this.getCardIcon(title);

        return `
            <div class="dashboard-top-card">
                <h3 class="dashboard-top-card-title">
                    <span class="dashboard-top-card-icon">${icon}</span>
                    ${title}
                </h3>
                <div class="dashboard-top-card-value-row">
                    <p class="dashboard-top-card-value">${formattedValue}</p>
                </div>
            </div>
        `;
    }

    renderAgeingBucketsCard(stats) {
        const buckets = [
            { key: 'd30', label: '30 Days' },
            { key: 'd60', label: '60 Days' },
            { key: 'd90', label: '90 Days' },
            { key: 'd120', label: '120 Days' },
            { key: 'd150', label: '150 Days' },
            { key: 'd180', label: '180+ Days' }
        ];

        const formatMoney = (value) => {
            if (value === null || value === undefined) return '0.00';
            const num = parseFloat(value);
            if (isNaN(num)) return '0.00';
            return num.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        const formatCurrency = (value) => {
            const numValue = Number(value) || 0;
            if (numValue === 0) {
                return '—';
            }
            return new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(numValue));
        };

        const bucketsHtml = buckets.map((bucket, index) => {
            const value = stats[bucket.key] || 0;
            const isLast = index === buckets.length - 1;
            return `
                <div class="debtor-ageing-item ${isLast ? 'last' : ''}">
                    <div class="debtor-ageing-label">${bucket.label.toUpperCase()}</div>
                    <div class="debtor-ageing-value">${formatCurrency(value)}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="dashboard-bottom-card debtor-ageing-card">
                <h3 class="dashboard-bottom-card-title">
                    <span class="dashboard-top-card-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                    </span>
                    AGEING BUCKETS
                </h3>
                <div class="debtor-ageing-list">
                    ${bucketsHtml}
                </div>
            </div>
        `;
    }

    renderSecondaryCard() {
        const ageingBuckets = [
            { key: 'current', label: 'Current' },
            { key: 'd30', label: '30 Days' },
            { key: 'd60', label: '60 Days' },
            { key: 'd90', label: '90 Days' },
            { key: 'd120', label: '120 Days' },
            { key: 'd150', label: '150 Days' },
            { key: 'd180', label: '180+ Days' }
        ];

        const buttonsHtml = ageingBuckets.map(bucket => {
            const isSelected = this.selectedAgeingBuckets.includes(bucket.key);
            return `
                <button 
                    type="button"
                    class="debtor-ageing-bucket-btn ${isSelected ? 'selected' : ''}"
                    data-bucket="${bucket.key}"
                >
                    ${bucket.label}
                </button>
            `;
        }).join('');

        return `
            <div class="dashboard-bottom-card debtor-secondary-card">
                <h3 class="dashboard-bottom-card-title">
                    <span class="dashboard-top-card-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                        </svg>
                    </span>
                    SEARCH DEBTORS
                </h3>
                <div class="debtor-secondary-content">
                    <div class="debtor-search-container">
                        <input 
                            type="text" 
                            id="debtor-search-input" 
                            class="debtor-search-input" 
                            placeholder="Search by name, surname or account number..."
                            autocomplete="off"
                        />
                        
                        <div class="debtor-filters-section">
                            <div class="debtor-balance-filter">
                                <label class="debtor-filter-label">
                                    <span>Minimum Balance: R <span id="debtor-min-balance-value">${this.minBalance.toLocaleString()}</span></span>
                                    <div class="debtor-slider-container">
                                        <input 
                                            type="range" 
                                            id="debtor-min-balance-slider" 
                                            min="0" 
                                            max="5000" 
                                            step="50" 
                                            value="${this.minBalance}"
                                            class="debtor-balance-slider"
                                        />
                                    </div>
                                </label>
                            </div>
                            
                            <div class="debtor-ageing-filter">
                                <label class="debtor-filter-label">
                                    <span>Ageing Buckets</span>
                                    <div class="debtor-bucket-buttons">
                                        ${buttonsHtml}
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        <div class="debtor-action-buttons">
                            <button class="debtor-action-btn debtor-email-btn" id="debtor-send-email-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <polyline points="22,6 12,13 2,6"></polyline>
                                </svg>
                                Send Emails
                            </button>
                            <button class="debtor-action-btn debtor-sms-btn" id="debtor-send-sms-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                                Send SMS
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupSearchHandlers(pharmacyId) {
        const searchInput = document.getElementById('debtor-search-input');
        const balanceSlider = document.getElementById('debtor-min-balance-slider');
        const balanceValue = document.getElementById('debtor-min-balance-value');
        const bucketButtons = document.querySelectorAll('.debtor-ageing-bucket-btn');
        
        if (!searchInput) return;

        let searchTimeout;
        
        // Search input handler
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            this.searchQuery = query;
            
            clearTimeout(searchTimeout);
            
            // Update the main debtors table with search query (debounced)
            searchTimeout = setTimeout(() => {
                this.loadDebtors(pharmacyId);
            }, 300);
        });

        // Handle Enter key
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(searchTimeout);
                this.loadDebtors(pharmacyId);
            }
        });

        // Balance slider handler
        if (balanceSlider && balanceValue) {
            balanceSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.minBalance = value;
                balanceValue.textContent = value.toLocaleString();
                
                // Reload debtors table with new filters
                this.loadDebtors(pharmacyId);
            });
        }

        // Ageing bucket buttons handler
        bucketButtons.forEach(button => {
            button.addEventListener('click', () => {
                const bucket = button.dataset.bucket;
                const isSelected = this.selectedAgeingBuckets.includes(bucket);
                
                console.log('Bucket clicked:', bucket, 'Currently selected:', isSelected);
                
                if (isSelected) {
                    // Uncheck - remove from selected (turn grey)
                    this.selectedAgeingBuckets = this.selectedAgeingBuckets.filter(b => b !== bucket);
                    button.classList.remove('selected');
                } else {
                    // Check - add to selected (turn orange)
                    this.selectedAgeingBuckets.push(bucket);
                    button.classList.add('selected');
                }
                
                console.log('Selected buckets after click:', this.selectedAgeingBuckets);
                
                // Reload debtors table with new filters
                this.loadDebtors(pharmacyId);
            });
        });

        // Action buttons handlers
        const sendEmailBtn = document.getElementById('debtor-send-email-btn');
        const sendSmsBtn = document.getElementById('debtor-send-sms-btn');
        
        if (sendEmailBtn) {
            sendEmailBtn.addEventListener('click', () => {
                this.showComingSoonModal('Send Emails', 'Email functionality is coming soon.');
            });
        }
        
        if (sendSmsBtn) {
            sendSmsBtn.addEventListener('click', () => {
                this.showComingSoonModal('Send SMS', 'SMS functionality is coming soon.');
            });
        }

        // Modal close handler
        const modalClose = document.getElementById('coming-soon-modal-close');
        const modalOverlay = document.getElementById('coming-soon-modal-overlay');
        
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                this.hideComingSoonModal();
            });
        }
        
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    this.hideComingSoonModal();
                }
            });
        }

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('active')) {
                this.hideComingSoonModal();
            }
        });
    }

    showComingSoonModal(title, message) {
        const modalOverlay = document.getElementById('coming-soon-modal-overlay');
        const modalTitle = document.getElementById('coming-soon-modal-title');
        const modalMessage = document.getElementById('coming-soon-modal-message');
        
        if (modalOverlay && modalTitle && modalMessage) {
            modalTitle.textContent = title;
            modalMessage.textContent = message;
            modalOverlay.classList.add('active');
        }
    }

    hideComingSoonModal() {
        const modalOverlay = document.getElementById('coming-soon-modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('active');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    render() {
        const container = document.querySelector('.content-area');
        if (!container) {
            console.error('Content area not found');
            return;
        }

        const stats = this.statistics || {
            total_accounts: 0,
            total_outstanding: 0,
            current: 0,
            d30: 0,
            d60: 0,
            d90: 0,
            d120: 0,
            d150: 0,
            d180: 0
        };

        container.innerHTML = `
            <div class="dashboard-container">
                <div class="debtor-cards-wrapper">
                    <div class="dashboard-top-cards debtor-top-cards">
                        ${this.renderTopCard('Outstanding Balance', stats.total_outstanding, 'currency')}
                        ${this.renderTopCard('Number of Accounts', stats.total_accounts, 'number')}
                        ${this.renderTopCard('Current Balance', stats.current, 'currency')}
                    </div>
                    <div class="debtor-ageing-wrapper">
                        ${this.renderAgeingBucketsCard(stats)}
                    </div>
                    <div class="debtor-secondary-card-wrapper">
                        ${this.renderSecondaryCard()}
                    </div>
                </div>
                <div class="debtor-table-wrapper">
                    ${this.renderDebtorsTable()}
                </div>
            </div>
        `;

        // Setup search handlers and load debtors after rendering
        const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
        if (pharmacy && pharmacy.id) {
            setTimeout(() => {
                this.setupSearchHandlers(pharmacy.id);
                this.loadDebtors(pharmacy.id);
                // Initialize sort icons after table is rendered
                setTimeout(() => {
                    this.updateSortIcons();
                }, 200);
            }, 100);
        }
    }

    renderDebtorsTable() {
        return `
            <div class="dashboard-bottom-card debtor-table-card">
                <h3 class="dashboard-bottom-card-title">
                    <span class="dashboard-top-card-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </span>
                    DEBTORS
                </h3>
                <div class="debtor-table-container">
                    <table class="debtor-table">
                        <thead>
                            <tr>
                                <th class="debtor-table-checkbox"><input type="checkbox" id="debtor-select-all" /></th>
                                <th class="debtor-table-sortable" data-column="acc_no">Account <span class="sort-icon"></span></th>
                                <th class="debtor-table-sortable" data-column="name">Name <span class="sort-icon"></span></th>
                                <th class="debtor-table-sortable" data-column="current">Current <span class="sort-icon"></span></th>
                                <th class="debtor-table-sortable" data-column="d30">30D <span class="sort-icon"></span></th>
                                <th class="debtor-table-sortable" data-column="d60">60D <span class="sort-icon"></span></th>
                                <th class="debtor-table-sortable" data-column="d90">90D <span class="sort-icon"></span></th>
                                <th class="debtor-table-sortable" data-column="d120">120D <span class="sort-icon"></span></th>
                                <th class="debtor-table-sortable" data-column="d150">150D <span class="sort-icon"></span></th>
                                <th class="debtor-table-sortable" data-column="d180">180D <span class="sort-icon"></span></th>
                                <th class="debtor-table-sortable" data-column="balance">Balance <span class="sort-icon"></span></th>
                                <th class="debtor-table-sortable" data-column="email">Email <span class="sort-icon"></span></th>
                                <th class="debtor-table-sortable" data-column="phone">Phone <span class="sort-icon"></span></th>
                            </tr>
                        </thead>
                        <tbody id="debtor-table-body">
                            <tr><td colspan="13" style="text-align: center; padding: 40px;">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async loadDebtors(pharmacyId) {
        const tableBody = document.getElementById('debtor-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 40px;">Loading...</td></tr>';

        try {
            let jwtToken = null;
            if (typeof Auth !== 'undefined') {
                const authData = Auth.getAuthData();
                jwtToken = authData.token;
            }

            if (!jwtToken) {
                tableBody.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 40px;">Authentication required</td></tr>';
                return;
            }

            const baseUrl = 'https://pharmacy-api-webservice.onrender.com';
            const params = new URLSearchParams({
                per_page: '1000',
                page: '1',
                exclude_medical_aid: 'true'
            });

            // Add search query if present
            if (this.searchQuery && this.searchQuery.trim().length > 0) {
                params.append('search', this.searchQuery.trim());
            }

            // Note: We do NOT use the API's ageing_buckets filter as it doesn't work reliably
            // Instead, we fetch all debtors and filter client-side

            // Add sorting if set (API sorting still works)
            if (this.sortColumn) {
                params.append('sort_by', this.sortColumn);
                params.append('sort_order', this.sortOrder);
            }

            const url = `${baseUrl}/pharmacies/${pharmacyId}/debtors?${params.toString()}`;
            console.log('Fetching debtors from:', url);

            const response = await window.fetch(url, {
                headers: {
                    'Authorization': `Bearer ${jwtToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load debtors');
            }

            const data = await response.json();
            let debtors = data.debtors || [];
            
            // Client-side filtering by ageing buckets
            const allBuckets = ['current', 'd30', 'd60', 'd90', 'd120', 'd150', 'd180'];
            const allSelected = allBuckets.every(b => this.selectedAgeingBuckets.includes(b));
            
            if (this.selectedAgeingBuckets.length === 0) {
                // No buckets selected - show nothing
                console.log('No ageing buckets selected - showing no results');
                this.allDebtors = [];
            } else if (!allSelected) {
                // Filter debtors: show only those with balance > 0 in at least one selected bucket
                console.log('Client-side filtering by buckets:', this.selectedAgeingBuckets);
                debtors = debtors.filter(debtor => {
                    return this.selectedAgeingBuckets.some(bucket => {
                        const value = parseFloat(debtor[bucket]) || 0;
                        return value > 0;
                    });
                });
                console.log(`Filtered to ${debtors.length} debtors`);
                this.allDebtors = debtors;
            } else {
                // All buckets selected - show all debtors
                console.log('All buckets selected - showing all', debtors.length, 'debtors');
                this.allDebtors = debtors;
            }
            
            // Client-side filtering by minimum balance (in case API doesn't filter properly)
            if (this.minBalance > 0) {
                this.allDebtors = this.allDebtors.filter(debtor => {
                    const balance = parseFloat(debtor.balance) || 0;
                    return balance >= this.minBalance;
                });
                console.log(`After min balance filter: ${this.allDebtors.length} debtors`);
            }
            
            this.renderDebtorsTableBody();
            this.setupTableHandlers();
            this.updateSortIcons();
        } catch (error) {
            console.error('Error loading debtors:', error);
            tableBody.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 40px;">Error loading debtors</td></tr>';
        }
    }

    renderDebtorsTableBody() {
        const tableBody = document.getElementById('debtor-table-body');
        if (!tableBody) return;

        if (this.allDebtors.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 40px;">No debtors found</td></tr>';
            return;
        }

        const formatCurrency = (value) => {
            const numValue = Number(value) || 0;
            if (numValue === 0) return '—';
            return new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(numValue);
        };

        const rowsHtml = this.allDebtors.map(debtor => {
            const accountNo = debtor.acc_no || debtor.account_number || 'N/A';
            const name = debtor.name || 'Unknown';
            const email = debtor.email || '';
            const phone = debtor.phone || '';
            
            return `
                <tr>
                    <td class="debtor-table-checkbox">
                        <input type="checkbox" class="debtor-row-checkbox" data-debtor-id="${debtor.id || debtor.debtor_id}" />
                    </td>
                    <td>${this.escapeHtml(accountNo)}</td>
                    <td>${this.escapeHtml(name)}</td>
                    <td>${formatCurrency(debtor.current)}</td>
                    <td>${formatCurrency(debtor.d30)}</td>
                    <td>${formatCurrency(debtor.d60)}</td>
                    <td>${formatCurrency(debtor.d90)}</td>
                    <td>${formatCurrency(debtor.d120)}</td>
                    <td>${formatCurrency(debtor.d150)}</td>
                    <td>${formatCurrency(debtor.d180)}</td>
                    <td>${formatCurrency(debtor.balance)}</td>
                    <td class="debtor-email">${email ? this.escapeHtml(email) : '—'}</td>
                    <td>${phone ? this.escapeHtml(phone) : 'No phone'}</td>
                </tr>
            `;
        }).join('');

        tableBody.innerHTML = rowsHtml;
    }

    setupTableHandlers() {
        // Select all checkbox
        const selectAll = document.getElementById('debtor-select-all');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.debtor-row-checkbox');
                checkboxes.forEach(cb => cb.checked = e.target.checked);
            });
        }

        // Sortable column headers
        const sortableHeaders = document.querySelectorAll('.debtor-table-sortable');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                
                // Update sort state
                if (this.sortColumn === column) {
                    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortColumn = column;
                    this.sortOrder = 'asc';
                }

                // Update sort icons
                this.updateSortIcons();
                
                // Reload debtors with new sort
                const pharmacy = window.pharmacyPicker?.getSelectedPharmacy();
                if (pharmacy && pharmacy.id) {
                    this.loadDebtors(pharmacy.id);
                }
            });
        });
    }

    updateSortIcons() {
        const headers = document.querySelectorAll('.debtor-table-sortable');
        headers.forEach(header => {
            const icon = header.querySelector('.sort-icon');
            if (!icon) return;
            
            const column = header.dataset.column;
            
            // Remove active class from all headers
            header.classList.remove('active');
            
            if (this.sortColumn === column) {
                // Active sort column
                icon.textContent = this.sortOrder === 'asc' ? '↑' : '↓';
                icon.style.opacity = '1';
                icon.style.color = '#F37A20';
                header.style.color = '#F37A20';
                header.classList.add('active');
            } else {
                // Inactive column
                icon.textContent = '↕';
                icon.style.opacity = '0.3';
                icon.style.color = '';
                header.style.color = '';
            }
        });
    }

    showEmptyState() {
        const container = document.querySelector('.content-area');
        if (!container) return;
        
        container.innerHTML = `
            <div class="dashboard-container">
                <div class="empty-state">
                    <p>Please select a pharmacy to view debtor tools.</p>
                </div>
            </div>
        `;
    }

    showError(error) {
        const container = document.querySelector('.content-area');
        if (!container) return;
        
        container.innerHTML = `
            <div class="dashboard-container">
                <div class="error-state">
                    <p>Error loading debtor tools: ${error.message || 'Unknown error'}</p>
                </div>
            </div>
        `;
    }
}

