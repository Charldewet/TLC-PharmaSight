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
import PharmacyPickerModal from '../components/PharmacyPickerModal';
import MonthPickerModal from '../components/MonthPickerModal';
import LoadingOverlay from '../components/LoadingOverlay';
import GradientBackground from '../components/GradientBackground';
import { 
  formatMoney, 
  getMonthString,
} from '../utils/formatters';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { 
  PharmacyIcon, 
  CalendarIcon, 
  HamburgerIcon,
  TargetIconNav,
} from '../components/Icons';
import { LinearGradient } from 'expo-linear-gradient';

const TargetsScreen = ({ navigation }) => {
  const { user, authToken } = useAuth();
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [showPharmacyPicker, setShowPharmacyPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getMonthString());
  const [growthPercent, setGrowthPercent] = useState('');
  
  // Targets data: array of { date, weekday, dateLabel, prevYearTurnover, growthPercent, targetTurnover }
  const [targetsData, setTargetsData] = useState([]);
  
  // Store previous year data by date
  const [prevYearData, setPrevYearData] = useState({});

  useEffect(() => {
    loadPharmacies();
  }, [user, authToken]);

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  useEffect(() => {
    if (selectedPharmacy && selectedMonth) {
      loadTargets(!isInitialLoad);
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

  const addDays = (dateObj, days) => {
    const d = new Date(dateObj.getTime());
    d.setDate(d.getDate() + days);
    return d;
  };

  const formatYmdLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadTargets = async (showOverlay = false) => {
    if (!selectedPharmacy || !selectedMonth) return;

    try {
      if (showOverlay) {
        setDataLoading(true);
      }

      const pid = selectedPharmacy.pharmacy_id || selectedPharmacy.id;
      const [year, month] = selectedMonth.split('-').map(Number);
      const monthIndex = month - 1; // 0-based
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

      // Build array of dates for the month
      const dates = [];
      const prevDates = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const jsDate = new Date(year, monthIndex, d);
        const weekday = jsDate.getDay(); // 0 = Sunday, 6 = Saturday
        const dayOfMonth = jsDate.getDate();
        const monthAbbr = jsDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const dateLabel = `${dayOfMonth} ${monthAbbr}`;
        const ymddate = formatYmdLocal(jsDate);
        const prevComparable = addDays(jsDate, -364); // keeps weekday alignment
        const prevYmd = formatYmdLocal(prevComparable);
        
        dates.push({
          date: ymddate,
          weekday,
          dateLabel,
          prevDate: prevYmd,
          isWeekend: weekday === 0 || weekday === 6, // Sunday or Saturday
        });
        prevDates.push(prevYmd);
      }

      // Load previous year data
      const monthsNeeded = Array.from(new Set(prevDates.map(d => d.slice(0, 7))));
      const prevYearMap = {};
      
      await Promise.all(monthsNeeded.map(async (monthStr) => {
        try {
          const [year, mon] = monthStr.split('-').map(Number);
          const lastDay = new Date(year, mon, 0).getDate();
          const fromDate = `${monthStr}-01`;
          const toDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
          
          const data = await dashboardAPI.getDays(pid, monthStr);
          if (Array.isArray(data)) {
            data.forEach(rec => {
              prevYearMap[rec.business_date] = rec;
            });
          }
        } catch (e) {
          console.error('Error loading previous year data:', e);
        }
      }));

      setPrevYearData(prevYearMap);

      // Load saved targets
      let savedTargets = {};
      try {
        const targetsResponse = await dashboardAPI.getTargets(pid, selectedMonth);
        if (targetsResponse.targets && Array.isArray(targetsResponse.targets)) {
          targetsResponse.targets.forEach(target => {
            savedTargets[target.date] = target.value;
          });
        }
      } catch (e) {
        console.error('Error loading saved targets:', e);
      }

      // Build targets data array
      const targets = dates.map(dateInfo => {
        const prevRec = prevYearMap[dateInfo.prevDate];
        const prevTurnover = prevRec ? Number(prevRec.turnover || 0) : null;
        const savedTarget = savedTargets[dateInfo.date];
        let growthPct = '';
        let targetTurnover = savedTarget ? String(savedTarget) : '';

        // Calculate growth % if we have both target and previous year data
        if (savedTarget && prevTurnover !== null && prevTurnover > 0) {
          const growth = ((savedTarget / prevTurnover) - 1) * 100;
          growthPct = growth.toFixed(2);
        }

        return {
          ...dateInfo,
          prevYearTurnover: prevTurnover,
          growthPercent: growthPct,
          targetTurnover: targetTurnover,
        };
      });

      setTargetsData(targets);
    } catch (error) {
      console.error('Error loading targets:', error);
      Alert.alert('Error', 'Failed to load targets. Please try again.');
    } finally {
      setDataLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTargets(false);
  };

  const handleGrowthPercentChange = (index, value) => {
    const targets = [...targetsData];
    const target = targets[index];
    
    if (!target) return;
    
    target.growthPercent = value;
    
    // Calculate target turnover from growth %
    const growthPct = parseFloat(value);
    if (!isNaN(growthPct) && target.prevYearTurnover !== null && target.prevYearTurnover > 0) {
      const multiplier = 1 + (growthPct / 100);
      const targetValue = target.prevYearTurnover * multiplier;
      target.targetTurnover = targetValue.toFixed(2);
    } else if (value === '' || isNaN(growthPct)) {
      // Clear target if growth is cleared
      if (!target.targetTurnover || target.targetTurnover === '0.00') {
        target.targetTurnover = '';
      }
    }
    
    setTargetsData(targets);
  };

  const handleTargetTurnoverChange = (index, value) => {
    const targets = [...targetsData];
    const target = targets[index];
    
    if (!target) return;
    
    target.targetTurnover = value;
    
    // Calculate growth % from target turnover
    const targetValue = parseFloat(value);
    if (!isNaN(targetValue) && targetValue > 0 && target.prevYearTurnover !== null && target.prevYearTurnover > 0) {
      const growthPct = ((targetValue / target.prevYearTurnover) - 1) * 100;
      target.growthPercent = growthPct.toFixed(2);
    } else if (value === '' || isNaN(targetValue) || targetValue <= 0) {
      target.growthPercent = '';
    }
    
    setTargetsData(targets);
  };

  const applyGrowthToAll = () => {
    const pct = parseFloat(growthPercent || '0');
    if (isNaN(pct)) {
      Alert.alert('Invalid Growth %', 'Please enter a valid growth percentage.');
      return;
    }

    const multiplier = 1 + (pct / 100);
    const updatedTargets = targetsData.map(target => {
      if (target.prevYearTurnover !== null && target.prevYearTurnover > 0) {
        const newTarget = target.prevYearTurnover * multiplier;
        return {
          ...target,
          targetTurnover: newTarget.toFixed(2),
          growthPercent: pct.toFixed(2),
        };
      }
      return target;
    });

    setTargetsData(updatedTargets);
  };

  const saveTargets = async () => {
    if (!selectedPharmacy || !selectedMonth) return;

    const pid = selectedPharmacy.pharmacy_id || selectedPharmacy.id;
    const targets = {};

    targetsData.forEach(target => {
      if (target.targetTurnover && !isNaN(Number(target.targetTurnover))) {
        targets[target.date] = Number(target.targetTurnover);
      }
    });

    if (Object.keys(targets).length === 0) {
      Alert.alert('No Targets', 'No target values to save.', [{ text: 'OK' }]);
      return;
    }

    try {
      setDataLoading(true);
      await dashboardAPI.saveTargets(pid, selectedMonth, targets);
      Alert.alert('Success', 'Targets saved successfully!', [{ text: 'OK' }]);
    } catch (error) {
      console.error('Error saving targets:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to save targets';
      Alert.alert('Error', errorMsg, [{ text: 'OK' }]);
    } finally {
      setDataLoading(false);
    }
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
              <Text style={styles.pageTitle}>Targets</Text>
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
          {/* Toolbar Card */}
          <View style={[styles.card, styles.firstCard]}>
            <View style={styles.toolbar}>
              <Text style={styles.toolbarLabel}>Growth %</Text>
              <TextInput
                style={styles.toolbarInput}
                value={growthPercent}
                onChangeText={setGrowthPercent}
                placeholder="0"
                keyboardType="numeric"
                returnKeyType="done"
              />
              <View style={styles.toolbarButtonsRow}>
                <TouchableOpacity
                  style={styles.toolbarButton}
                  onPress={applyGrowthToAll}
                >
                  <LinearGradient
                    colors={[colors.accentPrimary, colors.accentPrimaryHover]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.toolbarButtonGradient}
                  >
                    <Text style={styles.toolbarButtonText}>Apply to Targets</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={saveTargets}
                >
                  <LinearGradient
                    colors={[colors.statusSuccess, '#10b981']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.toolbarButtonGradient}
                  >
                    <Text style={styles.toolbarButtonText}>Save Targets</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Targets Table Card */}
          <View style={styles.card}>
            <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.dateColumn]}>Date</Text>
                  <View style={styles.prevYearColumn}>
                    <Text style={styles.tableHeaderCell}>Prev Year</Text>
                    <Text style={styles.tableHeaderCell}>T/O</Text>
                  </View>
                  <Text style={[styles.tableHeaderCell, styles.numColumn]}>% Growth</Text>
                  <Text style={[styles.tableHeaderCell, styles.numColumn]}>Target T/O</Text>
                </View>

                {/* Table Rows */}
                {targetsData.length === 0 ? (
                  <View style={styles.emptyRow}>
                    <Text style={styles.emptyText}>Select a month above to load targets…</Text>
                  </View>
                ) : (
                  targetsData.map((target, index) => (
                    <View key={target.date} style={[
                      styles.tableRow,
                      target.isWeekend && styles.tableRowWeekend
                    ]}>
                      <Text style={[styles.tableCell, styles.dateColumn]}>{target.dateLabel}</Text>
                      <Text style={[styles.tableCell, styles.prevYearColumn]}>
                        {target.prevYearTurnover !== null ? formatMoney(target.prevYearTurnover) : '—'}
                      </Text>
                      <TextInput
                        style={[styles.tableCellInput, styles.numColumn, styles.growthColumn]}
                        value={target.growthPercent}
                        onChangeText={(value) => handleGrowthPercentChange(index, value)}
                        placeholder="0.00"
                        keyboardType="numeric"
                        returnKeyType="next"
                      />
                      <TextInput
                        style={[styles.tableCellInput, styles.numColumn]}
                        value={target.targetTurnover}
                        onChangeText={(value) => handleTargetTurnoverChange(index, value)}
                        placeholder="0.00"
                        keyboardType="numeric"
                        returnKeyType="done"
                      />
                    </View>
                  ))
                )}
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
          message="Loading targets..."
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
  toolbar: {
    gap: 12,
  },
  toolbarLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
  },
  toolbarInput: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  toolbarButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  toolbarButton: {
    borderRadius: 999,
    overflow: 'hidden',
    flex: 1,
  },
  toolbarButtonGradient: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    borderRadius: 999,
    overflow: 'hidden',
    flex: 1,
  },
  toolbarButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  table: {
    backgroundColor: 'transparent',
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.accentPrimary,
    paddingVertical: 12,
    paddingHorizontal: 12,
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
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 0,
    alignItems: 'center',
  },
  tableRowWeekend: {
    backgroundColor: 'rgba(255, 69, 9, 0.08)',
  },
  tableCell: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
  },
  tableCellInput: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
    borderWidth: 0,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    minWidth: 0,
    textAlign: 'right',
  },
  dateColumn: {
    width: 70,
    flexShrink: 0,
  },
  numColumn: {
    flex: 1,
    minWidth: 70,
    textAlign: 'right',
  },
  growthColumn: {
    textAlign: 'center',
  },
  prevYearColumn: {
    width: 65,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
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

export default TargetsScreen;
