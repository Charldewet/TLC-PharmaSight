import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI, apiFetch } from '../services/api';
import PharmacyPickerModal from '../components/PharmacyPickerModal';
import DatePickerModal from '../components/DatePickerModal';
import LoadingOverlay from '../components/LoadingOverlay';
import BestSellersModal from '../components/BestSellersModal';
import LowGPModal from '../components/LowGPModal';
import GradientBackground from '../components/GradientBackground';
import { 
  formatMoney, 
  formatDate,
  getMonthString,
  getYesterday,
} from '../utils/formatters';
import { API_BASE_URL } from '../config/api';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { 
  PharmacyIcon, 
  CalendarIcon, 
  HamburgerIcon, 
  DollarIcon, 
  ShoppingCartIcon, 
  GPIcon,
  BestSellersIcon,
  WarningIcon,
  ListIcon,
} from '../components/Icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Path, Polyline, Line, Rect } from 'react-native-svg';

// Custom icon components for Stock Management
const BoxIcon = ({ size = 20, color = colors.textPrimary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <Polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <Line x1="12" y1="22.08" x2="12" y2="12" />
  </Svg>
);

const ClipboardIcon = ({ size = 20, color = colors.textPrimary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <Rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </Svg>
);

const CalendarDaysIcon = ({ size = 20, color = colors.textPrimary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <Line x1="16" y1="2" x2="16" y2="6" />
    <Line x1="8" y1="2" x2="8" y2="6" />
    <Line x1="3" y1="10" x2="21" y2="10" />
  </Svg>
);

const CreditCardIcon = ({ size = 20, color = colors.textPrimary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <Line x1="1" y1="10" x2="23" y2="10" />
  </Svg>
);

const StockManagementScreen = ({ navigation }) => {
  const { user, authToken } = useAuth();
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [showPharmacyPicker, setShowPharmacyPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBestSellersModal, setShowBestSellersModal] = useState(false);
  const [showLowGPModal, setShowLowGPModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getYesterday());
  
  // Stock management data
  const [stockData, setStockData] = useState({
    // Purchases section
    purchases: null,
    budget: null,
    budgetPercentage: 0,
    mtdPurchases: null,
    mtdBudget: null,
    mtdBudgetPercentage: 0,
    // Stock overview
    stockValue: null,
    stockChange: null,
    stockChangePercent: null,
    stockDays: null,
    costOfSales: null,
    mtdGP: null,
    mtdGPValue: null,
    // Stock summary
    bestSellers: [],
    worstGP: [],
  });

  useEffect(() => {
    loadPharmacies();
  }, [user, authToken]);

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  useEffect(() => {
    if (selectedPharmacy && selectedDate) {
      loadStockManagement(!isInitialLoad);
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  }, [selectedPharmacy, selectedDate]);

  const loadPharmacies = async () => {
    if (!user?.username || !authToken) {
      return;
    }

    try {
      setLoading(true);
      const data = await dashboardAPI.getPharmacies(user.username);
      setPharmacies(data.pharmacies || []);
      if (data.pharmacies && data.pharmacies.length > 0) {
        setSelectedPharmacy(data.pharmacies[0]);
      }
    } catch (error) {
      console.error('Error loading pharmacies:', error);
      Alert.alert('Error', 'Failed to load pharmacies. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadStockManagement = async (showOverlay = false) => {
    if (!selectedPharmacy || !selectedDate) return;

    try {
      if (showOverlay) {
        setDataLoading(true);
      } else {
        setRefreshing(true);
      }

      const pid = selectedPharmacy.pharmacy_id || selectedPharmacy.id;
      const dateObj = new Date(selectedDate + 'T00:00:00');
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      const mtdDay = dateObj.getDate();

      // Load all data in parallel
      const [stockValueData, mtdData, targetsData, bestSellersData, worstGPData] = await Promise.all([
        fetchStockValue(pid, selectedDate),
        fetchMTDData(pid, monthKey, selectedDate),
        fetchTargetsData(pid, monthKey),
        fetchBestSellers(pid, monthKey, selectedDate),
        fetchWorstGP(pid, monthKey, selectedDate),
      ]);

      console.log('[StockManagement] Fetched data:', {
        stockValueData,
        mtdData,
        targetsData: targetsData ? { ...targetsData, targets: targetsData.targets?.length || 0 } : null,
      });

      // Calculate stock days (matching web app: stock value / average daily turnover over last 30 days)
      let stockDays = null;
      if (stockValueData?.current_stock_value > 0) {
        try {
          // Get last 30 days of turnover data
          const dateForCalc = new Date(selectedDate + 'T00:00:00');
          const last30Start = new Date(dateForCalc);
          last30Start.setDate(last30Start.getDate() - 29); // 30 days including today
          const last30StartStr = last30Start.toISOString().split('T')[0];
          const last30EndStr = selectedDate;
          
          // Determine which months to fetch
          const startMonth = last30StartStr.slice(0, 7);
          const endMonth = last30EndStr.slice(0, 7);
          const monthsToFetch = startMonth !== endMonth ? [startMonth, endMonth] : [startMonth];
          
          // Fetch all required months
          const all30DayDataPromises = monthsToFetch.map(month => 
            dashboardAPI.getDays(pid, month).catch(() => [])
          );
          const all30DayDataArrays = await Promise.all(all30DayDataPromises);
          const all30DayData = all30DayDataArrays.flat();
          
          // Filter to only include dates within the 30-day range
          const filtered30Days = all30DayData.filter(day => {
            const dayDate = day.business_date || day.date || day.bdate;
            return dayDate >= last30StartStr && dayDate <= last30EndStr;
          });
          
          // Calculate average daily turnover
          const totalTurnover = filtered30Days.reduce((acc, day) => {
            return acc + (Number(day.turnover) || 0);
          }, 0);
          
          const avgDailyTurnover = filtered30Days.length > 0 ? totalTurnover / filtered30Days.length : 0;
          
          // Calculate days of inventory: Current Stock Value / Average Daily Turnover
          if (avgDailyTurnover > 0) {
            stockDays = stockValueData.current_stock_value / avgDailyTurnover;
            console.log('[StockManagement] Stock days calculation:', {
              currentStockValue: stockValueData.current_stock_value,
              totalTurnover,
              daysInRange: filtered30Days.length,
              avgDailyTurnover,
              stockDays,
            });
          } else {
            console.log('[StockManagement] Cannot calculate stock days - no average daily turnover');
          }
        } catch (error) {
          console.error('[StockManagement] Failed to calculate days of inventory:', error);
        }
      } else {
        console.log('[StockManagement] Cannot calculate stock days - no stock value');
      }

      // Calculate budgets (matching web app logic)
      let fullMonthBudget = 0;
      let mtdBudget = 0;
      
      console.log('[StockManagement] Budget calculation - monthKey:', monthKey, 'throughDate:', selectedDate, 'mtdDay:', mtdDay);
      console.log('[StockManagement] Targets data:', targetsData);
      
      // First, try to get purchase_budget directly from API
      if (targetsData?.purchase_budget) {
        fullMonthBudget = Number(targetsData.purchase_budget);
        console.log('[StockManagement] Using purchase_budget from API:', fullMonthBudget);
      }
      
      // Calculate from turnover targets (75% of turnover)
      // This is used for MTD budget and as fallback for full month budget
      if (targetsData?.targets && Array.isArray(targetsData.targets)) {
        const cutoffDateStr = `${monthKey}-${String(mtdDay).padStart(2, '0')}`;
        console.log('[StockManagement] Calculating from turnover targets, cutoffDate:', cutoffDateStr);
        
        // Full month budget from turnover targets (75%)
        const turnoverTargetFullMonth = targetsData.targets.reduce((sum, t) => sum + Number(t.value || 0), 0);
        console.log('[StockManagement] Full month turnover target:', turnoverTargetFullMonth);
        
        // If purchase_budget is 0 or not set, calculate from turnover targets
        if (fullMonthBudget === 0 && turnoverTargetFullMonth > 0) {
          fullMonthBudget = turnoverTargetFullMonth * 0.75;
          console.log('[StockManagement] Calculated full month budget from turnover targets:', fullMonthBudget);
        }
        
        // MTD budget (always calculated from turnover targets up to current day)
        const turnoverTargetMTD = targetsData.targets.reduce((sum, t) => {
          if (!t.date) return sum;
          return t.date <= cutoffDateStr ? sum + Number(t.value || 0) : sum;
        }, 0);
        console.log('[StockManagement] MTD turnover target:', turnoverTargetMTD);
        
        if (turnoverTargetMTD > 0) {
          mtdBudget = turnoverTargetMTD * 0.75;
          console.log('[StockManagement] Calculated MTD budget from turnover targets:', mtdBudget);
        } else {
          console.log('[StockManagement] No MTD turnover targets found for calculation');
        }
      } else {
        console.log('[StockManagement] No turnover targets array found in targets data');
      }
      
      console.log('[StockManagement] Final budgets - fullMonth:', fullMonthBudget, 'mtdBudget:', mtdBudget);

      const purchases = Number(mtdData?.purchases || 0);
      const budgetPercentage = fullMonthBudget > 0 ? (purchases / fullMonthBudget) * 100 : 0;
      const mtdBudgetPercentage = mtdBudget > 0 ? (purchases / mtdBudget) * 100 : 0;

      // Calculate MTD GP% (matching web app logic)
      const typeRSales = Number(mtdData?.type_r_sales || 0);
      const turnover = Number(mtdData?.turnover || 0);
      const gpValue = Number(mtdData?.gp_value || 0);
      let mtdGP = 0;
      
      if (turnover > 0) {
        const denominator = turnover - typeRSales;
        mtdGP = denominator > 0 ? (gpValue / denominator) * 100 : 0;
      }
      
      console.log('[StockManagement] MTD GP calculation:', {
        turnover,
        typeRSales,
        gpValue,
        denominator: turnover - typeRSales,
        mtdGP,
      });

      setStockData({
        purchases,
        budget: fullMonthBudget,
        budgetPercentage: Math.min(budgetPercentage, 100),
        mtdPurchases: purchases,
        mtdBudget,
        mtdBudgetPercentage: Math.min(mtdBudgetPercentage, 100),
        stockValue: stockValueData?.current_stock_value || null,
        stockChange: stockValueData?.stock_change || null,
        stockChangePercent: stockValueData?.stock_change_percent || null,
        stockDays,
        costOfSales: mtdData?.cost_of_sales || null,
        mtdGP: mtdGP > 0 ? mtdGP : null,
        mtdGPValue: gpValue > 0 ? gpValue : null,
        // Store all items for modal, but display top 5 in card (matching MonthlySummaryScreen)
        bestSellers: (bestSellersData || []).slice(0, 5),
        worstGP: (worstGPData || []).slice(0, 5),
      });

    } catch (error) {
      console.error('Error loading stock management:', error);
      Alert.alert('Error', 'Failed to load stock management data.');
    } finally {
      setDataLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStockValue = async (pid, date) => {
    try {
      // Match web app logic: fetch both current day and previous day
      // Web app uses /api/stock-value which fetches both days
      // Mobile app directly calls external API like web app backend does
      
      // Get current day's closing stock
      const currentDayData = await dashboardAPI.getDays(pid, date.slice(0, 7));
      const currentDayRecord = Array.isArray(currentDayData) 
        ? currentDayData.find(d => (d.business_date || d.date || d.bdate) === date)
        : null;
      
      const currentStockValue = currentDayRecord 
        ? parseFloat(currentDayRecord.closing_stock || 0)
        : 0;
      
      // Get previous day's closing stock (becomes opening stock)
      const dateObj = new Date(date + 'T00:00:00');
      const prevDay = new Date(dateObj);
      prevDay.setDate(prevDay.getDate() - 1);
      const prevDate = prevDay.toISOString().split('T')[0];
      const prevMonth = prevDate.slice(0, 7);
      
      const prevDayData = await dashboardAPI.getDays(pid, prevMonth).catch(() => []);
      const prevDayRecord = Array.isArray(prevDayData)
        ? prevDayData.find(d => (d.business_date || d.date || d.bdate) === prevDate)
        : null;
      
      const openingStockValue = prevDayRecord
        ? parseFloat(prevDayRecord.closing_stock || 0)
        : 0;
      
      // Calculate change
      const stockChange = currentStockValue - openingStockValue;
      const stockChangePercent = openingStockValue > 0 
        ? (stockChange / openingStockValue) * 100 
        : 0;
      
      console.log('[StockManagement] Stock value calculation:', {
        date,
        currentStockValue,
        openingStockValue,
        stockChange,
        stockChangePercent,
      });
      
      return {
        current_stock_value: currentStockValue,
        opening_stock_value: openingStockValue,
        stock_change: stockChange,
        stock_change_percent: stockChangePercent,
      };
    } catch (error) {
      console.error('[StockManagement] Error fetching stock value:', error);
      return null;
    }
  };

  const fetchMTDData = async (pid, monthKey, throughDate) => {
    try {
      const resp = await apiFetch(`${API_BASE_URL}/api/mtd?pid=${pid}&month=${monthKey}&through=${throughDate}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (resp.ok) {
        return await resp.json();
      }
    } catch (error) {
      console.error('Error fetching MTD data:', error);
    }
    return null;
  };

  const fetchTargetsData = async (pid, monthKey) => {
    try {
      // Use dashboardAPI.getTargets which has better error handling
      // Returns { targets: [] } on error instead of null
      const data = await dashboardAPI.getTargets(pid, monthKey);
      return data || { targets: [] };
    } catch (error) {
      console.error('Error fetching targets data:', error);
      // Return empty targets object so budget calculation can continue
      return { targets: [] };
    }
  };

  const fetchBestSellers = async (pid, monthKey, throughDate) => {
    try {
      // Match MonthlySummaryScreen: fetch 20 items (for modal), display top 5 in card
      const firstOfMonth = `${monthKey}-01`;
      const data = await dashboardAPI.getBestSellers(pid, null, firstOfMonth, throughDate, 20);
      console.log('[StockManagement] fetchBestSellers Raw API response:', JSON.stringify(data, null, 2));
      
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
      
      console.log('[StockManagement] Parsed bestSellers:', bestSellers.length, 'items');
      if (bestSellers.length > 0) {
        console.log('[StockManagement] First best seller KEYS:', Object.keys(bestSellers[0]));
        console.log('[StockManagement] First best seller:', JSON.stringify(bestSellers[0], null, 2));
      }
      
      // Return all items (will be sliced to top 5 in setStockData)
      return bestSellers;
    } catch (error) {
      console.error('[StockManagement] Error fetching best sellers:', error);
      return [];
    }
  };

  const fetchWorstGP = async (pid, monthKey, throughDate) => {
    try {
      // Match MonthlySummaryScreen: fetch 50 items with threshold=20 and exclude_pdst=true
      const firstOfMonth = `${monthKey}-01`;
      const data = await dashboardAPI.getWorstGP(pid, null, firstOfMonth, throughDate, 50, 20, true);
      console.log('[StockManagement] fetchWorstGP Raw API response:', JSON.stringify(data, null, 2));
      
      let worstGP = [];
      if (Array.isArray(data)) {
        worstGP = data;
      } else if (data.worst_gp_products) {
        worstGP = data.worst_gp_products;
      } else if (data.low_gp_products) {
        worstGP = data.low_gp_products;
      } else if (data.items) {
        worstGP = data.items;
      } else if (data.data && Array.isArray(data.data)) {
        worstGP = data.data;
      }
      
      console.log('[StockManagement] Parsed worstGP:', worstGP.length, 'items');
      if (worstGP.length > 0) {
        console.log('[StockManagement] First worst GP KEYS:', Object.keys(worstGP[0]));
        console.log('[StockManagement] First worst GP:', JSON.stringify(worstGP[0], null, 2));
      }
      
      // Return all items (will be sliced to top 5 in setStockData)
      return worstGP;
    } catch (error) {
      console.error('[StockManagement] Error fetching worst GP:', error);
      return [];
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setDataLoading(true);
    try {
      await loadStockManagement(false);
    } finally {
      setRefreshing(false);
      setDataLoading(false);
    }
  };

  const handlePharmacySelect = (pharmacy) => {
    setSelectedPharmacy(pharmacy);
    setShowPharmacyPicker(false);
  };

  const getDatePickerButtonText = () => {
    if (!selectedDate) return 'Select Date';
    // Show short date format: "Monday, 15 Jan" or just "15 Jan"
    const date = new Date(selectedDate + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    // Check if it's yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // Otherwise show formatted date
    return date.toLocaleDateString('en-ZA', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  // Donut chart component
  const DonutChart = ({ percentage, color, gradientId }) => {
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (Math.min(percentage, 100) / 100) * circumference;
    
    return (
      <View style={styles.pieChartContainer}>
        <Svg width={120} height={120} viewBox="0 0 120 120">
          <Defs>
            <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={color} stopOpacity="1" />
              <Stop offset="100%" stopColor={color} stopOpacity="0.7" />
            </SvgLinearGradient>
          </Defs>
          <Circle cx="60" cy="60" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="20" />
          <Circle 
            cx="60" 
            cy="60" 
            r={radius} 
            fill="none" 
            stroke={`url(#${gradientId})`}
            strokeWidth="20"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 60 60)"
          />
        </Svg>
        <View style={styles.pieChartCenter}>
          <Text style={styles.pieChartPercentage}>{Math.round(percentage)}%</Text>
          <Text style={styles.pieChartLabel}>USED</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <GradientBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <View style={styles.container}>
        {/* Top Bar with Blur */}
        <View style={styles.topBarWrapper}>
          {/* Soft gradient fade at bottom edge - behind content */}
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
            {/* Page Title Section */}
            <View style={styles.pageTitleSection}>
              <Text style={styles.pageTitle}>Stock Management</Text>
            </View>

            {/* Selector Row: Pharmacy | Date */}
            <View style={styles.selectorRow}>
              {/* Pharmacy Picker Button */}
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

              {/* Date Picker Button */}
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

      {/* Main Content */}
      <ScrollView
        style={styles.contentArea}
        contentContainerStyle={styles.contentAreaInner}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Purchases Section */}
        <Text style={styles.sectionHeading}>Purchases</Text>
        <View style={styles.budgetCardsRow}>
          {/* Full Month Budget Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIcon}>
                  <CreditCardIcon size={16} color={colors.chartGP} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.chartGP }]}>Budget</Text>
              </View>
            </View>
            <View style={styles.budgetCardContent}>
              <View style={styles.budgetCardList}>
                <View style={styles.budgetItem}>
                  <Text style={styles.budgetLabel}>PURCHASES</Text>
                  <View style={styles.budgetValueWrapper}>
                    <Text style={styles.budgetCurrency}>R</Text>
                    <Text style={styles.budgetValue}>{stockData.purchases !== null ? formatMoney(stockData.purchases) : '—'}</Text>
                  </View>
                </View>
                <View style={styles.budgetItem}>
                  <Text style={styles.budgetLabel}>BUDGET</Text>
                  <View style={styles.budgetValueWrapper}>
                    <Text style={styles.budgetCurrency}>R</Text>
                    <Text style={styles.budgetValue}>{stockData.budget > 0 ? formatMoney(stockData.budget) : '—'}</Text>
                  </View>
                </View>
              </View>
              <DonutChart percentage={stockData.budgetPercentage} color={colors.chartGP} gradientId="budgetGradient" />
            </View>
          </View>

          {/* MTD Budget Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIcon}>
                  <CreditCardIcon size={16} color={colors.chartBasket} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.chartBasket }]}>MTD Budget</Text>
              </View>
            </View>
            <View style={styles.budgetCardContent}>
              <View style={styles.budgetCardList}>
                <View style={styles.budgetItem}>
                  <Text style={styles.budgetLabel}>PURCHASES</Text>
                  <View style={styles.budgetValueWrapper}>
                    <Text style={styles.budgetCurrency}>R</Text>
                    <Text style={styles.budgetValue}>{stockData.mtdPurchases !== null ? formatMoney(stockData.mtdPurchases) : '—'}</Text>
                  </View>
                </View>
                <View style={styles.budgetItem}>
                  <Text style={styles.budgetLabel}>MTD BUDGET</Text>
                  <View style={styles.budgetValueWrapper}>
                    <Text style={styles.budgetCurrency}>R</Text>
                    <Text style={styles.budgetValue}>{stockData.mtdBudget > 0 ? formatMoney(stockData.mtdBudget) : '—'}</Text>
                  </View>
                </View>
              </View>
              <DonutChart percentage={stockData.mtdBudgetPercentage} color={colors.chartBasket} gradientId="mtdBudgetGradient" />
            </View>
          </View>
        </View>

        {/* Stock Overview Section */}
        <Text style={styles.sectionHeading}>Stock Overview</Text>
        <View style={styles.stockOverviewGrid}>
          {/* Stock Value Card */}
          <View style={[styles.card, { width: '48%', flexGrow: 1 }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIcon}>
                  <ClipboardIcon size={16} color={colors.chartTurnover} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.chartTurnover }]}>Stock Value</Text>
              </View>
            </View>
            <View style={styles.overviewCardValue}>
              <Text style={styles.overviewCurrency}>R</Text>
              <Text style={styles.overviewAmount}>
                {stockData.stockValue !== null && stockData.stockValue > 0 
                  ? formatMoney(stockData.stockValue) 
                  : '—'}
              </Text>
            </View>
            {stockData.stockChange !== null && stockData.stockChange !== 0 && (
              <Text style={[
                styles.overviewComparison,
                stockData.stockChange >= 0 ? styles.positiveText : styles.negativeText
              ]}>
                {stockData.stockChange >= 0 ? '+' : ''}R {formatMoney(Math.abs(stockData.stockChange))} ({stockData.stockChangePercent >= 0 ? '+' : ''}{stockData.stockChangePercent?.toFixed(1)}%)
              </Text>
            )}
          </View>

          {/* Days Card */}
          <View style={[styles.card, { width: '48%', flexGrow: 1 }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIcon}>
                  <CalendarDaysIcon size={16} color={colors.chartBasketSize} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.chartBasketSize }]}>Days</Text>
              </View>
            </View>
            <View style={styles.overviewCardValue}>
              <Text style={styles.overviewAmount}>{stockData.stockDays !== null && stockData.stockDays > 0 ? stockData.stockDays.toFixed(1) : '—'}</Text>
            </View>
            <Text style={styles.overviewComparison}>Days of inventory left</Text>
          </View>

          {/* Cost of Sales Card */}
          <View style={[styles.card, { width: '48%', flexGrow: 1 }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIcon}>
                  <ShoppingCartIcon size={16} color={colors.chartGP} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.chartGP }]}>Cost of Sales</Text>
              </View>
            </View>
            <View style={styles.overviewCardValue}>
              <Text style={styles.overviewCurrency}>R</Text>
              <Text style={styles.overviewAmount}>{stockData.costOfSales !== null ? formatMoney(stockData.costOfSales) : '—'}</Text>
            </View>
            <Text style={styles.overviewComparison}>MTD</Text>
          </View>

          {/* MTD GP Card */}
          <View style={[styles.card, { width: '48%', flexGrow: 1 }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIcon}>
                  <GPIcon size={16} color={colors.chartBasket} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.chartBasket }]}>MTD GP</Text>
              </View>
            </View>
            <View style={styles.overviewCardValue}>
              <Text style={styles.overviewAmount}>{stockData.mtdGP !== null && stockData.mtdGP > 0 ? stockData.mtdGP.toFixed(1) : '—'}</Text>
              <Text style={styles.overviewCurrencyAfter}>%</Text>
            </View>
            {stockData.mtdGPValue !== null && stockData.mtdGPValue > 0 && (
              <Text style={styles.overviewComparison}>R {formatMoney(stockData.mtdGPValue)}</Text>
            )}
          </View>
        </View>

        {/* Stock Summary Section */}
        <Text style={styles.sectionHeading}>Stock Summary</Text>
        <View style={styles.stockSummaryRow}>
          {/* Best Sellers Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIcon}>
                  <BestSellersIcon size={16} color={colors.chartBasket} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.chartBasket }]}>Best Sellers</Text>
              </View>
              <TouchableOpacity 
                style={styles.listIconButton}
                onPress={() => setShowBestSellersModal(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ListIcon size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.stockList}>
              {stockData.bestSellers.length > 0 ? (
                stockData.bestSellers.map((item, index) => {
                  // Handle various field names from different API endpoints (range vs single date)
                  // Match MonthlySummaryScreen exactly
                  const productName = item.product_description || item.description || item.product_name || item.name || item.title || 'Unknown';
                  const productCode = item.nappi_code || item.product_code || item.stock_code || item.code || item.barcode || item.item_code || '—';
                  // For range queries, quantity might be in different fields
                  const quantity = item.qty_sold || item.quantity_sold || item.total_qty_sold || item.total_quantity_sold || 
                                   item.total_qty || item.total_quantity || item.qty || item.quantity || 
                                   item.units_sold || item.units || 0;
                  // For range queries, GP/sales value might be in different fields
                  const gpValue = item.gp_value || item.total_gp_value || item.total_gp || item.gp || 
                                  item.gross_profit || item.turnover || item.total_turnover || 
                                  item.sales_value || item.total_sales || item.value || 0;
                  
                  return (
                    <View key={index} style={styles.stockItem}>
                      <View style={styles.stockDetails}>
                        <Text style={styles.stockName} numberOfLines={1}>
                          {productName}
                        </Text>
                        <Text style={styles.stockCode}>
                          {productCode}
                        </Text>
                      </View>
                      <View style={styles.stockStats}>
                        <Text style={styles.stockQty}>
                          {quantity}
                        </Text>
                        <Text style={styles.stockGP}>
                          R {formatMoney(gpValue)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No data available</Text>
              )}
            </View>
          </View>

          {/* Low GP Products Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIcon}>
                  <WarningIcon size={16} color={colors.statusWarning} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.statusWarning }]}>Low GP Products</Text>
              </View>
              <TouchableOpacity 
                style={styles.listIconButton}
                onPress={() => setShowLowGPModal(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ListIcon size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.stockList}>
              {stockData.worstGP.length > 0 ? (
                stockData.worstGP.map((item, index) => {
                  // Handle various field names from different API endpoints (range vs single date)
                  // Match MonthlySummaryScreen exactly
                  const productName = item.product_name || item.product_description || item.description || item.name || item.title || 'Unknown';
                  const productCode = item.nappi_code || item.lp_code || item.product_code || item.stock_code || item.code || item.barcode || item.item_code || '—';
                  const gpPercent = item.gp_percent || item.gp_pct || item.margin_pct || item.gp_percentage || 0;
                  // For range queries, quantity might be in different fields
                  const quantity = item.quantity_sold || item.qty_sold || item.total_qty_sold || item.total_quantity_sold ||
                                   item.total_qty || item.total_quantity || item.qty || item.quantity || 
                                   item.units_sold || item.units || 0;
                  
                  return (
                    <View key={index} style={styles.stockItem}>
                      <View style={styles.stockDetails}>
                        <Text style={styles.stockName} numberOfLines={1}>
                          {productName}
                        </Text>
                        <Text style={styles.stockCode}>
                          {productCode}
                        </Text>
                      </View>
                      <View style={styles.stockStats}>
                        <Text style={[styles.stockGP, { color: colors.statusWarning }]}>
                          {gpPercent.toFixed(1)}%
                        </Text>
                        <Text style={styles.stockQty}>
                          {quantity} units
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No data available</Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <PharmacyPickerModal
        visible={showPharmacyPicker}
        onClose={() => setShowPharmacyPicker(false)}
        pharmacies={pharmacies}
        selectedPharmacy={selectedPharmacy}
        onSelect={handlePharmacySelect}
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

      <BestSellersModal
        visible={showBestSellersModal}
        onClose={() => setShowBestSellersModal(false)}
        pharmacyId={selectedPharmacy?.pharmacy_id || selectedPharmacy?.id}
        date={null}
        fromDate={selectedDate ? `${selectedDate.slice(0, 7)}-01` : null}
        toDate={selectedDate}
        isDailyView={false}
      />

      <LowGPModal
        visible={showLowGPModal}
        onClose={() => setShowLowGPModal(false)}
        pharmacyId={selectedPharmacy?.pharmacy_id || selectedPharmacy?.id}
        date={null}
        fromDate={selectedDate ? `${selectedDate.slice(0, 7)}-01` : null}
        toDate={selectedDate}
        isDailyView={false}
        pharmacyName={selectedPharmacy?.trading_name || selectedPharmacy?.name || 'Unknown'}
      />

      {/* Loading Overlay for data changes */}
      <LoadingOverlay
        visible={dataLoading}
        message="Loading stock data..."
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
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
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
  },
  topBarFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 0,
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
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    // Shadow for Android
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
  sectionHeading: {
    fontSize: 16,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  budgetCardsRow: {
    flexDirection: 'column',
    gap: 4,
    marginBottom: 24,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 20,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardIcon: {
    marginRight: 6,
  },
  cardTitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: -0.1,
  },
  budgetCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetCardList: {
    flex: 1,
    marginRight: 16,
  },
  budgetItem: {
    marginBottom: 12,
  },
  budgetLabel: {
    fontSize: 9,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  budgetValueWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  budgetCurrency: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    marginRight: 4,
  },
  budgetValue: {
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  pieChartContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pieChartCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pieChartPercentage: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  pieChartLabel: {
    fontSize: 8,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  stockOverviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 24,
  },
  overviewCardValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
    minHeight: 32,
  },
  overviewCurrency: {
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    marginRight: 3,
  },
  overviewCurrencyAfter: {
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    marginLeft: 1,
  },
  overviewAmount: {
    fontSize: 22,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  overviewComparison: {
    fontSize: 10,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  positiveText: {
    color: colors.statusSuccess,
  },
  negativeText: {
    color: colors.statusError,
  },
  stockSummaryRow: {
    flexDirection: 'column',
    gap: 4,
    marginBottom: 24,
  },
  listIconButton: {
    padding: 4,
  },
  stockList: {
    gap: 12,
  },
  stockItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  stockDetails: {
    flex: 1,
    marginRight: 12,
  },
  stockName: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  stockCode: {
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  stockStats: {
    alignItems: 'flex-end',
  },
  stockGP: {
    fontSize: 17,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4,
  },
  stockQty: {
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
  },
});

export default StockManagementScreen;

