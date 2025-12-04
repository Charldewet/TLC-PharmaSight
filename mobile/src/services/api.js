import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_KEY, getAuthHeaders, API_ENDPOINTS } from '../config/api';

// Create axios instance - connects directly to the deployed API webservice
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth headers
// Defaults to API_KEY first (shared service key), same as web app standard endpoints
api.interceptors.request.use(
  async (config) => {
    // Get user's auth token from storage
    const userToken = await AsyncStorage.getItem('auth_token');
    const authHeaders = getAuthHeaders(userToken);

    // Only set Authorization header if caller hasn't overridden it
    if (!config.headers.Authorization && authHeaders.Authorization) {
      config.headers.Authorization = authHeaders.Authorization;
    }
    
    const tokenType = config.headers.Authorization
      ? (config.headers.Authorization.includes(API_KEY) ? 'API_KEY' : 'USER_TOKEN')
      : 'NONE';
    console.log('[API Request]', config.method?.toUpperCase(), config.url, `[Auth: ${tokenType}]`);
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    console.log('[API Response]', response.status, response.config.url);
    return response;
  },
  async (error) => {
    console.error('[API Error]', error.response?.status, error.config?.url, error.message);
    
    // If Bearer token fails with 401, try X-API-Key header (same as web app fallback)
    if (error.response?.status === 401 && API_KEY && !error.config._retried) {
      console.log('[API] Retrying with X-API-Key header...');
      error.config._retried = true;
      error.config.headers['X-API-Key'] = API_KEY;
      delete error.config.headers['Authorization'];
      return api.request(error.config);
    }
    
    if (error.response?.status === 401) {
      // Clear auth data on unauthorized (after retry)
      await AsyncStorage.multiRemove(['auth_token', 'username', 'user_id']);
    }
    return Promise.reject(error);
  }
);

// Helper function to get last day of month
const getLastDayOfMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

// Dashboard API - calls external API directly (same as web app backend does)
export const dashboardAPI = {
  // Get user's pharmacies
  // Web app: GET /users/{username}/pharmacies
  getPharmacies: async (username) => {
    const endpoint = API_ENDPOINTS.PHARMACIES(username);
    console.log('[dashboardAPI.getPharmacies] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      const response = await api.get(endpoint);
      console.log('[dashboardAPI.getPharmacies] ✅ Success');
      return response.data;
    } catch (error) {
      console.error('[dashboardAPI.getPharmacies] ❌ Error:', error.message);
      console.error('[dashboardAPI.getPharmacies] Status:', error.response?.status);
      console.error('[dashboardAPI.getPharmacies] Data:', error.response?.data);
      throw error;
    }
  },
  
  // Get daily data for a month
  // Web app: GET /pharmacies/{pid}/days?from=YYYY-MM-01&to=YYYY-MM-DD
  getDays: async (pid, month) => {
    // month is YYYY-MM format, convert to from/to dates
    const [year, mon] = month.split('-').map(Number);
    const lastDay = getLastDayOfMonth(year, mon);
    const fromDate = `${month}-01`;
    const toDate = `${month}-${String(lastDay).padStart(2, '0')}`;
    
    const endpoint = API_ENDPOINTS.DAYS(pid, fromDate, toDate);
    console.log('[dashboardAPI.getDays] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      const response = await api.get(endpoint);
      console.log('[dashboardAPI.getDays] ✅ Success, records:', Array.isArray(response.data) ? response.data.length : 'N/A');
      return response.data;
    } catch (error) {
      console.error('[dashboardAPI.getDays] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Get month-to-date data
  // Web app: GET /pharmacies/{pid}/mtd?month=YYYY-MM&through=YYYY-MM-DD
  getMTD: async (pid, month, through) => {
    const endpoint = API_ENDPOINTS.MTD(pid, month, through);
    console.log('[dashboardAPI.getMTD] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      const response = await api.get(endpoint);
      console.log('[dashboardAPI.getMTD] ✅ Success');
      return response.data;
    } catch (error) {
      console.error('[dashboardAPI.getMTD] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Get best sellers
  // Web app: GET /pharmacies/{pid}/stock-activity/by-quantity?date=...&limit=...
  // Or range: GET /pharmacies/{pid}/stock-activity/by-quantity/range?from=...&to=...&limit=...
  getBestSellers: async (pid, date, fromDate, toDate, limit = 20) => {
    const endpoint = API_ENDPOINTS.BEST_SELLERS(pid, date, fromDate, toDate, limit);
    console.log('[dashboardAPI.getBestSellers] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      const response = await api.get(endpoint);
      console.log('[dashboardAPI.getBestSellers] ✅ Success');
      return response.data;
    } catch (error) {
      console.error('[dashboardAPI.getBestSellers] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Get worst GP products
  // Web app: GET /pharmacies/{pid}/stock-activity/low-gp/range?from=...&to=...&threshold=...&limit=...
  getWorstGP: async (pid, date, fromDate, toDate, limit = 100, threshold = 20, excludePdst = false) => {
    const endpoint = API_ENDPOINTS.WORST_GP(pid, date, fromDate, toDate, limit, threshold, excludePdst);
    console.log('[dashboardAPI.getWorstGP] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      const response = await api.get(endpoint);
      console.log('[dashboardAPI.getWorstGP] ✅ Success');
      return response.data;
    } catch (error) {
      console.error('[dashboardAPI.getWorstGP] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Get stock value (uses days endpoint with same from/to date)
  // Web app: GET /pharmacies/{pid}/days?from=DATE&to=DATE
  getStockValue: async (pid, date) => {
    const endpoint = API_ENDPOINTS.STOCK_VALUE(pid, date);
    console.log('[dashboardAPI.getStockValue] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      const response = await api.get(endpoint);
      console.log('[dashboardAPI.getStockValue] ✅ Success');
      
      // Extract stock value from response (same logic as web app)
      const data = response.data;
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
      console.error('[dashboardAPI.getStockValue] ❌ Error:', error.message);
      return { current_stock_value: 0, opening_stock_value: 0, stock_change: 0 };
    }
  },
  
  // Get targets
  // Note: This is an admin endpoint (/admin/pharmacies/{pid}/targets) that may require special permissions
  // If it fails (401/403), we return empty targets - the app should still work without them
  getTargets: async (pid, month) => {
    const endpoint = API_ENDPOINTS.TARGETS(pid, month);
    console.log('[dashboardAPI.getTargets] URL:', `${API_BASE_URL}${endpoint}`);

    try {
      const userToken = await AsyncStorage.getItem('auth_token');
      const headers = getAuthHeaders(userToken, { preferUserToken: true });
      const response = await api.get(endpoint, { headers });
      console.log('[dashboardAPI.getTargets] ✅ Success');
      return response.data;
    } catch (error) {
      // Targets endpoint requires admin permissions - this is expected to fail for regular users
      // Return empty data so the app can continue without targets
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('[dashboardAPI.getTargets] ⚠️ No access to targets (admin only) - continuing without targets');
      } else {
        console.error('[dashboardAPI.getTargets] ❌ Error:', error.message);
      }
      return { targets: [] };
    }
  },
  
  // Save targets
  // POST /admin/pharmacies/{pid}/targets?month={month}
  // Body: { "YYYY-MM-DD": value, ... }
  saveTargets: async (pid, month, targets) => {
    const endpoint = API_ENDPOINTS.TARGETS(pid, month);
    console.log('[dashboardAPI.saveTargets] URL:', `${API_BASE_URL}${endpoint}`);

    try {
      const userToken = await AsyncStorage.getItem('auth_token');
      const headers = getAuthHeaders(userToken, { preferUserToken: true });
      const response = await api.post(endpoint, targets, { headers });
      console.log('[dashboardAPI.saveTargets] ✅ Success');
      return response.data;
    } catch (error) {
      console.error('[dashboardAPI.saveTargets] ❌ Error:', error.message);
      console.error('[dashboardAPI.saveTargets] Status:', error.response?.status);
      console.error('[dashboardAPI.saveTargets] Response:', error.response?.data);
      throw error;
    }
  },
  
  // Search products
  // Web app: GET /api/products/search?query=...&page=1&page_size=200
  searchProducts: async (query, page = 1, pageSize = 200) => {
    const endpoint = API_ENDPOINTS.PRODUCT_SEARCH(query, page, pageSize);
    console.log('[dashboardAPI.searchProducts] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      const response = await api.get(endpoint);
      console.log('[dashboardAPI.searchProducts] ✅ Success');
      
      // Handle multiple response structures
      const data = response.data;
      if (Array.isArray(data)) {
        return data;
      } else if (data.items && Array.isArray(data.items)) {
        return data.items;
      } else if (data.products && Array.isArray(data.products)) {
        return data.products;
      } else if (data.data && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    } catch (error) {
      console.error('[dashboardAPI.searchProducts] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Get product sales details
  // Web app: GET /api/products/{code}/sales?from_date=...&to_date=...&pharmacy_id=...
  getProductSales: async (code, fromDate, toDate, pharmacyId) => {
    const endpoint = API_ENDPOINTS.PRODUCT_SALES(code, fromDate, toDate, pharmacyId);
    console.log('[dashboardAPI.getProductSales] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      const response = await api.get(endpoint);
      console.log('[dashboardAPI.getProductSales] ✅ Success');
      return response.data;
    } catch (error) {
      console.error('[dashboardAPI.getProductSales] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Get product stock on hand
  // Web app: GET /api/products/{code}/stock?pharmacy_id=...&date=...
  getProductStock: async (code, pharmacyId, date) => {
    const endpoint = API_ENDPOINTS.PRODUCT_STOCK(code, pharmacyId, date);
    console.log('[dashboardAPI.getProductStock] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      const response = await api.get(endpoint);
      console.log('[dashboardAPI.getProductStock] ✅ Success');
      return response.data;
    } catch (error) {
      console.error('[dashboardAPI.getProductStock] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Get top 180-day usage data
  // Web app: GET /api/pharmacies/{pid}/usage/top-180d?limit=200
  getUsageTop180d: async (pharmacyId, limit = 200) => {
    const endpoint = API_ENDPOINTS.USAGE_TOP_180D(pharmacyId, limit);
    console.log('[dashboardAPI.getUsageTop180d] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      const response = await api.get(endpoint);
      console.log('[dashboardAPI.getUsageTop180d] ✅ Success');
      const data = response.data;
      // Handle both array and object formats
      if (Array.isArray(data)) {
        return data;
      } else if (data.items && Array.isArray(data.items)) {
        return data.items;
      }
      return [];
    } catch (error) {
      console.error('[dashboardAPI.getUsageTop180d] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Get product usage data
  // Web app: GET /api/pharmacies/{pid}/usage/product/{code}
  getProductUsage: async (pharmacyId, code) => {
    const endpoint = API_ENDPOINTS.PRODUCT_USAGE(pharmacyId, code);
    console.log('[dashboardAPI.getProductUsage] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      const response = await api.get(endpoint);
      console.log('[dashboardAPI.getProductUsage] ✅ Success');
      return response.data;
    } catch (error) {
      console.error('[dashboardAPI.getProductUsage] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Get negative stock products
  // Web app: GET /api/negative-stock?pid={pid}&date={date}&limit=200
  // External API: GET /pharmacies/{pid}/stock-activity/negative-soh?date={date}&limit={limit}
  getNegativeStock: async (pharmacyId, date, limit = 200) => {
    const endpoint = API_ENDPOINTS.NEGATIVE_STOCK(pharmacyId, date, limit);
    console.log('[dashboardAPI.getNegativeStock] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      const response = await api.get(endpoint);
      console.log('[dashboardAPI.getNegativeStock] ✅ Success');
      
      // Handle multiple response structures (same as web app)
      const data = response.data;
      if (Array.isArray(data)) {
        return data;
      } else if (data.items && Array.isArray(data.items)) {
        return data.items;
      }
      return [];
    } catch (error) {
      console.error('[dashboardAPI.getNegativeStock] ❌ Error:', error.message);
      throw error;
    }
  },
};

// Debtor API - calls external API webservice directly (same as other endpoints)
export const debtorAPI = {
  // Get user's pharmacies (same as dashboardAPI)
  getPharmacies: async (username) => {
    const endpoint = API_ENDPOINTS.PHARMACIES(username);
    console.log('[debtorAPI.getPharmacies] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      const response = await api.get(endpoint);
      console.log('[debtorAPI.getPharmacies] ✅ Success');
      return response.data;
    } catch (error) {
      console.error('[debtorAPI.getPharmacies] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Get debtor statistics
  getStatistics: async (pharmacyId) => {
    const endpoint = API_ENDPOINTS.DEBTOR_STATISTICS(pharmacyId);
    console.log('[debtorAPI.getStatistics] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      // Use user token for debtor endpoints (same as web app)
      const userToken = await AsyncStorage.getItem('auth_token');
      console.log('[debtorAPI.getStatistics] User token present:', !!userToken);
      const headers = getAuthHeaders(userToken, { preferUserToken: true });
      console.log('[debtorAPI.getStatistics] Auth header:', headers.Authorization ? 'Bearer ***' : 'None');
      const response = await api.get(endpoint, { headers });
      console.log('[debtorAPI.getStatistics] ✅ Success');
      return response.data;
    } catch (error) {
      console.error('[debtorAPI.getStatistics] ❌ Error:', error.message);
      console.error('[debtorAPI.getStatistics] Status:', error.response?.status);
      console.error('[debtorAPI.getStatistics] Response:', error.response?.data);
      throw error;
    }
  },
  
  // Get debtors list with filters
  getDebtors: async (pharmacyId, filters = {}) => {
    const endpoint = API_ENDPOINTS.DEBTORS(pharmacyId);
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });
    
    const url = `${API_BASE_URL}${endpoint}${params.toString() ? '?' + params.toString() : ''}`;
    console.log('[debtorAPI.getDebtors] URL:', url);
    
    try {
      // Use user token for debtor endpoints (same as web app)
      const userToken = await AsyncStorage.getItem('auth_token');
      const headers = getAuthHeaders(userToken, { preferUserToken: true });
      const response = await api.get(endpoint, { params, headers });
      console.log('[debtorAPI.getDebtors] ✅ Success, count:', response.data.debtors?.length || 0);
      return response.data;
    } catch (error) {
      console.error('[debtorAPI.getDebtors] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Send email to debtors
  sendEmail: async (pharmacyId, debtorIds, subject = null, message = null) => {
    const endpoint = API_ENDPOINTS.DEBTOR_SEND_EMAIL(pharmacyId);
    console.log('[debtorAPI.sendEmail] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      // Use user token for debtor endpoints (same as web app)
      const userToken = await AsyncStorage.getItem('auth_token');
      const headers = getAuthHeaders(userToken, { preferUserToken: true });
      const response = await api.post(endpoint, {
        debtor_ids: debtorIds,
        subject: subject,
        message: message,
      }, { headers });
      console.log('[debtorAPI.sendEmail] ✅ Success');
      return response.data;
    } catch (error) {
      console.error('[debtorAPI.sendEmail] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Send SMS to debtors
  sendSMS: async (pharmacyId, debtorIds, message = null) => {
    const endpoint = API_ENDPOINTS.DEBTOR_SEND_SMS(pharmacyId);
    console.log('[debtorAPI.sendSMS] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      // Use user token for debtor endpoints (same as web app)
      const userToken = await AsyncStorage.getItem('auth_token');
      const headers = getAuthHeaders(userToken, { preferUserToken: true });
      const response = await api.post(endpoint, {
        debtor_ids: debtorIds,
        message: message,
      }, { headers });
      console.log('[debtorAPI.sendSMS] ✅ Success');
      return response.data;
    } catch (error) {
      console.error('[debtorAPI.sendSMS] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Download CSV
  downloadCSV: async (pharmacyId, debtorIds = null) => {
    const endpoint = API_ENDPOINTS.DEBTOR_DOWNLOAD_CSV(pharmacyId);
    console.log('[debtorAPI.downloadCSV] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      // Use user token for debtor endpoints (same as web app)
      const userToken = await AsyncStorage.getItem('auth_token');
      const headers = getAuthHeaders(userToken, { preferUserToken: true });
      const response = await api.post(endpoint, {
        debtor_ids: debtorIds,
      }, {
        headers,
        responseType: 'blob', // For file downloads
      });
      console.log('[debtorAPI.downloadCSV] ✅ Success');
      
      // In React Native, you'd need to handle the blob/file download
      // For now, we'll just return success
      return response.data;
    } catch (error) {
      console.error('[debtorAPI.downloadCSV] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Download PDF
  downloadPDF: async (pharmacyId, debtorIds = null) => {
    const endpoint = API_ENDPOINTS.DEBTOR_DOWNLOAD_PDF(pharmacyId);
    console.log('[debtorAPI.downloadPDF] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      // Use user token for debtor endpoints (same as web app)
      const userToken = await AsyncStorage.getItem('auth_token');
      const headers = getAuthHeaders(userToken, { preferUserToken: true });
      const response = await api.post(endpoint, {
        debtor_ids: debtorIds,
      }, {
        headers,
        responseType: 'blob', // For file downloads
      });
      console.log('[debtorAPI.downloadPDF] ✅ Success');
      
      // In React Native, you'd need to handle the blob/file download
      // For now, we'll just return success
      return response.data;
    } catch (error) {
      console.error('[debtorAPI.downloadPDF] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Get debtor reports
  getReports: async (pharmacyId) => {
    const endpoint = API_ENDPOINTS.DEBTOR_REPORTS(pharmacyId);
    console.log('[debtorAPI.getReports] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      // Use user token for debtor endpoints (same as web app)
      const userToken = await AsyncStorage.getItem('auth_token');
      const headers = getAuthHeaders(userToken, { preferUserToken: true });
      const response = await api.get(endpoint, { headers });
      console.log('[debtorAPI.getReports] ✅ Success');
      return response.data;
    } catch (error) {
      console.error('[debtorAPI.getReports] ❌ Error:', error.message);
      throw error;
    }
  },
  
  // Get debtor communications
  getCommunications: async (pharmacyId, debtorId) => {
    const endpoint = API_ENDPOINTS.DEBTOR_COMMUNICATIONS(pharmacyId, debtorId);
    console.log('[debtorAPI.getCommunications] URL:', `${API_BASE_URL}${endpoint}`);
    
    try {
      // Use user token for debtor endpoints (same as web app)
      const userToken = await AsyncStorage.getItem('auth_token');
      const headers = getAuthHeaders(userToken, { preferUserToken: true });
      const response = await api.get(endpoint, { headers });
      console.log('[debtorAPI.getCommunications] ✅ Success');
      return response.data;
    } catch (error) {
      console.error('[debtorAPI.getCommunications] ❌ Error:', error.message);
      throw error;
    }
  },
};

// Legacy apiFetch function for screens that still use it
// This translates old /api/... URLs to external API URLs
export const apiFetch = async (url, options = {}) => {
  // Get auth headers
  const userToken = await AsyncStorage.getItem('auth_token');
  const authHeaders = getAuthHeaders(userToken);
  
  // Merge headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...authHeaders,
  };
  
  // Translate URL if needed (for legacy code using /api/... format)
  let finalUrl = url;
  
  // Handle /api/days?pid=X&month=YYYY-MM format
  if (url.includes('/api/days')) {
    const urlObj = new URL(url, 'https://dummy.com');
    const pid = urlObj.searchParams.get('pid');
    const month = urlObj.searchParams.get('month');
    if (pid && month) {
      const [year, mon] = month.split('-').map(Number);
      const lastDay = getLastDayOfMonth(year, mon);
      const fromDate = `${month}-01`;
      const toDate = `${month}-${String(lastDay).padStart(2, '0')}`;
      finalUrl = `${API_BASE_URL}/pharmacies/${pid}/days?from=${fromDate}&to=${toDate}`;
    }
  }
  // Handle /api/mtd?pid=X&month=YYYY-MM&through=DATE format
  else if (url.includes('/api/mtd')) {
    const urlObj = new URL(url, 'https://dummy.com');
    const pid = urlObj.searchParams.get('pid');
    const month = urlObj.searchParams.get('month');
    const through = urlObj.searchParams.get('through');
    if (pid && month && through) {
      finalUrl = `${API_BASE_URL}/pharmacies/${pid}/mtd?month=${month}&through=${through}`;
    }
  }
  // Handle /api/targets?pid=X&month=YYYY-MM format
  else if (url.includes('/api/targets')) {
    const urlObj = new URL(url, 'https://dummy.com');
    const pid = urlObj.searchParams.get('pid');
    const month = urlObj.searchParams.get('month');
    if (pid && month) {
      finalUrl = `${API_BASE_URL}/admin/pharmacies/${pid}/targets?month=${month}`;
    }
  }
  // Handle /api/stock-value?pid=X&date=DATE format
  else if (url.includes('/api/stock-value')) {
    const urlObj = new URL(url, 'https://dummy.com');
    const pid = urlObj.searchParams.get('pid');
    const date = urlObj.searchParams.get('date');
    if (pid && date) {
      finalUrl = `${API_BASE_URL}/pharmacies/${pid}/days?from=${date}&to=${date}`;
    }
  }
  // Handle /api/best-sellers format
  else if (url.includes('/api/best-sellers')) {
    const urlObj = new URL(url, 'https://dummy.com');
    const pid = urlObj.searchParams.get('pid');
    const date = urlObj.searchParams.get('date');
    const fromDate = urlObj.searchParams.get('from_date');
    const toDate = urlObj.searchParams.get('to_date');
    const limit = urlObj.searchParams.get('limit') || '20';
    if (pid) {
      if (fromDate && toDate) {
        finalUrl = `${API_BASE_URL}/pharmacies/${pid}/stock-activity/by-quantity/range?from=${fromDate}&to=${toDate}&limit=${limit}`;
      } else if (date) {
        finalUrl = `${API_BASE_URL}/pharmacies/${pid}/stock-activity/by-quantity?date=${date}&limit=${limit}`;
      }
    }
  }
  // Handle /api/worst-gp format
  else if (url.includes('/api/worst-gp')) {
    const urlObj = new URL(url, 'https://dummy.com');
    const pid = urlObj.searchParams.get('pid');
    const fromDate = urlObj.searchParams.get('from_date');
    const toDate = urlObj.searchParams.get('to_date');
    const limit = urlObj.searchParams.get('limit') || '100';
    const threshold = urlObj.searchParams.get('threshold') || '20';
    const excludePdst = urlObj.searchParams.get('exclude_pdst');
    if (pid && fromDate && toDate) {
      let newUrl = `${API_BASE_URL}/pharmacies/${pid}/stock-activity/low-gp/range?from=${fromDate}&to=${toDate}&threshold=${threshold}&limit=${limit}`;
      if (excludePdst === 'true') newUrl += '&exclude_pdst=true';
      finalUrl = newUrl;
    }
  }
  
  console.log('[apiFetch] URL:', url, '->', finalUrl);
  
  return fetch(finalUrl, { ...options, headers });
};

export default api;
