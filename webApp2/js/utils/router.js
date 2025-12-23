// Simple Router Utility
// Handles navigation between screens

class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = 'dashboard';
        this.init();
    }

    init() {
        // Set up navigation listeners
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const route = item.getAttribute('data-tab');
                if (route) {
                    this.navigate(route);
                }
            });
        });
    }

    // Register a route handler
    register(route, handler) {
        this.routes[route] = handler;
    }

    // Navigate to a route
    navigate(route) {
        if (this.routes[route]) {
            // Update active nav item
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-tab') === route) {
                    item.classList.add('active');
                }
            });

            // Update page title
            const label = document.querySelector(`[data-tab="${route}"] .nav-item-label`)?.textContent || 'Dashboard';
            this.updatePageTitle(label);

            // Show/hide view mode toggle based on route (only show on dashboard)
            this.updateViewModeToggleVisibility(route);

            // Call route handler
            this.currentRoute = route;
            this.routes[route]();
        } else {
            console.warn(`Route "${route}" not registered`);
        }
    }
    
    // Update view mode toggle visibility (only show on dashboard)
    updateViewModeToggleVisibility(route) {
        const floatingViewModeBtn = document.getElementById('floating-view-mode-btn');
        const viewModeBtn = document.getElementById('view-mode-btn');
        
        if (route === 'dashboard') {
            // Show on dashboard
            if (floatingViewModeBtn) {
                floatingViewModeBtn.classList.add('show-on-dashboard');
            }
            // Top bar button visibility is handled by CSS on mobile, but ensure it's visible on desktop
            if (viewModeBtn && window.innerWidth > 768) {
                viewModeBtn.style.display = '';
            }
        } else {
            // Hide on all other screens (both mobile and desktop)
            if (floatingViewModeBtn) {
                floatingViewModeBtn.classList.remove('show-on-dashboard');
            }
            // Hide top bar button on all screen sizes for non-dashboard screens
            if (viewModeBtn) {
                viewModeBtn.style.display = 'none';
            }
        }
    }

    updatePageTitle(label) {
        const pageTitle = document.getElementById('page-title');
        const pageSubtitle = document.getElementById('page-subtitle');
        
        if (pageTitle) {
            pageTitle.textContent = label;
        }
        
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

    getCurrentRoute() {
        return this.currentRoute;
    }
}

// Export singleton instance
window.Router = Router;

