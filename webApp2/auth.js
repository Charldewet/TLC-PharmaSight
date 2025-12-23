// API Configuration
const API_BASE_URL = 'https://pharmacy-api-webservice.onrender.com';

// Local backend URL for AI insights and other local endpoints
// Always use the production backend URL for insights
// The insights endpoint is hosted on Render at pharmasight-qdv0.onrender.com
window.LOCAL_BACKEND_URL = 'https://pharmasight-qdv0.onrender.com';
const LOCAL_BACKEND_URL = window.LOCAL_BACKEND_URL;

// API Key for authentication (same as mobile app and backend uses)
const API_KEY = 'super-secret-long-random-string';

// Auth utility functions
const Auth = {
    // Store auth data in localStorage
    setAuthData(data) {
        localStorage.setItem('auth_token', data.token || '');
        localStorage.setItem('username', data.username || '');
        localStorage.setItem('user_id', data.user_id || '');
    },

    // Get auth data
    getAuthData() {
        return {
            token: localStorage.getItem('auth_token'),
            username: localStorage.getItem('username'),
            user_id: localStorage.getItem('user_id')
        };
    },

    // Check if user is authenticated
    isAuthenticated() {
        const token = localStorage.getItem('auth_token');
        return !!token;
    },

    // Clear auth data (logout)
    clearAuthData() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('username');
        localStorage.removeItem('user_id');
        localStorage.removeItem('pharmacies');
        localStorage.removeItem('selected_pharmacy_id');
        localStorage.removeItem('selected_pharmacy_name');
    },

    // Get auth headers for API calls
    // Use API_KEY first (as with other endpoints), fall back to user token
    getAuthHeaders() {
        if (API_KEY) {
            return { 'Authorization': `Bearer ${API_KEY}` };
        }
        const token = localStorage.getItem('auth_token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    },

    // Login function
    async login(username, password) {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            let errorMessage = 'Invalid username or password';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch (e) {
                // Use default error message
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        const token = data.token || data.access_token || data.api_key;
        const canonicalUsername = data.username || (data.user && data.user.username) || username;
        let userId = data.user_id || (data.user && data.user.user_id) || data.id;

        // If no user_id in response, try to fetch it
        if (!userId && token) {
            try {
                const userResponse = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(canonicalUsername)}/pharmacies`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    userId = userData.user_id || userData.id;
                }
            } catch (e) {
                console.warn('Failed to fetch user_id:', e);
            }
        }

        // Store auth data
        this.setAuthData({
            token,
            username: canonicalUsername,
            user_id: userId
        });

        return {
            token,
            username: canonicalUsername,
            user_id: userId
        };
    },

    // Fetch user's pharmacies
    async fetchPharmacies() {
        const { username, token } = this.getAuthData();
        if (!username || !token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}/pharmacies`, {
            headers: this.getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to fetch pharmacies');
        }

        const data = await response.json();
        const pharmacies = data.pharmacies || [];
        
        // Sort pharmacies so "TLC GROUP" always appears last
        pharmacies.sort((a, b) => {
            const nameA = (a.pharmacy_name || a.name || '').toUpperCase();
            const nameB = (b.pharmacy_name || b.name || '').toUpperCase();
            if (nameA === 'TLC GROUP') return 1;
            if (nameB === 'TLC GROUP') return -1;
            return 0;
        });

        // Store pharmacies
        localStorage.setItem('pharmacies', JSON.stringify(pharmacies));
        
        return pharmacies;
    },

    // Logout function
    logout() {
        this.clearAuthData();
        window.location.href = 'login.html';
    }
};

// Login form handler (only runs on login page)
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    
    // Only run this code on the login page (where login form exists)
    if (!loginForm) {
        return;
    }

    const loginError = document.getElementById('login-error');
    const loginErrorText = document.getElementById('login-error-text');
    const loginButton = document.getElementById('login-button');
    const loginButtonText = document.getElementById('login-button-text');
    const loginButtonIcon = document.getElementById('login-button-icon');
    const loginButtonSpinner = document.getElementById('login-button-spinner');

    // Check if already logged in - redirect to dashboard
    if (Auth.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            // Hide previous errors
            loginError.style.display = 'none';

            // Show loading state
            loginButton.disabled = true;
            loginButtonText.textContent = 'Signing in...';
            loginButtonIcon.style.display = 'none';
            loginButtonSpinner.style.display = 'block';

            try {
                await Auth.login(username, password);
                
                // Fetch pharmacies after successful login
                try {
                    await Auth.fetchPharmacies();
                } catch (e) {
                    console.warn('Failed to fetch pharmacies:', e);
                }

                // Redirect to dashboard
                window.location.href = 'index.html';
            } catch (error) {
                // Show error
                loginErrorText.textContent = error.message;
                loginError.style.display = 'flex';
                
                // Reset button state
                loginButton.disabled = false;
                loginButtonText.textContent = 'Sign In';
                loginButtonIcon.style.display = 'block';
                loginButtonSpinner.style.display = 'none';
            }
        });
    }
});

