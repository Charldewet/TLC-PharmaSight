import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import DashboardCard from './DashboardCard';
import { formatMoney } from '../utils/formatters';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { API_BASE_URL } from '../config/api';
import { apiFetch } from '../services/api';

const TurnoverDetailModal = ({ 
  visible, 
  onClose, 
  turnover, 
  turnoverPercentage, 
  turnoverComparison,
  selectedDate,
  pharmacyId,
  authToken,
}) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && pharmacyId && authToken && selectedDate) {
      loadChartData();
    }
  }, [visible, pharmacyId, authToken, selectedDate]);

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

  const loadChartData = async () => {
    if (!pharmacyId || !authToken || !selectedDate) return;

    try {
      setLoading(true);
      const pid = pharmacyId;
      const currentDate = new Date(selectedDate + 'T00:00:00');
      
      // Get last 7 days
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(currentDate);
        date.setDate(date.getDate() - i);
        days.push(date.toISOString().split('T')[0]);
      }

      // Fetch data for all days
      const dataPromises = days.map(async (date) => {
        const month = date.slice(0, 7);
        const daysResp = await apiFetch(`${API_BASE_URL}/api/days?pid=${pid}&month=${month}`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        const daysData = daysResp.ok ? await daysResp.json() : [];
        const dayData = daysData.find(d => d.business_date === date) || null;
        
        // Get previous year same weekday data
        const prevYearData = await getPreviousYearWeekdayData(date, pid);
        
        return {
          date,
          turnover: dayData ? Number(dayData.turnover || 0) : 0,
          prevYearTurnover: prevYearData ? Number(prevYearData.turnover || 0) : 0,
        };
      });

      const results = await Promise.all(dataPromises);
      setChartData(results);
    } catch (error) {
      console.error('Error loading chart data:', error);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  const getDayLabel = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  };

  const renderBarChart = () => {
    if (loading) {
      return (
        <View style={styles.chartLoadingContainer}>
          <ActivityIndicator size="small" color={colors.accentPrimary} />
        </View>
      );
    }

    if (chartData.length === 0) {
      return (
        <View style={styles.chartLoadingContainer}>
          <Text style={styles.emptyText}>No data available</Text>
        </View>
      );
    }

    const maxValue = Math.max(
      ...chartData.map(d => Math.max(d.turnover, d.prevYearTurnover)),
      1
    );

    return (
      <View style={styles.chartContainer}>
        <View style={styles.barsContainer}>
          {chartData.map((item, index) => {
            const barHeight = maxValue > 0 ? (item.turnover / maxValue) * 120 : 0;
            // Green if turnover > previous year same weekday, Orange if <=
            // Handle case where prevYearTurnover is 0 or null
            const isBetter = item.prevYearTurnover > 0 && item.turnover > item.prevYearTurnover;
            const barColor = isBetter ? '#59BA47' : '#FF4509'; // Green if better, Orange if worse or equal
            
            return (
              <View key={item.date} style={styles.barWrapper}>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(barHeight, 2),
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{getDayLabel(item.date)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 80 : 50}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.contentContainer}
          >
            {/* Card */}
            <View style={styles.cardContainer}>
              <DashboardCard
                title="Turnover"
                value={turnover !== null ? formatMoney(turnover) : '—'}
                currency="R"
                percentage={turnoverPercentage}
                comparison={turnoverComparison}
              />
            </View>

            {/* Chart */}
            <View style={styles.chartSection}>
              <Text style={styles.chartTitle}>Last 7 Days</Text>
              {renderBarChart()}
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  cardContainer: {
    width: '100%',
    marginBottom: 24,
  },
  chartSection: {
    width: '100%',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  chartContainer: {
    width: '100%',
    alignItems: 'center',
  },
  chartLoadingContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    width: '100%',
    height: 150,
    paddingHorizontal: 8,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  barContainer: {
    width: '80%',
    height: 120,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
  },
  bar: {
    width: '100%',
    minHeight: 2,
    borderRadius: 4,
    backgroundColor: colors.chartTurnover,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginTop: 4,
  },
  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
    backgroundColor: colors.accentPrimary,
  },
  closeButtonText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

export default TurnoverDetailModal;

