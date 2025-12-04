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

const DailySummaryScreen = ({ navigation }) => {
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
  
  // Daily summary data
  const [dailyData, setDailyData] = useState({
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
      loadDailySummary(!isInitialLoad);
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

  const getPreviousYearWeekdayData = async (date, pid) => {
    try {
      const dateObj = new Date(date + 'T00:00:00');
      const weekday = dateObj.getDay();
      const prevYear = dateObj.getFullYear() - 1;
      
      const prevYearMonth = `${prevYear}-${date.slice(5, 7)}`;
      const daysResp = await apiFetch(`${API_BASE_URL}/api/days?pid=${pid}&month=${prevYearMonth}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const daysData = daysResp.ok ? await daysResp.json() : [];
      
      // Find the same weekday in previous year
      const foundData = daysData.find(d => {
        const dDate = new Date(d.business_date + 'T00:00:00');
        return dDate.getDay() === weekday;
      });
      
      return foundData || null;
    } catch (error) {
      console.error('Error getting previous year data:', error);
      return null;
    }
  };

  const loadDailySummary = async (showOverlay = false) => {
    if (!selectedPharmacy || !selectedDate) return;

    try {
      if (showOverlay) {
        setDataLoading(true);
      } else {
        setLoading(true);
      }
      
      const pid = selectedPharmacy.pharmacy_id || selectedPharmacy.id;
      const month = selectedDate.slice(0, 7);

      // Get current month data
      const daysResp = await apiFetch(`${API_BASE_URL}/api/days?pid=${pid}&month=${month}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const daysData = daysResp.ok ? await daysResp.json() : [];
      
      // Find data for selected date
      const selectedDayData = daysData.find(d => d.business_date === selectedDate) || null;
      
      // Get previous year weekday data
      const prevYearData = await getPreviousYearWeekdayData(selectedDate, pid);
      
      // Update daily summary data
      updateDailySummary(selectedDayData, prevYearData);
      
      // Load best sellers and worst GP
      await Promise.all([
        loadBestSellers(pid),
        loadWorstGP(pid),
      ]);
    } catch (error) {
      console.error('Error loading daily summary:', error);
      Alert.alert('Error', 'Failed to load daily summary data.');
    } finally {
      setLoading(false);
      setDataLoading(false);
    }
  };

  const updateDailySummary = (data, prevYearData) => {
    if (!data) {
      setDailyData({
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
      return;
    }

    const turnover = Number(data.turnover || 0);
    const gpValue = Number(data.gp_value || 0);
    const gpPercent = (data.gp_pct !== undefined && data.gp_pct !== null) 
      ? Number(data.gp_pct) 
      : (turnover ? (gpValue / turnover) * 100 : 0);
    const purchases = Number(data.purchases || data.daily_purchases || data.purchases_value || 0);
    const costOfSales = turnover - gpValue;
    
    const transactionCount = Number(
      data.transaction_count || 
      data.transactions || 
      data.txn_count || 
      data.num_transactions ||
      data.sales_transactions ||
      0
    );
    
    let basket = 0;
    let displayTransactions = 0;
    
    if (transactionCount > 0) {
      basket = turnover / transactionCount;
      displayTransactions = transactionCount;
    } else {
      displayTransactions = Math.max(1, Math.round(turnover / 150));
      basket = displayTransactions ? turnover / displayTransactions : 0;
    }

    // Dispensary data
    const dispensarySales = Number(data.dispensary_turnover || 0);
    const frontShopSales = Number(data.frontshop_turnover || 0);
    const totalSales = dispensarySales + frontShopSales;
    const dispensaryPercent = totalSales > 0 ? Math.round((dispensarySales / totalSales) * 100) : 0;

    // Scripts data
    const scripts = Number(data.scripts_qty || 0);
    const avgScript = Number(data.avg_script_value || 0) || (scripts > 0 ? dispensarySales / scripts : 0);

    // Turnover comparison (matching dashboard screen format)
    let turnoverComparison = null;
    let turnoverPercentage = null;
    if (prevYearData) {
      const prevYearTurnover = Number(prevYearData.turnover || 0);
      if (prevYearTurnover > 0) {
        const prevYear = new Date(selectedDate + 'T00:00:00').getFullYear() - 1;
        turnoverPercentage = ((turnover - prevYearTurnover) / prevYearTurnover) * 100;
        turnoverComparison = `vs ${prevYear}: R ${formatMoney(prevYearTurnover)}`;
      } else {
        turnoverComparison = 'No previous year data';
      }
    } else {
      turnoverComparison = 'No previous year data';
    }

    setDailyData({
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
      bestSellers: dailyData.bestSellers,
      worstGP: dailyData.worstGP,
    });
  };

  const loadBestSellers = async (pid) => {
    try {
      const data = await dashboardAPI.getBestSellers(pid, selectedDate, null, null, 5);
      console.log('[loadBestSellers] Raw API response:', JSON.stringify(data, null, 2));
      
      let bestSellers = [];
      if (Array.isArray(data)) {
        bestSellers = data;
      } else if (data.best_sellers) {
        bestSellers = data.best_sellers;
      } else if (data.items) {
        bestSellers = data.items;
      }
      
      // Log first item to see what fields are available
      if (bestSellers.length > 0) {
        console.log('[loadBestSellers] First item fields:', Object.keys(bestSellers[0]));
        console.log('[loadBestSellers] First item:', bestSellers[0]);
      }
      
      setDailyData(prev => ({ ...prev, bestSellers: bestSellers.slice(0, 5) }));
    } catch (error) {
      console.error('Error loading best sellers:', error);
    }
  };

  const loadWorstGP = async (pid) => {
    try {
      const data = await dashboardAPI.getWorstGP(pid, selectedDate, null, null, 5, 20, true);
      console.log('[loadWorstGP] Raw API response:', JSON.stringify(data, null, 2));
      
      let worstGP = [];
      if (Array.isArray(data)) {
        worstGP = data;
      } else if (data.worst_gp_products) {
        worstGP = data.worst_gp_products;
      } else if (data.items) {
        worstGP = data.items;
      }
      
      // Log first item to see what fields are available
      if (worstGP.length > 0) {
        console.log('[loadWorstGP] First item fields:', Object.keys(worstGP[0]));
        console.log('[loadWorstGP] First item:', worstGP[0]);
      }
      
      setDailyData(prev => ({ ...prev, worstGP: worstGP.slice(0, 5) }));
    } catch (error) {
      console.error('Error loading worst GP:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setDataLoading(true);
    try {
      await loadDailySummary();
    } finally {
      setRefreshing(false);
      setDataLoading(false);
    }
  };

  const formatDateDisplay = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(undefined, { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
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

  const renderPieChart = (percentage) => {
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    const gradientId = 'dailySummaryPieGradient';
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
              <Text style={styles.pageTitle}>Daily Summary</Text>
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
              value={dailyData.turnover !== null ? formatMoney(dailyData.turnover) : '—'}
              currency="R"
              percentage={dailyData.turnoverPercentage}
              comparison={dailyData.turnoverComparison}
            />
          </View>
          
          <View style={styles.metricCardWrapper}>
            <DashboardCard
              title="GP%"
              value={dailyData.gpPercent !== null ? dailyData.gpPercent.toFixed(1) : '—'}
              currency="%"
              comparison={dailyData.gpValue !== null ? `GP: R ${formatMoney(dailyData.gpValue)}` : null}
            />
          </View>
          
          <View style={styles.metricCardWrapper}>
            <DashboardCard
              title="Purchases"
              value={dailyData.purchases !== null ? formatMoney(dailyData.purchases) : '—'}
              currency="R"
              comparison={dailyData.costOfSales !== null ? `Cost of Sales: R ${formatMoney(dailyData.costOfSales)}` : null}
            />
          </View>
          
          <View style={styles.metricCardWrapper}>
            <DashboardCard
              title="Basket"
              value={dailyData.basket !== null ? formatMoney(dailyData.basket) : '—'}
              currency="R"
              comparison={dailyData.transactions !== null ? `Transactions: ${dailyData.transactions}` : null}
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
                      {dailyData.dispensarySales !== null ? formatMoney(dailyData.dispensarySales) : '—'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.splitItem}>
                  <Text style={styles.splitLabel}>FRONT SHOP</Text>
                  <View style={styles.splitValueWrapper}>
                    <Text style={styles.splitCurrency}>R</Text>
                    <Text style={styles.splitValue}>
                      {dailyData.frontShopSales !== null ? formatMoney(dailyData.frontShopSales) : '—'}
                    </Text>
                  </View>
                </View>
              </View>
              
              {renderPieChart(dailyData.dispensaryPercent)}
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
                    {dailyData.avgScript !== null && dailyData.avgScript > 0 
                      ? formatMoney(dailyData.avgScript) 
                      : '—'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.scriptsItem}>
                <Text style={styles.scriptsLabel}>Scripts</Text>
                <Text style={styles.scriptsValue}>
                  {dailyData.scripts !== null ? dailyData.scripts : '—'}
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
              {dailyData.bestSellers.length > 0 ? (
                dailyData.bestSellers.map((item, index) => (
                  <View key={index} style={styles.stockItem}>
                    <View style={styles.stockDetails}>
                      <Text style={styles.stockName} numberOfLines={1}>
                        {item.product_description || item.description || item.product_name || item.name || item.title || 'Unknown'}
                      </Text>
                      <Text style={styles.stockCode}>
                        {item.product_code || item.code || '—'}
                      </Text>
                    </View>
                    <View style={styles.stockStats}>
                      <Text style={styles.stockQty}>
                        {item.qty_sold || item.quantity || 0}
                      </Text>
                      <Text style={styles.stockGP}>
                        R {formatMoney(item.gp_value || item.gp || 0)}
                      </Text>
                    </View>
                  </View>
                ))
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
              {dailyData.worstGP.length > 0 ? (
                dailyData.worstGP.map((item, index) => (
                  <View key={index} style={styles.stockItem}>
                    <View style={styles.stockDetails}>
                      <Text style={styles.stockName} numberOfLines={1}>
                        {item.product_description || item.description || item.product_name || item.name || item.title || 'Unknown'}
                      </Text>
                      <Text style={styles.stockCode}>
                        {item.lp_code || item.product_code || item.code || item.stock_code || item.barcode || item.nappi_code || '—'}
                      </Text>
                    </View>
                    <View style={styles.stockStats}>
                      <Text style={[styles.stockGP, { color: colors.statusWarning }]}>
                        {(item.gp_percent !== undefined || item.gp_pct !== undefined) 
                          ? `${(item.gp_percent || item.gp_pct || item.margin_pct || 0).toFixed(1)}%` 
                          : '—'}
                      </Text>
                      <Text style={styles.stockQty}>
                        {item.quantity_sold || item.qty_sold || item.qty || item.quantity || item.total_quantity || item.units_sold || 0} units
                      </Text>
                    </View>
                  </View>
                ))
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
        date={selectedDate}
        isDailyView={true}
      />

      {/* Low GP Products Modal */}
      <LowGPModal
        visible={showLowGPModal}
        onClose={() => setShowLowGPModal(false)}
        pharmacyId={selectedPharmacy?.pharmacy_id || selectedPharmacy?.id}
        date={selectedDate}
        isDailyView={true}
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
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  scriptsValueWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scriptsCurrency: {
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    marginRight: 3,
  },
  scriptsValue: {
    fontSize: 16,
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

export default DailySummaryScreen;

