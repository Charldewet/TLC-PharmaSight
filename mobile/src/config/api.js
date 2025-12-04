// API Configuration
// Connect directly to the deployed pharmacy API webservice
// Uses the same API key authentication as the web app backend

import { Platform } from 'react-native';

// API Base URL - the deployed pharmacy API webservice
export const API_BASE_URL = 'https://pharmacy-api-webservice.onrender.com';

// API Key for authentication (same as web app uses via PHARMA_API_KEY)
export const API_KEY = 'super-secret-long-random-string';

// Helper to get auth headers.
// Default behaviour (same as web app standard endpoints):
//   - Use API_KEY first (shared service key)
//   - Fall back to user token if API_KEY missing
// For admin endpoints we can request "preferUserToken" to flip the priority.
export const getAuthHeaders = (userToken = null, options = {}) => {
  const preferUserToken = options.preferUserToken || false;

  if (preferUserToken) {
    if (userToken) {
      return { 'Authorization': `Bearer ${userToken}` };
    }
    if (API_KEY) {
      return { 'Authorization': `Bearer ${API_KEY}` };
    }
    return {};
  }

  if (API_KEY) {
    return { 'Authorization': `Bearer ${API_KEY}` };
  }
  if (userToken) {
    return { 'Authorization': `Bearer ${userToken}` };
  }
  return {};
};

// API Endpoints - matching the external API structure
// These are the same endpoints the web app's FastAPI backend calls
export const API_ENDPOINTS = {
  // Auth - POST /auth/login with JSON body {username, password}
  LOGIN: '/auth/login',
  
  // User pharmacies - GET /users/{username}/pharmacies
  PHARMACIES: (username) => `/users/${encodeURIComponent(username)}/pharmacies`,
  
  // Daily data - GET /pharmacies/{pid}/days?from=YYYY-MM-DD&to=YYYY-MM-DD
  DAYS: (pid, from, to) => `/pharmacies/${pid}/days?from=${from}&to=${to}`,
  
  // Month-to-date - GET /pharmacies/{pid}/mtd?month=YYYY-MM&through=YYYY-MM-DD
  MTD: (pid, month, through) => `/pharmacies/${pid}/mtd?month=${month}&through=${through}`,
  
  // Best sellers - GET /pharmacies/{pid}/stock-activity/by-quantity?date=YYYY-MM-DD&limit=N
  // Or range: GET /pharmacies/{pid}/stock-activity/by-quantity/range?from=...&to=...&limit=N
  BEST_SELLERS: (pid, date, fromDate, toDate, limit = 20) => {
    if (fromDate && toDate) {
      return `/pharmacies/${pid}/stock-activity/by-quantity/range?from=${fromDate}&to=${toDate}&limit=${limit}`;
    }
    return `/pharmacies/${pid}/stock-activity/by-quantity?date=${date}&limit=${limit}`;
  },
  
  // Worst GP products - GET /pharmacies/{pid}/stock-activity/low-gp/range?from=...&to=...&threshold=...&limit=...
  // Or single date: GET /pharmacies/{pid}/stock-activity/worst-gp?date=...&limit=...
  WORST_GP: (pid, date, fromDate, toDate, limit = 100, threshold = 20, excludePdst = false) => {
    if (fromDate && toDate) {
      let url = `/pharmacies/${pid}/stock-activity/low-gp/range?from=${fromDate}&to=${toDate}&threshold=${threshold}&limit=${limit}`;
      if (excludePdst) url += '&exclude_pdst=true';
      return url;
    }
    return `/pharmacies/${pid}/stock-activity/worst-gp?date=${date}&limit=${limit}`;
  },
  
  // Stock value (uses days endpoint with same from/to date)
  STOCK_VALUE: (pid, date) => `/pharmacies/${pid}/days?from=${date}&to=${date}`,
  
  // Targets - Note: This is an admin endpoint that may require special permissions
  // If it fails, the app should continue without targets data
  TARGETS: (pid, month) => `/admin/pharmacies/${pid}/targets?month=${month}`,
  
  // Product search - GET /products/search?query=...&page=1&page_size=200
  PRODUCT_SEARCH: (query, page = 1, pageSize = 200) => `/products/search?query=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`,
  
  // Product sales - GET /products/{code}/sales?from_date=...&to_date=...&pharmacy_id=...
  PRODUCT_SALES: (code, fromDate, toDate, pharmacyId) => `/products/${encodeURIComponent(code)}/sales?from_date=${fromDate}&to_date=${toDate}&pharmacy_id=${pharmacyId}`,
  
  // Product stock on hand - GET /products/{code}/stock?pharmacy_id=...&date=...
  PRODUCT_STOCK: (code, pharmacyId, date) => `/products/${encodeURIComponent(code)}/stock?pharmacy_id=${pharmacyId}&date=${date}`,
  
  // Usage data - GET /pharmacies/{pid}/usage/top-180d?limit=200
  USAGE_TOP_180D: (pharmacyId, limit = 200) => `/pharmacies/${pharmacyId}/usage/top-180d?limit=${limit}`,
  
  // Product usage - GET /pharmacies/{pid}/usage/product/{code}
  PRODUCT_USAGE: (pharmacyId, code) => `/pharmacies/${pharmacyId}/usage/product/${encodeURIComponent(code)}`,
  
  // Negative stock - GET /pharmacies/{pid}/stock-activity/negative-soh?date=YYYY-MM-DD&limit=200
  NEGATIVE_STOCK: (pharmacyId, date, limit = 200) => `/pharmacies/${pharmacyId}/stock-activity/negative-soh?date=${date}&limit=${limit}`,
  
  // Debtor endpoints - These exist on the external API webservice
  // Note: The FastAPI backend also has proxy endpoints at /api/pharmacies/{id}/debtors
  // but the actual endpoints are on the external API webservice
  DEBTOR_STATISTICS: (pharmacyId) => `/pharmacies/${pharmacyId}/debtors/statistics`,
  DEBTORS: (pharmacyId) => `/pharmacies/${pharmacyId}/debtors`,
  DEBTOR_SEND_EMAIL: (pharmacyId) => `/pharmacies/${pharmacyId}/debtors/send-email`,
  DEBTOR_SEND_SMS: (pharmacyId) => `/pharmacies/${pharmacyId}/debtors/send-sms`,
  DEBTOR_DOWNLOAD_CSV: (pharmacyId) => `/pharmacies/${pharmacyId}/debtors/download-csv`,
  DEBTOR_DOWNLOAD_PDF: (pharmacyId) => `/pharmacies/${pharmacyId}/debtors/download-pdf`,
  DEBTOR_REPORTS: (pharmacyId) => `/pharmacies/${pharmacyId}/debtors/reports`,
  DEBTOR_COMMUNICATIONS: (pharmacyId, debtorId) => `/pharmacies/${pharmacyId}/debtors/${debtorId}/communications`,
};
