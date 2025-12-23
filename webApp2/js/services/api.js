// API Service - Centralized API calls
// Uses Auth from auth.js for authentication
// Uses the hosted API at API_BASE_URL defined in auth.js
// Endpoints match the external pharmacy API structure (same as mobile app)

// Prevent double initialization
if (window.api && typeof window.api.getDays === 'function') {
    console.warn('API service already initialized, skipping');
} else {
    (function() {
        // Use the hosted API_BASE_URL from auth.js
        // API_BASE_URL = 'https://pharmacy-api-webservice.onrender.com'
        
        // Helper to get last day of month
        const getLastDayOfMonth = (year, month) => {
            return new Date(year, month, 0).getDate();
        };
        
        class APIService {
            constructor() {
                // Use the global API_BASE_URL from auth.js
                this.baseURL = API_BASE_URL;
                console.log('API Service using base URL:', this.baseURL);
            }

            // Get auth headers
            getAuthHeaders() {
                if (typeof Auth !== 'undefined') {
                    return Auth.getAuthHeaders();
                }
                return {};
            }

            // Generic request wrapper
            async request(endpoint, options = {}) {
                const url = `${this.baseURL}${endpoint}`;
                const headers = {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                    ...options.headers
                };

                try {
                    const response = await window.fetch(url, {
                        ...options,
                        headers
                    });

                    if (!response.ok) {
                        throw new Error(`API Error: ${response.status} ${response.statusText}`);
                    }

                    return await response.json();
                } catch (error) {
                    console.error(`API Error [${endpoint}]:`, error);
                    throw error;
                }
            }

            // Get user's pharmacies
            // Endpoint: GET /users/{username}/pharmacies
            async getPharmacies(username) {
                return this.request(`/users/${encodeURIComponent(username)}/pharmacies`);
            }

            // Get daily sales data for a month
            // External API: GET /pharmacies/{pid}/days?from=YYYY-MM-DD&to=YYYY-MM-DD
            async getDays(pid, month) {
                // month is YYYY-MM format, convert to from/to dates
                const [year, mon] = month.split('-').map(Number);
                const lastDay = getLastDayOfMonth(year, mon);
                const fromDate = `${month}-01`;
                const toDate = `${month}-${String(lastDay).padStart(2, '0')}`;
                
                return this.request(`/pharmacies/${pid}/days?from=${fromDate}&to=${toDate}`);
            }

            // Get month-to-date data
            // External API: GET /pharmacies/{pid}/mtd?month=YYYY-MM&through=YYYY-MM-DD
            async getMTD(pid, month, through) {
                return this.request(`/pharmacies/${pid}/mtd?month=${encodeURIComponent(month)}&through=${encodeURIComponent(through)}`);
            }

            async getTargets(pid, month) {
                const endpoint = `/admin/pharmacies/${pid}/targets?month=${encodeURIComponent(month)}`;
                console.log('=== FETCHING TARGETS (EXTERNAL) ===');
                console.log('Endpoint:', endpoint);
                console.log('Pharmacy ID:', pid, 'Month:', month);
                
                try {
                    const data = await this.request(endpoint, {
                        headers: this.getAuthHeaders()
                    });
                    console.log('Targets API SUCCESS - Response:', data);
                    console.log('Targets array/object:', data?.targets);
                    return data;
                } catch (error) {
                    console.error('Targets API FAILED:', error.message);
                    return { targets: [] };
                }
            }

            // Save targets
            // External API: POST /admin/pharmacies/{pid}/targets?month=YYYY-MM
            async saveTargets(pid, month, targets) {
                return this.request(`/admin/pharmacies/${pid}/targets?month=${encodeURIComponent(month)}`, {
                    method: 'POST',
                    body: JSON.stringify(targets)
                });
            }

            // Get stock value (uses days endpoint with same from/to date)
            // External API: GET /pharmacies/{pid}/days?from=DATE&to=DATE
            async getStockValue(pid, date) {
                try {
                    const data = await this.request(`/pharmacies/${pid}/days?from=${date}&to=${date}`);
                    
                    // Extract stock value from response
                    if (Array.isArray(data) && data.length > 0) {
                        const record = data[0];
                        return {
                            current_stock_value: parseFloat(record.closing_stock || 0),
                            opening_stock_value: parseFloat(record.opening_stock || 0),
                            stock_change: parseFloat(record.closing_stock || 0) - parseFloat(record.opening_stock || 0),
                        };
                    }
                    return { current_stock_value: 0, opening_stock_value: 0, stock_change: 0 };
                } catch (error) {
                    console.error('Error loading stock value:', error);
                    return { current_stock_value: 0, opening_stock_value: 0, stock_change: 0 };
                }
            }

            // Get best sellers
            // External API: GET /pharmacies/{pid}/stock-activity/by-quantity?date=YYYY-MM-DD&limit=N
            // Or range: GET /pharmacies/{pid}/stock-activity/by-quantity/range?from=...&to=...&limit=N
            async getBestSellers(pid, date, fromDate, toDate, limit = 20) {
                if (fromDate && toDate) {
                    return this.request(`/pharmacies/${pid}/stock-activity/by-quantity/range?from=${fromDate}&to=${toDate}&limit=${limit}`);
                }
                return this.request(`/pharmacies/${pid}/stock-activity/by-quantity?date=${date}&limit=${limit}`);
            }

            // Get worst GP products
            // External API: GET /pharmacies/{pid}/stock-activity/low-gp/range?from=...&to=...&threshold=...&limit=...
            async getWorstGP(pid, date, fromDate, toDate, limit = 100, threshold = 20, excludePdst = false) {
                if (fromDate && toDate) {
                    let url = `/pharmacies/${pid}/stock-activity/low-gp/range?from=${fromDate}&to=${toDate}&threshold=${threshold}&limit=${limit}`;
                    if (excludePdst) url += '&exclude_pdst=true';
                    return this.request(url);
                }
                return this.request(`/pharmacies/${pid}/stock-activity/worst-gp?date=${date}&limit=${limit}`);
            }

            // Search products
            // External API: GET /products/search?query=...&page=1&page_size=200
            async searchProducts(query, page = 1, pageSize = 200) {
                return this.request(`/products/search?query=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`);
            }

            // Get product sales
            // External API: GET /products/{code}/sales?from_date=...&to_date=...&pharmacy_id=...
            async getProductSales(code, fromDate, toDate, pharmacyId) {
                return this.request(`/products/${encodeURIComponent(code)}/sales?from_date=${fromDate}&to_date=${toDate}&pharmacy_id=${pharmacyId}`);
            }

            // Get product stock
            // External API: GET /products/{code}/stock?pharmacy_id=...&date=...
            async getProductStock(code, pharmacyId, date) {
                return this.request(`/products/${encodeURIComponent(code)}/stock?pharmacy_id=${pharmacyId}&date=${date}`);
            }

            // Get top 180-day usage
            // External API: GET /pharmacies/{pid}/usage/top-180d?limit=200
            async getUsageTop180d(pharmacyId, limit = 200) {
                return this.request(`/pharmacies/${pharmacyId}/usage/top-180d?limit=${limit}`);
            }

            // Get product usage
            // External API: GET /pharmacies/{pid}/usage/product/{code}
            async getProductUsage(pharmacyId, code) {
                return this.request(`/pharmacies/${pharmacyId}/usage/product/${encodeURIComponent(code)}`);
            }

            // Get negative stock
            // External API: GET /pharmacies/{pid}/stock-activity/negative-soh?date=YYYY-MM-DD&limit=200
            async getNegativeStock(pharmacyId, date, limit = 200) {
                return this.request(`/pharmacies/${pharmacyId}/stock-activity/negative-soh?date=${date}&limit=${limit}`);
            }

            // Get stock activity (all products with stock data)
            // External API: GET /pharmacies/{pid}/stock-activity?date=YYYY-MM-DD&limit=1000
            async getStockActivity(pharmacyId, date, limit = 1000) {
                return this.request(`/pharmacies/${pharmacyId}/stock-activity?date=${date}&limit=${limit}`);
            }

            // Get MTD insights for the dashboard
            // Local API: GET /api/pharmacies/{pid}/dashboard-insights?date=YYYY-MM-DD
            async getDashboardInsights(pharmacyId, date) {
                try {
                    // This endpoint is on our local backend, not the external API
                    // Use LOCAL_BACKEND_URL defined in auth.js (stored in window.LOCAL_BACKEND_URL)
                    // Fallback to production backend if not set
                    let backendUrl = '';
                    if (typeof window !== 'undefined' && window.LOCAL_BACKEND_URL) {
                        backendUrl = window.LOCAL_BACKEND_URL;
                    } else if (typeof LOCAL_BACKEND_URL !== 'undefined' && LOCAL_BACKEND_URL) {
                        backendUrl = LOCAL_BACKEND_URL;
                    } else {
                        // Fallback to production backend
                        backendUrl = 'https://pharmasight-qdv0.onrender.com';
                    }
                    
                    // Ensure backendUrl doesn't end with a slash
                    backendUrl = backendUrl.replace(/\/$/, '');
                    
                    const dateParam = date ? `?date=${encodeURIComponent(date)}` : '';
                    const url = `${backendUrl}/api/pharmacies/${pharmacyId}/dashboard-insights${dateParam}`;
                    
                    console.log('Fetching dashboard insights from:', url);
                    
                    const response = await window.fetch(url, {
                        headers: this.getAuthHeaders()
                    });
                    
                    if (!response.ok) {
                        throw new Error(`API Error: ${response.status} ${response.statusText}`);
                    }
                    
                    return await response.json();
                } catch (error) {
                    console.error('Error fetching dashboard insights:', error);
                    // Return a fallback structure so the UI can handle it gracefully
                    return {
                        pharmacy_id: pharmacyId,
                        generated_at: new Date().toISOString(),
                        timezone: 'Africa/Johannesburg',
                        mtd: {
                            status: 'error',
                            reason: error.message,
                            period_start: null,
                            period_end: null,
                            insights_markdown: null
                        }
                    };
                }
            }
        }

        // Export singleton instance
        try {
            window.api = new APIService();
            console.log('API service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize API service:', error);
        }
    })();
}
