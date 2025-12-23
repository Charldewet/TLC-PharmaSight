// Import Auth utilities (loaded from auth.js)
// Auth object should be available globally

// Pharmacy picker state
let selectedPharmacyId = null;
let selectedPharmacyName = null;
let pharmacies = [];

// Date picker state
let selectedDate = null;
let currentCalendarMonth = null;
let currentCalendarYear = null;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check if Auth is available and user is authenticated
    if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize user info display
    initUserInfo();
    
    // Initialize sidebar
    initSidebar();
    
    // Initialize pharmacy picker
    initPharmacyPicker();
    
    // Initialize date picker
    initDatePicker();
    
    console.log('Dashboard initialized');
});

// Initialize user information display
function initUserInfo() {
    const userNameEl = document.getElementById('user-name');
    const userAvatarEl = document.getElementById('user-avatar');
    
    if (typeof Auth !== 'undefined') {
        const authData = Auth.getAuthData();
        
        if (userNameEl && authData.username) {
            userNameEl.textContent = authData.username;
        }
        
        if (userAvatarEl && authData.username) {
            // Get first letter of username for avatar
            userAvatarEl.textContent = authData.username.charAt(0).toUpperCase();
        }
    }
}

// Initialize sidebar functionality
function initSidebar() {
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.createElement('div');
    sidebarOverlay.className = 'sidebar-overlay';
    document.body.appendChild(sidebarOverlay);

    // Toggle sidebar on mobile
    mobileMenuBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
    });

    // Close sidebar when clicking overlay
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });

    // Handle navigation items (no functionality yet, just visual feedback)
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');
            
            // Update page title based on selected item
            const label = item.querySelector('.nav-item-label')?.textContent || 'Dashboard';
            updatePageTitle(label);
            
            // Close sidebar on mobile after selection
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
                sidebarOverlay.classList.remove('active');
            }
            
            // Prevent default behavior (navigation will be added later)
            e.preventDefault();
        });
    });

    // Handle sign out button
    const signOutBtn = document.getElementById('sign-out-btn');
    signOutBtn?.addEventListener('click', () => {
        if (typeof Auth !== 'undefined') {
            Auth.logout();
        } else {
            // Fallback: clear localStorage and redirect
            localStorage.clear();
            window.location.href = 'login.html';
        }
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        }
    });
}

// Update page title function
function updatePageTitle(label) {
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    
    if (pageTitle) {
        pageTitle.textContent = label;
    }
    
    // Update subtitle based on section
    const subtitles = {
        'Dashboard': 'Overview of your pharmacy performance',
        'Daily Summary': 'Daily sales and performance metrics',
        'Monthly Summary': 'Monthly aggregated data and insights',
        'Stock Management': 'Manage inventory and stock levels',
        'Stock Queries': 'Search and query stock information',
        'Debtor Tools': 'Manage debtors and accounts receivable',
        'Daily Tracking': 'Track daily performance metrics',
        'Targets': 'Set and monitor performance targets',
        'Admin': 'Administrative panel and user management'
    };
    
    if (pageSubtitle) {
        pageSubtitle.textContent = subtitles[label] || 'View and manage your data';
    }
}

// =====================================================
// PHARMACY PICKER FUNCTIONS
// =====================================================

// Load pharmacies from localStorage first, then API if needed
async function loadPharmacies(forceRefresh = false) {
    try {
        // First try to load from localStorage (populated during login)
        const storedPharmacies = localStorage.getItem('pharmacies');
        
        if (storedPharmacies && !forceRefresh) {
            try {
                pharmacies = JSON.parse(storedPharmacies);
                console.log('Loaded pharmacies from localStorage:', pharmacies.length);
            } catch (e) {
                console.warn('Failed to parse stored pharmacies:', e);
                pharmacies = [];
            }
        }
        
        // If no pharmacies in localStorage or force refresh, fetch from API
        if (pharmacies.length === 0 || forceRefresh) {
            console.log('Fetching pharmacies from API...');
            if (typeof Auth !== 'undefined') {
                try {
                    pharmacies = await Auth.fetchPharmacies();
                    console.log('Fetched pharmacies from API:', pharmacies.length);
                } catch (apiError) {
                    console.error('API fetch failed:', apiError);
                    // If API fails but we have cached data, use it
                    if (storedPharmacies) {
                        try {
                            pharmacies = JSON.parse(storedPharmacies);
                            console.log('Using cached pharmacies after API failure');
                        } catch (e) {
                            pharmacies = [];
                        }
                    }
                }
            }
        }
        
        // Populate the pharmacy list
        populatePharmacyList();
        
        // Initialize with stored selection or first pharmacy
        const storedPharmacyId = localStorage.getItem('selected_pharmacy_id');
        const storedPharmacyName = localStorage.getItem('selected_pharmacy_name');
        
        if (storedPharmacyId && storedPharmacyName) {
            // Verify the stored pharmacy still exists in the list
            const pharmacyExists = pharmacies.some(p => 
                (p.pharmacy_id || p.id) == storedPharmacyId
            );
            if (pharmacyExists) {
                selectedPharmacyId = storedPharmacyId;
                selectedPharmacyName = storedPharmacyName;
            }
        }
        
        // If no selection, use first pharmacy
        if (!selectedPharmacyId && pharmacies.length > 0) {
            const firstPharmacy = pharmacies[0];
            selectedPharmacyId = firstPharmacy.pharmacy_id || firstPharmacy.id;
            selectedPharmacyName = firstPharmacy.pharmacy_name || firstPharmacy.name;
        }
        
        // Store selection
        if (selectedPharmacyId && selectedPharmacyName) {
            localStorage.setItem('selected_pharmacy_id', selectedPharmacyId);
            localStorage.setItem('selected_pharmacy_name', selectedPharmacyName);
        }
        
        updatePharmacyDisplay();
        updatePharmacySelectionHighlight();
        
    } catch (error) {
        console.error('Error loading pharmacies:', error);
        // Try one more time with cached data
        const storedPharmacies = localStorage.getItem('pharmacies');
        if (storedPharmacies) {
            try {
                pharmacies = JSON.parse(storedPharmacies);
                populatePharmacyList();
                updatePharmacyDisplay();
                return;
            } catch (e) {
                // Fall through to error message
            }
        }
        
        // Show error message to user
        const pharmacyList = document.getElementById('pharmacy-picker-list');
        if (pharmacyList) {
            pharmacyList.innerHTML = `
                <div style="padding: 24px; text-align: center; color: var(--text-secondary);">
                    <p>Failed to load pharmacies. Please try logging out and back in.</p>
                </div>
            `;
        }
    }
}

// Populate the pharmacy list in the modal
function populatePharmacyList() {
    const pharmacyList = document.getElementById('pharmacy-picker-list');
    if (!pharmacyList) return;
    
    if (pharmacies.length === 0) {
        pharmacyList.innerHTML = `
            <div style="padding: 24px; text-align: center; color: var(--text-secondary);">
                <p>No pharmacies available.</p>
            </div>
        `;
        return;
    }
    
    pharmacyList.innerHTML = pharmacies.map(pharmacy => {
        const pharmacyId = pharmacy.pharmacy_id || pharmacy.id;
        const pharmacyName = pharmacy.pharmacy_name || pharmacy.name;
        const isSelected = selectedPharmacyId == pharmacyId;
        
        return `
            <button class="pharmacy-option ${isSelected ? 'selected' : ''}" 
                    data-pharmacy-id="${pharmacyId}" 
                    data-pharmacy-name="${pharmacyName}">
                <span class="pharmacy-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 3h18v18H3z"></path>
                        <path d="M3 9h18"></path>
                        <path d="M9 21V9"></path>
                    </svg>
                </span>
                <span>${pharmacyName}</span>
            </button>
        `;
    }).join('');
    
    // Add click handlers to pharmacy options
    const pharmacyOptions = pharmacyList.querySelectorAll('.pharmacy-option');
    pharmacyOptions.forEach(option => {
        option.addEventListener('click', function() {
            selectPharmacy(
                this.getAttribute('data-pharmacy-id'),
                this.getAttribute('data-pharmacy-name')
            );
        });
    });
}

// Select a pharmacy
function selectPharmacy(pharmacyId, pharmacyName) {
    selectedPharmacyId = pharmacyId;
    selectedPharmacyName = pharmacyName;
    
    // Store in localStorage
    localStorage.setItem('selected_pharmacy_id', pharmacyId);
    localStorage.setItem('selected_pharmacy_name', pharmacyName);
    
    // Update display
    updatePharmacyDisplay();
    updatePharmacySelectionHighlight();
    
    // Close modal
    closePharmacyPicker();
    
    console.log('Pharmacy selected:', pharmacyId, pharmacyName);
    
    // Trigger custom event for other parts of the app to listen to
    window.dispatchEvent(new CustomEvent('pharmacyChanged', {
        detail: { pharmacyId, pharmacyName }
    }));
}

// Update the pharmacy display button
function updatePharmacyDisplay() {
    const displayEl = document.getElementById('selected-pharmacy-display');
    if (displayEl) {
        if (selectedPharmacyName) {
            displayEl.textContent = selectedPharmacyName;
        } else {
            displayEl.textContent = 'Select Pharmacy';
        }
    }
}

// Update highlighting in the modal
function updatePharmacySelectionHighlight() {
    const pharmacyOptions = document.querySelectorAll('.pharmacy-option');
    pharmacyOptions.forEach(option => {
        option.classList.remove('selected');
        if (option.getAttribute('data-pharmacy-id') == selectedPharmacyId) {
            option.classList.add('selected');
        }
    });
}

// Check if we're on mobile
function isMobile() {
    return window.innerWidth <= 768;
}

// Open pharmacy picker modal
function openPharmacyPicker() {
    // Use cached pharmacies (don't force refresh on every open)
    // Pharmacies are already loaded on page init
    populatePharmacyList();
    updatePharmacySelectionHighlight();
    
    const overlay = document.getElementById('pharmacy-picker-modal-overlay');
    const modal = document.querySelector('.pharmacy-picker-modal');
    const button = document.getElementById('pharmacy-picker-btn');
    
    if (overlay && modal && button) {
        // On desktop, position the modal to align with the button's right edge
        if (!isMobile()) {
            const buttonRect = button.getBoundingClientRect();
            
            // Position modal below the button, aligned to right edge
            modal.style.top = `${buttonRect.bottom + 8}px`;
            modal.style.right = `${window.innerWidth - buttonRect.right}px`;
            modal.style.left = 'auto';
        }
        
        overlay.classList.add('active');
        // Only prevent body scroll on mobile
        if (isMobile()) {
            document.body.style.overflow = 'hidden';
        }
    }
}

// Close pharmacy picker modal
function closePharmacyPicker() {
    const overlay = document.getElementById('pharmacy-picker-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Initialize pharmacy picker
function initPharmacyPicker() {
    // Load pharmacies on initialization
    loadPharmacies();
    
    // Set up button click handler
    const pharmacyPickerBtn = document.getElementById('pharmacy-picker-btn');
    if (pharmacyPickerBtn) {
        pharmacyPickerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const overlay = document.getElementById('pharmacy-picker-modal-overlay');
            if (overlay && overlay.classList.contains('active')) {
                closePharmacyPicker();
            } else {
                openPharmacyPicker();
            }
        });
    }
    
    // Set up close button handler
    const closeBtn = document.getElementById('pharmacy-picker-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closePharmacyPicker);
    }
    
    // Close modal when clicking overlay
    const overlay = document.getElementById('pharmacy-picker-modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closePharmacyPicker();
            }
        });
    }
    
    // Close dropdown when clicking outside (for desktop)
    document.addEventListener('click', (e) => {
        const overlay = document.getElementById('pharmacy-picker-modal-overlay');
        const modal = document.querySelector('.pharmacy-picker-modal');
        const btn = document.getElementById('pharmacy-picker-btn');
        
        if (overlay && overlay.classList.contains('active')) {
            // Check if click is outside the modal and button
            if (modal && !modal.contains(e.target) && btn && !btn.contains(e.target)) {
                closePharmacyPicker();
            }
        }
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('pharmacy-picker-modal-overlay');
            if (overlay && overlay.classList.contains('active')) {
                closePharmacyPicker();
            }
        }
    });
    
    // Reposition dropdown on window resize (desktop only)
    window.addEventListener('resize', () => {
        if (!isMobile()) {
            const overlay = document.getElementById('pharmacy-picker-modal-overlay');
            const modal = document.querySelector('.pharmacy-picker-modal');
            const button = document.getElementById('pharmacy-picker-btn');
            
            if (overlay && overlay.classList.contains('active') && modal && button) {
                const buttonRect = button.getBoundingClientRect();
                modal.style.top = `${buttonRect.bottom + 8}px`;
                modal.style.right = `${window.innerWidth - buttonRect.right}px`;
                modal.style.left = 'auto';
            }
        }
    });
}

// Export pharmacy state for use in other scripts
window.getSelectedPharmacy = function() {
    return {
        id: selectedPharmacyId,
        name: selectedPharmacyName
    };
};

// =====================================================
// DATE PICKER FUNCTIONS
// =====================================================

// Format date as YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Format date for display (e.g., "Dec 22, 2024" or "Today")
function formatDateDisplay(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateCopy = new Date(date);
    dateCopy.setHours(0, 0, 0, 0);
    
    const diffTime = today - dateCopy;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays === -1) return 'Tomorrow';
    
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return dateCopy.toLocaleDateString('en-US', options);
}

// Initialize calendar month/year
function initCalendarView() {
    const date = selectedDate || new Date();
    currentCalendarMonth = date.getMonth();
    currentCalendarYear = date.getFullYear();
}

// Build calendar grid
function buildCalendar() {
    const daysContainer = document.getElementById('date-picker-days');
    const monthYearEl = document.getElementById('date-picker-month-year');
    
    if (!daysContainer || !monthYearEl) {
        console.warn('Calendar elements not found');
        return;
    }
    
    // Initialize calendar month/year if not set
    if (currentCalendarMonth === null || currentCalendarYear === null) {
        initCalendarView();
    }
    
    // Update month/year display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    monthYearEl.textContent = `${monthNames[currentCalendarMonth]} ${currentCalendarYear}`;
    
    // Get first day of month and number of days
    const firstDay = new Date(currentCalendarYear, currentCalendarMonth, 1);
    const lastDay = new Date(currentCalendarYear, currentCalendarMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Get today's date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get selected date for comparison
    const selectedDateValue = selectedDate ? formatDate(selectedDate) : null;
    
    // Clear container
    daysContainer.innerHTML = '';
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'date-picker-day other-month';
        daysContainer.appendChild(emptyDay);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentCalendarYear, currentCalendarMonth, day);
        date.setHours(0, 0, 0, 0);
        const dateValue = formatDate(date);
        const isToday = dateValue === formatDate(today);
        const isSelected = dateValue === selectedDateValue;
        
        const dayButton = document.createElement('button');
        dayButton.className = 'date-picker-day';
        if (isToday) dayButton.classList.add('today');
        if (isSelected) dayButton.classList.add('selected');
        dayButton.textContent = day;
        dayButton.setAttribute('data-date-value', dateValue);
        
        dayButton.addEventListener('click', function() {
            selectDateFromValue(this.getAttribute('data-date-value'));
        });
        
        daysContainer.appendChild(dayButton);
    }
    
    // Add empty cells to fill the last row (if needed)
    const totalCells = startingDayOfWeek + daysInMonth;
    const remainingCells = 7 - (totalCells % 7);
    if (remainingCells < 7) {
        for (let i = 0; i < remainingCells; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'date-picker-day other-month';
            daysContainer.appendChild(emptyDay);
        }
    }
}

// Select date from value string (YYYY-MM-DD)
function selectDateFromValue(dateValue) {
    const date = new Date(dateValue + 'T00:00:00');
    selectDate(date);
}

// Select a date
function selectDate(date) {
    selectedDate = date;
    
    // Update calendar view to show selected date's month
    currentCalendarMonth = date.getMonth();
    currentCalendarYear = date.getFullYear();
    
    // Store in localStorage
    localStorage.setItem('selected_date', formatDate(date));
    
    // Update display
    updateDateDisplay();
    updateDateSelectionHighlight();
    
    // Close modal
    closeDatePicker();
    
    console.log('Date selected:', formatDate(date));
    
    // Trigger custom event for other parts of the app to listen to
    window.dispatchEvent(new CustomEvent('dateChanged', {
        detail: { date: formatDate(date), display: formatDateDisplay(date) }
    }));
}

// Update the date display button
function updateDateDisplay() {
    const displayEl = document.getElementById('selected-date-display');
    if (displayEl && selectedDate) {
        displayEl.textContent = formatDateDisplay(selectedDate);
    }
}

// Update highlighting in the modal
function updateDateSelectionHighlight() {
    buildCalendar();
}

// Navigate calendar month
function navigateCalendarMonth(direction) {
    // Initialize if not set
    if (currentCalendarMonth === null || currentCalendarYear === null) {
        initCalendarView();
    }
    
    if (direction === 'prev') {
        currentCalendarMonth--;
        if (currentCalendarMonth < 0) {
            currentCalendarMonth = 11;
            currentCalendarYear--;
        }
    } else if (direction === 'next') {
        currentCalendarMonth++;
        if (currentCalendarMonth > 11) {
            currentCalendarMonth = 0;
            currentCalendarYear++;
        }
    }
    buildCalendar();
}

// Open date picker modal
function openDatePicker() {
    const overlay = document.getElementById('date-picker-modal-overlay');
    const modal = document.querySelector('.date-picker-modal');
    const button = document.getElementById('date-picker-btn');
    
    if (!overlay || !modal || !button) {
        console.error('Date picker elements not found');
        return;
    }
    
    // Initialize calendar to show selected date or today
    initCalendarView();
    
    // Build calendar after a small delay to ensure DOM is ready
    setTimeout(() => {
        buildCalendar();
    }, 10);
    
    // On desktop, position the modal to align with the button's right edge
    if (!isMobile()) {
        const buttonRect = button.getBoundingClientRect();
        
        // Position modal below the button, aligned to right edge
        modal.style.top = `${buttonRect.bottom + 8}px`;
        modal.style.right = `${window.innerWidth - buttonRect.right}px`;
        modal.style.left = 'auto';
    }
    
    overlay.classList.add('active');
    // Only prevent body scroll on mobile
    if (isMobile()) {
        document.body.style.overflow = 'hidden';
    }
}

// Close date picker modal
function closeDatePicker() {
    const overlay = document.getElementById('date-picker-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Initialize date picker
function initDatePicker() {
    // Initialize with today's date if no date is stored
    const storedDate = localStorage.getItem('selected_date');
    if (storedDate) {
        try {
            selectedDate = new Date(storedDate + 'T00:00:00');
        } catch (e) {
            selectedDate = new Date();
        }
    } else {
        selectedDate = new Date();
        localStorage.setItem('selected_date', formatDate(selectedDate));
    }
    
    updateDateDisplay();
    
    // Set up button click handler
    const datePickerBtn = document.getElementById('date-picker-btn');
    if (datePickerBtn) {
        datePickerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const overlay = document.getElementById('date-picker-modal-overlay');
            if (overlay && overlay.classList.contains('active')) {
                closeDatePicker();
            } else {
                openDatePicker();
            }
        });
    }
    
    // Set up close button handler
    const closeBtn = document.getElementById('date-picker-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeDatePicker);
    }
    
    // Set up month navigation buttons
    const prevMonthBtn = document.getElementById('date-picker-prev-month');
    const nextMonthBtn = document.getElementById('date-picker-next-month');
    
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => navigateCalendarMonth('prev'));
    }
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => navigateCalendarMonth('next'));
    }
    
    // Set up Today button
    const todayBtn = document.getElementById('date-picker-today-btn');
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            selectDate(today);
        });
    }
    
    // Set up Yesterday button
    const yesterdayBtn = document.getElementById('date-picker-yesterday-btn');
    if (yesterdayBtn) {
        yesterdayBtn.addEventListener('click', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);
            selectDate(yesterday);
        });
    }
    
    // Close modal when clicking overlay
    const overlay = document.getElementById('date-picker-modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeDatePicker();
            }
        });
    }
    
    // Close dropdown when clicking outside (for desktop)
    document.addEventListener('click', (e) => {
        const overlay = document.getElementById('date-picker-modal-overlay');
        const modal = document.querySelector('.date-picker-modal');
        const btn = document.getElementById('date-picker-btn');
        
        if (overlay && overlay.classList.contains('active')) {
            // Check if click is outside the modal and button
            if (modal && !modal.contains(e.target) && btn && !btn.contains(e.target)) {
                closeDatePicker();
            }
        }
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('date-picker-modal-overlay');
            if (overlay && overlay.classList.contains('active')) {
                closeDatePicker();
            }
        }
    });
    
    // Reposition dropdown on window resize (desktop only)
    window.addEventListener('resize', () => {
        if (!isMobile()) {
            const overlay = document.getElementById('date-picker-modal-overlay');
            const modal = document.querySelector('.date-picker-modal');
            const button = document.getElementById('date-picker-btn');
            
            if (overlay && overlay.classList.contains('active') && modal && button) {
                const buttonRect = button.getBoundingClientRect();
                modal.style.top = `${buttonRect.bottom + 8}px`;
                modal.style.right = `${window.innerWidth - buttonRect.right}px`;
                modal.style.left = 'auto';
            }
        }
    });
}

// Export date state for use in other scripts
window.getSelectedDate = function() {
    return {
        date: selectedDate ? formatDate(selectedDate) : null,
        display: selectedDate ? formatDateDisplay(selectedDate) : null
    };
};
