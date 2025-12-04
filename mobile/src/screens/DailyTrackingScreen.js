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
import MonthPickerModal from '../components/MonthPickerModal';
import LoadingOverlay from '../components/LoadingOverlay';
import GradientBackground from '../components/GradientBackground';
import { 
  formatMoney, 
  getMonthString,
} from '../utils/formatters';
import { API_BASE_URL } from '../config/api';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { 
  PharmacyIcon, 
  CalendarIcon, 
  HamburgerIcon,
  TrendingUpIcon,
} from '../components/Icons';
import { LinearGradient } from 'expo-linear-gradient';

const DailyTrackingScreen = ({ navigation }) => {
  const { user, authToken } = useAuth();
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [showPharmacyPicker, setShowPharmacyPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getMonthString());
  
  // Daily tracking data: array of daily records
  const [dailyData, setDailyData] = useState([]);
  const [totals, setTotals] = useState({
    budgetTurnover: 0,
    actualTurnover: 0,
    gpPercent: 0,
    gpValue: 0,
    budgetSpend: 0,
    actualSpend: 0,
    purchases: 0,
    purchasesPercent: 0,
  });

  useEffect(() => {
    loadPharmacies();
  }, [user, authToken]);

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  useEffect(() => {
    if (selectedPharmacy && selectedMonth) {
      loadDailyTracking(!isInitialLoad);
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  }, [selectedPharmacy, selectedMonth]);

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

  const formatYmdLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatPercentage = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return `${value.toFixed(1)}%`;
  };

  const loadDailyTracking = async (showOverlay = false) => {
    if (!selectedPharmacy || !selectedMonth) return;

    try {
      if (showOverlay) {
        setDataLoading(true);
      }

      const pid = selectedPharmacy.pharmacy_id || selectedPharmacy.id;
      const [year, month] = selectedMonth.split('-').map(Number);
      const monthIndex = month - 1; // 0-based
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

      // Load daily data for the month
      const daysData = await dashboardAPI.getDays(pid, selectedMonth);
      const dataMap = {};
      if (Array.isArray(daysData)) {
        daysData.forEach(rec => {
          dataMap[rec.business_date] = rec;
        });
      }

      // Load targets for the month
      let targetsMap = {};
      try {
        const targetsResponse = await dashboardAPI.getTargets(pid, selectedMonth);
        if (targetsResponse.targets && Array.isArray(targetsResponse.targets)) {
          targetsResponse.targets.forEach(target => {
            targetsMap[target.date] = target.value;
          });
        }
      } catch (e) {
        console.error('Error loading targets:', e);
      }

      // Build daily tracking data array
      const trackingData = [];
      let totalBudgetTurnover = 0;
      let totalActualTurnover = 0;
      let totalGPValue = 0;
      let totalBudgetSpend = 0;
      let totalActualSpend = 0;
      let totalPurchases = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const jsDate = new Date(year, monthIndex, d);
        const weekdayIdx = jsDate.getDay(); // 0 = Sunday, 6 = Saturday
        const isWeekend = weekdayIdx === 0 || weekdayIdx === 6;
        const dayOfMonth = jsDate.getDate();
        const monthAbbr = jsDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const dateLabel = `${dayOfMonth} ${monthAbbr}`;
        const dateStr = formatYmdLocal(jsDate);

        const dayRec = dataMap[dateStr] || {};
        const actualTurnover = Number(dayRec.turnover || 0);
        const gpValue = Number(dayRec.gp_value || dayRec.gp || 0);
        const gpPercent = actualTurnover > 0 ? (gpValue / actualTurnover) * 100 : null;
        const closingStock = Number(dayRec.closing_stock || 0);
        const purchases = Number(dayRec.purchases || dayRec.daily_purchases || dayRec.purchases_value || 0);
        
        const budgetTurnover = targetsMap[dateStr] || null;
        const budgetSpend = budgetTurnover ? budgetTurnover * 0.75 : null;
        const actualSpend = actualTurnover * 0.75;
        const purchasesPercent = actualTurnover > 0 ? (purchases / actualTurnover) * 100 : null;

        // Calculate running purchase budget left (will be calculated after totals)
        trackingData.push({
          date: dateStr,
          dateLabel,
          weekdayIdx,
          isWeekend,
          budgetTurnover,
          actualTurnover,
          gpPercent,
          gpValue,
          budgetSpend,
          actualSpend,
          purchases,
          purchasesPercent,
          closingStock,
          hasData: !!dataMap[dateStr],
        });

        // Accumulate totals
        if (budgetTurnover) totalBudgetTurnover += budgetTurnover;
        totalActualTurnover += actualTurnover;
        totalGPValue += gpValue;
        if (budgetSpend) totalBudgetSpend += budgetSpend;
        totalActualSpend += actualSpend;
        totalPurchases += purchases;
      }

      // Calculate running purchase budget left
      let runningBudgetLeft = totalBudgetSpend;
      trackingData.forEach(day => {
        runningBudgetLeft -= day.purchases;
        day.purchaseBudgetLeft = runningBudgetLeft;
      });

      // Calculate totals
      const totalGPPercent = totalActualTurnover > 0 ? (totalGPValue / totalActualTurnover) * 100 : 0;
      const totalPurchasesPercent = totalActualTurnover > 0 ? (totalPurchases / totalActualTurnover) * 100 : 0;

      setTotals({
        budgetTurnover: totalBudgetTurnover,
        actualTurnover: totalActualTurnover,
        gpPercent: totalGPPercent,
        gpValue: totalGPValue,
        budgetSpend: totalBudgetSpend,
        actualSpend: totalActualSpend,
        purchases: totalPurchases,
        purchasesPercent: totalPurchasesPercent,
      });

      setDailyData(trackingData);
    } catch (error) {
      console.error('Error loading daily tracking:', error);
      Alert.alert('Error', 'Failed to load daily tracking data. Please try again.');
    } finally {
      setDataLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDailyTracking(false);
  };

  const formatMonthDisplay = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
              <Text style={styles.pageTitle}>Daily Tracking</Text>
            </View>

            {/* Selector Row: Pharmacy | Month */}
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

              {/* Month Selector Button */}
              <TouchableOpacity 
                style={styles.datePickerBtnWrapper}
                onPress={() => setShowMonthPicker(true)}
              >
                <LinearGradient
                  colors={[colors.accentPrimary, colors.accentPrimaryHover]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.datePickerBtn}
                >
                  <CalendarIcon size={16} color="#FFFFFF" />
                  <Text style={styles.datePickerText} numberOfLines={1}>
                    {formatMonthDisplay(selectedMonth)}
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
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accentPrimary} />
          }
        >
          {/* Daily Tracking Table Card */}
          <View style={[styles.card, styles.firstCard]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.dateColumn]}>Date</Text>
                  <View style={[styles.budgetToColumn, styles.headerColumn]}>
                    <Text style={styles.tableHeaderCell}>Budget</Text>
                    <Text style={styles.tableHeaderCell}>T/O</Text>
                  </View>
                  <View style={[styles.actualToColumn, styles.headerColumn]}>
                    <Text style={styles.tableHeaderCell}>Actual</Text>
                    <Text style={styles.tableHeaderCell}>T/O</Text>
                  </View>
                  <Text style={[styles.tableHeaderCell, styles.gpPercentColumn]}>GP%</Text>
                  <Text style={[styles.tableHeaderCell, styles.gpValueColumn]}>GP Value</Text>
                  <View style={[styles.numColumn, styles.headerColumn]}>
                    <Text style={styles.tableHeaderCell}>Budget</Text>
                    <Text style={styles.tableHeaderCell}>Spend</Text>
                  </View>
                  <Text style={[styles.tableHeaderCell, styles.numColumn]}>Actual Spend</Text>
                  <Text style={[styles.tableHeaderCell, styles.numColumn]}>Purchases</Text>
                  <Text style={[styles.tableHeaderCell, styles.numColumn]}>Purchases %</Text>
                  <Text style={[styles.tableHeaderCell, styles.numColumn]}>Budget Left</Text>
                  <View style={[styles.stockOnHandColumn, styles.headerColumn]}>
                    <Text style={styles.tableHeaderCell}>Stock</Text>
                    <Text style={styles.tableHeaderCell}>on Hand</Text>
                  </View>
                </View>

                {/* Table Rows */}
                {dailyData.length === 0 ? (
                  <View style={styles.emptyRow}>
                    <Text style={styles.emptyText}>Select a month above to load data…</Text>
                  </View>
                ) : (
                  dailyData.map((day, index) => (
                    <View key={day.date} style={[
                      styles.tableRow,
                      day.isWeekend && styles.tableRowWeekend
                    ]}>
                      <Text style={[styles.tableCell, styles.dateColumn, !day.hasData && styles.tableCellNoData]}>{day.dateLabel}</Text>
                      <Text style={[styles.tableCell, styles.budgetToColumn, !day.hasData && styles.tableCellNoData]}>
                        {day.budgetTurnover ? formatMoney(day.budgetTurnover) : '—'}
                      </Text>
                      <Text style={[styles.tableCell, styles.actualToColumn, day.hasData ? styles.tableCellOrange : styles.tableCellNoData]}>
                        {day.hasData ? formatMoney(day.actualTurnover) : '—'}
                      </Text>
                      <Text style={[styles.tableCell, styles.gpPercentColumn, !day.hasData && styles.tableCellNoData]}>
                        {day.hasData ? formatPercentage(day.gpPercent) : '—'}
                      </Text>
                      <Text style={[styles.tableCell, styles.gpValueColumn, !day.hasData && styles.tableCellNoData]}>
                        {day.hasData ? formatMoney(day.gpValue) : '—'}
                      </Text>
                      <Text style={[styles.tableCell, styles.numColumn, !day.hasData && styles.tableCellNoData]}>
                        {day.budgetSpend ? formatMoney(day.budgetSpend) : '—'}
                      </Text>
                      <Text style={[styles.tableCell, styles.numColumn, !day.hasData && styles.tableCellNoData]}>
                        {day.hasData ? formatMoney(day.actualSpend) : '—'}
                      </Text>
                      <Text style={[styles.tableCell, styles.numColumn, !day.hasData && styles.tableCellNoData]}>
                        {day.hasData ? formatMoney(day.purchases) : '—'}
                      </Text>
                      <Text style={[styles.tableCell, styles.numColumn, !day.hasData && styles.tableCellNoData]}>
                        {day.hasData ? formatPercentage(day.purchasesPercent) : '—'}
                      </Text>
                      <Text style={[styles.tableCell, styles.numColumn, day.hasData ? styles.tableCellGreen : styles.tableCellNoData]}>
                        {day.purchaseBudgetLeft !== undefined ? formatMoney(day.purchaseBudgetLeft) : '—'}
                      </Text>
                      <Text style={[styles.tableCell, styles.stockOnHandColumn, day.hasData ? styles.tableCellPurple : styles.tableCellNoData]}>
                        {day.hasData ? formatMoney(day.closingStock) : '—'}
                      </Text>
                    </View>
                  ))
                )}

                {/* Totals Row */}
                {dailyData.length > 0 && (
                  <View style={[styles.tableRow, styles.totalsRow]}>
                    <Text style={[styles.tableCell, styles.dateColumn, styles.totalsCell]}>Total</Text>
                    <Text style={[styles.tableCell, styles.budgetToColumn, styles.totalsCell]}>
                      {totals.budgetTurnover > 0 ? formatMoney(totals.budgetTurnover) : '—'}
                    </Text>
                    <Text style={[styles.tableCell, styles.actualToColumn, styles.totalsCell, styles.tableCellOrange]}>
                      {formatMoney(totals.actualTurnover)}
                    </Text>
                    <Text style={[styles.tableCell, styles.gpPercentColumn, styles.totalsCell]}>
                      {formatPercentage(totals.gpPercent)}
                    </Text>
                    <Text style={[styles.tableCell, styles.gpValueColumn, styles.totalsCell]}>
                      {formatMoney(totals.gpValue)}
                    </Text>
                    <Text style={[styles.tableCell, styles.numColumn, styles.totalsCell]}>
                      {totals.budgetSpend > 0 ? formatMoney(totals.budgetSpend) : '—'}
                    </Text>
                    <Text style={[styles.tableCell, styles.numColumn, styles.totalsCell]}>
                      {formatMoney(totals.actualSpend)}
                    </Text>
                    <Text style={[styles.tableCell, styles.numColumn, styles.totalsCell]}>
                      {formatMoney(totals.purchases)}
                    </Text>
                    <Text style={[styles.tableCell, styles.numColumn, styles.totalsCell]}>
                      {formatPercentage(totals.purchasesPercent)}
                    </Text>
                    <Text style={[styles.tableCell, styles.numColumn, styles.totalsCell, styles.tableCellGreen]}>—</Text>
                    <Text style={[styles.tableCell, styles.stockOnHandColumn, styles.totalsCell, styles.tableCellPurple]}>—</Text>
                  </View>
                )}
              </View>
            </ScrollView>
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

        <MonthPickerModal
          visible={showMonthPicker}
          selectedMonth={selectedMonth}
          onMonthSelect={(month) => {
            setSelectedMonth(month);
            setShowMonthPicker(false);
          }}
          onClose={() => setShowMonthPicker(false)}
        />

        <LoadingOverlay
          visible={dataLoading}
          message="Loading daily tracking..."
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
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  firstCard: {
    marginTop: 24,
  },
  table: {
    backgroundColor: 'transparent',
    minWidth: 850,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.accentPrimary,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  tableHeaderCell: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  headerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
    borderBottomWidth: 0,
    alignItems: 'center',
  },
  tableRowWeekend: {
    backgroundColor: 'rgba(255, 69, 9, 0.08)',
  },
  totalsRow: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    marginTop: 4,
  },
  tableCell: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
  },
  tableCellOrange: {
    color: colors.accentPrimary,
  },
  tableCellGreen: {
    color: colors.statusSuccess,
  },
  tableCellPurple: {
    color: '#9333EA', // Purple color
  },
  tableCellNoData: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  totalsCell: {
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
  },
  dateColumn: {
    width: 60,
    flexShrink: 0,
  },
  budgetToColumn: {
    width: 70,
    flexShrink: 0,
  },
  actualToColumn: {
    width: 70,
    flexShrink: 0,
  },
  numColumn: {
    width: 90,
    flexShrink: 0,
    textAlign: 'right',
  },
  gpPercentColumn: {
    width: 50,
    flexShrink: 0,
    textAlign: 'center',
  },
  gpValueColumn: {
    width: 75,
    flexShrink: 0,
    textAlign: 'right',
  },
  stockOnHandColumn: {
    width: 80,
    flexShrink: 0,
    textAlign: 'right',
  },
  emptyRow: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

export default DailyTrackingScreen;

