// Date Picker Component
// Handles date selection UI and state

class DatePicker {
    constructor() {
        this.selectedDate = null;
        this.currentCalendarMonth = null;
        this.currentCalendarYear = null;
        this.init();
    }

    init() {
        // Load from localStorage
        const storedDate = localStorage.getItem('selected_date');
        if (storedDate) {
            try {
                this.selectedDate = new Date(storedDate + 'T00:00:00');
            } catch (e) {
                this.selectedDate = new Date();
            }
        } else {
            this.selectedDate = new Date();
            localStorage.setItem('selected_date', this.formatDate(this.selectedDate));
        }

        this.setupEventListeners();
        this.updateDisplay();
    }

    setupEventListeners() {
        // Open date picker button
        const dateBtn = document.getElementById('date-picker-btn');
        if (dateBtn) {
            dateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const overlay = document.getElementById('date-picker-modal-overlay');
                if (overlay && overlay.classList.contains('active')) {
                    this.closePicker();
                } else {
                    this.openPicker();
                }
            });
        }

        // Close button
        const closeBtn = document.getElementById('date-picker-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePicker());
        }

        // Month navigation
        const prevBtn = document.getElementById('date-picker-prev-month');
        const nextBtn = document.getElementById('date-picker-next-month');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.navigateMonth('prev'));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.navigateMonth('next'));
        }

        // Today button
        const todayBtn = document.getElementById('date-picker-today-btn');
        if (todayBtn) {
            todayBtn.addEventListener('click', () => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                this.selectDate(today);
            });
        }

        // Yesterday button
        const yesterdayBtn = document.getElementById('date-picker-yesterday-btn');
        if (yesterdayBtn) {
            yesterdayBtn.addEventListener('click', () => {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                this.selectDate(yesterday);
            });
        }

        // Overlay click
        const overlay = document.getElementById('date-picker-modal-overlay');
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
                const overlay = document.getElementById('date-picker-modal-overlay');
                if (overlay && overlay.classList.contains('active')) {
                    this.closePicker();
                }
            }
        });
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatDateDisplay(date) {
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

    initCalendarView() {
        const date = this.selectedDate || new Date();
        this.currentCalendarMonth = date.getMonth();
        this.currentCalendarYear = date.getFullYear();
    }

    buildCalendar() {
        const daysContainer = document.getElementById('date-picker-days');
        const monthYearEl = document.getElementById('date-picker-month-year');
        
        if (!daysContainer || !monthYearEl) {
            console.warn('Calendar elements not found');
            return;
        }
        
        if (this.currentCalendarMonth === null || this.currentCalendarYear === null) {
            this.initCalendarView();
        }
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        monthYearEl.textContent = `${monthNames[this.currentCalendarMonth]} ${this.currentCalendarYear}`;
        
        const firstDay = new Date(this.currentCalendarYear, this.currentCalendarMonth, 1);
        const lastDay = new Date(this.currentCalendarYear, this.currentCalendarMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDateValue = this.selectedDate ? this.formatDate(this.selectedDate) : null;
        
        daysContainer.innerHTML = '';
        
        // Empty cells before first day
        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'date-picker-day other-month';
            daysContainer.appendChild(emptyDay);
        }
        
        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(this.currentCalendarYear, this.currentCalendarMonth, day);
            date.setHours(0, 0, 0, 0);
            const dateValue = this.formatDate(date);
            const isToday = dateValue === this.formatDate(today);
            const isSelected = dateValue === selectedDateValue;
            
            const dayButton = document.createElement('button');
            dayButton.className = 'date-picker-day';
            if (isToday) dayButton.classList.add('today');
            if (isSelected) dayButton.classList.add('selected');
            dayButton.textContent = day;
            dayButton.setAttribute('data-date-value', dateValue);
            
            dayButton.addEventListener('click', () => {
                this.selectDateFromValue(dateValue);
            });
            
            daysContainer.appendChild(dayButton);
        }
        
        // Fill remaining cells
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

    navigateMonth(direction) {
        if (this.currentCalendarMonth === null || this.currentCalendarYear === null) {
            this.initCalendarView();
        }
        
        if (direction === 'prev') {
            this.currentCalendarMonth--;
            if (this.currentCalendarMonth < 0) {
                this.currentCalendarMonth = 11;
                this.currentCalendarYear--;
            }
        } else if (direction === 'next') {
            this.currentCalendarMonth++;
            if (this.currentCalendarMonth > 11) {
                this.currentCalendarMonth = 0;
                this.currentCalendarYear++;
            }
        }
        this.buildCalendar();
    }

    selectDateFromValue(dateValue) {
        const date = new Date(dateValue + 'T00:00:00');
        this.selectDate(date);
    }

    selectDate(date) {
        this.selectedDate = date;
        this.currentCalendarMonth = date.getMonth();
        this.currentCalendarYear = date.getFullYear();
        
        localStorage.setItem('selected_date', this.formatDate(date));
        
        this.updateDisplay();
        this.buildCalendar();
        this.closePicker();
        
        window.dispatchEvent(new CustomEvent('dateChanged', {
            detail: { date: this.formatDate(date), display: this.formatDateDisplay(date) }
        }));
    }

    updateDisplay() {
        const label = document.getElementById('selected-date-display');
        if (label && this.selectedDate) {
            label.textContent = this.formatDateDisplay(this.selectedDate);
        }
    }

    openPicker() {
        this.initCalendarView();
        this.buildCalendar();
        
        const overlay = document.getElementById('date-picker-modal-overlay');
        const modal = document.querySelector('.date-picker-modal');
        const button = document.getElementById('date-picker-btn');
        
        if (overlay && modal && button) {
            if (!this.isMobile()) {
                const buttonRect = button.getBoundingClientRect();
                modal.style.top = `${buttonRect.bottom + 8}px`;
                modal.style.right = `${window.innerWidth - buttonRect.right}px`;
                modal.style.left = 'auto';
            }
            
            overlay.classList.add('active');
            if (this.isMobile()) {
                document.body.style.overflow = 'hidden';
            }
        }
    }

    closePicker() {
        const overlay = document.getElementById('date-picker-modal-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    isMobile() {
        return window.innerWidth <= 768;
    }

    // Public getters
    getSelectedDate() {
        return this.selectedDate ? this.formatDate(this.selectedDate) : null;
    }
}

// Export singleton instance
window.DatePicker = DatePicker;

