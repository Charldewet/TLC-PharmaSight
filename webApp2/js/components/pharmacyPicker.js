// Pharmacy Picker Component
// Handles pharmacy selection UI and state

class PharmacyPicker {
    constructor() {
        this.selectedPharmacyId = null;
        this.selectedPharmacyName = null;
        this.pharmacies = [];
        this.groupViewEnabled = false;
        this.init();
    }

    init() {
        // Load from localStorage first
        const groupViewEnabled = localStorage.getItem('group_view_enabled') === 'true';
        if (groupViewEnabled) {
            this.groupViewEnabled = true;
            this.selectedPharmacyId = null;
            this.selectedPharmacyName = 'Group View';
        } else {
            const storedId = localStorage.getItem('selected_pharmacy_id');
            const storedName = localStorage.getItem('selected_pharmacy_name');
            if (storedId && storedName) {
                this.selectedPharmacyId = storedId;
                this.selectedPharmacyName = storedName;
            }
        }

        this.setupEventListeners();
        this.loadPharmacies();
    }

    setupEventListeners() {
        // Open pharmacy picker button
        const pharmacyBtn = document.getElementById('pharmacy-picker-btn');
        if (pharmacyBtn) {
            pharmacyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openPicker();
            });
        }

        // Close button
        const closeBtn = document.getElementById('pharmacy-picker-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePicker());
        }

        // Overlay click
        const overlay = document.getElementById('pharmacy-picker-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closePicker();
                }
            });
        }

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const overlay = document.getElementById('pharmacy-picker-modal-overlay');
                if (overlay && overlay.classList.contains('active')) {
                    this.closePicker();
                }
            }
        });

        // Window resize handler for desktop positioning
        window.addEventListener('resize', () => {
            if (!this.isMobile()) {
                const overlay = document.getElementById('pharmacy-picker-modal-overlay');
                const modal = overlay?.querySelector('.pharmacy-picker-modal');
                const button = document.getElementById('pharmacy-picker-btn');
                
                if (overlay && overlay.classList.contains('active') && modal && button) {
                    this.repositionModal(modal, button);
                }
            }
        });

        // Click outside handler for desktop
        document.addEventListener('click', (e) => {
            if (!this.isMobile()) {
                const overlay = document.getElementById('pharmacy-picker-modal-overlay');
                const button = document.getElementById('pharmacy-picker-btn');
                const modal = overlay?.querySelector('.pharmacy-picker-modal');
                
                if (overlay && overlay.classList.contains('active')) {
                    const isClickInsideModal = modal && modal.contains(e.target);
                    const isClickOnButton = button && button.contains(e.target);
                    
                    if (!isClickInsideModal && !isClickOnButton) {
                        this.closePicker();
                    }
                }
            }
        });
    }

    async loadPharmacies(forceRefresh = false) {
        try {
            // Try localStorage first
            const storedPharmacies = localStorage.getItem('pharmacies');
            if (storedPharmacies && !forceRefresh) {
                try {
                    this.pharmacies = JSON.parse(storedPharmacies);
                    console.log('Loaded pharmacies from localStorage:', this.pharmacies.length);
                } catch (e) {
                    console.warn('Failed to parse stored pharmacies:', e);
                    this.pharmacies = [];
                }
            }

            // Fetch from API if needed
            if (this.pharmacies.length === 0 || forceRefresh) {
                if (typeof Auth !== 'undefined') {
                    this.pharmacies = await Auth.fetchPharmacies();
                    console.log('Fetched pharmacies from API:', this.pharmacies.length);
                }
            }

            // Initialize selection
            if (!this.selectedPharmacyId && this.pharmacies.length > 0) {
                const firstPharmacy = this.pharmacies[0];
                this.selectPharmacy(
                    firstPharmacy.pharmacy_id || firstPharmacy.id,
                    firstPharmacy.pharmacy_name || firstPharmacy.name
                );
            } else if (this.selectedPharmacyId) {
                // Verify selected pharmacy still exists
                const exists = this.pharmacies.some(p => 
                    (p.pharmacy_id || p.id) == this.selectedPharmacyId
                );
                if (!exists && this.pharmacies.length > 0) {
                    const firstPharmacy = this.pharmacies[0];
                    this.selectPharmacy(
                        firstPharmacy.pharmacy_id || firstPharmacy.id,
                        firstPharmacy.pharmacy_name || firstPharmacy.name
                    );
                }
            }

            this.updateDisplay();
        } catch (error) {
            console.error('Error loading pharmacies:', error);
        }
    }

    selectPharmacy(id, name) {
        // Handle group view selection
        if (id === 'group-view') {
            this.groupViewEnabled = true;
            this.selectedPharmacyId = null;
            this.selectedPharmacyName = 'Group View';
            localStorage.setItem('group_view_enabled', 'true');
            localStorage.removeItem('selected_pharmacy_id');
            localStorage.removeItem('selected_pharmacy_name');
        } else {
            this.groupViewEnabled = false;
            this.selectedPharmacyId = id;
            this.selectedPharmacyName = name;
            localStorage.setItem('selected_pharmacy_id', id);
            localStorage.setItem('selected_pharmacy_name', name);
            localStorage.setItem('group_view_enabled', 'false');
        }
        
        this.updateDisplay();
        this.updateSelectionHighlight();
        this.closePicker();
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('pharmacyChanged', {
            detail: { id, name, groupView: this.groupViewEnabled }
        }));
    }

    updateDisplay() {
        const label = document.getElementById('selected-pharmacy-display');
        if (label && this.selectedPharmacyName) {
            label.textContent = this.selectedPharmacyName;
        }
    }

    populateList() {
        const list = document.getElementById('pharmacy-picker-list');
        if (!list) return;

        // Check if we're on dashboard screen
        const isDashboard = window.router?.getCurrentRoute() === 'dashboard';
        
        // Build group view option HTML
        const groupViewOption = `
            <button class="pharmacy-option ${this.groupViewEnabled ? 'selected' : ''} ${!isDashboard ? 'disabled' : ''}" 
                    data-pharmacy-id="group-view" 
                    data-pharmacy-name="Group View"
                    ${!isDashboard ? 'disabled' : ''}>
                <span class="pharmacy-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                </span>
                <span>Group View</span>
            </button>
        `;

        if (this.pharmacies.length === 0) {
            list.innerHTML = `
                ${groupViewOption}
                <div style="padding: 24px; text-align: center; color: var(--text-secondary);">
                    <p>No pharmacies available.</p>
                </div>
            `;
            return;
        }

        const pharmaciesHTML = this.pharmacies.map(pharmacy => {
            const id = pharmacy.pharmacy_id || pharmacy.id;
            const name = pharmacy.pharmacy_name || pharmacy.name;
            const isSelected = !this.groupViewEnabled && this.selectedPharmacyId == id;

            return `
                <button class="pharmacy-option ${isSelected ? 'selected' : ''}" 
                        data-pharmacy-id="${id}" 
                        data-pharmacy-name="${name}">
                    <span class="pharmacy-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 3h18v18H3z"></path>
                            <path d="M3 9h18"></path>
                            <path d="M9 21V9"></path>
                        </svg>
                    </span>
                    <span>${name}</span>
                </button>
            `;
        }).join('');

        list.innerHTML = groupViewOption + pharmaciesHTML;

        // Add click handlers
        list.querySelectorAll('.pharmacy-option').forEach(option => {
            if (option.classList.contains('disabled')) return;
            
            option.addEventListener('click', () => {
                this.selectPharmacy(
                    option.getAttribute('data-pharmacy-id'),
                    option.getAttribute('data-pharmacy-name')
                );
            });
        });
    }

    updateSelectionHighlight() {
        this.populateList();
    }

    openPicker() {
        // Always refresh the list when opening to update disabled state
        this.populateList();
        this.updateSelectionHighlight();

        const overlay = document.getElementById('pharmacy-picker-modal-overlay');
        const modal = overlay?.querySelector('.pharmacy-picker-modal');
        const button = document.getElementById('pharmacy-picker-btn');

        if (overlay && modal && button) {
            if (!this.isMobile()) {
                this.repositionModal(modal, button);
            }
            overlay.classList.add('active');
            if (this.isMobile()) {
                document.body.style.overflow = 'hidden';
            }
        }
    }

    closePicker() {
        const overlay = document.getElementById('pharmacy-picker-modal-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    repositionModal(modal, button) {
        const buttonRect = button.getBoundingClientRect();
        modal.style.top = `${buttonRect.bottom + 8}px`;
        modal.style.right = `${window.innerWidth - buttonRect.right}px`;
        modal.style.left = 'auto';
    }

    isMobile() {
        return window.innerWidth <= 768;
    }

    // Public getters
    getSelectedPharmacy() {
        return {
            id: this.selectedPharmacyId,
            name: this.selectedPharmacyName,
            groupView: this.groupViewEnabled
        };
    }
    
    isGroupViewEnabled() {
        return this.groupViewEnabled;
    }
}

// Export singleton instance
window.PharmacyPicker = PharmacyPicker;

