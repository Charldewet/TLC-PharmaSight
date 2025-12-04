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
  TextInput,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import DashboardCard from '../components/DashboardCard';
import SpendAnalyticsCard from '../components/SpendAnalyticsCard';
import GroupViewCard from '../components/GroupViewCard';
import PharmacyPickerModal from '../components/PharmacyPickerModal';
import DatePickerModal from '../components/DatePickerModal';
import LoadingOverlay from '../components/LoadingOverlay';
import GradientBackground from '../components/GradientBackground';
import { 
  formatMoney, 
  formatDate,
  getMonthString,
  getPreviousMonth,
  getPreviousYearMonth,
  getToday,
  getYesterday,
} from '../utils/formatters';
import { API_BASE_URL } from '../config/api';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { PharmacyIcon, GroupViewIcon, CalendarIcon, HamburgerIcon, DollarIcon, ShoppingCartIcon, GPIcon, BasketIcon, DailyIcon, MonthlyIcon } from '../components/Icons';
import { LinearGradient } from 'expo-linear-gradient';

const DashboardScreen = ({ navigation }) => {
  const { user, authToken } = useAuth();
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [showPharmacyPicker, setShowPharmacyPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [groupViewEnabled, setGroupViewEnabled] = useState(false);
  
  // View mode
  const [summaryViewMode, setSummaryViewMode] = useState('daily');
  const [selectedMonth, setSelectedMonth] = useState(getMonthString());
  const [selectedDate, setSelectedDate] = useState(getToday());
  
  // Dashboard data
  const [dashboardData, setDashboardData] = useState({
    currentTurnover: null,
    budgetTurnover: null,
    gpPercent: null,
    gpValue: null,
    basket: null,
    transactions: null,
    purchases: null,
    purchaseBudget: null,
    currentComparison: null,
    budgetComparison: null,
    purchaseComparison: null,
    purchaseBudgetComparison: null,
  });

  // Group view data: { [pharmacyId]: { turnover: {...}, purchases: {...}, gp: {...}, basket: {...} } }
  const [groupViewData, setGroupViewData] = useState({});
  const [groupViewLoading, setGroupViewLoading] = useState(false);

  useEffect(() => {
    loadPharmacies();
  }, [user, authToken]);

  // Track if this is the initial load or a data change
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // When switching view modes, update date accordingly:
  // - Monthly view: use yesterday (as per requirement)
  // - Daily view: use today
  useEffect(() => {
    if (summaryViewMode === 'monthly') {
      setSelectedDate(getYesterday());
    } else if (summaryViewMode === 'daily') {
      setSelectedDate(getToday());
    }
  }, [summaryViewMode]);

  useEffect(() => {
    if (groupViewEnabled) {
      loadGroupViewData(!isInitialLoad);
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    } else if (selectedPharmacy) {
      // Show overlay for data changes after initial load
      loadDashboard(!isInitialLoad);
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  }, [selectedPharmacy, selectedMonth, selectedDate, summaryViewMode, groupViewEnabled]);

  const loadPharmacies = async () => {
    if (!user?.username) {
      console.log('[loadPharmacies] No username available');
      return;
    }

    if (!authToken) {
      console.error('[loadPharmacies] No auth token available');
      Alert.alert('Error', 'Authentication required. Please log in again.');
      return;
    }

    try {
      setLoading(true);
      console.log('[loadPharmacies] Using API_BASE_URL:', API_BASE_URL);
      console.log('[loadPharmacies] Username:', user.username);
      console.log('[loadPharmacies] Auth token present:', !!authToken);
      console.log('[loadPharmacies] Auth token length:', authToken?.length);
      
      // Use the dashboardAPI service which has proper axios interceptors
      const data = await dashboardAPI.getPharmacies(user.username);
      console.log('[loadPharmacies] Response data:', data);
      
      const pharmaciesList = data.pharmacies || [];
      
      if (pharmaciesList.length === 0) {
        console.warn('[loadPharmacies] No pharmacies returned from API');
        Alert.alert('Info', 'No pharmacies available. Please contact your administrator.');
      }
      
      // Sort pharmacies so "TLC GROUP" always appears last (same as web app)
      const sortedPharmacies = pharmaciesList.sort((a, b) => {
        const nameA = (a.pharmacy_name || a.name || '').toUpperCase();
        const nameB = (b.pharmacy_name || b.name || '').toUpperCase();
        if (nameA === 'TLC GROUP') return 1;
        if (nameB === 'TLC GROUP') return -1;
        return nameA.localeCompare(nameB);
      });
      
      console.log('[loadPharmacies] Sorted pharmacies:', sortedPharmacies.length);
      setPharmacies(sortedPharmacies);
      
      // Initialize with first pharmacy if available (same as web app)
      if (sortedPharmacies.length > 0 && !selectedPharmacy) {
        console.log('[loadPharmacies] Setting initial pharmacy:', sortedPharmacies[0]);
        setSelectedPharmacy(sortedPharmacies[0]);
      }
    } catch (error) {
      console.error('[loadPharmacies] Error loading pharmacies:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error occurred';
      Alert.alert('Error', `Failed to load pharmacies: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async (showOverlay = false) => {
    if (!selectedPharmacy || !selectedDate) return;
    
    const pid = selectedPharmacy.pharmacy_id || selectedPharmacy.id;
    const month = selectedDate.slice(0, 7);
    
    try {
      if (showOverlay) {
        setDataLoading(true);
      }
      
      if (summaryViewMode === 'daily') {
        await loadDailyDashboard(pid, month, selectedDate);
      } else {
        await loadMonthlyDashboard(pid, month, selectedDate);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const loadDailyDashboard = async (pid, month, date) => {
    try {
      // Use dashboardAPI service which has correct endpoints
      const daysData = await dashboardAPI.getDays(pid, month);
      const dayData = (Array.isArray(daysData) ? daysData : []).find(d => d.business_date === date) || null;
      
      const prevYearData = await getPreviousYearWeekdayData(date, pid);
      
      // Targets may not exist on external API - handle gracefully
      let targetsData = { targets: [] };
      try {
        targetsData = await dashboardAPI.getTargets(pid, month);
      } catch (e) {
        console.log('Targets not available:', e.message);
      }
      const dayTarget = (targetsData.targets || []).find(t => t.date === date) || null;
      
      updateDashboardDaily(dayData, prevYearData, dayTarget, date);
    } catch (error) {
      console.error('Error loading daily dashboard:', error);
    }
  };

  const loadMonthlyDashboard = async (pid, month, throughDate) => {
    try {
      // Use dashboardAPI service which has correct endpoints
      const currentData = await dashboardAPI.getDays(pid, month);
      
      const prevMonth = getPreviousMonth(month);
      const prevMonthData = await dashboardAPI.getDays(pid, prevMonth).catch(() => []);
      
      const prevYearMonth = getPreviousYearMonth(month);
      const prevYearData = await dashboardAPI.getDays(pid, prevYearMonth).catch(() => []);
      
      // Targets may not exist on external API - handle gracefully
      let targetsData = { targets: [] };
      try {
        targetsData = await dashboardAPI.getTargets(pid, month);
      } catch (e) {
        console.log('Targets not available:', e.message);
      }
      
      const mtdData = await dashboardAPI.getMTD(pid, month, throughDate).catch(() => null);
      
      updateDashboardMonthly(
        Array.isArray(currentData) ? currentData : [], 
        Array.isArray(prevMonthData) ? prevMonthData : [], 
        Array.isArray(prevYearData) ? prevYearData : [], 
        targetsData.targets || [], 
        month, 
        mtdData
      );
    } catch (error) {
      console.error('Error loading monthly dashboard:', error);
    }
  };

  const getPreviousYearWeekdayData = async (date, pid) => {
    try {
      const dateObj = new Date(date + 'T00:00:00');
      const weekday = dateObj.getDay();
      const prevYear = dateObj.getFullYear() - 1;
      
      const prevYearMonth = `${prevYear}-${date.slice(5, 7)}`;
      // Use dashboardAPI service which has correct endpoints
      const daysData = await dashboardAPI.getDays(pid, prevYearMonth);
      
      return (Array.isArray(daysData) ? daysData : []).find(d => {
        const dDate = new Date(d.business_date + 'T00:00:00');
        return dDate.getDay() === weekday;
      }) || null;
    } catch (error) {
      return null;
    }
  };

  const updateDashboardDaily = (dayData, prevYearData, dayTarget, date) => {
    const currentTurnover = dayData ? Number(dayData.turnover || 0) : 0;
    const currentPurchases = dayData ? Number(dayData.purchases || dayData.daily_purchases || dayData.purchases_value || 0) : 0;
    const prevYearTurnover = prevYearData ? Number(prevYearData.turnover || 0) : 0;
    
    let budgetTurnover = dayTarget ? Number(dayTarget.value || 0) : 0;
    if (budgetTurnover === 0 && prevYearTurnover > 0) {
      budgetTurnover = prevYearTurnover * 1.10;
    }
    
    const yoyGrowth = prevYearTurnover > 0 ? ((currentTurnover - prevYearTurnover) / prevYearTurnover) * 100 : null;
    const purchaseBudgetDaily = budgetTurnover * 0.75;
    const purchaseBudgetDifference = currentPurchases - purchaseBudgetDaily;
    
    const gpValue = dayData ? Number(dayData.gp_value || dayData.gp || 0) : 0;
    const gpPercent = currentTurnover > 0 ? (gpValue / currentTurnover) * 100 : 0;
    const transactions = dayData ? Number(dayData.transaction_count || dayData.transactions || 0) : 0;
    let basket = dayData ? Number(dayData.avg_basket || dayData.basket || 0) : 0;
    if (basket === 0 && transactions > 0) {
      basket = currentTurnover / transactions;
    } else if (basket === 0 && currentTurnover > 0) {
      const estTransactions = Math.max(1, Math.round(currentTurnover / 150));
      basket = currentTurnover / estTransactions;
    }
    
    const dateObj = new Date(date + 'T00:00:00');
    const prevYear = dateObj.getFullYear() - 1;
    
    setDashboardData({
      currentTurnover,
      budgetTurnover,
      gpPercent,
      gpValue,
      basket,
      transactions: transactions || (currentTurnover > 0 ? Math.max(1, Math.round(currentTurnover / 150)) : 0),
      purchases: currentPurchases,
      purchaseBudget: purchaseBudgetDaily,
      currentComparison: prevYearTurnover > 0 ? `vs ${prevYear}: R ${formatMoney(prevYearTurnover)}` : '—',
      budgetComparison: budgetTurnover > 0 && currentTurnover > 0 ? 
        `R ${formatMoney(Math.abs(currentTurnover - budgetTurnover))} ${currentTurnover >= budgetTurnover ? 'above' : 'under'}` : '—',
      purchaseComparison: purchaseBudgetDaily > 0 && currentPurchases > 0 ?
        `R ${formatMoney(Math.abs(purchaseBudgetDifference))} ${purchaseBudgetDifference >= 0 ? 'above' : 'below'}` : '—',
      purchaseBudgetComparison: purchaseBudgetDaily > 0 && currentPurchases > 0 ?
        `R ${formatMoney(Math.abs(purchaseBudgetDifference))} ${purchaseBudgetDifference >= 0 ? 'above' : 'below'}` : '—',
      currentPercentage: yoyGrowth,
      budgetPercentage: budgetTurnover > 0 && currentTurnover > 0 ? 
        ((currentTurnover - budgetTurnover) / budgetTurnover) * 100 : null,
      purchaseBudgetPercentage: purchaseBudgetDaily > 0 && currentPurchases > 0 ?
        (purchaseBudgetDifference / purchaseBudgetDaily) * 100 : null,
    });
  };

  const updateDashboardMonthly = (currentData, prevMonthData, prevYearData, targets, month, mtdData) => {
    const throughDate = selectedDate;
    const mtdDays = currentData.filter(d => {
      const dDate = d.business_date || d.date || d.bdate;
      return dDate && dDate <= throughDate;
    });
    
    // Use MTD aggregated data if available (authoritative), otherwise calculate from days
    const currentTurnover = mtdData && mtdData.turnover !== undefined 
      ? Number(mtdData.turnover || 0)
      : mtdDays.reduce((sum, d) => sum + Number(d.turnover || 0), 0);
    const currentPurchases = mtdData && mtdData.purchases !== undefined
      ? Number(mtdData.purchases || 0)
      : mtdDays.reduce((sum, d) => sum + Number(d.purchases || d.daily_purchases || d.purchases_value || 0), 0);
    const prevMonthTurnover = prevMonthData.reduce((sum, d) => sum + Number(d.turnover || 0), 0);
    
    const prevYearMTDDays = prevYearData.filter(d => {
      const dDate = d.business_date || d.date || d.bdate;
      if (!dDate) return false;
      const dDateObj = new Date(dDate + 'T00:00:00');
      const throughDateObj = new Date(throughDate + 'T00:00:00');
      return dDateObj.getDate() <= throughDateObj.getDate();
    });
    const prevYearTurnover = prevYearMTDDays.reduce((sum, d) => sum + Number(d.turnover || 0), 0);
    
    const mtdTargets = targets.filter(t => {
      const tDate = t.date;
      return tDate && tDate <= throughDate;
    });
    let budgetTurnover = mtdTargets.reduce((sum, t) => sum + Number(t.value || 0), 0);
    
    if (budgetTurnover === 0 && prevYearTurnover > 0) {
      budgetTurnover = prevYearTurnover * 1.10;
    }
    
    let gpPercent = 0;
    let gpValue = 0;
    let basket = 0;
    let transactions = 0;
    
    if (mtdData) {
      // Use MTD aggregated data for GP value, transactions, and basket
      // But always use currentTurnover (calculated from MTD days) for percentage calculations
      gpValue = Number(mtdData.gp_value || 0);
      transactions = Number(mtdData.transaction_count || 0);
      basket = Number(mtdData.avg_basket || 0);
      gpPercent = currentTurnover > 0 ? (gpValue / currentTurnover) * 100 : 0;
      
      if (basket === 0 && transactions > 0) {
        basket = currentTurnover / transactions;
      } else if (basket === 0 && currentTurnover > 0) {
        const estTransactions = Math.max(1, Math.round(currentTurnover / 150));
        basket = currentTurnover / estTransactions;
      }
    } else {
      const totalGp = mtdDays.reduce((sum, d) => sum + Number(d.gp_value || d.gp || 0), 0);
      gpValue = totalGp;
      gpPercent = currentTurnover > 0 ? (totalGp / currentTurnover) * 100 : 0;
      transactions = mtdDays.reduce((sum, d) => sum + Number(d.transaction_count || d.transactions || 0), 0);
      if (transactions > 0) {
        basket = currentTurnover / transactions;
      } else if (currentTurnover > 0) {
        const estTransactions = Math.max(1, Math.round(currentTurnover / 150));
        basket = currentTurnover / estTransactions;
      }
    }
    
    const purchaseBudget = currentTurnover * 0.75;
    const purchaseBudgetDifference = currentPurchases - purchaseBudget;
    
    const [year] = month.split('-');
    const prevYear = parseInt(year) - 1;
    const yoyGrowth = prevYearTurnover > 0 ? ((currentTurnover - prevYearTurnover) / prevYearTurnover) * 100 : null;
    
    setDashboardData({
      currentTurnover,
      budgetTurnover,
      gpPercent,
      gpValue,
      basket,
      transactions: transactions || (currentTurnover > 0 ? Math.max(1, Math.round(currentTurnover / 150)) : 0),
      purchases: currentPurchases,
      purchaseBudget,
      currentComparison: prevYearTurnover > 0 ? `vs ${prevYear}: R ${formatMoney(prevYearTurnover)}` : '—',
      budgetComparison: budgetTurnover > 0 && currentTurnover > 0 ?
        `R ${formatMoney(Math.abs(currentTurnover - budgetTurnover))} ${currentTurnover >= budgetTurnover ? 'above' : 'under'}` : '—',
      purchaseComparison: purchaseBudget > 0 && currentPurchases > 0 ?
        `R ${formatMoney(Math.abs(purchaseBudgetDifference))} ${purchaseBudgetDifference >= 0 ? 'above' : 'below'}` : '—',
      purchaseBudgetComparison: purchaseBudget > 0 && currentPurchases > 0 ?
        `R ${formatMoney(Math.abs(purchaseBudgetDifference))} ${purchaseBudgetDifference >= 0 ? 'above' : 'below'}` : '—',
      currentPercentage: yoyGrowth,
      budgetPercentage: budgetTurnover > 0 && currentTurnover > 0 ?
        ((currentTurnover - budgetTurnover) / budgetTurnover) * 100 : null,
      purchaseBudgetPercentage: purchaseBudget > 0 && currentPurchases > 0 ?
        (purchaseBudgetDifference / purchaseBudget) * 100 : null,
    });
  };

  const loadGroupViewData = async (showOverlay = false) => {
    if (!pharmacies.length) return;
    
    if (showOverlay) {
      setDataLoading(true);
    } else {
      setGroupViewLoading(true);
    }
    
    const month = selectedDate.slice(0, 7);
    const newGroupData = {};
    
    try {
      // Load data for all pharmacies in parallel
      const promises = pharmacies.map(async (pharmacy) => {
        const pid = pharmacy.pharmacy_id || pharmacy.id;
        try {
          if (summaryViewMode === 'daily') {
            await loadPharmacyGroupDataDaily(pid, month, newGroupData);
          } else {
            await loadPharmacyGroupDataMonthly(pid, month, newGroupData);
          }
        } catch (error) {
          console.error(`Error loading group data for pharmacy ${pid}:`, error);
        }
      });
      
      await Promise.all(promises);
      setGroupViewData(newGroupData);
    } catch (error) {
      console.error('Error loading group view data:', error);
    } finally {
      setGroupViewLoading(false);
      setDataLoading(false);
    }
  };

  const loadPharmacyGroupDataMonthly = async (pid, month, groupData) => {
    try {
      const throughDate = selectedDate;
      
      // Use dashboardAPI service which has correct endpoints
      const currentData = await dashboardAPI.getDays(pid, month).catch(() => []);
      
      // Get targets - may not exist on external API
      let targetsData = { targets: [] };
      try {
        targetsData = await dashboardAPI.getTargets(pid, month);
      } catch (e) {
        console.log('Targets not available:', e.message);
      }
      
      // Get previous year data
      const prevYearMonth = getPreviousYearMonth(month);
      const prevYearData = await dashboardAPI.getDays(pid, prevYearMonth).catch(() => []);
      
      // Get MTD aggregated data
      const mtdData = await dashboardAPI.getMTD(pid, month, throughDate).catch(() => null);
      
      updatePharmacyGroupData(
        pid, 
        Array.isArray(currentData) ? currentData : [], 
        targetsData.targets || [], 
        Array.isArray(prevYearData) ? prevYearData : [], 
        mtdData, 
        month, 
        groupData
      );
    } catch (error) {
      console.error(`Error loading monthly group data for pharmacy ${pid}:`, error);
    }
  };

  const loadPharmacyGroupDataDaily = async (pid, month, groupData) => {
    try {
      if (!selectedDate) return;
      
      // Use dashboardAPI service which has correct endpoints
      const daysData = await dashboardAPI.getDays(pid, month).catch(() => []);
      const dayData = (Array.isArray(daysData) ? daysData : []).find(d => d.business_date === selectedDate) || null;
      
      // Get previous year weekday data
      const prevYearData = await getPreviousYearWeekdayData(selectedDate, pid);
      
      // Get targets - may not exist on external API
      let targetsData = { targets: [] };
      try {
        targetsData = await dashboardAPI.getTargets(pid, month);
      } catch (e) {
        console.log('Targets not available:', e.message);
      }
      const dayTarget = (targetsData.targets || []).find(t => t.date === selectedDate) || null;
      
      updatePharmacyGroupDataDaily(pid, dayData, prevYearData, dayTarget, selectedDate, groupData);
    } catch (error) {
      console.error(`Error loading daily group data for pharmacy ${pid}:`, error);
    }
  };

  const updatePharmacyGroupData = (pid, currentData, targets, prevYearData, mtdData, month, groupData) => {
    const throughDate = selectedDate;
    const mtdDays = currentData.filter(d => {
      const dDate = d.business_date || d.date || d.bdate;
      return dDate && dDate <= throughDate;
    });
    
    const currentTurnover = mtdDays.reduce((sum, d) => sum + Number(d.turnover || 0), 0);
    const currentPurchases = mtdDays.reduce((sum, d) => sum + Number(d.purchases || d.daily_purchases || d.purchases_value || 0), 0);
    
    const prevYearMTDDays = prevYearData.filter(d => {
      const dDate = d.business_date || d.date || d.bdate;
      if (!dDate) return false;
      const dDateObj = new Date(dDate + 'T00:00:00');
      const throughDateObj = new Date(throughDate + 'T00:00:00');
      return dDateObj.getDate() <= throughDateObj.getDate();
    });
    const prevYearTurnover = prevYearMTDDays.reduce((sum, d) => sum + Number(d.turnover || 0), 0);
    
    const mtdTargets = targets.filter(t => {
      const tDate = t.date;
      return tDate && tDate <= throughDate;
    });
    let budgetTurnover = mtdTargets.reduce((sum, t) => sum + Number(t.value || 0), 0);
    
    if (budgetTurnover === 0 && prevYearTurnover > 0) {
      budgetTurnover = prevYearTurnover * 1.10;
    }
    
    const purchaseBudget = currentTurnover * 0.75;
    const purchaseBudgetDifference = currentPurchases - purchaseBudget;
    
    // Calculate turnover growth
    const turnoverGrowth = prevYearTurnover > 0 && currentTurnover > 0
      ? ((currentTurnover - prevYearTurnover) / prevYearTurnover) * 100
      : null;
    
    // Calculate GP
    let gpPercent = 0;
    let gpValue = 0;
    if (mtdData) {
      gpValue = Number(mtdData.gp_value || 0);
      const turnover = Number(mtdData.turnover || 0);
      gpPercent = turnover > 0 ? (gpValue / turnover) * 100 : 0;
    } else {
      const totalGp = mtdDays.reduce((sum, d) => sum + Number(d.gp_value || d.gp || 0), 0);
      gpValue = totalGp;
      gpPercent = currentTurnover > 0 ? (totalGp / currentTurnover) * 100 : 0;
    }
    
    // Calculate basket
    let basket = 0;
    let transactions = 0;
    if (mtdData) {
      transactions = Number(mtdData.transaction_count || 0);
      basket = Number(mtdData.avg_basket || 0);
      if (basket === 0 && transactions > 0) {
        basket = Number(mtdData.turnover || 0) / transactions;
      }
    } else {
      transactions = mtdDays.reduce((sum, d) => sum + Number(d.transaction_count || d.transactions || 0), 0);
      if (transactions > 0) {
        basket = currentTurnover / transactions;
      }
    }
    
    // Calculate purchase percentage
    const purchasePct = purchaseBudget > 0 ? ((currentPurchases - purchaseBudget) / purchaseBudget) * 100 : null;
    
    if (!groupData[pid]) {
      groupData[pid] = {};
    }
    
    groupData[pid].turnover = {
      value: currentTurnover,
      comparison: prevYearTurnover > 0 ? `vs last year: R ${formatMoney(prevYearTurnover)}` : null,
      percentage: turnoverGrowth,
    };
    
    groupData[pid].purchases = {
      value: currentPurchases,
      comparison: purchaseBudgetDifference !== 0 
        ? `R ${formatMoney(Math.abs(purchaseBudgetDifference))} ${purchaseBudgetDifference >= 0 ? 'over' : 'under'}`
        : null,
      percentage: purchasePct,
    };
    
    groupData[pid].gp = {
      value: gpPercent,
      comparison: gpValue > 0 ? `R ${formatMoney(gpValue)}` : null,
    };
    
    groupData[pid].basket = {
      value: basket,
      comparison: transactions > 0 ? `${transactions.toLocaleString('en-ZA')} transactions` : null,
    };
  };

  const updatePharmacyGroupDataDaily = (pid, dayData, prevYearData, dayTarget, date, groupData) => {
    const currentTurnover = dayData ? Number(dayData.turnover || 0) : 0;
    const currentPurchases = dayData ? Number(dayData.purchases || dayData.daily_purchases || dayData.purchases_value || 0) : 0;
    const prevYearTurnover = prevYearData ? Number(prevYearData.turnover || 0) : 0;
    
    let budgetTurnover = dayTarget ? Number(dayTarget.value || 0) : 0;
    if (budgetTurnover === 0 && prevYearTurnover > 0) {
      budgetTurnover = prevYearTurnover * 1.10;
    }
    
    const purchaseBudget = budgetTurnover * 0.75;
    const purchaseBudgetDifference = currentPurchases - purchaseBudget;
    
    const turnoverGrowth = prevYearTurnover > 0 && currentTurnover > 0
      ? ((currentTurnover - prevYearTurnover) / prevYearTurnover) * 100
      : null;
    
    const gpValue = dayData ? Number(dayData.gp_value || dayData.gp || 0) : 0;
    const gpPercent = currentTurnover > 0 ? (gpValue / currentTurnover) * 100 : 0;
    
    const transactions = dayData ? Number(dayData.transaction_count || dayData.transactions || 0) : 0;
    let basket = dayData ? Number(dayData.avg_basket || dayData.basket || 0) : 0;
    if (basket === 0 && transactions > 0) {
      basket = currentTurnover / transactions;
    } else if (basket === 0 && currentTurnover > 0) {
      const estTransactions = Math.max(1, Math.round(currentTurnover / 150));
      basket = currentTurnover / estTransactions;
    }
    
    const purchasePct = purchaseBudget > 0 ? ((currentPurchases - purchaseBudget) / purchaseBudget) * 100 : null;
    
    const prevYear = new Date(date + 'T00:00:00').getFullYear() - 1;
    
    if (!groupData[pid]) {
      groupData[pid] = {};
    }
    
    groupData[pid].turnover = {
      value: currentTurnover,
      comparison: prevYearTurnover > 0 ? `vs last year: R ${formatMoney(prevYearTurnover)}` : null,
      percentage: turnoverGrowth,
    };
    
    groupData[pid].purchases = {
      value: currentPurchases,
      comparison: purchaseBudgetDifference !== 0
        ? `R ${formatMoney(Math.abs(purchaseBudgetDifference))} ${purchaseBudgetDifference >= 0 ? 'over' : 'under'}`
        : null,
      percentage: purchasePct,
    };
    
    groupData[pid].gp = {
      value: gpPercent,
      comparison: gpValue > 0 ? `R ${formatMoney(gpValue)}` : null,
    };
    
    groupData[pid].basket = {
      value: basket,
      comparison: transactions > 0 ? `${transactions.toLocaleString('en-ZA')} transactions` : null,
    };
  };

  const handlePharmacySelect = (pharmacy) => {
    setSelectedPharmacy(pharmacy);
    setShowPharmacyPicker(false);
    // Disable group view when selecting a pharmacy (like web app)
    if (groupViewEnabled) {
      setGroupViewEnabled(false);
    }
    // Dashboard will reload automatically via useEffect
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setDataLoading(true);
    try {
      await loadPharmacies();
      if (groupViewEnabled) {
        await loadGroupViewData();
      } else if (selectedPharmacy) {
        await loadDashboard();
      }
    } finally {
      setRefreshing(false);
      setDataLoading(false);
    }
  };

  const getDateDisplay = () => {
    if (summaryViewMode === 'daily') {
      if (selectedDate) {
        return formatDate(selectedDate);
      }
      return 'Select Date';
    }
    const dateObj = new Date(selectedMonth + '-01T00:00:00');
    const monthName = dateObj.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
    const today = new Date();
    const isCurrentMonth = dateObj.getMonth() === today.getMonth() && dateObj.getFullYear() === today.getFullYear();
    const day = isCurrentMonth ? today.getDate() : new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate();
    return `${monthName} (1 - ${day})`;
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

  if (loading && !selectedPharmacy) {
    return (
      <GradientBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
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
              <Text style={styles.pageTitle}>Dashboard</Text>
            </View>

            {/* Selector Row: Pharmacy | Group | Date */}
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
                    {selectedPharmacy ? (selectedPharmacy.pharmacy_name || selectedPharmacy.name) : 'Select Pharmacy'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Group View Toggle */}
              <TouchableOpacity
                style={[
                  styles.groupViewBtn,
                  groupViewEnabled ? styles.groupViewBtnActive : styles.groupViewBtnInactive,
                ]}
                onPress={() => setGroupViewEnabled(!groupViewEnabled)}
              >
                {groupViewEnabled && (
                  <LinearGradient
                    colors={[colors.accentPrimary, colors.accentPrimaryHover]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.groupViewBtnBackground}
                  />
                )}
                <View style={styles.groupViewBtnContent}>
                  <GroupViewIcon size={16} color={groupViewEnabled ? '#FFFFFF' : colors.accentPrimary} />
                  <Text style={[styles.groupViewText, groupViewEnabled && styles.groupViewTextActive]}>
                    Group
                  </Text>
                </View>
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

      <ScrollView
        style={styles.contentArea}
        contentContainerStyle={styles.contentAreaInner}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
      >
        {/* Summary Section */}
        {groupViewEnabled ? (
          <>
            {/* Section Heading */}
            <View style={styles.sectionHeadingContainer}>
              <Text style={styles.sectionHeadingInToggle}>Summary</Text>
            </View>
            
            {/* Group View Cards */}
            {groupViewLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.accentPrimary} />
                <Text style={styles.loadingText}>Loading group data...</Text>
              </View>
            ) : (
              <View style={styles.dashboardSummaryLayout}>
                <GroupViewCard
                  title={summaryViewMode === 'daily' ? 'Daily Turnover' : 'MTD Turnover'}
                  type="turnover"
                  pharmacies={pharmacies}
                  pharmacyData={Object.keys(groupViewData).reduce((acc, pid) => {
                    acc[pid] = groupViewData[pid]?.turnover || {};
                    return acc;
                  }, {})}
                  icon={DollarIcon}
                  iconColor={colors.chartTurnover}
                />
                
                <GroupViewCard
                  title="Purchases"
                  type="purchases"
                  pharmacies={pharmacies}
                  pharmacyData={Object.keys(groupViewData).reduce((acc, pid) => {
                    acc[pid] = groupViewData[pid]?.purchases || {};
                    return acc;
                  }, {})}
                  icon={ShoppingCartIcon}
                  iconColor={colors.chartGP}
                />
                
                <GroupViewCard
                  title="GP"
                  type="gp"
                  pharmacies={pharmacies}
                  pharmacyData={Object.keys(groupViewData).reduce((acc, pid) => {
                    acc[pid] = groupViewData[pid]?.gp || {};
                    return acc;
                  }, {})}
                  icon={GPIcon}
                  iconColor={colors.chartBasket}
                />
                
                <GroupViewCard
                  title="Basket"
                  type="basket"
                  pharmacies={pharmacies}
                  pharmacyData={Object.keys(groupViewData).reduce((acc, pid) => {
                    acc[pid] = groupViewData[pid]?.basket || {};
                    return acc;
                  }, {})}
                  icon={BasketIcon}
                  iconColor={colors.chartPurchases}
                />
              </View>
            )}
          </>
        ) : selectedPharmacy && (
          <>
            {/* Section Heading */}
            <View style={styles.sectionHeadingContainer}>
              <Text style={styles.sectionHeadingInToggle}>Summary</Text>
            </View>
            
            {/* Dashboard Summary Cards */}
            <View style={styles.dashboardSummaryLayout}>
              <View style={styles.dashboardCardWrapper}>
                <DashboardCard
                  title={summaryViewMode === 'daily' ? 'Daily Turnover' : 'MTD Turnover'}
                  value={dashboardData.currentTurnover !== null ? formatMoney(dashboardData.currentTurnover) : '—'}
                  currency="R"
                  percentage={dashboardData.currentPercentage}
                  comparison={dashboardData.currentComparison}
                  type="primary"
                  onPress={() => navigation.navigate('Trends', { 
                    metricType: 'turnover',
                    pharmacyId: selectedPharmacy?.pharmacy_id || selectedPharmacy?.id,
                    selectedDate: selectedDate,
                  })}
                />
              </View>
              
              <View style={styles.dashboardCardWrapper}>
                <DashboardCard
                  title={summaryViewMode === 'daily' ? 'Daily Target' : 'MTD Target'}
                  value={dashboardData.budgetTurnover !== null ? formatMoney(dashboardData.budgetTurnover) : '—'}
                  currency="R"
                  percentage={dashboardData.budgetPercentage}
                  comparison={dashboardData.budgetComparison}
                  type="metric-gp"
                />
              </View>
              
              <View style={styles.dashboardCardWrapper}>
                <DashboardCard
                  title="Purchases"
                  value={dashboardData.purchases !== null ? formatMoney(dashboardData.purchases) : '—'}
                  currency="R"
                  percentage={dashboardData.currentTurnover !== null && dashboardData.currentTurnover > 0 && dashboardData.purchases !== null
                    ? (dashboardData.purchases / dashboardData.currentTurnover) * 100
                    : null}
                  comparison="vs Turnover"
                  type="metric-purchases"
                  threshold={75}
                  onPress={() => navigation.navigate('Trends', { 
                    metricType: 'purchases',
                    pharmacyId: selectedPharmacy?.pharmacy_id || selectedPharmacy?.id,
                    selectedDate: selectedDate,
                  })}
                />
              </View>
              
              <View style={styles.dashboardCardWrapper}>
                <DashboardCard
                  title="Purchase Budget"
                  value={dashboardData.purchaseBudget !== null ? formatMoney(dashboardData.purchaseBudget) : '—'}
                  currency="R"
                  percentage={dashboardData.purchaseBudgetPercentage}
                  comparison={dashboardData.purchaseBudgetComparison}
                  type="metric-purchase-budget"
                  invertPercentage={true}
                />
              </View>
              
              <View style={styles.dashboardCardWrapper}>
                <DashboardCard
                  title="GP"
                  value={dashboardData.gpPercent !== null ? dashboardData.gpPercent.toFixed(1) : '—'}
                  currency="%"
                  comparison={dashboardData.gpValue !== null ? `R ${formatMoney(dashboardData.gpValue)}` : '—'}
                  type="metric-gp"
                  showWarning={dashboardData.gpPercent !== null && dashboardData.gpPercent < 25}
                  onPress={() => navigation.navigate('Trends', { 
                    metricType: 'gp',
                    pharmacyId: selectedPharmacy?.pharmacy_id || selectedPharmacy?.id,
                    selectedDate: selectedDate,
                  })}
                />
              </View>
              
              <View style={styles.dashboardCardWrapper}>
                <DashboardCard
                  title="Basket"
                  value={dashboardData.basket !== null ? formatMoney(dashboardData.basket) : '—'}
                  currency="R"
                  comparison={dashboardData.transactions ? `${dashboardData.transactions.toLocaleString('en-ZA')} transactions` : '—'}
                  type="metric-basket"
                  onPress={() => navigation.navigate('Trends', { 
                    metricType: 'basket',
                    pharmacyId: selectedPharmacy?.pharmacy_id || selectedPharmacy?.id,
                    selectedDate: selectedDate,
                  })}
                />
              </View>
            </View>

            {/* Spend Analytics Section */}
            <Text style={styles.sectionHeading}>Spend Analytics</Text>
            
            <View style={styles.spendAnalyticsLayout}>
              <SpendAnalyticsCard
                title="VS BUDGET"
                purchases={dashboardData.purchases}
                comparisonValue={dashboardData.purchaseBudget}
                percentage={dashboardData.purchaseBudget !== null && dashboardData.purchaseBudget > 0 && dashboardData.purchases !== null
                  ? (dashboardData.purchases / dashboardData.purchaseBudget) * 100
                  : null}
                difference={dashboardData.purchases !== null && dashboardData.purchaseBudget !== null
                  ? dashboardData.purchases - dashboardData.purchaseBudget
                  : null}
                differenceLabel={
                  dashboardData.purchases !== null && dashboardData.purchaseBudget !== null
                    ? (dashboardData.purchases > dashboardData.purchaseBudget
                        ? 'ABOVE BUDGET'
                        : dashboardData.purchases < dashboardData.purchaseBudget
                        ? 'BELOW BUDGET'
                        : 'ON BUDGET')
                    : 'DIFFERENCE'
                }
                color="green"
              />
              
              <SpendAnalyticsCard
                title="VS TURNOVER"
                purchases={dashboardData.purchases}
                comparisonValue={dashboardData.currentTurnover}
                percentage={dashboardData.currentTurnover !== null && dashboardData.currentTurnover > 0 && dashboardData.purchases !== null
                  ? (dashboardData.purchases / dashboardData.currentTurnover) * 100
                  : null}
                color="orange"
              />
            </View>
          </>
        )}

        {/* Empty State */}
        {pharmacies.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No pharmacies available</Text>
            <Text style={styles.emptyStateSubtext}>
              Please contact your administrator to grant pharmacy access.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Pharmacy Picker Modal */}
      <PharmacyPickerModal
        visible={showPharmacyPicker}
        pharmacies={pharmacies}
        selectedPharmacy={selectedPharmacy}
        onSelect={handlePharmacySelect}
        onClose={() => setShowPharmacyPicker(false)}
      />

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          setSelectedDate(date);
          // Update month if in monthly mode
          if (summaryViewMode === 'monthly') {
            const monthStr = date.slice(0, 7);
            setSelectedMonth(monthStr);
          }
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Loading Overlay for data changes */}
      <LoadingOverlay
        visible={dataLoading}
        message="Loading data..."
      />

      {/* Floating Monthly/Daily Toggle */}
      <View style={styles.floatingToggleContainer}>
        <BlurView 
          intensity={Platform.OS === 'ios' ? 80 : 50} 
          tint="light" 
          style={styles.summaryViewToggle}
          reducedTransparencyFallbackColor="rgba(255, 255, 255, 0.75)"
        >
          <TouchableOpacity
            style={styles.summaryViewToggleBtnWrapper}
            onPress={() => setSummaryViewMode('monthly')}
          >
            <LinearGradient
              colors={summaryViewMode === 'monthly' 
                ? [colors.accentPrimary, colors.accentPrimaryHover]
                : ['transparent', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryViewToggleBtn}
            >
              <MonthlyIcon 
                size={28} 
                color={summaryViewMode === 'monthly' ? '#FFFFFF' : colors.textPrimary} 
              />
              <Text style={[styles.summaryViewToggleText, summaryViewMode === 'monthly' && styles.summaryViewToggleTextActive]}>
                Monthly
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.summaryViewToggleBtnWrapper}
            onPress={() => setSummaryViewMode('daily')}
          >
            <LinearGradient
              colors={summaryViewMode === 'daily' 
                ? [colors.accentPrimary, colors.accentPrimaryHover]
                : ['transparent', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryViewToggleBtn}
            >
              <DailyIcon 
                size={28} 
                color={summaryViewMode === 'daily' ? '#FFFFFF' : colors.textPrimary} 
              />
              <Text style={[styles.summaryViewToggleText, summaryViewMode === 'daily' && styles.summaryViewToggleTextActive]}>
                Daily
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </BlurView>
      </View>

      {/* Floating Hamburger Menu Button */}
      <View style={styles.floatingHamburgerContainer}>
        <BlurView 
          intensity={Platform.OS === 'ios' ? 100 : 70} 
          tint="light" 
          style={styles.hamburgerToggle}
          reducedTransparencyFallbackColor="rgba(255, 255, 255, 0.9)"
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
    flex: 2,
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
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  groupViewBtn: {
    flex: 0.7,
    minWidth: 0,
    borderRadius: 999,
    overflow: 'hidden',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  groupViewBtnInactive: {
    backgroundColor: '#FFFFFF',
  },
  groupViewBtnActive: {
    backgroundColor: 'transparent',
  },
  groupViewBtnBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
  },
  groupViewBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  groupViewText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  groupViewTextActive: {
    color: '#FFFFFF',
  },
  datePickerBtnWrapper: {
    flex: 1.3,
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
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  monthControl: {
    minWidth: 100,
  },
  monthControlLabel: {
    fontSize: 9,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  monthInput: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.bgSecondary,
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
  },
  contentArea: {
    flex: 1,
  },
  contentAreaInner: {
    paddingHorizontal: 24,
    paddingTop: 150,
    paddingBottom: 120,
  },
  sectionHeadingWithToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },
  sectionHeading: {
    fontSize: 16,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    letterSpacing: 0.2,
    marginBottom: 16,
    marginTop: 8,
  },
  sectionHeadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },
  sectionHeadingInToggle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    letterSpacing: 0.2,
    marginBottom: 0,
  },
  floatingToggleContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 1000,
  },
  summaryViewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    padding: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    overflow: 'hidden',
    minWidth: 190,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    // Shadow for Android
    elevation: 4,
  },
  summaryViewToggleBtnWrapper: {
    flex: 1,
    minWidth: 0,
  },
  summaryViewToggleBtn: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  summaryViewToggleText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  summaryViewToggleTextActive: {
    fontFamily: typography.fontFamily.bold,
    color: '#FFFFFF',
    fontWeight: typography.fontWeight.bold,
  },
  dashboardSummaryLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  dashboardCardWrapper: {
    width: '48.5%',
  },
  spendAnalyticsLayout: {
    flexDirection: 'column',
    marginBottom: 16,
    gap: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default DashboardScreen;

