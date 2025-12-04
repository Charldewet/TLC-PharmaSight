# Web App List Icon & Modal Implementation Guide

This document details how the web app implements the list icon, best sellers screen, low GP screen, and PDF download functionality. Use this as a reference for implementing the same features in the native app.

## Table of Contents
1. [List Icon Implementation](#list-icon-implementation)
2. [Best Sellers Screen](#best-sellers-screen)
3. [Low GP Products Screen](#low-gp-products-screen)
4. [PDF Creation & Download](#pdf-creation--download)
5. [API Endpoints](#api-endpoints)
6. [Data Structures](#data-structures)

---

## List Icon Implementation

### Icon SVG
The list icon is a simple three-line list icon (hamburger menu style):

```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="8" y1="6" x2="21" y2="6"></line>
  <line x1="8" y1="12" x2="21" y2="12"></line>
  <line x1="8" y1="18" x2="21" y2="18"></line>
  <line x1="3" y1="6" x2="3.01" y2="6"></line>
  <line x1="3" y1="12" x2="3.01" y2="12"></line>
  <line x1="3" y1="18" x2="3.01" y2="18"></line>
</svg>
```

### Button IDs
The list icon buttons have different IDs depending on which screen they're on:

**Best Sellers:**
- Dashboard: `best-sellers-chart-btn`
- Monthly Summary: `monthly-best-sellers-chart-btn`
- Stock Management: `stock-best-sellers-chart-btn`

**Low GP Products:**
- Dashboard: `worst-gp-list-btn`
- Monthly Summary: `monthly-worst-gp-list-btn`
- Stock Management: `stock-worst-gp-list-btn`

### Styling
- Class: `card-arrow`
- Cursor: `pointer`
- Positioned in the card header next to the title

---

## Best Sellers Screen

### Opening the Modal
When the list icon is clicked, it calls `openBestSellersListModal()`:

```javascript
async function openBestSellersListModal() {
  var overlay = document.getElementById('best-sellers-list-modal-overlay');
  
  // Show modal
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Load and render list data
  await loadBestSellersList();
}
```

### Loading Best Sellers Data
The `loadBestSellersList()` function fetches data from the API:

```javascript
async function loadBestSellersList() {
  if (!selectedPharmacyId) {
    console.log('No pharmacy selected');
    return;
  }
  
  var dateToUse = selectedDate || new Date().toISOString().split('T')[0];
  var pid = selectedPharmacyId;
  
  // Check if we're on monthly summary tab
  const monthlySummaryTab = document.getElementById('tab-monthly-summary');
  const isMonthlyView = monthlySummaryTab && !monthlySummaryTab.hidden;
  
  const container = document.getElementById('best-sellers-list-content');
  
  try {
    // Show loading state
    if (container) {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--textMuted);">Loading...</div>';
    }
    
    // Fetch top 20 best sellers
    let url;
    if (isMonthlyView) {
      const fromDate = dateToUse.slice(0, 8) + '01'; // First day of month
      const toDate = dateToUse;
      url = `/api/best-sellers?pid=${encodeURIComponent(pid)}&from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}&limit=20`;
    } else {
      url = `/api/best-sellers?pid=${encodeURIComponent(pid)}&date=${encodeURIComponent(dateToUse)}&limit=20`;
    }
    
    const resp = await fetch(url);
    const data = resp.ok ? await resp.json() : {items: []};
    
    // Handle different response structures
    let bestSellers = [];
    if (Array.isArray(data)) {
      bestSellers = data;
    } else if (data.best_sellers) {
      bestSellers = data.best_sellers;
    } else if (data.stock_activity) {
      bestSellers = data.stock_activity;
    } else if (data.items) {
      bestSellers = data.items;
    } else if (data.data && Array.isArray(data.data)) {
      bestSellers = data.data;
    }
    
    // Take top 20
    const top20 = bestSellers.slice(0, 20);
    
    // Update modal title with date
    const modalTitle = document.getElementById('best-sellers-modal-title');
    const modalDates = document.getElementById('best-sellers-modal-dates');
    if (modalTitle) modalTitle.textContent = 'Top 20 Best Sellers';
    if (modalDates) modalDates.textContent = dateToUse;
    
    // Render list
    if (!container) return;
    
    if (top20.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--textMuted);">No products found for this period</div>';
      return;
    }
    
    container.innerHTML = top20.map((item, idx) => {
      // Use correct field names from the API response (with fallbacks for older endpoints)
      const productName = item.product_description || item.description || item.product_name || item.name || 'Unknown Product';
      const productCode = item.nappi_code || item.product_code || item.code || '';
      const quantity = item.qty_sold || item.quantity_sold || item.qty || item.quantity || item.total_quantity || item.units_sold || 0;
      const gpPercent = item.gp_percent || item.gp_pct || item.margin_pct || 0;
      
      return `
        <div class="worst-gp-list-item">
          <div class="worst-gp-rank">${idx + 1}</div>
          <div class="worst-gp-details">
            <div class="worst-gp-name">${escapeHtml(productName)}</div>
            <div class="worst-gp-code">${escapeHtml(productCode)}</div>
          </div>
          <div class="worst-gp-stats">
            <div class="best-seller-qty">${quantity} units</div>
            <div class="best-seller-gp">${gpPercent.toFixed(1)}% GP</div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (e) {
    console.error('Failed to load best sellers list:', e);
    if (container) {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--textMuted);">Error loading data</div>';
    }
  }
}
```

### Closing the Modal
```javascript
function closeBestSellersListModal() {
  var overlay = document.getElementById('best-sellers-list-modal-overlay');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}
```

---

## Low GP Products Screen

### Opening the Modal
When the list icon is clicked, it calls `openWorstGPListModal()`:

```javascript
async function openWorstGPListModal() {
  var overlay = document.getElementById('worst-gp-list-modal-overlay');
  
  // Show modal
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Reset to NO SEP by default and update button states
  currentExcludePdst = true;
  updateSepButtonStates();
  
  // Load and render list data
  await loadWorstGPList();
}
```

### Loading Low GP Products Data
The `loadWorstGPList()` function fetches data from the API:

```javascript
async function loadWorstGPList(threshold, excludePdst) {
  if (!selectedPharmacyId) {
    console.log('No pharmacy selected');
    return;
  }
  
  // Use provided threshold or get from input, default to 20
  if (threshold === undefined) {
    const thresholdInput = document.getElementById('gp-threshold-input');
    threshold = thresholdInput ? parseFloat(thresholdInput.value) : 20;
  }
  
  // Use provided excludePdst or use current state
  if (excludePdst === undefined) {
    excludePdst = currentExcludePdst;
  } else {
    currentExcludePdst = excludePdst;
  }
  
  var dateToUse = selectedDate || new Date().toISOString().split('T')[0];
  var pid = selectedPharmacyId;
  
  // Check if we're on monthly summary tab or stock management tab (which uses monthly data)
  const monthlySummaryTab = document.getElementById('tab-monthly-summary');
  const stockManagementTab = document.getElementById('tab-stock-management');
  const isMonthlyView = (monthlySummaryTab && !monthlySummaryTab.hidden) || 
                        (stockManagementTab && !stockManagementTab.hidden);
  
  const container = document.getElementById('worst-gp-list-content');
  const countDisplay = document.getElementById('gp-threshold-count');
  
  try {
    // Show loading state
    if (container) {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--textMuted);">Loading...</div>';
    }
    if (countDisplay) {
      countDisplay.textContent = 'Loading...';
    }
    
    // Fetch items with exclude PDST/KSAA based on parameter
    let url;
    if (isMonthlyView) {
      const fromDate = dateToUse.slice(0, 8) + '01'; // First day of month
      const toDate = dateToUse;
      url = `/api/worst-gp?pid=${encodeURIComponent(pid)}&from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}&threshold=${threshold}&limit=100&exclude_pdst=${excludePdst}`;
    } else {
      // For daily view, use date range with same from_date and to_date (today only)
      url = `/api/worst-gp?pid=${encodeURIComponent(pid)}&from_date=${encodeURIComponent(dateToUse)}&to_date=${encodeURIComponent(dateToUse)}&threshold=${threshold}&limit=100&exclude_pdst=${excludePdst}`;
    }
    
    const resp = await fetch(url);
    const data = resp.ok ? await resp.json() : {items: []};
    
    // Handle different response structures
    let worstGPProducts = [];
    if (Array.isArray(data)) {
      worstGPProducts = data;
    } else if (data.worst_gp_products) {
      worstGPProducts = data.worst_gp_products;
    } else if (data.low_gp_products) {
      worstGPProducts = data.low_gp_products;
    } else if (data.items) {
      worstGPProducts = data.items;
    } else if (data.data && Array.isArray(data.data)) {
      worstGPProducts = data.data;
    }
    
    // Update modal title with date
    const modalTitle = document.getElementById('worst-gp-modal-title');
    const modalDates = document.getElementById('worst-gp-modal-dates');
    if (modalTitle) modalTitle.textContent = 'Low GP Products';
    if (modalDates) {
      if (isMonthlyView) {
        const fromDate = dateToUse.slice(0, 8) + '01';
        modalDates.textContent = `${fromDate} to ${dateToUse}`;
      } else {
        modalDates.textContent = dateToUse;
      }
    }
    
    // Update count display
    if (countDisplay) {
      countDisplay.textContent = `Showing ${worstGPProducts.length} product${worstGPProducts.length !== 1 ? 's' : ''} with GP% ≤ ${threshold}%`;
    }
    
    // Render list
    if (!container) return;
    
    if (worstGPProducts.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--textMuted);">No products found with GP% ≤ ${threshold}% for this period</div>`;
      return;
    }
    
    container.innerHTML = worstGPProducts.map((item, idx) => {
      // Use correct field names from the API response (with fallbacks for older endpoints)
      const productName = item.product_name || item.product_description || item.description || item.name || 'Unknown Product';
      const productCode = item.nappi_code || item.product_code || item.code || '';
      const quantity = item.quantity_sold || item.qty_sold || item.qty || item.quantity || item.total_quantity || item.units_sold || 0;
      const gpPercent = item.gp_percent || item.gp_pct || item.margin_pct || 0;
      
      return `
        <div class="worst-gp-list-item">
          <div class="worst-gp-rank">${idx + 1}</div>
          <div class="worst-gp-details">
            <div class="worst-gp-name">${escapeHtml(productName)}</div>
            <div class="worst-gp-code">${escapeHtml(productCode)}</div>
          </div>
          <div class="worst-gp-stats">
            <div class="worst-gp-gp">${gpPercent.toFixed(1)}%</div>
            <div class="worst-gp-qty">${quantity} units</div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (e) {
    console.error('Failed to load worst GP list:', e);
    if (container) {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--textMuted);">Error loading data</div>';
    }
    if (countDisplay) {
      countDisplay.textContent = 'Error loading data';
    }
  }
}
```

### Threshold Controls
The Low GP modal includes:
- **Threshold Input**: Number input (default: 20) for GP% threshold
- **Apply Button**: Applies the threshold filter
- **SEP Button**: Shows products including SEP (exclude_pdst=false)
- **NO SEP Button**: Excludes SEP products (exclude_pdst=true, default)
- **PDF Download Button**: Downloads the current list as PDF

### SEP/NO SEP Button States
```javascript
var currentExcludePdst = true; // Default to NO SEP (exclude PDST)

function updateSepButtonStates() {
  var sepBtn = document.getElementById('sep-btn');
  var noSepBtn = document.getElementById('no-sep-btn');
  
  if (sepBtn && noSepBtn) {
    if (currentExcludePdst) {
      // NO SEP is active
      sepBtn.classList.remove('btn-primary');
      sepBtn.classList.add('btn-secondary');
      noSepBtn.classList.remove('btn-secondary');
      noSepBtn.classList.add('btn-primary');
    } else {
      // SEP is active
      sepBtn.classList.remove('btn-secondary');
      sepBtn.classList.add('btn-primary');
      noSepBtn.classList.remove('btn-primary');
      noSepBtn.classList.add('btn-secondary');
    }
  }
}
```

### Closing the Modal
```javascript
function closeWorstGPListModal() {
  var overlay = document.getElementById('worst-gp-list-modal-overlay');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}
```

---

## PDF Creation & Download

### PDF Download Function
The `downloadWorstGPListPDF()` function creates a PDF from the currently displayed low GP products:

```javascript
function downloadWorstGPListPDF() {
  const container = document.getElementById('worst-gp-list-content');
  const threshold = document.getElementById('gp-threshold-input');
  const thresholdValue = threshold ? threshold.value : '20';
  
  if (!container) return;
  
  // Get all the items currently displayed
  const items = container.querySelectorAll('.worst-gp-list-item');
  
  if (items.length === 0) {
    showStyledAlert('No data to download', 'warning', 'No Data');
    return;
  }
  
  // Create PDF using jsPDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  const dateToUse = selectedDate || new Date().toISOString().split('T')[0];
  
  // Check if we're on monthly summary tab or stock management tab (which uses monthly data)
  const monthlySummaryTab = document.getElementById('tab-monthly-summary');
  const stockManagementTab = document.getElementById('tab-stock-management');
  const isMonthlyView = (monthlySummaryTab && !monthlySummaryTab.hidden) || 
                        (stockManagementTab && !stockManagementTab.hidden);
  
  // Add title
  const pharmacyName = selectedPharmacyName || 'Unknown Pharmacy';
  doc.setFontSize(16);
  doc.text(`${pharmacyName} - Low GP Products Report`, 14, 15);
  
  doc.setFontSize(10);
  if (isMonthlyView) {
    // Show date range for monthly view
    const fromDate = dateToUse.slice(0, 8) + '01'; // First day of month
    doc.text(`Period: ${fromDate} to ${dateToUse}`, 14, 22);
  } else {
    doc.text(`Date: ${dateToUse}`, 14, 22);
  }
  doc.text(`Threshold: Below ${thresholdValue}% GP`, 14, 28);
  doc.text(`Total Products: ${items.length}`, 14, 34);
  
  // Add table headers
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  let yPos = 45;
  doc.text('Rank', 14, yPos);
  doc.text('Product Name', 30, yPos);
  doc.text('Product Code', 110, yPos);
  doc.text('GP%', 155, yPos);
  doc.text('Qty', 180, yPos);
  
  // Add line under headers
  doc.line(14, yPos + 2, 195, yPos + 2);
  
  // Add data rows
  doc.setFont(undefined, 'normal');
  yPos += 8;
  
  items.forEach((item, index) => {
    const rank = item.querySelector('.worst-gp-rank')?.textContent.trim() || '';
    const name = item.querySelector('.worst-gp-name')?.textContent.trim() || '';
    const code = item.querySelector('.worst-gp-code')?.textContent.trim() || '';
    const gp = item.querySelector('.worst-gp-gp')?.textContent.trim() || '';
    const qty = item.querySelector('.worst-gp-qty')?.textContent.trim() || '';
    
    // Check if we need a new page
    if (yPos > 280) {
      doc.addPage();
      yPos = 15;
    }
    
    doc.text(rank, 14, yPos);
    doc.text(name.substring(0, 45), 30, yPos); // Truncate long names
    doc.text(code, 110, yPos);
    doc.text(gp, 155, yPos);
    doc.text(qty, 180, yPos);
    
    yPos += 6;
  });
  
  // Save the PDF with appropriate filename
  let filename;
  if (isMonthlyView) {
    const fromDate = dateToUse.slice(0, 8) + '01'; // First day of month
    filename = `low-gp-products-${fromDate}-to-${dateToUse}-below-${thresholdValue}percent.pdf`;
  } else {
    filename = `low-gp-products-${dateToUse}-below-${thresholdValue}percent.pdf`;
  }
  doc.save(filename);
}
```

### PDF Library
The web app uses **jsPDF** library for PDF generation. For native apps, you'll need to use platform-specific PDF libraries:
- **React Native**: `react-native-pdf` or `react-native-html-to-pdf`
- **iOS**: `PDFKit` (native)
- **Android**: `iText` or `PdfDocument` (native)

### PDF Structure
1. **Header Section** (yPos: 15-34):
   - Pharmacy name and report title (font size: 16)
   - Period/Date (font size: 10)
   - Threshold value (font size: 10)
   - Total products count (font size: 10)

2. **Table Headers** (yPos: 45):
   - Rank, Product Name, Product Code, GP%, Qty (font size: 9, bold)
   - Underline at yPos + 2

3. **Data Rows** (yPos: 53+):
   - Each row contains: rank, name (truncated to 45 chars), code, GP%, quantity
   - Row spacing: 6 units
   - Page break when yPos > 280

4. **Filename Format**:
   - Daily: `low-gp-products-YYYY-MM-DD-below-XXpercent.pdf`
   - Monthly: `low-gp-products-YYYY-MM-01-to-YYYY-MM-DD-below-XXpercent.pdf`

---

## API Endpoints

### Best Sellers API

**Endpoint:** `GET /api/best-sellers`

**Query Parameters:**
- `pid` (required): Pharmacy ID
- `date` (optional): Single date in YYYY-MM-DD format
- `from_date` (optional): Start date in YYYY-MM-DD format (use with `to_date`)
- `to_date` (optional): End date in YYYY-MM-DD format (use with `from_date`)
- `limit` (optional): Maximum number of results (default: 20)

**Usage:**
- Single date: `/api/best-sellers?pid=123&date=2024-01-15&limit=20`
- Date range: `/api/best-sellers?pid=123&from_date=2024-01-01&to_date=2024-01-31&limit=20`

**Response Format:**
```json
{
  "pharmacy_id": 123,
  "date": "2024-01-15",
  "best_sellers": [
    {
      "product_description": "Product Name",
      "nappi_code": "1234567",
      "qty_sold": 50,
      "gp_percent": 25.5
    }
  ]
}
```

**Alternative Response Formats (handle all):**
- Direct array: `[{...}, {...}]`
- `{ "best_sellers": [...] }`
- `{ "stock_activity": [...] }`
- `{ "items": [...] }`
- `{ "data": [...] }`

### Worst GP API

**Endpoint:** `GET /api/worst-gp`

**Query Parameters:**
- `pid` (required): Pharmacy ID
- `date` (optional): Single date in YYYY-MM-DD format
- `from_date` (optional): Start date in YYYY-MM-DD format (use with `to_date`)
- `to_date` (optional): End date in YYYY-MM-DD format (use with `from_date`)
- `limit` (optional): Maximum number of results (default: 100)
- `threshold` (optional): GP% threshold (default: 20)
- `exclude_pdst` (optional): Boolean to exclude PDST/KSAA products (default: false)

**Usage:**
- Single date: `/api/worst-gp?pid=123&date=2024-01-15&threshold=20&limit=100&exclude_pdst=true`
- Date range: `/api/worst-gp?pid=123&from_date=2024-01-01&to_date=2024-01-31&threshold=20&limit=100&exclude_pdst=true`

**Response Format:**
```json
{
  "pharmacy_id": 123,
  "date": "2024-01-15",
  "worst_gp_products": [
    {
      "product_name": "Product Name",
      "nappi_code": "1234567",
      "quantity_sold": 10,
      "gp_percent": 15.5
    }
  ]
}
```

**Alternative Response Formats (handle all):**
- Direct array: `[{...}, {...}]`
- `{ "worst_gp_products": [...] }`
- `{ "low_gp_products": [...] }`
- `{ "items": [...] }`
- `{ "data": [...] }`

---

## Data Structures

### Best Seller Item
```typescript
interface BestSellerItem {
  product_description?: string;  // Primary field name
  description?: string;           // Fallback
  product_name?: string;          // Fallback
  name?: string;                  // Fallback
  
  nappi_code?: string;            // Primary field name
  product_code?: string;          // Fallback
  code?: string;                  // Fallback
  
  qty_sold?: number;              // Primary field name
  quantity_sold?: number;          // Fallback
  qty?: number;                   // Fallback
  quantity?: number;              // Fallback
  total_quantity?: number;        // Fallback
  units_sold?: number;            // Fallback
  
  gp_percent?: number;            // Primary field name
  gp_pct?: number;                // Fallback
  margin_pct?: number;            // Fallback
}
```

### Worst GP Item
```typescript
interface WorstGPItem {
  product_name?: string;          // Primary field name
  product_description?: string;   // Fallback
  description?: string;           // Fallback
  name?: string;                  // Fallback
  
  nappi_code?: string;            // Primary field name
  product_code?: string;          // Fallback
  code?: string;                  // Fallback
  
  quantity_sold?: number;          // Primary field name
  qty_sold?: number;              // Fallback
  qty?: number;                   // Fallback
  quantity?: number;              // Fallback
  total_quantity?: number;        // Fallback
  units_sold?: number;            // Fallback
  
  gp_percent?: number;            // Primary field name
  gp_pct?: number;                // Fallback
  margin_pct?: number;            // Fallback
}
```

---

## Key Implementation Notes

1. **Date Handling:**
   - Daily view: Use single `date` parameter
   - Monthly view: Use `from_date` (first day of month) and `to_date` (selected date)
   - Format: `YYYY-MM-DD`

2. **Response Parsing:**
   - Always handle multiple response formats (array, object with different keys)
   - Use fallback field names for product data

3. **Error Handling:**
   - Show loading state while fetching
   - Display error message if fetch fails
   - Show "No data" message if array is empty

4. **Modal Management:**
   - Prevent body scroll when modal is open
   - Close modal on overlay click or close button
   - Restore body scroll when modal closes

5. **PDF Generation:**
   - Extract data from rendered DOM elements
   - Handle pagination (new page when yPos > 280)
   - Truncate long product names (45 characters)
   - Use appropriate filename format based on view type

6. **Threshold Filtering:**
   - Default threshold: 20%
   - Backend filters by threshold (GP% ≤ threshold)
   - Frontend displays count of filtered products

7. **SEP/NO SEP Toggle:**
   - NO SEP (default): `exclude_pdst=true` - excludes PDST/KSAA products
   - SEP: `exclude_pdst=false` - includes all products
   - Update button states to show active selection

---

## Native App Implementation Checklist

- [ ] Implement list icon component (SVG or icon library)
- [ ] Create modal/screen component for best sellers
- [ ] Create modal/screen component for low GP products
- [ ] Implement API calls for best sellers
- [ ] Implement API calls for worst GP with threshold and exclude_pdst
- [ ] Handle multiple response formats
- [ ] Implement threshold input and apply button
- [ ] Implement SEP/NO SEP toggle buttons
- [ ] Implement PDF generation library
- [ ] Implement PDF download functionality
- [ ] Handle date range logic (daily vs monthly)
- [ ] Display loading states
- [ ] Display error states
- [ ] Display empty states
- [ ] Style list items to match web app design

---

## Example API Calls

### Best Sellers - Daily View
```javascript
GET /api/best-sellers?pid=123&date=2024-01-15&limit=20
```

### Best Sellers - Monthly View
```javascript
GET /api/best-sellers?pid=123&from_date=2024-01-01&to_date=2024-01-31&limit=20
```

### Worst GP - Daily View (NO SEP)
```javascript
GET /api/worst-gp?pid=123&from_date=2024-01-15&to_date=2024-01-15&threshold=20&limit=100&exclude_pdst=true
```

### Worst GP - Monthly View (SEP)
```javascript
GET /api/worst-gp?pid=123&from_date=2024-01-01&to_date=2024-01-31&threshold=20&limit=100&exclude_pdst=false
```

---

This document provides all the details needed to implement the same functionality in your native app. If you need any clarification or additional details, please refer to the source code in `app/templates/dashboard.html` and `app/main.py`.

