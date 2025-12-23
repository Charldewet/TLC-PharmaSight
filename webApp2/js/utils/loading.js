// Loading Overlay Utility
// Provides a simple API to show/hide a full-screen loading overlay

class LoadingOverlay {
    constructor() {
        this.overlay = document.getElementById('loading-overlay');
        if (!this.overlay) {
            console.warn('Loading overlay element not found in DOM');
        }
    }

    show(message = 'Loading data...') {
        if (!this.overlay) return;
        
        const loadingText = this.overlay.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }
        
        this.overlay.classList.add('active');
    }

    hide() {
        if (!this.overlay) return;
        this.overlay.classList.remove('active');
    }

    isVisible() {
        return this.overlay?.classList.contains('active') || false;
    }
}

// Export singleton instance
window.loadingOverlay = new LoadingOverlay();


