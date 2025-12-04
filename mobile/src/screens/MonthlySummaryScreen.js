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
import DashboardCard from '../components/DashboardCard';
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
  getToday,
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
  BasketIcon,
  SplitIcon,
  ScriptsIcon,
  BestSellersIcon,
  WarningIcon,
  ListIcon,
} from '../components/Icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const MonthlySummaryScreen = ({ navigation }) => {
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
  const [selectedDate, setSelectedDate] = useState(getToday());
  
  // Monthly summary data (MTD)
  const [monthlyData, setMonthlyData] = useState({
    turnover: null,
    gpPercent: null,
    gpValue: null,
    purchases: null,
    basket: null,
    transactions: null,
    costOfSales: null,
    turnoverComparison: null,
    turnoverPercentage: null,
    dispensarySales: null,
    frontShopSales: null,
    dispensaryPercent: 0,
    scripts: null,
    avgScript: null,
    bestSellers: [],
    worstGP: [],
  });

  useEffect(() => {
    loadPharmacies();
  }, [user, authToken]);

  // Track if this is the initial load or a date change
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  useEffect(() => {
    if (selectedPharmacy && selectedDate) {
      // Show overlay for date/pharmacy changes after initial load
      loadMonthlySummary(!isInitialLoad);
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

  const loadMonthlySummary = async (showOverlay = false) => {
    if (!selectedPharmacy || !selectedDate) return;

    try {
      if (showOverlay) {
        setDataLoading(true);
      } else {
        setLoading(true);
      }
      
      const pid = selectedPharmacy.pharmacy_id || selectedPharmacy.id;
      const month = selectedDate.slice(0, 7);
      const throughDate = selectedDate;

      // Get MTD aggregated data
      const mtdResp = await apiFetch(`${API_BASE_URL}/api/mtd?pid=${pid}&month=${month}&through=${throughDate}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const mtdData = mtdResp.ok ? await mtdResp.json() : null;

      // Get daily data for the month to calculate MTD values
      const daysResp = await apiFetch(`${API_BASE_URL}/api/days?pid=${pid}&month=${month}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const daysData = daysResp.ok ? await daysResp.json() : [];

      // Filter to MTD days (up to selected date)
      const mtdDays = daysData.filter(d => {
        const dDate = d.business_date || d.date || d.bdate;
        return dDate && dDate <= throughDate;
      });

      // Get previous year same month MTD data for comparison (same as web app)
      const prevYearMtdData = await getPreviousYearMTDData(throughDate, pid);

      // Update monthly summary data
      updateMonthlySummary(mtdData, mtdDays, prevYearMtdData, throughDate);

      // Load best sellers and worst GP for MTD range (first of month to selected date)
      const firstOfMonth = `${month}-01`;
      await Promise.all([
        loadBestSellers(pid, firstOfMonth, throughDate),
        loadWorstGP(pid, firstOfMonth, throughDate),
      ]);
    } catch (error) {
      console.error('Error loading monthly summary:', error);
      Alert.alert('Error', 'Failed to load monthly summary data.');
    } finally {
      setLoading(false);
      setDataLoading(false);
    }
  };

  // Get previous year's same month MTD data (matching web app logic)
  const getPreviousYearMTDData = async (dateStr, pid) => {
    try {
      // Parse the current date
      const currentDate = new Date(dateStr + 'T00:00:00');
      
      // Calculate the previous year's same date
      const prevYear = currentDate.getFullYear() - 1;
      const prevYearMonth = currentDate.getMonth() + 1;
      const prevYearDay = currentDate.getDate();
      
      // Handle month length differences (e.g., Feb 29 -> Feb 28)
      const prevYearMonthDays = new Date(prevYear, prevYearMonth, 0).getDate();
      const adjustedDay = Math.min(prevYearDay, prevYearMonthDays);
      
      const prevYearMonthStr = `${prevYear}-${String(prevYearMonth).padStart(2, '0')}`;
      const prevYearThroughDate = `${prevYear}-${String(prevYearMonth).padStart(2, '0')}-${String(adjustedDay).padStart(2, '0')}`;
      
      console.log('[getPreviousYearMTDData] Fetching:', { prevYearMonthStr, prevYearThroughDate });
      
      // Fetch the previous year's MTD data using efficient endpoint
      const resp = await apiFetch(
        `${API_BASE_URL}/api/mtd?pid=${pid}&month=${prevYearMonthStr}&through=${prevYearThroughDate}`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (!resp.ok) return null;
      
      const data = await resp.json();
      console.log('[getPreviousYearMTDData] Response:', data);
      
      return data;
    } catch (error) {
      console.error('Failed to get previous year MTD data:', error);
      return null;
    }
  };

  const updateMonthlySummary = (mtdData, mtdDays, prevYearMtdData, throughDate) => {
    // Use MTD aggregated data if available, otherwise calculate from daily data
    let turnover = 0;
    let gpValue = 0;
    let purchases = 0;
    let transactionCount = 0;
    let dispensarySales = 0;
    let frontShopSales = 0;
    let scripts = 0;

    if (mtdData) {
      turnover = Number(mtdData.turnover || 0);
      gpValue = Number(mtdData.gp_value || 0);
      transactionCount = Number(mtdData.transaction_count || 0);
    } else {
      // Calculate from daily data
      turnover = mtdDays.reduce((sum, d) => sum + Number(d.turnover || 0), 0);
      gpValue = mtdDays.reduce((sum, d) => sum + Number(d.gp_value || d.gp || 0), 0);
      transactionCount = mtdDays.reduce((sum, d) => sum + Number(d.transaction_count || d.transactions || 0), 0);
    }

    // Purchases from daily data
    purchases = mtdDays.reduce((sum, d) => sum + Number(d.purchases || d.daily_purchases || d.purchases_value || 0), 0);

    // Dispensary and front shop sales from daily data
    dispensarySales = mtdDays.reduce((sum, d) => sum + Number(d.dispensary_turnover || 0), 0);
    frontShopSales = mtdDays.reduce((sum, d) => sum + Number(d.frontshop_turnover || 0), 0);

    // Scripts from daily data
    scripts = mtdDays.reduce((sum, d) => sum + Number(d.scripts_qty || 0), 0);

    const gpPercent = turnover > 0 ? (gpValue / turnover) * 100 : 0;
    const costOfSales = turnover - gpValue;
    
    let basket = 0;
    let displayTransactions = 0;
    
    if (transactionCount > 0) {
      basket = turnover / transactionCount;
      displayTransactions = transactionCount;
    } else {
      displayTransactions = Math.max(1, Math.round(turnover / 150));
      basket = displayTransactions ? turnover / displayTransactions : 0;
    }

    const totalSales = dispensarySales + frontShopSales;
    const dispensaryPercent = totalSales > 0 ? Math.round((dispensarySales / totalSales) * 100) : 0;

    const avgScript = scripts > 0 ? dispensarySales / scripts : 0;

    // Turnover comparison with previous year same month MTD (matching dashboard screen)
    let turnoverComparison = null;
    let turnoverPercentage = null;
    if (prevYearMtdData) {
      const prevYearTurnover = Number(prevYearMtdData.turnover || 0);
      if (prevYearTurnover > 0) {
        const prevYear = new Date(throughDate + 'T00:00:00').getFullYear() - 1;
        turnoverPercentage = ((turnover - prevYearTurnover) / prevYearTurnover) * 100;
        turnoverComparison = `vs ${prevYear}: R ${formatMoney(prevYearTurnover)}`;
      } else {
        turnoverComparison = 'No previous year data';
      }
    } else {
      turnoverComparison = 'No previous year data';
    }

    // Update state while preserving bestSellers and worstGP (they're loaded separately)
    setMonthlyData(prev => ({
      ...prev,
      turnover,
      gpPercent,
      gpValue,
      purchases,
      basket,
      transactions: displayTransactions,
      costOfSales,
      turnoverComparison,
      turnoverPercentage,
      dispensarySales,
      frontShopSales,
      dispensaryPercent,
      scripts,
      avgScript,
      // Don't overwrite bestSellers and worstGP - they're loaded separately
    }));
  };

  const loadBestSellers = async (pid, fromDate, toDate) => {
    try {
      // Match web app: fetch 20 items (for modal), display top 5 in card
      const data = await dashboardAPI.getBestSellers(pid, null, fromDate, toDate, 20);
      console.log('[MonthlySummaryScreen] loadBestSellers Raw API response:', JSON.stringify(data, null, 2));
      
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
      
      console.log('[MonthlySummaryScreen] Parsed bestSellers:', bestSellers.length, 'items');
      if (bestSellers.length > 0) {
        console.log('[MonthlySummaryScreen] First best seller KEYS:', Object.keys(bestSellers[0]));
        console.log('[MonthlySummaryScreen] First best seller:', JSON.stringify(bestSellers[0], null, 2));
      }
      
      // Store all items for modal, but display top 5 in card
      setMonthlyData(prev => {
        const updated = { ...prev, bestSellers: bestSellers.slice(0, 5) };
        console.log('[MonthlySummaryScreen] Updated monthlyData.bestSellers:', updated.bestSellers.length);
        return updated;
      });
    } catch (error) {
      console.error('[MonthlySummaryScreen] Error loading best sellers:', error);
      setMonthlyData(prev => ({ ...prev, bestSellers: [] }));
    }
  };

  const loadWorstGP = async (pid, fromDate, toDate) => {
    try {
      // Match web app: fetch 50 items with threshold=20 and exclude_pdst=true
      const data = await dashboardAPI.getWorstGP(pid, null, fromDate, toDate, 50, 20, true);
      console.log('[MonthlySummaryScreen] loadWorstGP Raw API response:', JSON.stringify(data, null, 2));
      
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
      
      console.log('[MonthlySummaryScreen] Parsed worstGP:', worstGP.length, 'items');
      if (worstGP.length > 0) {
        console.log('[MonthlySummaryScreen] First worst GP KEYS:', Object.keys(worstGP[0]));
        console.log('[MonthlySummaryScreen] First worst GP:', JSON.stringify(worstGP[0], null, 2));
      }
      
      // Store all items for modal, but display top 5 in card
      setMonthlyData(prev => {
        const updated = { ...prev, worstGP: worstGP.slice(0, 5) };
        console.log('[MonthlySummaryScreen] Updated monthlyData.worstGP:', updated.worstGP.length);
        return updated;
      });
    } catch (error) {
      console.error('[MonthlySummaryScreen] Error loading worst GP:', error);
      setMonthlyData(prev => ({ ...prev, worstGP: [] }));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setDataLoading(true);
    try {
      await loadMonthlySummary();
    } finally {
      setRefreshing(false);
      setDataLoading(false);
    }
  };

  const getDatePickerButtonText = () => {
    if (!selectedDate) return 'Select Date';
    const date = new Date(selectedDate + 'T00:00:00');
    const month = date.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
    const day = date.getDate();
    return `${month} (1 - ${day})`;
  };

  const renderPieChart = (percentage) => {
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    const gradientId = 'monthlySummaryPieGradient';
    const size = 90;
    
    return (
      <View style={styles.pieChartContainer}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FF4509" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FFA500" stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="18"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="18"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.pieChartCenter}>
          <Text style={styles.pieChartPercentage}>{percentage}%</Text>
        </View>
      </View>
    );
  };

  if (loading && !selectedPharmacy) {
    return (
      <GradientBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
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
              <Text style={styles.pageTitle}>Monthly Summary</Text>
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
                    {selectedPharmacy ? (selectedPharmacy.pharmacy_name || selectedPharmacy.name) : 'Select Pharmacy'}
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

      <ScrollView
        style={styles.contentArea}
        contentContainerStyle={styles.contentAreaInner}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
      >
        {/* Section Heading */}
        <View style={styles.sectionHeadingContainer}>
          <Text style={styles.sectionHeadingInToggle}>Summary</Text>
        </View>

        {/* Main Metrics Cards */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCardWrapper}>
            <DashboardCard
              title="Turnover"
              value={monthlyData.turnover !== null ? formatMoney(monthlyData.turnover) : '—'}
              currency="R"
              percentage={monthlyData.turnoverPercentage}
              comparison={monthlyData.turnoverComparison}
            />
          </View>
          
          <View style={styles.metricCardWrapper}>
            <DashboardCard
              title="GP%"
              value={monthlyData.gpPercent !== null ? monthlyData.gpPercent.toFixed(1) : '—'}
              currency="%"
              comparison={monthlyData.gpValue !== null ? `GP: R ${formatMoney(monthlyData.gpValue)}` : null}
            />
          </View>
          
          <View style={styles.metricCardWrapper}>
            <DashboardCard
              title="Purchases"
              value={monthlyData.purchases !== null ? formatMoney(monthlyData.purchases) : '—'}
              currency="R"
              comparison={monthlyData.costOfSales !== null ? `Cost of Sales: R ${formatMoney(monthlyData.costOfSales)}` : null}
            />
          </View>
          
          <View style={styles.metricCardWrapper}>
            <DashboardCard
              title="Basket"
              value={monthlyData.basket !== null ? formatMoney(monthlyData.basket) : '—'}
              currency="R"
              comparison={monthlyData.transactions !== null ? `Transactions: ${monthlyData.transactions}` : null}
            />
          </View>
        </View>

        {/* Dispensary Summary Section */}
        <Text style={styles.sectionHeading}>Dispensary Summary</Text>
        
        <View style={styles.dispensaryContainer}>
          {/* Split Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIcon}>
                  <SplitIcon size={16} color={colors.chartTurnover} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.chartTurnover }]}>Split</Text>
              </View>
            </View>
            
            <View style={styles.splitContent}>
              <View style={styles.splitList}>
                <View style={styles.splitItem}>
                  <Text style={styles.splitLabel}>DISPENSARY</Text>
                  <View style={styles.splitValueWrapper}>
                    <Text style={styles.splitCurrency}>R</Text>
                    <Text style={styles.splitValue}>
                      {monthlyData.dispensarySales !== null ? formatMoney(monthlyData.dispensarySales) : '—'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.splitItem}>
                  <Text style={styles.splitLabel}>FRONT SHOP</Text>
                  <View style={styles.splitValueWrapper}>
                    <Text style={styles.splitCurrency}>R</Text>
                    <Text style={styles.splitValue}>
                      {monthlyData.frontShopSales !== null ? formatMoney(monthlyData.frontShopSales) : '—'}
                    </Text>
                  </View>
                </View>
              </View>
              
              {renderPieChart(monthlyData.dispensaryPercent)}
            </View>
          </View>

          {/* Scripts Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIcon}>
                  <ScriptsIcon size={16} color={colors.chartGP} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.chartGP }]}>Scripts</Text>
              </View>
            </View>
            
            <View style={styles.scriptsContent}>
              <View style={styles.scriptsItem}>
                <Text style={styles.scriptsLabel}>Avg Script</Text>
                <View style={styles.scriptsValueWrapper}>
                  <Text style={styles.scriptsCurrency}>R</Text>
                  <Text style={styles.scriptsValue}>
                    {monthlyData.avgScript !== null && monthlyData.avgScript > 0 
                      ? formatMoney(monthlyData.avgScript) 
                      : '—'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.scriptsItem}>
                <Text style={styles.scriptsLabel}>Scripts</Text>
                <Text style={styles.scriptsValue}>
                  {monthlyData.scripts !== null ? monthlyData.scripts : '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stock Summary Section */}
        <Text style={styles.sectionHeading}>Stock Summary</Text>
        
        <View style={styles.stockContainer}>
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
                onPress={() => setShowBestSellersModal(true)}
                style={styles.listIconButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ListIcon size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.stockList}>
              {monthlyData.bestSellers.length > 0 ? (
                monthlyData.bestSellers.map((item, index) => {
                  // Handle various field names from different API endpoints (range vs single date)
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
                onPress={() => setShowLowGPModal(true)}
                style={styles.listIconButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ListIcon size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.stockList}>
              {monthlyData.worstGP.length > 0 ? (
                monthlyData.worstGP.map((item, index) => {
                  // Handle various field names from different API endpoints (range vs single date)
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
        pharmacies={pharmacies}
        selectedPharmacy={selectedPharmacy}
        onSelect={(pharmacy) => {
          setSelectedPharmacy(pharmacy);
          setShowPharmacyPicker(false);
        }}
        onClose={() => setShowPharmacyPicker(false)}
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

      {/* Best Sellers Modal */}
      <BestSellersModal
        visible={showBestSellersModal}
        onClose={() => setShowBestSellersModal(false)}
        pharmacyId={selectedPharmacy?.pharmacy_id || selectedPharmacy?.id}
        date={null}
        fromDate={selectedDate ? `${selectedDate.slice(0, 7)}-01` : null}
        toDate={selectedDate}
        isDailyView={false}
      />

      {/* Low GP Products Modal */}
      <LowGPModal
        visible={showLowGPModal}
        onClose={() => setShowLowGPModal(false)}
        pharmacyId={selectedPharmacy?.pharmacy_id || selectedPharmacy?.id}
        date={null}
        fromDate={selectedDate ? `${selectedDate.slice(0, 7)}-01` : null}
        toDate={selectedDate}
        isDailyView={false}
        pharmacyName={selectedPharmacy?.pharmacy_name || selectedPharmacy?.name || 'Unknown Pharmacy'}
      />

      {/* Loading Overlay for date/pharmacy changes */}
      <LoadingOverlay
        visible={dataLoading}
        message="Loading data..."
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
    fontFamily: typography.fontFamily.semibold,
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
    fontFamily: typography.fontFamily.semibold,
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    gap: 8,
  },
  metricCardWrapper: {
    width: '48.5%',
  },
  sectionHeading: {
    fontSize: 16,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 12,
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
  dispensaryContainer: {
    gap: 4,
    marginBottom: 24,
  },
  stockContainer: {
    gap: 4,
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
  listIconButton: {
    padding: 4,
  },
  cardTitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: -0.1,
  },
  splitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  splitList: {
    flex: 1,
  },
  splitItem: {
    marginBottom: 12,
  },
  splitLabel: {
    fontSize: 9,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  splitValueWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  splitCurrency: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    marginRight: 4,
  },
  splitValue: {
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  pieChartContainer: {
    width: 90,
    height: 90,
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
  scriptsContent: {
    gap: 12,
  },
  scriptsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scriptsLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  scriptsValueWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scriptsCurrency: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    marginRight: 3,
  },
  scriptsValue: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
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

export default MonthlySummaryScreen;

