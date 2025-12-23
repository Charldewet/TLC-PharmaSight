// Main App Initialization
// Sets up the application and coordinates all components

class App {
    constructor() {
        this.router = null;
        this.pharmacyPicker = null;
        this.datePicker = null;
    }

    async init() {
        // Check authentication
        if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        // Set up viewport height for mobile browsers (fallback for browsers without dvh support)
        this.initViewportHeight();

        // Initialize components
        this.initUserInfo();
        this.initSidebar();
        await this.initPharmacyPicker();
        this.initDatePicker();
        this.initRouter();

        console.log('App initialized');
    }
    
    // Handle viewport height for mobile browsers with address bar
    initViewportHeight() {
        const setAppHeight = () => {
            // Set --app-height to actual inner height (accounts for browser UI)
            document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
        };
        
        // Set initial value
        setAppHeight();
        
        // Update on resize and orientation change
        window.addEventListener('resize', setAppHeight);
        window.addEventListener('orientationchange', () => {
            // Delay to allow browser UI to settle after orientation change
            setTimeout(setAppHeight, 100);
        });
    }

    initUserInfo() {
        const userNameEl = document.getElementById('user-name');
        const userAvatarEl = document.getElementById('user-avatar');
        
        if (typeof Auth !== 'undefined') {
            const authData = Auth.getAuthData();
            
            if (userNameEl && authData.username) {
                userNameEl.textContent = authData.username;
            }
            
            if (userAvatarEl && authData.username) {
                userAvatarEl.textContent = authData.username.charAt(0).toUpperCase();
            }
        }
    }

    initSidebar() {
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
        const sidebar = document.getElementById('sidebar');
        
        // Create mobile overlay
        const sidebarOverlay = document.createElement('div');
        sidebarOverlay.className = 'sidebar-overlay';
        document.body.appendChild(sidebarOverlay);
        
        // Create tablet overlay (for when sidebar expands over content)
        const tabletOverlay = document.createElement('div');
        tabletOverlay.className = 'sidebar-overlay-tablet';
        document.body.appendChild(tabletOverlay);

        // Mobile menu button click handler
        mobileMenuBtn?.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('active');
        });

        // Mobile overlay click - close sidebar
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
        
        // Tablet toggle button click handler
        sidebarToggleBtn?.addEventListener('click', () => {
            sidebar.classList.toggle('sidebar-expanded');
            tabletOverlay.classList.toggle('active');
        });
        
        // Tablet overlay click - collapse sidebar
        tabletOverlay.addEventListener('click', () => {
            sidebar.classList.remove('sidebar-expanded');
            tabletOverlay.classList.remove('active');
        });

        const signOutBtn = document.getElementById('sign-out-btn');
        signOutBtn?.addEventListener('click', () => {
            if (typeof Auth !== 'undefined') {
                Auth.logout();
            } else {
                localStorage.clear();
                window.location.href = 'login.html';
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            // Close mobile sidebar when resizing to larger screen
            if (window.innerWidth > 768) {
                sidebar.classList.remove('open');
                sidebarOverlay.classList.remove('active');
            }
            // Collapse tablet sidebar when resizing to desktop
            if (window.innerWidth >= 1200) {
                sidebar.classList.remove('sidebar-expanded');
                tabletOverlay.classList.remove('active');
            }
            
            // Update view mode toggle visibility on resize
            if (window.router) {
                const currentRoute = window.router.getCurrentRoute();
                window.router.updateViewModeToggleVisibility(currentRoute);
            }
        });
        
        // Close sidebar when clicking on a nav item (mobile and tablet)
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                // Close sidebar on mobile (≤768px)
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    sidebarOverlay.classList.remove('active');
                }
                // Collapse sidebar in tablet mode (769-1199px)
                else if (window.innerWidth < 1200) {
                    sidebar.classList.remove('sidebar-expanded');
                    tabletOverlay.classList.remove('active');
                }
            });
        });
    }

    async initPharmacyPicker() {
        this.pharmacyPicker = new PharmacyPicker();
        window.pharmacyPicker = this.pharmacyPicker;

        // Wait for pharmacies to load before proceeding
        await this.pharmacyPicker.loadPharmacies();

        // Listen for pharmacy changes
        window.addEventListener('pharmacyChanged', () => {
            this.reloadCurrentScreen();
        });
    }

    initDatePicker() {
        this.datePicker = new DatePicker();
        window.datePicker = this.datePicker;

        // Listen for date changes
        window.addEventListener('dateChanged', () => {
            this.reloadCurrentScreen();
        });
    }

    initRouter() {
        this.router = new Router();
        window.router = this.router;

        // Register routes
        this.router.register('dashboard', () => {
            const screen = new DashboardScreen();
            screen.load();
        });

        this.router.register('daily-summary', () => {
            const screen = new DailySummaryScreen();
            screen.load();
        });

        this.router.register('monthly-summary', () => {
            const screen = new MonthlySummaryScreen();
            screen.load();
        });

        this.router.register('stock-management', () => {
            const screen = new StockManagementScreen();
            screen.load();
        });

        this.router.register('stock-queries', () => {
            const screen = new StockQueriesScreen();
            screen.load();
        });

        this.router.register('debtor-tools', () => {
            const screen = new DebtorToolsScreen();
            screen.load();
        });

        this.router.register('daily', () => {
            const screen = new DailyTrackingScreen();
            screen.load();
        });

        this.router.register('targets', () => {
            const screen = new TargetsScreen();
            screen.load();
        });

        this.router.register('admin', () => {
            // TODO: Implement AdminScreen
            const mainContent = document.querySelector('.content-area');
            if (mainContent) {
                mainContent.innerHTML = `
                    <div class="dashboard-container">
                        <div class="empty-state">
                            <h2>Admin Panel</h2>
                            <p>Admin functionality coming soon.</p>
                        </div>
                    </div>
                `;
            }
        });

        // Initialize with dashboard
        this.router.navigate('dashboard');
        
        // Update view mode toggle visibility on initial load
        this.router.updateViewModeToggleVisibility('dashboard');
    }

    reloadCurrentScreen() {
        const currentRoute = this.router.getCurrentRoute();
        if (currentRoute) {
            this.router.navigate(currentRoute);
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
    window.app = app;
});

