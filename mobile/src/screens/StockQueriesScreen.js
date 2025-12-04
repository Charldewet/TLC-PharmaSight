import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import PharmacyPickerModal from '../components/PharmacyPickerModal';
import DatePickerModal from '../components/DatePickerModal';
import LoadingOverlay from '../components/LoadingOverlay';
import GradientBackground from '../components/GradientBackground';
import CustomDropdown from '../components/CustomDropdown';
import { formatMoney, getYesterday } from '../utils/formatters';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { 
  PharmacyIcon, 
  CalendarIcon, 
  HamburgerIcon, 
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
} from '../components/Icons';
import Svg, { Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const StockQueriesScreen = ({ navigation }) => {
  const { user, authToken } = useAuth();
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getYesterday());
  const [showPharmacyPicker, setShowPharmacyPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Stock Lookup Section
  const [stockLookupExpanded, setStockLookupExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [productDetails, setProductDetails] = useState({});
  const [productDetailsLoading, setProductDetailsLoading] = useState({});
  const [tooltipVisible, setTooltipVisible] = useState({}); // { productId_barIndex: true }
  
  // Overstock Section
  const [overstockExpanded, setOverstockExpanded] = useState(false);
  const [overstockDaysThreshold, setOverstockDaysThreshold] = useState(30);
  const [overstockCategory, setOverstockCategory] = useState('all');
  const [overstockMinValue, setOverstockMinValue] = useState(100);
  const [overstockLoading, setOverstockLoading] = useState(false);
  const [overstockResults, setOverstockResults] = useState([]);
  const [overstockError, setOverstockError] = useState(null);
  
  // Negative Stock Section
  const [negativeStockExpanded, setNegativeStockExpanded] = useState(false);
  const [negativeStockLoading, setNegativeStockLoading] = useState(false);
  const [negativeStockResults, setNegativeStockResults] = useState([]);
  const [negativeStockError, setNegativeStockError] = useState(null);
  
  const searchTimeoutRef = useRef(null);
  const tooltipTimeoutRef = useRef({});

  useEffect(() => {
    loadPharmacies();
  }, [user, authToken]);

  // Reset all states when pharmacy or date changes
  useEffect(() => {
    if (selectedPharmacy && selectedDate) {
      // Reset all Stock Lookup states when pharmacy or date changes
      setSearchQuery('');
      setSearchResults([]);
      setSearchLoading(false);
      setExpandedProduct(null);
      setProductDetails({});
      setProductDetailsLoading({});
      setTooltipVisible({});
      
      // Reset all Overstock states when pharmacy or date changes
      setOverstockResults([]);
      setOverstockError(null);
      setOverstockLoading(false);
      setOverstockDaysThreshold(30);
      setOverstockCategory('all');
      setOverstockMinValue(100);
      
      // Reset all Negative Stock states when pharmacy or date changes
      setNegativeStockResults([]);
      setNegativeStockError(null);
      setNegativeStockLoading(false);
      
      // Clear any pending timeouts
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      Object.values(tooltipTimeoutRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      tooltipTimeoutRef.current = {};
    }
  }, [selectedPharmacy, selectedDate]);

  useEffect(() => {
    // Debounced search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery.trim());
      }, 300);
    } else {
      setSearchResults([]);
      setExpandedProduct(null);
      setProductDetails({});
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedPharmacy]);

  const loadPharmacies = async () => {
    if (!user?.username || !authToken) {
      return;
    }

    try {
      const data = await dashboardAPI.getPharmacies(user.username);
      setPharmacies(data.pharmacies || []);
      if (data.pharmacies && data.pharmacies.length > 0) {
        setSelectedPharmacy(data.pharmacies[0]);
      }
    } catch (error) {
      console.error('Error loading pharmacies:', error);
    }
  };

  const performSearch = async (query) => {
    if (!selectedPharmacy || !query || query.length < 3) {
      return;
    }

    try {
      setSearchLoading(true);
      const results = await dashboardAPI.searchProducts(query, 1, 200);
      
      // Sort results (priority-based matching)
      const queryLower = query.toLowerCase();
      const sortedResults = results.sort((a, b) => {
        const aCode = (a.product_code || a.stock_code || a.code || '').toLowerCase();
        const bCode = (b.product_code || b.stock_code || b.code || '').toLowerCase();
        const aName = (a.description || a.product_name || a.name || '').toLowerCase();
        const bName = (b.description || b.product_name || b.name || '').toLowerCase();
        
        // Exact code match first
        if (aCode === queryLower && bCode !== queryLower) return -1;
        if (bCode === queryLower && aCode !== queryLower) return 1;
        
        // Code starts with query
        if (aCode.startsWith(queryLower) && !bCode.startsWith(queryLower)) return -1;
        if (bCode.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1;
        
        // Name starts with query
        if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
        if (bName.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1;
        
        // Contains query
        const aContains = aCode.includes(queryLower) || aName.includes(queryLower);
        const bContains = bCode.includes(queryLower) || bName.includes(queryLower);
        if (aContains && !bContains) return -1;
        if (bContains && !aContains) return 1;
        
        return 0;
      });
      
      setSearchResults(sortedResults);
    } catch (error) {
      console.error('Error searching products:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleProductDetails = async (product) => {
    const productCode = product.product_code || product.stock_code || product.code || '';
    const productId = product.id || productCode;
    
    if (expandedProduct === productId) {
      // Collapse
      setExpandedProduct(null);
    } else {
      // Expand - fetch product details
      setExpandedProduct(productId);
      
      if (!productDetails[productId] && !productDetailsLoading[productId]) {
        setProductDetailsLoading(prev => ({ ...prev, [productId]: true }));
        
        try {
          const pid = selectedPharmacy.pharmacy_id || selectedPharmacy.id;
          
          // Fetch SOH and sales details in parallel
          const [sohData, salesData] = await Promise.all([
            dashboardAPI.getProductStock(productCode, pid, selectedDate).catch(() => ({ on_hand: 0 })),
            fetchProductSales(productCode, pid, selectedDate).catch(() => null),
          ]);
          
          const onHand = Number(sohData.on_hand || 0);
          
          // Calculate metrics from sales data
          let summary = {
            on_hand: onHand,
            total_qty_sold: 0,
            total_sales_value: 0,
            total_cost_of_sales: 0,
            total_gp_value: 0,
            avg_gp_percentage: 0,
            unit_price: 0,
            unit_cost: 0,
            daily_avg: 0,
            monthly_avg: 0,
          };
          
          if (salesData) {
            const daily = salesData.daily || salesData.items || [];
            summary.total_qty_sold = salesData.summary?.total_qty_sold || 
              daily.reduce((sum, d) => sum + (Number(d.qty_sold || d.quantity || 0) || 0), 0);
            summary.total_sales_value = salesData.summary?.total_sales_value || 
              daily.reduce((sum, d) => sum + (Number(d.sales_val || d.sales_value || 0) || 0), 0);
            summary.total_cost_of_sales = salesData.summary?.total_cost_of_sales || 
              daily.reduce((sum, d) => sum + (Number(d.cost_of_sales || d.cost || 0) || 0), 0);
            summary.total_gp_value = salesData.summary?.total_gp_value || 
              daily.reduce((sum, d) => sum + (Number(d.gp_value || d.gp || 0) || 0), 0);
            summary.avg_gp_percentage = salesData.summary?.avg_gp_percentage || 
              (summary.total_sales_value > 0 ? (summary.total_gp_value / summary.total_sales_value) * 100 : 0);
            
            // Calculate unit price and cost
            if (summary.total_qty_sold > 0) {
              summary.unit_price = summary.total_sales_value / summary.total_qty_sold;
              summary.unit_cost = summary.total_cost_of_sales / summary.total_qty_sold;
            }
            
            // Calculate daily average (180-day average) - matching web app
            // This calculates average daily quantity over the last 180 days
            const endDateObj = new Date(selectedDate + 'T00:00:00');
            const startDateObj = new Date(endDateObj);
            startDateObj.setDate(startDateObj.getDate() - 179); // 180 days total (0-179 = 180 days)
            
            const last180Days = daily.filter(d => {
              const dDate = d.date || d.business_date || d.bdate;
              if (!dDate) return false;
              const dayDate = new Date(dDate + 'T00:00:00');
              return dayDate >= startDateObj && dayDate <= endDateObj;
            });
            
            // Calculate total quantity over last 180 days
            const totalQty180d = last180Days.reduce((sum, d) => sum + (Number(d.qty_sold || d.quantity || d.qty || 0) || 0), 0);
            
            console.log('[StockQueries] Daily avg calculation:', {
              dailyLength: daily.length,
              last180DaysLength: last180Days.length,
              totalQty180d,
              startDate: startDateObj.toISOString().split('T')[0],
              endDate: endDateObj.toISOString().split('T')[0],
            });
            
            // Daily average = total quantity / 180 days (matching web app computeStockAvgQtyOverDays)
            // Use summary total_qty_sold if it covers the 180-day period, otherwise calculate from daily data
            const summaryQty = salesData.summary?.total_qty_sold || salesData.total_qty_sold || 0;
            if (totalQty180d > 0) {
              summary.daily_avg = totalQty180d / 180;
            } else if (summaryQty > 0) {
              // Fallback: use summary quantity / 180 if daily data doesn't cover the period
              summary.daily_avg = Number(summaryQty) / 180;
            }
            
            // Monthly average = daily average * 30 (matching web app)
            summary.monthly_avg = summary.daily_avg * 30;
            
            console.log('[StockQueries] Calculated averages:', {
              daily_avg: summary.daily_avg,
              monthly_avg: summary.monthly_avg,
            });
          }
          
          // Set initial state with summary data and chart loading (matching web app pattern)
          // Display the 6 metric cards immediately while monthly chart loads in background
          setProductDetails(prev => ({
            ...prev,
            [productId]: {
              summary,
              monthly: null,
              loading: false,
              chartLoading: true,
            },
          }));
          
          // Mark summary loading as complete so cards display immediately
          setProductDetailsLoading(prev => ({ ...prev, [productId]: false }));
          
          // Fetch monthly data separately (12 months) - matching web app pattern
          // This runs in the background while the summary cards are already displayed
          try {
            const monthlyData = await fetchProductMonthlyData(productCode, pid, selectedDate);
            
            // Update with monthly data
            setProductDetails(prev => ({
              ...prev,
              [productId]: {
                ...prev[productId],
                monthly: monthlyData,
                chartLoading: false,
              },
            }));
          } catch (error) {
            console.error('Error fetching monthly data:', error);
            // Even if monthly data fails, keep the summary cards visible
            setProductDetails(prev => ({
              ...prev,
              [productId]: {
                ...prev[productId],
                chartLoading: false,
              },
            }));
          }
        } catch (error) {
          console.error('Error fetching product details:', error);
          setProductDetails(prev => ({
            ...prev,
            [productId]: {
              summary: { on_hand: 0 },
              loading: false,
              chartLoading: false,
              error: 'Failed to load product details',
            },
          }));
          setProductDetailsLoading(prev => ({ ...prev, [productId]: false }));
        }
      }
    }
  };

  const fetchProductSales = async (productCode, pharmacyId, endDate) => {
    try {
      // Fetch last 180 days for daily average calculation (matching web app)
      const endDateObj = new Date(endDate + 'T00:00:00');
      const startDateObj = new Date(endDateObj);
      startDateObj.setDate(startDateObj.getDate() - 179); // 180 days total (0-179 = 180 days)
      const startDate = startDateObj.toISOString().split('T')[0];
      
      const data = await dashboardAPI.getProductSales(productCode, startDate, endDate, pharmacyId);
      return data;
    } catch (error) {
      console.error('Error fetching product sales:', error);
      return null;
    }
  };

  const fetchProductMonthlyData = async (productCode, pharmacyId, endDate) => {
    try {
      // Calculate 12 months back from end date (matching web app)
      const endDateObj = new Date(endDate + 'T00:00:00');
      const monthlyData = [];
      
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(endDateObj);
        monthDate.setMonth(monthDate.getMonth() - i);
        
        // Get first and last day of that month
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const firstDay = new Date(year, month, 1);
        let lastDay = new Date(year, month + 1, 0);
        
        // Don't fetch future months
        if (lastDay > endDateObj) {
          lastDay = endDateObj;
        }
        
        // Skip if this month is entirely in the future
        if (firstDay > endDateObj) {
          // Format month label even for future months (for chart completeness)
          const monthNum = month + 1;
          const yearShort = year.toString().slice(-2);
          const monthLabel = String(monthNum).padStart(2, '0') + '/' + yearShort;
          monthlyData.push({
            month: monthLabel,
            qty: 0
          });
          continue;
        }
        
        const fromStr = firstDay.toISOString().split('T')[0];
        const toStr = lastDay.toISOString().split('T')[0];
        
        // Debug logging for current month
        const isCurrentMonth = month === endDateObj.getMonth() && year === endDateObj.getFullYear();
        if (isCurrentMonth) {
          console.log('[StockQueries] Fetching current month:', {
            month: `${month + 1}/${year.toString().slice(-2)}`,
            fromStr,
            toStr,
            endDate: endDateObj.toISOString().split('T')[0],
            firstDay: firstDay.toISOString().split('T')[0],
            lastDay: lastDay.toISOString().split('T')[0],
          });
        }
        
        let monthlyQty = 0;
        
        try {
          const data = await dashboardAPI.getProductSales(productCode, fromStr, toStr, pharmacyId);
          
          // Try to get from summary first
          if (data?.summary?.total_qty_sold !== undefined) {
            monthlyQty = Number(data.summary.total_qty_sold) || 0;
          } else if (data?.total_qty_sold !== undefined) {
            monthlyQty = Number(data.total_qty_sold) || 0;
          } else {
            // Calculate from daily data
            const daily = data?.daily || data?.items || [];
            monthlyQty = daily.reduce((sum, d) => sum + (Number(d.qty_sold || d.quantity || 0) || 0), 0);
          }
          
          if (isCurrentMonth) {
            console.log('[StockQueries] Current month data:', {
              summary: data?.summary,
              dailyLength: (data?.daily || data?.items || []).length,
              monthlyQty,
            });
          }
        } catch (e) {
          // If fetch fails (404 = no data, other errors = actual problem), keep qty as 0
          // Only log non-404 errors as they're expected for months with no data
          if (e?.response?.status !== 404 && e?.response?.status !== 400) {
            console.log(`Failed to fetch month data for ${fromStr}:`, e.message || e);
          }
          if (isCurrentMonth) {
            console.log('[StockQueries] Current month fetch error:', {
              status: e?.response?.status,
              message: e.message,
            });
          }
          // 404 and 400 are expected for months with no data, so we silently continue with qty = 0
        }
        
        // Format month as MM/YY (e.g., "11/25" for November 2025)
        const monthNum = month + 1; // JavaScript months are 0-indexed
        const yearShort = year.toString().slice(-2); // Last 2 digits of year
        const monthLabel = String(monthNum).padStart(2, '0') + '/' + yearShort;
        
        monthlyData.push({
          month: monthLabel,
          qty: monthlyQty
        });
        
        if (isCurrentMonth) {
          console.log('[StockQueries] Added current month to chart:', {
            month: monthLabel,
            qty: monthlyQty,
          });
        }
      }
      
      return monthlyData;
    } catch (error) {
      console.error('Error fetching monthly data:', error);
      return [];
    }
  };

  const getDepartmentCategory = (departmentCode) => {
    if (!departmentCode) return 'other';
    const code = departmentCode.toUpperCase();
    
    // PDST = Dispensary (prescription drugs)
    if (code.startsWith('PDST')) return 'dispensary';
    
    // PDOB = Self-Medication
    if (code.startsWith('PDOB')) return 'self-medication';
    
    // GIT codes
    if (code.startsWith('GIT') || code.includes('GIT')) return 'git';
    
    // Vitamins
    if (code.includes('VIT') || code.includes('VITAMIN')) return 'vitamins';
    
    // First Aid
    if (code.includes('FIRST') || code.includes('AID') || code.includes('FA')) return 'first-aid';
    
    // Sports
    if (code.includes('SPORT')) return 'sports';
    
    // Health Foods
    if (code.includes('HEALTH') || code.includes('FOOD')) return 'health-foods';
    
    // Beauty
    if (code.includes('BEAUTY') || code.includes('COSMETIC')) return 'beauty';
    
    // Bath & Body
    if (code.includes('BATH') || code.includes('BODY')) return 'bath-body';
    
    // Baby
    if (code.includes('BABY') || code.includes('INFANT')) return 'baby';
    
    // Gifts
    if (code.includes('GIFT')) return 'gifts';
    
    return 'other';
  };

  const loadNegativeStock = async () => {
    if (!selectedPharmacy) {
      setNegativeStockError('Please select a pharmacy');
      return;
    }

    setNegativeStockLoading(true);
    setNegativeStockError(null);
    setNegativeStockResults([]);

    try {
      const pid = selectedPharmacy.pharmacy_id || selectedPharmacy.id;
      const dateStr = selectedDate;

      // Fetch negative stock data from API
      const stockData = await dashboardAPI.getNegativeStock(pid, dateStr, 200);
      
      // Normalize data - extract SOH from various field names (matching web app logic)
      const normalizedItems = stockData.map((product) => {
        const onHandRaw = product.current_soh !== undefined ? product.current_soh :
                         (product.currentSOH !== undefined ? product.currentSOH :
                         (product.on_hand !== undefined ? product.on_hand :
                         (product.soh !== undefined ? product.soh :
                         (product.stock_on_hand !== undefined ? product.stock_on_hand : 0))));
        
        // Create normalized product object
        const normalized = {
          ...product,
          description: product.description || product.productName || product.name || 'Unknown Product',
          product_code: product.product_code || product.stock_code || product.code || 'N/A',
          current_soh: Number(onHandRaw),
        };
        
        return normalized;
      });

      // API already filters and sorts by most negative first, so we can use directly
      setNegativeStockResults(normalizedItems);
    } catch (error) {
      console.error('Negative Stock error:', error);
      setNegativeStockError('Failed to load negative stock products: ' + (error.message || 'Unknown error'));
      setNegativeStockResults([]);
    } finally {
      setNegativeStockLoading(false);
    }
  };

  const generateNegativeStockPDFHTML = () => {
    const dateToUse = selectedDate || new Date().toISOString().split('T')[0];
    const pharmacyName = selectedPharmacy ? (selectedPharmacy.trading_name || selectedPharmacy.pharmacy_name || selectedPharmacy.name) : 'Unknown Pharmacy';
    
    // Format date for display
    const formattedDate = dateToUse.length === 8 
      ? `${dateToUse.slice(0, 4)}-${dateToUse.slice(4, 6)}-${dateToUse.slice(6, 8)}`
      : dateToUse;

    // Generate table rows
    const tableRows = negativeStockResults.map((product, index) => {
      const productCode = product.product_code || product.stock_code || product.code || 'N/A';
      const productName = product.description || product.productName || product.name || 'Unknown Product';
      const onHand = product.current_soh !== undefined ? product.current_soh : 0;

      return `
        <tr>
          <td style="padding: 4px;">${productName.substring(0, 50)}</td>
          <td style="padding: 4px;">${productCode}</td>
          <td style="text-align: center; padding: 4px;">${onHand.toFixed(1)}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              font-size: 9pt;
              padding: 20px;
            }
            h1 {
              font-size: 16pt;
              margin-bottom: 8px;
            }
            .info {
              font-size: 10pt;
              margin-bottom: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
              padding: 6px;
              text-align: left;
              border-bottom: 2px solid #000;
            }
            td {
              padding: 4px;
              border-bottom: 1px solid #ddd;
            }
            .name-col {
              width: 200px;
            }
            .code-col {
              width: 100px;
            }
            .soh-col {
              width: 60px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <h1>${pharmacyName} - Negative Stock Report</h1>
          <div class="info">Date: ${formattedDate}</div>
          <div class="info">Total Products: ${negativeStockResults.length}</div>
          
          <table>
            <thead>
              <tr>
                <th class="name-col">Product Name</th>
                <th class="code-col">Product Code</th>
                <th class="soh-col">SOH</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `;
  };

  const downloadNegativeStockPDF = async () => {
    if (negativeStockResults.length === 0) {
      Alert.alert('No Data', 'No negative stock products to download. Please load data first.');
      return;
    }

    try {
      // Generate HTML
      const html = generateNegativeStockPDFHTML();
      
      // Generate PDF
      const { uri } = await Print.printToFileAsync({ html });
      
      // Generate filename
      const dateToUse = selectedDate || new Date().toISOString().split('T')[0];
      const formattedDate = dateToUse.length === 8 
        ? `${dateToUse.slice(0, 4)}-${dateToUse.slice(4, 6)}-${dateToUse.slice(6, 8)}`
        : dateToUse.replace(/-/g, '');
      
      const filename = `negative-stock-${formattedDate}.pdf`;
      
      // Create a new file path with the desired filename
      const newUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.moveAsync({
        from: uri,
        to: newUri,
      });

      // Share/download the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Negative Stock Report',
        });
      } else {
        Alert.alert('Success', `PDF saved to: ${newUri}`);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    }
  };

  const loadOverStocked = async () => {
    if (!selectedPharmacy) {
      setOverstockError('Please select a pharmacy');
      return;
    }

    setOverstockLoading(true);
    setOverstockError(null);
    setOverstockResults([]);

    try {
      const pid = selectedPharmacy.pharmacy_id || selectedPharmacy.id;
      const dateStr = selectedDate;

      // Step 1: Fetch stock activity data (best sellers)
      const stockActivityData = await dashboardAPI.getBestSellers(pid, dateStr, null, null, 100);
      let items = [];
      if (Array.isArray(stockActivityData)) {
        items = stockActivityData;
      } else if (stockActivityData.best_sellers) {
        items = stockActivityData.best_sellers;
      } else if (stockActivityData.items) {
        items = stockActivityData.items;
      }

      // Step 2: Build usage map from 180d averages
      const usageMap = {};
      
      try {
        const usageData = await dashboardAPI.getUsageTop180d(pid, 200);
        usageData.forEach((u) => {
          if (u && u.product_code && typeof u.avg_qty_180d === 'number') {
            usageMap[u.product_code] = u.avg_qty_180d;
          }
        });
      } catch (e) {
        console.log('Failed to fetch bulk usage data:', e);
      }

      // Step 3: Fetch missing product usage individually
      const missingCodes = Array.from(new Set(
        items
          .map((p) => p.product_code || p.stock_code || p.code)
          .filter((c) => c && usageMap[c] === undefined)
      ));

      if (missingCodes.length > 0) {
        const perProductResults = await Promise.allSettled(
          missingCodes.map((code) =>
            dashboardAPI.getProductUsage(pid, code).catch(() => null)
          )
        );

        perProductResults.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value && typeof res.value.avg_qty_180d === 'number') {
            usageMap[missingCodes[idx]] = res.value.avg_qty_180d;
          }
        });
      }

      // Step 4: Fetch monthly sales data for current month
      const dateObj = new Date(dateStr + 'T00:00:00');
      const currentYear = dateObj.getFullYear();
      const currentMonth = dateObj.getMonth();
      const monthStart = new Date(currentYear, currentMonth, 1);
      const monthEnd = dateObj;
      const monthStartStr = monthStart.toISOString().split('T')[0];
      const monthEndStr = monthEnd.toISOString().split('T')[0];

      const monthlySalesPromises = items.map(async (product) => {
        const code = product.product_code || product.stock_code || product.code || '';
        if (!code) return { code, monthlyQty: 0 };

        try {
          const data = await dashboardAPI.getProductSales(code, monthStartStr, monthEndStr, pid);
          let monthlyQty = 0;
          if (data?.summary?.total_qty_sold !== undefined) {
            monthlyQty = Number(data.summary.total_qty_sold) || 0;
          } else if (data?.total_qty_sold !== undefined) {
            monthlyQty = Number(data.total_qty_sold) || 0;
          } else {
            const daily = data?.daily || data?.items || [];
            monthlyQty = daily.reduce((sum, d) => sum + (Number(d.qty_sold || d.quantity || 0) || 0), 0);
          }
          return { code, monthlyQty };
        } catch (e) {
          return { code, monthlyQty: 0 };
        }
      });

      const monthlySalesResults = await Promise.all(monthlySalesPromises);
      const monthlySalesMap = {};
      monthlySalesResults.forEach((result) => {
        monthlySalesMap[result.code] = result.monthlyQty;
      });

      // Step 5: Calculate days of stock and process data
      let processedData = items.map((product) => {
        const code = product.product_code || product.stock_code || product.code || '';
        
        // Extract stock on hand
        const onHandRaw = product.on_hand !== undefined ? product.on_hand : (product.currentSOH !== undefined ? product.currentSOH : 0);
        const onHand = Number(onHandRaw);
        
        // Get 180-day average daily usage
        const avg180 = usageMap[code] || 0;
        const avgDailyUsage = typeof avg180 === 'number' && isFinite(avg180) ? avg180 : 0;
        const avgMonthlyUsage = avgDailyUsage * 30;
        
        // Get monthly qty sold
        const monthlyQtySold = monthlySalesMap[code] || 0;
        
        // Calculate unit cost from daily sales data
        const qtySold = Number(product.qty_sold || product.sales_qty || 0);
        const costOfSales = Number(product.cost_of_sales || 0);
        const unitCost = qtySold > 0 ? costOfSales / qtySold : 0;
        
        // Calculate days of stock
        const days = (avgDailyUsage > 0.1) 
          ? (onHand / avgDailyUsage) 
          : 0;
        
        // Round SOH to 1 decimal place
        const roundedSOH = isFinite(onHand) ? Math.round(onHand * 10) / 10 : 0;
        
        return {
          ...product,
          currentSOH: roundedSOH,
          daysOfStock: Math.min(Math.round(days), 45),
          costPerUnit: unitCost,
          departmentCode: product.department_code || product.departmentCode || '',
          description: product.description || product.productName || product.name || 'Unknown Product',
          stock_code: code,
          avgDailyUsage: avgDailyUsage,
          avgMonthlyUsage: avgMonthlyUsage,
          monthlyQtySold: monthlyQtySold
        };
      });

      // Step 6: Filter by days threshold
      processedData = processedData.filter((product) => {
        return (product.daysOfStock || 0) >= overstockDaysThreshold;
      });

      // Step 7: Apply category and value filters
      processedData = processedData.filter((product) => {
        // Category filter
        if (overstockCategory !== 'all') {
          const category = getDepartmentCategory(product.departmentCode || '');
          if (category !== overstockCategory) return false;
        }
        
        // Value filter
        const stockValue = (product.costPerUnit || 0) * (product.currentSOH || 0);
        const meetsThreshold = stockValue >= overstockMinValue;
        
        // Special case: PDST products always included
        const isPDST = (product.departmentCode || '').toUpperCase().startsWith('PDST');
        if (isPDST) return true;
        
        return meetsThreshold;
      });

      // Step 8: Sort by days of stock (descending)
      processedData = processedData.sort((a, b) => {
        return (b.daysOfStock || 0) - (a.daysOfStock || 0);
      });

      // Step 9: Limit to 200 items
      if (processedData.length > 200) {
        processedData = processedData.slice(0, 200);
      }

      setOverstockResults(processedData);
    } catch (error) {
      console.error('Over Stocked error:', error);
      setOverstockError('Failed to load over stocked products: ' + (error.message || 'Unknown error'));
      setOverstockResults([]);
    } finally {
      setOverstockLoading(false);
    }
  };

  const getDatePickerButtonText = () => {
    if (!selectedDate) return 'Select Date';
    const date = new Date(selectedDate + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString('en-ZA', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  return (
    <GradientBackground>
      <View style={styles.container}>
        {/* Top Bar with Blur */}
        <View style={styles.topBarWrapper}>
          <LinearGradient
            colors={['rgba(255, 248, 242, 0.6)', 'rgba(255, 248, 242, 0.6)', 'rgba(255, 248, 242, 0)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.topBarFade}
            pointerEvents="none"
          />
          <BlurView 
            intensity={Platform.OS === 'ios' ? 80 : 50} 
            tint="light" 
            style={styles.topBar}
            reducedTransparencyFallbackColor="rgba(255, 255, 255, 0.3)"
          >
            <View style={styles.pageTitleSection}>
              <Text style={styles.pageTitle}>Stock Queries</Text>
            </View>

            <View style={styles.selectorRow}>
              <TouchableOpacity 
                style={styles.pharmacyPickerBtnWrapper}
                onPress={() => setShowPharmacyPicker(true)}
              >
                <LinearGradient
                  colors={[colors.accentPrimary, colors.accentPrimaryHover]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pharmacyPickerBtn}
                >
                  <PharmacyIcon size={16} color="#FFFFFF" />
                  <Text style={styles.pharmacyPickerText} numberOfLines={1}>
                    {selectedPharmacy ? (selectedPharmacy.trading_name || selectedPharmacy.pharmacy_name || selectedPharmacy.name) : 'Select Pharmacy'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.datePickerBtnWrapper}
                onPress={() => setShowDatePicker(true)}
              >
                <LinearGradient
                  colors={[colors.accentPrimary, colors.accentPrimaryHover]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.datePickerBtn}
                >
                  <CalendarIcon size={16} color="#FFFFFF" />
                  <Text style={styles.datePickerText} numberOfLines={1}>
                    {getDatePickerButtonText()}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>

        <ScrollView
          style={styles.contentArea}
          contentContainerStyle={styles.contentAreaInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Stock Lookup Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setStockLookupExpanded(!stockLookupExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionHeaderLeft}>
                {stockLookupExpanded ? (
                  <ChevronDownIcon size={20} color={colors.textPrimary} />
                ) : (
                  <ChevronRightIcon size={20} color={colors.textPrimary} />
                )}
                <Text style={styles.sectionTitle}>Stock Lookup</Text>
              </View>
            </TouchableOpacity>

            {stockLookupExpanded && (
              <View style={styles.sectionContent}>
                {/* Search Bar */}
                <View style={styles.searchBarContainer}>
                  <View style={styles.searchBar}>
                    <SearchIcon size={18} color={colors.textSecondary} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search by product name or code..."
                      placeholderTextColor={colors.textMuted}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {searchLoading && (
                      <ActivityIndicator size="small" color={colors.accentPrimary} />
                    )}
                  </View>
                </View>

                {/* Search Results */}
                {searchQuery.length >= 3 && (
                  <View style={styles.resultsContainer}>
                    {searchResults.length > 0 ? (
                      <>
                        <Text style={styles.resultsCount}>
                          Found {searchResults.length} product{searchResults.length !== 1 ? 's' : ''}
                        </Text>
                        {searchResults.map((item, index) => {
                          const productCode = item.product_code || item.stock_code || item.code || 'N/A';
                          const productName = item.description || item.product_name || item.name || item.title || 'Unknown Product';
                          const productId = item.id || productCode;
                          const isExpanded = expandedProduct === productId;
                          const details = productDetails[productId];
                          const isLoading = productDetailsLoading[productId];

                          return (
                            <View key={productId} style={styles.resultItem}>
                              <TouchableOpacity
                                style={styles.resultItemHeader}
                                onPress={() => toggleProductDetails(item)}
                                activeOpacity={0.7}
                              >
                                <View style={styles.resultItemInfo}>
                                  <Text style={styles.resultItemName} numberOfLines={1}>
                                    {productName}
                                  </Text>
                                  <Text style={styles.resultItemCode}>
                                    {productCode}
                                  </Text>
                                </View>
                                {isExpanded ? (
                                  <ChevronDownIcon size={20} color={colors.textSecondary} />
                                ) : (
                                  <ChevronRightIcon size={20} color={colors.textSecondary} />
                                )}
                              </TouchableOpacity>

                              {isExpanded && (
                                <View style={styles.productDetails}>
                                  {isLoading ? (
                                    <View style={styles.detailsLoading}>
                                      <ActivityIndicator size="small" color={colors.accentPrimary} />
                                      <Text style={styles.detailsLoadingText}>Loading product details...</Text>
                                    </View>
                                  ) : details && details.summary ? (
                                    <View style={styles.detailsContent}>
                                      {/* Product Metrics Grid */}
                                      <View style={styles.metricsGrid}>
                                        {/* Row 1: DAILY AVG, MNTH AVG */}
                                        <View style={styles.metricCard}>
                                          <Text style={[styles.metricLabel, { color: colors.chartTurnover }]}>DAILY AVG</Text>
                                          <Text style={styles.metricValue}>
                                            {details.summary.daily_avg > 0 ? details.summary.daily_avg.toFixed(1) : '—'}
                                          </Text>
                                        </View>
                                        <View style={styles.metricCard}>
                                          <Text style={[styles.metricLabel, { color: colors.chartBasket }]}>MNTH AVG</Text>
                                          <Text style={styles.metricValue}>
                                            {details.summary.monthly_avg > 0 ? details.summary.monthly_avg.toFixed(1) : '—'}
                                          </Text>
                                        </View>
                                        
                                        {/* Row 2: SOH, GP% */}
                                        <View style={styles.metricCard}>
                                          <Text style={[styles.metricLabel, { color: colors.chartTurnover }]}>SOH</Text>
                                          <Text style={styles.metricValue}>
                                            {details.summary.on_hand > 0 ? details.summary.on_hand.toFixed(1) : '0'}
                                          </Text>
                                        </View>
                                        <View style={styles.metricCard}>
                                          <Text style={[styles.metricLabel, { color: colors.chartGP }]}>GP%</Text>
                                          <Text style={styles.metricValue}>
                                            {details.summary.avg_gp_percentage > 0 ? `${details.summary.avg_gp_percentage.toFixed(2)}%` : '—'}
                                          </Text>
                                        </View>
                                        
                                        {/* Row 3: UNIT COST (left), UNIT PRICE (right) */}
                                        <View style={styles.metricCard}>
                                          <Text style={[styles.metricLabel, { color: colors.chartTurnover }]}>UNIT COST</Text>
                                          <Text style={styles.metricValue}>
                                            {details.summary.unit_cost > 0 ? `R ${details.summary.unit_cost.toFixed(2)}` : '—'}
                                          </Text>
                                        </View>
                                        <View style={styles.metricCard}>
                                          <Text style={[styles.metricLabel, { color: colors.chartTurnover }]}>UNIT PRICE</Text>
                                          <Text style={styles.metricValue}>
                                            {details.summary.unit_price > 0 ? `R ${details.summary.unit_price.toFixed(2)}` : '—'}
                                          </Text>
                                        </View>
                                      </View>
                                      
                                      {/* Monthly Sales Chart */}
                                      {details.chartLoading ? (
                                        <View style={styles.monthlyChartCard}>
                                          <LinearGradient
                                            colors={['#FF6B35', '#FF8C42', '#FF6B35']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.monthlyChartGradient}
                                          >
                                            <View style={styles.chartHeader}>
                                              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <Rect x="3" y="3" width="4" height="18" />
                                                <Rect x="10" y="8" width="4" height="13" />
                                                <Rect x="17" y="12" width="4" height="9" />
                                              </Svg>
                                              <Text style={styles.chartTitle}>MONTHLY SALES</Text>
                                            </View>
                                            <View style={styles.chartLoading}>
                                              <ActivityIndicator size="small" color="#FFFFFF" />
                                              <Text style={styles.chartLoadingText}>Loading Data...</Text>
                                            </View>
                                          </LinearGradient>
                                        </View>
                                      ) : details.monthly && Array.isArray(details.monthly) && details.monthly.length > 0 ? (
                                        <View style={styles.monthlyChartCard}>
                                          <LinearGradient
                                            colors={['#FF6B35', '#FF8C42', '#FF6B35']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.monthlyChartGradient}
                                          >
                                            {/* Chart Header */}
                                            <View style={styles.chartHeader}>
                                              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <Rect x="3" y="3" width="4" height="18" />
                                                <Rect x="10" y="8" width="4" height="13" />
                                                <Rect x="17" y="12" width="4" height="9" />
                                              </Svg>
                                              <Text style={styles.chartTitle}>MONTHLY SALES</Text>
                                            </View>
                                            
                                            {/* Bar Chart */}
                                            <View style={styles.barChartWrapper}>
                                              {details.monthly.map((monthData, index) => {
                                                const maxQty = Math.max(...details.monthly.map(m => m.qty || 0));
                                                const heightPercent = maxQty > 0 ? (monthData.qty / maxQty) * 100 : 0;
                                                const tooltipKey = `${expandedProduct}_${index}`;
                                                const showTooltip = tooltipVisible[tooltipKey] && monthData.qty > 0;
                                                
                                                return (
                                                  <TouchableOpacity
                                                    key={index}
                                                    style={styles.barGroup}
                                                    activeOpacity={0.7}
                                                    onPressIn={() => {
                                                      // Clear any existing timeout for this tooltip
                                                      if (tooltipTimeoutRef.current[tooltipKey]) {
                                                        clearTimeout(tooltipTimeoutRef.current[tooltipKey]);
                                                      }
                                                      // Show tooltip
                                                      setTooltipVisible(prev => ({ ...prev, [tooltipKey]: true }));
                                                    }}
                                                    onPressOut={() => {
                                                      // Hide tooltip after 2 seconds (matching web app)
                                                      tooltipTimeoutRef.current[tooltipKey] = setTimeout(() => {
                                                        setTooltipVisible(prev => {
                                                          const newState = { ...prev };
                                                          delete newState[tooltipKey];
                                                          return newState;
                                                        });
                                                      }, 2000);
                                                    }}
                                                  >
                                                    <View style={styles.barContainer}>
                                                      {showTooltip && (
                                                        <View style={styles.barTooltip}>
                                                          <Text style={styles.barTooltipText} numberOfLines={1}>
                                                            {Math.round(monthData.qty)}
                                                          </Text>
                                                        </View>
                                                      )}
                                                      <View 
                                                        style={[
                                                          styles.bar,
                                                          { 
                                                            height: `${Math.max(heightPercent, monthData.qty > 0 ? 3 : 0)}%`,
                                                            minHeight: monthData.qty > 0 ? 3 : 0,
                                                          }
                                                        ]} 
                                                      />
                                                    </View>
                                                    <Text style={styles.barLabel}>{monthData.month}</Text>
                                                  </TouchableOpacity>
                                                );
                                              })}
                                            </View>
                                          </LinearGradient>
                                        </View>
                                      ) : null}
                                    </View>
                                  ) : (
                                    <View style={styles.detailsError}>
                                      <Text style={styles.detailsErrorText}>
                                        {details?.error || 'No product details available'}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </>
                    ) : !searchLoading ? (
                      <Text style={styles.noResultsText}>No products found</Text>
                    ) : null}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Negative Stock Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setNegativeStockExpanded(!negativeStockExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionHeaderLeft}>
                {negativeStockExpanded ? (
                  <ChevronDownIcon size={20} color={colors.textPrimary} />
                ) : (
                  <ChevronRightIcon size={20} color={colors.textPrimary} />
                )}
                <Text style={styles.sectionTitle}>Negative Stock</Text>
              </View>
            </TouchableOpacity>

            {negativeStockExpanded && (
              <View style={styles.sectionContent}>
                {/* Load and Download Buttons */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.loadButton, { flex: 1, marginRight: 8 }]}
                    onPress={loadNegativeStock}
                    disabled={negativeStockLoading}
                  >
                    <LinearGradient
                      colors={[colors.accentPrimary, colors.accentPrimaryHover]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.loadButtonGradient}
                    >
                      {negativeStockLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.loadButtonText}>Load Negative Stock</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.downloadButton, { flex: 1, marginLeft: 8 }]}
                    onPress={downloadNegativeStockPDF}
                    disabled={negativeStockLoading || negativeStockResults.length === 0}
                  >
                    <LinearGradient
                      colors={negativeStockResults.length === 0 
                        ? [colors.textMuted, colors.textMuted]
                        : [colors.accentPrimary, colors.accentPrimaryHover]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.downloadButtonGradient}
                    >
                      <DownloadIcon size={16} color="#FFFFFF" />
                      <Text style={styles.downloadButtonText}>PDF</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* Loading State */}
                {negativeStockLoading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.accentPrimary} />
                    <Text style={styles.loadingText}>Loading...</Text>
                  </View>
                )}

                {/* Error State */}
                {negativeStockError && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{negativeStockError}</Text>
                  </View>
                )}

                {/* Empty State */}
                {!negativeStockLoading && !negativeStockError && negativeStockResults.length === 0 && (
                  <Text style={styles.noResultsText}>
                    No negative stock products loaded yet. Tap the button above to load.
                  </Text>
                )}

                {/* Results */}
                {negativeStockResults.length > 0 && (
                  <View style={styles.resultsContainer}>
                    {negativeStockResults.map((product, index) => {
                      const productCode = product.product_code || product.stock_code || product.code || 'N/A';
                      const productName = product.description || product.productName || product.name || 'Unknown Product';
                      const onHand = product.current_soh !== undefined ? product.current_soh : 0;

                      return (
                        <View key={`${productCode}_${index}`} style={styles.resultItem}>
                          {/* Header Section */}
                          <View style={styles.resultItemHeader}>
                            <View style={styles.resultItemInfo}>
                              <Text style={styles.resultItemName} numberOfLines={1}>
                                {productName}
                              </Text>
                              <Text style={styles.resultItemCode}>{productCode}</Text>
                            </View>
                            {/* SOH Card (red/warning color for negative) */}
                            <View style={styles.negativeStockSohCard}>
                              <Text style={styles.negativeStockSohLabel}>SOH</Text>
                              <Text style={styles.negativeStockSohValue}>
                                {onHand ? onHand.toFixed(1) : '0.0'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Overstock Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setOverstockExpanded(!overstockExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionHeaderLeft}>
                {overstockExpanded ? (
                  <ChevronDownIcon size={20} color={colors.textPrimary} />
                ) : (
                  <ChevronRightIcon size={20} color={colors.textPrimary} />
                )}
                <Text style={styles.sectionTitle}>Over Stocked</Text>
              </View>
            </TouchableOpacity>

            {overstockExpanded && (
              <View style={styles.sectionContent}>
                {/* Filters Card */}
                <View style={styles.filtersCard}>
                  <CustomDropdown
                    label="Days Threshold:"
                    options={[
                      { value: 7, label: '7+ days' },
                      { value: 14, label: '14+ days' },
                      { value: 21, label: '21+ days' },
                      { value: 30, label: '30+ days' },
                    ]}
                    selectedValue={overstockDaysThreshold}
                    onSelect={setOverstockDaysThreshold}
                  />

                  <CustomDropdown
                    label="Category:"
                    options={[
                      { value: 'all', label: 'All Categories' },
                      { value: 'dispensary', label: 'Dispensary' },
                      { value: 'self-medication', label: 'Self-Medication' },
                      { value: 'git', label: 'GIT' },
                      { value: 'vitamins', label: 'Vitamins' },
                      { value: 'first-aid', label: 'First Aid' },
                      { value: 'sports', label: 'Sports' },
                      { value: 'health-foods', label: 'Health Foods' },
                      { value: 'beauty', label: 'Beauty' },
                      { value: 'bath-body', label: 'Bath & Body' },
                      { value: 'baby', label: 'Baby' },
                      { value: 'gifts', label: 'Gifts' },
                      { value: 'other', label: 'Other' },
                    ]}
                    selectedValue={overstockCategory}
                    onSelect={setOverstockCategory}
                  />

                  <CustomDropdown
                    label="Min Value:"
                    options={[
                      { value: 10, label: 'R 10+' },
                      { value: 100, label: 'R 100+' },
                      { value: 200, label: 'R 200+' },
                      { value: 300, label: 'R 300+' },
                      { value: 400, label: 'R 400+' },
                      { value: 500, label: 'R 500+' },
                      { value: 600, label: 'R 600+' },
                      { value: 700, label: 'R 700+' },
                      { value: 800, label: 'R 800+' },
                      { value: 900, label: 'R 900+' },
                      { value: 1000, label: 'R 1000+' },
                    ]}
                    selectedValue={overstockMinValue}
                    onSelect={setOverstockMinValue}
                  />

                  {/* Load Button */}
                  <TouchableOpacity
                    style={styles.loadButton}
                    onPress={loadOverStocked}
                    disabled={overstockLoading}
                  >
                    <LinearGradient
                      colors={[colors.accentPrimary, colors.accentPrimaryHover]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.loadButtonGradient}
                    >
                      {overstockLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.loadButtonText}>Load Over Stocked Products</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* Loading State */}
                {overstockLoading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.accentPrimary} />
                    <Text style={styles.loadingText}>Loading...</Text>
                  </View>
                )}

                {/* Error State */}
                {overstockError && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{overstockError}</Text>
                  </View>
                )}

                {/* Empty State */}
                {!overstockLoading && !overstockError && overstockResults.length === 0 && (
                  <Text style={styles.noResultsText}>
                    No over stocked products loaded yet. Adjust filters and tap the button above.
                  </Text>
                )}

                {/* Results */}
                {overstockResults.length > 0 && (
                  <View style={styles.resultsContainer}>
                    {overstockResults.map((product, index) => {
                      const productCode = product.stock_code || product.product_code || product.code || 'N/A';
                      const productName = product.description || product.productName || product.name || 'Unknown Product';
                      const stockValue = (product.costPerUnit || 0) * (product.currentSOH || 0);
                      const daysValue = product.daysOfStock >= 45 ? '45+' : product.daysOfStock?.toString() || '0';

                      return (
                        <View key={`${productCode}_${index}`} style={styles.resultItem}>
                          {/* Header Section */}
                          <View style={styles.resultItemHeader}>
                            <View style={styles.resultItemInfo}>
                              <Text style={styles.resultItemName} numberOfLines={1}>
                                {productName}
                              </Text>
                              <Text style={styles.resultItemCode}>{productCode}</Text>
                            </View>
                          </View>

                          {/* Metrics Grid */}
                          <View style={styles.productDetails}>
                            <View style={styles.detailsContent}>
                              <View style={styles.metricsGrid}>
                                <View style={styles.metricCard}>
                                  <Text style={[styles.metricLabel, { color: colors.chartTurnover }]}>DAYS</Text>
                                  <Text style={styles.metricValue}>{daysValue}</Text>
                                </View>
                                <View style={styles.metricCard}>
                                  <Text style={[styles.metricLabel, { color: colors.chartTurnover }]}>SOH</Text>
                                  <Text style={styles.metricValue}>
                                    {product.currentSOH ? product.currentSOH.toFixed(1) : '0.0'}
                                  </Text>
                                </View>
                                <View style={styles.metricCard}>
                                  <Text style={[styles.metricLabel, { color: colors.chartGP }]}>VALUE</Text>
                                  <Text style={styles.metricValue}>
                                    R {stockValue > 0 ? stockValue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                                  </Text>
                                </View>
                                <View style={styles.metricCard}>
                                  <Text style={[styles.metricLabel, { color: colors.chartTurnover }]}>DAILY AVG</Text>
                                  <Text style={styles.metricValue}>
                                    {product.avgDailyUsage ? product.avgDailyUsage.toFixed(1) : '0.0'}
                                  </Text>
                                </View>
                                <View style={styles.metricCard}>
                                  <Text style={[styles.metricLabel, { color: colors.chartBasket }]}>MNTH AVG</Text>
                                  <Text style={styles.metricValue}>
                                    {product.avgMonthlyUsage ? product.avgMonthlyUsage.toFixed(1) : '0.0'}
                                  </Text>
                                </View>
                                <View style={styles.metricCard}>
                                  <Text style={[styles.metricLabel, { color: colors.chartTurnover }]}>MNTH QTY</Text>
                                  <Text style={styles.metricValue}>
                                    {product.monthlyQtySold ? product.monthlyQtySold.toFixed(1) : '0.0'}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Modals */}
        <PharmacyPickerModal
          visible={showPharmacyPicker}
          onClose={() => setShowPharmacyPicker(false)}
          pharmacies={pharmacies}
          selectedPharmacy={selectedPharmacy}
          onSelect={(pharmacy) => {
            setSelectedPharmacy(pharmacy);
            setShowPharmacyPicker(false);
          }}
        />

        <DatePickerModal
          visible={showDatePicker}
          selectedDate={selectedDate}
          onDateSelect={(date) => {
            setSelectedDate(date);
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />

        {/* Floating Hamburger Menu Button */}
        <View style={styles.floatingHamburgerContainer}>
          <BlurView 
            intensity={Platform.OS === 'ios' ? 80 : 50} 
            tint="light" 
            style={styles.hamburgerToggle}
            reducedTransparencyFallbackColor="rgba(255, 255, 255, 0.6)"
          >
            <TouchableOpacity
              style={styles.hamburgerToggleBtn}
              onPress={() => navigation.openDrawer()}
            >
              <HamburgerIcon size={28} color={colors.textPrimary} />
            </TouchableOpacity>
          </BlurView>
        </View>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBarWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  topBar: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingLeft: 24,
    paddingRight: 24,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  topBarFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  pageTitleSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 20,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 11,
    textAlign: 'center',
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
  },
  pharmacyPickerBtnWrapper: {
    flex: 1,
    minWidth: 0,
  },
  pharmacyPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 999,
    width: '100%',
  },
  pharmacyPickerText: {
    fontSize: 13,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  datePickerBtnWrapper: {
    flex: 1,
    minWidth: 0,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 999,
    width: '100%',
  },
  datePickerText: {
    fontSize: 13,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  contentArea: {
    flex: 1,
  },
  contentAreaInner: {
    paddingHorizontal: 24,
    paddingTop: 150,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  sectionContent: {
    marginTop: 8,
  },
  searchBarContainer: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
    padding: 0,
  },
  resultsContainer: {
    gap: 4,
  },
  resultsCount: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  resultItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 4,
  },
  resultItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  resultItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  resultItemName: {
    fontSize: 15,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  resultItemCode: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  productDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    padding: 16,
  },
  detailsLoading: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  detailsLoadingText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  detailsContent: {
    gap: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    width: '48%',
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  detailsError: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  detailsErrorText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  noResultsText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  floatingHamburgerContainer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    zIndex: 1000,
  },
  hamburgerToggle: {
    borderRadius: 999,
    padding: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  hamburgerToggleBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    width: 60,
    height: 60,
  },
  monthlyChartCard: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  monthlyChartGradient: {
    padding: 16,
    borderRadius: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  barChartWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 84, // Reduced by 30% from 120
    gap: 4,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barContainer: {
    width: '100%',
    height: '85%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  bar: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    minHeight: 3,
  },
  barLabel: {
    fontSize: 8,
    fontFamily: typography.fontFamily.bold,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 10,
  },
  chartLoading: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    flexDirection: 'row',
  },
  chartLoadingText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  filtersCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 12,
    padding: 16,
    gap: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  loadButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  loadButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadButtonText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  downloadButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  downloadButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  downloadButtonText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.statusError,
    textAlign: 'center',
  },
  barTooltip: {
    position: 'absolute',
    bottom: '100%',
    alignSelf: 'center',
    transform: [{ translateX: -30 }, { translateY: -4 }],
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 4,
    zIndex: 10,
    minWidth: 50,
    maxWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTooltipText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
    textAlign: 'center',
    flexShrink: 0,
    includeFontPadding: false,
  },
  negativeStockSohCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  negativeStockSohLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: '#991b1b',
    marginBottom: 2,
  },
  negativeStockSohValue: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: '#dc2626',
  },
});

export default StockQueriesScreen;

