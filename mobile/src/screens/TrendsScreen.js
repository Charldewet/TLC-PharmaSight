import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Circle, Path } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI, apiFetch } from '../services/api';
import GradientBackground from '../components/GradientBackground';
import LoadingOverlay from '../components/LoadingOverlay';
import { BackArrowIcon } from '../components/Icons';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { formatMoney, formatYmd } from '../utils/formatters';
import { API_BASE_URL } from '../config/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_PADDING = 40;
const CHART_WIDTH = SCREEN_WIDTH - CHART_PADDING * 2 - 40; // Account for padding
// BAR_WIDTH will be calculated dynamically based on number of bars

const TrendsScreen = ({ route, navigation }) => {
  const { metricType = 'turnover' } = route?.params || {};
  const { authToken } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('W'); // W, M, 6M, Y
  const [selectedBarDate, setSelectedBarDate] = useState(null); // null = show average (renamed to avoid confusion)
  const [selectedMonthlyTotalDate, setSelectedMonthlyTotalDate] = useState(null); // For monthly totals chart selection
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [turnoverData, setTurnoverData] = useState([]);
  const [gpData, setGpData] = useState([]);
  const [purchasesData, setPurchasesData] = useState([]);
  const [basketData, setBasketData] = useState([]);
  const [pharmacyId, setPharmacyId] = useState(null);
  const [insightsData, setInsightsData] = useState([]);
  const [yoyData, setYoyData] = useState(null);
  
  // Reference date from dashboard (the date selected on dashboard)
  const [referenceDate, setReferenceDate] = useState(null);

  // Get pharmacy ID and reference date from route params
  useEffect(() => {
    const pid = route?.params?.pharmacyId;
    const passedDate = route?.params?.selectedDate;
    
    if (pid) {
      setPharmacyId(pid);
    }
    
    // Use passed date or default to yesterday
    if (passedDate) {
      setReferenceDate(passedDate);
    } else {
      // Default to yesterday if no date passed
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      setReferenceDate(formatYmd(yesterday));
    }
  }, [route?.params]);

  // Map metric types to display names
  const getMetricTitle = () => {
    const metricMap = {
      'turnover': 'Turnover',
      'target': 'Target',
      'purchases': 'Purchases',
      'purchase-budget': 'Purchase Budget',
      'gp': 'GP',
      'basket': 'Basket',
    };
    return metricMap[metricType] || 'Trend';
  };

  const periods = [
    { key: 'W', label: 'W' },
    { key: 'M', label: 'M' },
    { key: '6M', label: '6M' },
    { key: 'Y', label: 'Y' },
  ];

  const loadTurnoverData = useCallback(async (period = 'W') => {
    if (!pharmacyId || !authToken || !referenceDate) return;
    
    try {
      setLoading(true);
      
      // Parse the reference date (selected date from dashboard)
      const refDate = new Date(referenceDate + 'T12:00:00');
      
      // For Y period, use monthly aggregated data
      if (period === 'Y') {
        // Get last 12 months from the reference date
        const monthlyData = [];
        
        for (let i = 0; i < 12; i++) {
          const monthDate = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
          const year = monthDate.getFullYear();
          const month = monthDate.getMonth() + 1;
          const monthStr = `${year}-${String(month).padStart(2, '0')}`;
          
          // Get last day of month for MTD endpoint
          const lastDay = new Date(year, month, 0).getDate();
          const lastDayDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
          
          try {
            // Fetch aggregated monthly total using MTD endpoint
            const mtdResp = await apiFetch(`${API_BASE_URL}/api/mtd?pid=${pharmacyId}&month=${monthStr}&through=${lastDayDate}`, {
              headers: { 'Authorization': `Bearer ${authToken}` },
            });
            
            // Also fetch daily data to count trading days
            const daysResp = await apiFetch(`${API_BASE_URL}/api/days?pid=${pharmacyId}&month=${monthStr}`, {
              headers: { 'Authorization': `Bearer ${authToken}` },
            });
            
            let totalTurnover = 0;
            let tradingDays = 0;
            
            if (mtdResp.ok) {
              const mtdData = await mtdResp.json();
              totalTurnover = Number(mtdData.turnover || 0);
            }
            
            if (daysResp.ok) {
              const dailyData = await daysResp.json();
              if (Array.isArray(dailyData)) {
                // Count days with turnover > 0
                tradingDays = dailyData.filter(d => Number(d.turnover || 0) > 0).length;
              }
            }
            
            // Calculate daily average
            const dailyAverage = tradingDays > 0 ? totalTurnover / tradingDays : 0;
            
            // Get first and last day of month for date range display
            const firstDayDate = `${year}-${String(month).padStart(2, '0')}-01`;
            
            monthlyData.push({
              date: firstDayDate,
              endDate: lastDayDate,
              turnover: dailyAverage,
              totalTurnover: totalTurnover,
              tradingDays: tradingDays,
              formattedDate: monthDate.toLocaleDateString('en-US', { month: 'short' }),
              month: monthDate.getMonth(),
              year: year,
            });
          } catch (error) {
            console.error(`Error fetching data for month ${monthStr}:`, error);
            // Add empty entry to maintain 12 months
            const firstDayDate = `${year}-${String(month).padStart(2, '0')}-01`;
            monthlyData.push({
              date: firstDayDate,
              endDate: lastDayDate,
              turnover: 0,
              totalTurnover: 0,
              tradingDays: 0,
              formattedDate: monthDate.toLocaleDateString('en-US', { month: 'short' }),
              month: monthDate.getMonth(),
              year: year,
            });
          }
        }
        
        // Reverse to show oldest to newest
        monthlyData.reverse();
        setTurnoverData(monthlyData);
      } else {
        // Get date range based on period (from reference date)
        let daysToLoad = 7;
        if (period === 'M') daysToLoad = 31;
        if (period === '6M') daysToLoad = 182; // 26 weeks
        
        const dates = [];
        for (let i = daysToLoad - 1; i >= 0; i--) {
          const date = new Date(refDate);
          date.setDate(refDate.getDate() - i);
          dates.push(formatYmd(date));
        }
        
        // Get months needed for the date range
        const months = new Set();
        dates.forEach(date => {
          months.add(date.substring(0, 7)); // YYYY-MM
        });
        
        // Fetch data for all months using direct fetch (like DashboardScreen)
        const allData = [];
        for (const month of months) {
          try {
            const daysResp = await apiFetch(`${API_BASE_URL}/api/days?pid=${pharmacyId}&month=${month}`, {
              headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (daysResp.ok) {
              const data = await daysResp.json();
              if (Array.isArray(data)) {
                allData.push(...data);
              }
            } else {
              console.error(`Error fetching data for month ${month}:`, daysResp.status, daysResp.statusText);
            }
          } catch (error) {
            console.error(`Error fetching data for month ${month}:`, error);
          }
        }
        
        // For 6M period, group data by weeks and calculate daily average
        if (period === '6M') {
        // Group daily data into weeks (26 weeks)
        const weeklyData = [];
        const startDate = new Date(dates[0] + 'T00:00:00');
        
        for (let week = 0; week < 26; week++) {
          const weekStart = new Date(startDate);
          weekStart.setDate(startDate.getDate() + (week * 7));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          
          // Sum turnover and count trading days for this week
          let weekTurnover = 0;
          let tradingDays = 0;
          for (let d = 0; d < 7; d++) {
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + d);
            const dayStr = formatYmd(dayDate);
            const dayData = allData.find(item => item.business_date === dayStr || item.date === dayStr);
            if (dayData && Number(dayData.turnover || 0) > 0) {
              weekTurnover += Number(dayData.turnover || 0);
              tradingDays += 1;
            }
          }
          
          // Calculate daily average (turnover / trading days)
          const dailyAverage = tradingDays > 0 ? weekTurnover / tradingDays : 0;
          
          weeklyData.push({
            date: formatYmd(weekStart),
            endDate: formatYmd(weekEnd),
            turnover: dailyAverage, // Store daily average for display
            totalTurnover: weekTurnover,
            tradingDays: tradingDays,
            formattedDate: weekStart.toLocaleDateString('en-US', { month: 'short' }),
            weekNumber: week,
            month: weekStart.getMonth(),
          });
        }
        
        setTurnoverData(weeklyData);
      } else {
        // Filter and map to our date range (W and M periods)
        const chartData = dates.map(date => {
          const dayData = allData.find(d => d.business_date === date || d.date === date);
          return {
            date,
            turnover: dayData ? Number(dayData.turnover || 0) : 0,
            formattedDate: formatDateForDisplay(date, period),
            dayNumber: new Date(date + 'T00:00:00').getDate(),
          };
        });
        
        setTurnoverData(chartData);
      }
      }
    } catch (error) {
      console.error('Error loading turnover data:', error);
      setTurnoverData([]);
    } finally {
      setLoading(false);
    }
  }, [pharmacyId, authToken, referenceDate]);

  const loadGPData = useCallback(async (period = 'W') => {
    if (!pharmacyId || !authToken || !referenceDate) return;
    
    try {
      setLoading(true);
      
      // Parse the reference date (selected date from dashboard)
      const refDate = new Date(referenceDate + 'T12:00:00');
      
      // For Y period, use monthly aggregated data
      if (period === 'Y') {
        // Get last 12 months from the reference date
        const monthlyData = [];
        
        for (let i = 0; i < 12; i++) {
          const monthDate = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
          const year = monthDate.getFullYear();
          const month = monthDate.getMonth() + 1;
          const monthStr = `${year}-${String(month).padStart(2, '0')}`;
          
          // Get last day of month for MTD endpoint
          const lastDay = new Date(year, month, 0).getDate();
          const lastDayDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
          
          try {
            // Fetch aggregated monthly total using MTD endpoint
            const mtdResp = await apiFetch(`${API_BASE_URL}/api/mtd?pid=${pharmacyId}&month=${monthStr}&through=${lastDayDate}`, {
              headers: { 'Authorization': `Bearer ${authToken}` },
            });
            
            // Also fetch daily data to count trading days
            const daysResp = await apiFetch(`${API_BASE_URL}/api/days?pid=${pharmacyId}&month=${monthStr}`, {
              headers: { 'Authorization': `Bearer ${authToken}` },
            });
            
            let totalGP = 0;
            let totalTurnover = 0;
            let tradingDays = 0;
            
            if (mtdResp.ok) {
              const mtdData = await mtdResp.json();
              totalGP = Number(mtdData.gp_value || 0);
              totalTurnover = Number(mtdData.turnover || 0);
            }
            
            if (daysResp.ok) {
              const dailyData = await daysResp.json();
              if (Array.isArray(dailyData)) {
                // Count days with turnover > 0
                tradingDays = dailyData.filter(d => Number(d.turnover || 0) > 0).length;
              }
            }
            
            // Calculate GP percentage
            const gpPercent = totalTurnover > 0 ? (totalGP / totalTurnover) * 100 : 0;
            
            // Get first and last day of month for date range display
            const firstDayDate = `${year}-${String(month).padStart(2, '0')}-01`;
            
            monthlyData.push({
              date: firstDayDate,
              endDate: lastDayDate,
              gp: gpPercent,
              totalGP: totalGP,
              totalTurnover: totalTurnover,
              tradingDays: tradingDays,
              formattedDate: monthDate.toLocaleDateString('en-US', { month: 'short' }),
              month: monthDate.getMonth(),
              year: year,
            });
          } catch (error) {
            console.error(`Error fetching GP data for month ${monthStr}:`, error);
            // Add empty entry to maintain 12 months
            const firstDayDate = `${year}-${String(month).padStart(2, '0')}-01`;
            monthlyData.push({
              date: firstDayDate,
              endDate: lastDayDate,
              gp: 0,
              totalGP: 0,
              totalTurnover: 0,
              tradingDays: 0,
              formattedDate: monthDate.toLocaleDateString('en-US', { month: 'short' }),
              month: monthDate.getMonth(),
              year: year,
            });
          }
        }
        
        // Reverse to show oldest to newest
        monthlyData.reverse();
        setGpData(monthlyData);
      } else {
        // Get date range based on period (from reference date)
        let daysToLoad = 7;
        if (period === 'M') daysToLoad = 31;
        if (period === '6M') daysToLoad = 182; // 26 weeks
        
        const dates = [];
        for (let i = daysToLoad - 1; i >= 0; i--) {
          const date = new Date(refDate);
          date.setDate(refDate.getDate() - i);
          dates.push(formatYmd(date));
        }
        
        // Get months needed for the date range
        const months = new Set();
        dates.forEach(date => {
          months.add(date.substring(0, 7)); // YYYY-MM
        });
        
        // Fetch data for all months using direct fetch (like DashboardScreen)
        const allData = [];
        for (const month of months) {
          try {
            const daysResp = await apiFetch(`${API_BASE_URL}/api/days?pid=${pharmacyId}&month=${month}`, {
              headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (daysResp.ok) {
              const data = await daysResp.json();
              if (Array.isArray(data)) {
                allData.push(...data);
              }
            } else {
              console.error(`Error fetching data for month ${month}:`, daysResp.status, daysResp.statusText);
            }
          } catch (error) {
            console.error(`Error fetching data for month ${month}:`, error);
          }
        }
        
        // For 6M period, group data by weeks and calculate daily average
        if (period === '6M') {
          // Group daily data into weeks (26 weeks)
          const weeklyData = [];
          const startDate = new Date(dates[0] + 'T00:00:00');
          
          for (let week = 0; week < 26; week++) {
            const weekStart = new Date(startDate);
            weekStart.setDate(startDate.getDate() + (week * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            // Sum GP and turnover, count trading days for this week
            let weekGP = 0;
            let weekTurnover = 0;
            let tradingDays = 0;
            for (let d = 0; d < 7; d++) {
              const dayDate = new Date(weekStart);
              dayDate.setDate(weekStart.getDate() + d);
              const dayStr = formatYmd(dayDate);
              const dayData = allData.find(item => item.business_date === dayStr || item.date === dayStr);
              if (dayData && Number(dayData.turnover || 0) > 0) {
                weekGP += Number(dayData.gp_value || dayData.gp || 0);
                weekTurnover += Number(dayData.turnover || 0);
                tradingDays += 1;
              }
            }
            
            // Calculate GP percentage for the week
            const gpPercent = weekTurnover > 0 ? (weekGP / weekTurnover) * 100 : 0;
            
            weeklyData.push({
              date: formatYmd(weekStart),
              endDate: formatYmd(weekEnd),
              gp: gpPercent,
              totalGP: weekGP,
              totalTurnover: weekTurnover,
              tradingDays: tradingDays,
              formattedDate: weekStart.toLocaleDateString('en-US', { month: 'short' }),
              weekNumber: week,
              month: weekStart.getMonth(),
            });
          }
          
          setGpData(weeklyData);
        } else {
          // Filter and map to our date range (W and M periods)
          const chartData = dates.map(date => {
            const dayData = allData.find(d => d.business_date === date || d.date === date);
            const turnover = dayData ? Number(dayData.turnover || 0) : 0;
            const gpValue = dayData ? Number(dayData.gp_value || dayData.gp || 0) : 0;
            const gpPercent = turnover > 0 ? (gpValue / turnover) * 100 : 0;
            
            return {
              date,
              gp: gpPercent,
              formattedDate: formatDateForDisplay(date, period),
              dayNumber: new Date(date + 'T00:00:00').getDate(),
            };
          });
          
          setGpData(chartData);
        }
      }
    } catch (error) {
      console.error('Error loading GP data:', error);
      setGpData([]);
    } finally {
      setLoading(false);
    }
  }, [pharmacyId, authToken, referenceDate]);

  const loadPurchasesData = useCallback(async (period = 'W') => {
    if (!pharmacyId || !authToken || !referenceDate) return;
    
    try {
      setLoading(true);
      
      // Parse the reference date (selected date from dashboard)
      const refDate = new Date(referenceDate + 'T12:00:00');
      
      // For Y period, use monthly aggregated data
      if (period === 'Y') {
        // Get last 12 months from the reference date
        const monthlyData = [];
        
        for (let i = 0; i < 12; i++) {
          const monthDate = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
          const year = monthDate.getFullYear();
          const month = monthDate.getMonth() + 1;
          const monthStr = `${year}-${String(month).padStart(2, '0')}`;
          
          // Get last day of month for MTD endpoint
          const lastDay = new Date(year, month, 0).getDate();
          const lastDayDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
          
          try {
            // Fetch daily data to sum purchases
            const daysResp = await apiFetch(`${API_BASE_URL}/api/days?pid=${pharmacyId}&month=${monthStr}`, {
              headers: { 'Authorization': `Bearer ${authToken}` },
            });
            
            let totalPurchases = 0;
            let tradingDays = 0;
            
            if (daysResp.ok) {
              const dailyData = await daysResp.json();
              if (Array.isArray(dailyData)) {
                // Sum purchases from all days in the month
                totalPurchases = dailyData.reduce((sum, d) => {
                  return sum + Number(d.purchases || d.daily_purchases || d.purchases_value || 0);
                }, 0);
                // Count days with turnover > 0 (trading days)
                tradingDays = dailyData.filter(d => Number(d.turnover || 0) > 0).length;
              }
            }
            
            // Calculate daily average purchases
            const dailyAverage = tradingDays > 0 ? totalPurchases / tradingDays : 0;
            
            // Get first and last day of month for date range display
            const firstDayDate = `${year}-${String(month).padStart(2, '0')}-01`;
            
            monthlyData.push({
              date: firstDayDate,
              endDate: lastDayDate,
              purchases: dailyAverage,
              totalPurchases: totalPurchases,
              tradingDays: tradingDays,
              formattedDate: monthDate.toLocaleDateString('en-US', { month: 'short' }),
              month: monthDate.getMonth(),
              year: year,
            });
          } catch (error) {
            console.error(`Error fetching purchases data for month ${monthStr}:`, error);
            // Add empty entry to maintain 12 months
            const firstDayDate = `${year}-${String(month).padStart(2, '0')}-01`;
            monthlyData.push({
              date: firstDayDate,
              endDate: lastDayDate,
              purchases: 0,
              totalPurchases: 0,
              tradingDays: 0,
              formattedDate: monthDate.toLocaleDateString('en-US', { month: 'short' }),
              month: monthDate.getMonth(),
              year: year,
            });
          }
        }
        
        // Reverse to show oldest to newest
        monthlyData.reverse();
        setPurchasesData(monthlyData);
      } else {
        // Get date range based on period (from reference date)
        let daysToLoad = 7;
        if (period === 'M') daysToLoad = 31;
        if (period === '6M') daysToLoad = 182; // 26 weeks
        
        const dates = [];
        for (let i = daysToLoad - 1; i >= 0; i--) {
          const date = new Date(refDate);
          date.setDate(refDate.getDate() - i);
          dates.push(formatYmd(date));
        }
        
        // Get months needed for the date range
        const months = new Set();
        dates.forEach(date => {
          months.add(date.substring(0, 7)); // YYYY-MM
        });
        
        // Fetch data for all months using direct fetch (like DashboardScreen)
        const allData = [];
        for (const month of months) {
          try {
            const daysResp = await apiFetch(`${API_BASE_URL}/api/days?pid=${pharmacyId}&month=${month}`, {
              headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (daysResp.ok) {
              const data = await daysResp.json();
              if (Array.isArray(data)) {
                allData.push(...data);
              }
            } else {
              console.error(`Error fetching data for month ${month}:`, daysResp.status, daysResp.statusText);
            }
          } catch (error) {
            console.error(`Error fetching data for month ${month}:`, error);
          }
        }
        
        // For 6M period, group data by weeks and calculate daily average
        if (period === '6M') {
          // Group daily data into weeks (26 weeks)
          const weeklyData = [];
          const startDate = new Date(dates[0] + 'T00:00:00');
          
          for (let week = 0; week < 26; week++) {
            const weekStart = new Date(startDate);
            weekStart.setDate(startDate.getDate() + (week * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            // Sum purchases and count trading days for this week
            let weekPurchases = 0;
            let tradingDays = 0;
            for (let d = 0; d < 7; d++) {
              const dayDate = new Date(weekStart);
              dayDate.setDate(weekStart.getDate() + d);
              const dayStr = formatYmd(dayDate);
              const dayData = allData.find(item => item.business_date === dayStr || item.date === dayStr);
              if (dayData && Number(dayData.turnover || 0) > 0) {
                weekPurchases += Number(dayData.purchases || dayData.daily_purchases || dayData.purchases_value || 0);
                tradingDays += 1;
              }
            }
            
            // Calculate daily average purchases (purchases / trading days)
            const dailyAverage = tradingDays > 0 ? weekPurchases / tradingDays : 0;
            
            weeklyData.push({
              date: formatYmd(weekStart),
              endDate: formatYmd(weekEnd),
              purchases: dailyAverage,
              totalPurchases: weekPurchases,
              tradingDays: tradingDays,
              formattedDate: weekStart.toLocaleDateString('en-US', { month: 'short' }),
              weekNumber: week,
              month: weekStart.getMonth(),
            });
          }
          
          setPurchasesData(weeklyData);
        } else {
          // Filter and map to our date range (W and M periods)
          const chartData = dates.map(date => {
            const dayData = allData.find(d => d.business_date === date || d.date === date);
            const purchases = dayData ? Number(dayData.purchases || dayData.daily_purchases || dayData.purchases_value || 0) : 0;
            
            return {
              date,
              purchases: purchases,
              formattedDate: formatDateForDisplay(date, period),
              dayNumber: new Date(date + 'T00:00:00').getDate(),
            };
          });
          
          setPurchasesData(chartData);
        }
      }
    } catch (error) {
      console.error('Error loading purchases data:', error);
      setPurchasesData([]);
    } finally {
      setLoading(false);
    }
  }, [pharmacyId, authToken, referenceDate]);

  const loadBasketData = useCallback(async (period = 'W') => {
    if (!pharmacyId || !authToken || !referenceDate) return;
    
    try {
      setLoading(true);
      
      // Parse the reference date (selected date from dashboard)
      const refDate = new Date(referenceDate + 'T12:00:00');
      
      // For Y period, use monthly aggregated data
      if (period === 'Y') {
        // Get last 12 months from the reference date
        const monthlyData = [];
        
        for (let i = 0; i < 12; i++) {
          const monthDate = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
          const year = monthDate.getFullYear();
          const month = monthDate.getMonth() + 1;
          const monthStr = `${year}-${String(month).padStart(2, '0')}`;
          
          // Get last day of month for MTD endpoint
          const lastDay = new Date(year, month, 0).getDate();
          const lastDayDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
          
          try {
            // Fetch aggregated monthly total using MTD endpoint
            const mtdResp = await apiFetch(`${API_BASE_URL}/api/mtd?pid=${pharmacyId}&month=${monthStr}&through=${lastDayDate}`, {
              headers: { 'Authorization': `Bearer ${authToken}` },
            });
            
            // Also fetch daily data to count trading days
            const daysResp = await apiFetch(`${API_BASE_URL}/api/days?pid=${pharmacyId}&month=${monthStr}`, {
              headers: { 'Authorization': `Bearer ${authToken}` },
            });
            
            let totalTurnover = 0;
            let totalTransactions = 0;
            let tradingDays = 0;
            
            if (mtdResp.ok) {
              const mtdData = await mtdResp.json();
              totalTurnover = Number(mtdData.turnover || 0);
              totalTransactions = Number(mtdData.transaction_count || 0);
            }
            
            if (daysResp.ok) {
              const dailyData = await daysResp.json();
              if (Array.isArray(dailyData)) {
                // Count days with turnover > 0
                tradingDays = dailyData.filter(d => Number(d.turnover || 0) > 0).length;
              }
            }
            
            // Calculate basket (turnover / transactions)
            let basket = 0;
            if (totalTransactions > 0) {
              basket = totalTurnover / totalTransactions;
            } else if (totalTurnover > 0) {
              // Estimate transactions if not available
              const estTransactions = Math.max(1, Math.round(totalTurnover / 150));
              basket = totalTurnover / estTransactions;
            }
            
            // Get first and last day of month for date range display
            const firstDayDate = `${year}-${String(month).padStart(2, '0')}-01`;
            
            monthlyData.push({
              date: firstDayDate,
              endDate: lastDayDate,
              basket: basket,
              totalTurnover: totalTurnover,
              totalTransactions: totalTransactions,
              tradingDays: tradingDays,
              formattedDate: monthDate.toLocaleDateString('en-US', { month: 'short' }),
              month: monthDate.getMonth(),
              year: year,
            });
          } catch (error) {
            console.error(`Error fetching basket data for month ${monthStr}:`, error);
            // Add empty entry to maintain 12 months
            const firstDayDate = `${year}-${String(month).padStart(2, '0')}-01`;
            monthlyData.push({
              date: firstDayDate,
              endDate: lastDayDate,
              basket: 0,
              totalTurnover: 0,
              totalTransactions: 0,
              tradingDays: 0,
              formattedDate: monthDate.toLocaleDateString('en-US', { month: 'short' }),
              month: monthDate.getMonth(),
              year: year,
            });
          }
        }
        
        // Reverse to show oldest to newest
        monthlyData.reverse();
        setBasketData(monthlyData);
      } else {
        // Get date range based on period (from reference date)
        let daysToLoad = 7;
        if (period === 'M') daysToLoad = 31;
        if (period === '6M') daysToLoad = 182; // 26 weeks
        
        const dates = [];
        for (let i = daysToLoad - 1; i >= 0; i--) {
          const date = new Date(refDate);
          date.setDate(refDate.getDate() - i);
          dates.push(formatYmd(date));
        }
        
        // Get months needed for the date range
        const months = new Set();
        dates.forEach(date => {
          months.add(date.substring(0, 7)); // YYYY-MM
        });
        
        // Fetch data for all months using direct fetch (like DashboardScreen)
        const allData = [];
        for (const month of months) {
          try {
            const daysResp = await apiFetch(`${API_BASE_URL}/api/days?pid=${pharmacyId}&month=${month}`, {
              headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (daysResp.ok) {
              const data = await daysResp.json();
              if (Array.isArray(data)) {
                allData.push(...data);
              }
            } else {
              console.error(`Error fetching data for month ${month}:`, daysResp.status, daysResp.statusText);
            }
          } catch (error) {
            console.error(`Error fetching data for month ${month}:`, error);
          }
        }
        
        // For 6M period, group data by weeks and calculate daily average
        if (period === '6M') {
          // Group daily data into weeks (26 weeks)
          const weeklyData = [];
          const startDate = new Date(dates[0] + 'T00:00:00');
          
          for (let week = 0; week < 26; week++) {
            const weekStart = new Date(startDate);
            weekStart.setDate(startDate.getDate() + (week * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            // Sum turnover and transactions, count trading days for this week
            let weekTurnover = 0;
            let weekTransactions = 0;
            let tradingDays = 0;
            for (let d = 0; d < 7; d++) {
              const dayDate = new Date(weekStart);
              dayDate.setDate(weekStart.getDate() + d);
              const dayStr = formatYmd(dayDate);
              const dayData = allData.find(item => item.business_date === dayStr || item.date === dayStr);
              if (dayData && Number(dayData.turnover || 0) > 0) {
                weekTurnover += Number(dayData.turnover || 0);
                weekTransactions += Number(dayData.transaction_count || dayData.transactions || 0);
                tradingDays += 1;
              }
            }
            
            // Calculate basket for the week (turnover / transactions)
            let basket = 0;
            if (weekTransactions > 0) {
              basket = weekTurnover / weekTransactions;
            } else if (weekTurnover > 0) {
              // Estimate transactions if not available
              const estTransactions = Math.max(1, Math.round(weekTurnover / 150));
              basket = weekTurnover / estTransactions;
            }
            
            weeklyData.push({
              date: formatYmd(weekStart),
              endDate: formatYmd(weekEnd),
              basket: basket,
              totalTurnover: weekTurnover,
              totalTransactions: weekTransactions,
              tradingDays: tradingDays,
              formattedDate: weekStart.toLocaleDateString('en-US', { month: 'short' }),
              weekNumber: week,
              month: weekStart.getMonth(),
            });
          }
          
          setBasketData(weeklyData);
        } else {
          // Filter and map to our date range (W and M periods)
          const chartData = dates.map(date => {
            const dayData = allData.find(d => d.business_date === date || d.date === date);
            const turnover = dayData ? Number(dayData.turnover || 0) : 0;
            const transactions = dayData ? Number(dayData.transaction_count || dayData.transactions || 0) : 0;
            
            // Calculate basket
            let basket = 0;
            if (dayData && dayData.avg_basket) {
              basket = Number(dayData.avg_basket || dayData.basket || 0);
            }
            if (basket === 0 && transactions > 0) {
              basket = turnover / transactions;
            } else if (basket === 0 && turnover > 0) {
              // Estimate transactions if not available
              const estTransactions = Math.max(1, Math.round(turnover / 150));
              basket = turnover / estTransactions;
            }
            
            return {
              date,
              basket: basket,
              formattedDate: formatDateForDisplay(date, period),
              dayNumber: new Date(date + 'T00:00:00').getDate(),
            };
          });
          
          setBasketData(chartData);
        }
      }
    } catch (error) {
      console.error('Error loading basket data:', error);
      setBasketData([]);
    } finally {
      setLoading(false);
    }
  }, [pharmacyId, authToken, referenceDate]);

  // Load insights data (last 7 days from reference date)
  const loadInsightsData = useCallback(async () => {
    if (!pharmacyId || !authToken || !referenceDate) return;
    
    try {
      // Parse reference date
      const refDate = new Date(referenceDate + 'T12:00:00');
      
      // Get last 7 days from reference date
      const dates = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(refDate);
        date.setDate(refDate.getDate() - i);
        dates.push(formatYmd(date));
      }
      
      // Get months needed for the date range
      const months = new Set();
      dates.forEach(date => {
        months.add(date.substring(0, 7)); // YYYY-MM
      });
      
      // Fetch data for all months
      const allData = [];
      for (const month of months) {
        try {
          const daysResp = await apiFetch(`${API_BASE_URL}/api/days?pid=${pharmacyId}&month=${month}`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
          });
          if (daysResp.ok) {
            const data = await daysResp.json();
            if (Array.isArray(data)) {
              allData.push(...data);
            }
          }
        } catch (error) {
          console.error(`Error fetching insights data for month ${month}:`, error);
        }
      }
      
      // Map to our date range
      const insightsChartData = dates.map(date => {
        const dayData = allData.find(d => d.business_date === date || d.date === date);
        const dateObj = new Date(date + 'T00:00:00');
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return {
          date,
          turnover: dayData ? Number(dayData.turnover || 0) : 0,
          dayLabel: days[dateObj.getDay()].charAt(0), // First letter of day
        };
      });
      
      setInsightsData(insightsChartData);
    } catch (error) {
      console.error('Error loading insights data:', error);
      setInsightsData([]);
    }
  }, [pharmacyId, authToken, referenceDate]);

  // Load insights data when pharmacyId is available
  useEffect(() => {
    if (metricType === 'turnover' && pharmacyId && referenceDate) {
      loadInsightsData();
    } else {
      setInsightsData([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pharmacyId, metricType, referenceDate]);

  // Load Year-over-Year comparison data
  const loadYoyData = useCallback(async () => {
    if (!pharmacyId || !authToken || !referenceDate) return;
    
    try {
      // Parse reference date
      const refDate = new Date(referenceDate + 'T12:00:00');
      const currentDay = refDate.getDate();
      const currentMonth = refDate.getMonth() + 1;
      const currentYear = refDate.getFullYear();
      const prevYear = currentYear - 1;
      
      const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const prevYearMonthStr = `${prevYear}-${String(currentMonth).padStart(2, '0')}`;
      
      // Get last day of month
      const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
      
      // Fetch current year daily data
      const currentYearResp = await apiFetch(`${API_BASE_URL}/api/days?pid=${pharmacyId}&month=${monthStr}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      
      // Fetch previous year daily data (same month)
      const prevYearResp = await apiFetch(`${API_BASE_URL}/api/days?pid=${pharmacyId}&month=${prevYearMonthStr}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      
      let currentYearData = [];
      let prevYearData = [];
      
      if (currentYearResp.ok) {
        const data = await currentYearResp.json();
        if (Array.isArray(data)) {
          currentYearData = data;
        }
      }
      
      if (prevYearResp.ok) {
        const data = await prevYearResp.json();
        if (Array.isArray(data)) {
          prevYearData = data;
        }
      }
      
      // Build cumulative data for each day of the month
      const cumulativeCurrentYear = [];
      const cumulativePrevYear = [];
      let runningTotalCurrent = 0;
      let runningTotalPrev = 0;
      
      for (let day = 1; day <= lastDayOfMonth; day++) {
        const dayStr = String(day).padStart(2, '0');
        const currentDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${dayStr}`;
        const prevDateStr = `${prevYear}-${String(currentMonth).padStart(2, '0')}-${dayStr}`;
        
        // Current year
        const currentDayData = currentYearData.find(d => d.business_date === currentDateStr || d.date === currentDateStr);
        if (currentDayData && day <= currentDay) {
          runningTotalCurrent += Number(currentDayData.turnover || 0);
        }
        cumulativeCurrentYear.push({
          day,
          cumulative: day <= currentDay ? runningTotalCurrent : null,
        });
        
        // Previous year
        const prevDayData = prevYearData.find(d => d.business_date === prevDateStr || d.date === prevDateStr);
        if (prevDayData) {
          runningTotalPrev += Number(prevDayData.turnover || 0);
        }
        cumulativePrevYear.push({
          day,
          cumulative: runningTotalPrev,
        });
      }
      
      // Calculate comparison percentage
      const currentMTD = runningTotalCurrent;
      const prevYearSameDayMTD = cumulativePrevYear.find(d => d.day === currentDay)?.cumulative || 0;
      const percentChange = prevYearSameDayMTD > 0 
        ? ((currentMTD - prevYearSameDayMTD) / prevYearSameDayMTD) * 100 
        : 0;
      
      setYoyData({
        currentYear: cumulativeCurrentYear,
        prevYear: cumulativePrevYear,
        currentMTD,
        prevYearSameDayMTD,
        percentChange,
        currentDay,
        lastDayOfMonth,
        monthName: refDate.toLocaleDateString('en-US', { month: 'long' }),
      });
    } catch (error) {
      console.error('Error loading YoY data:', error);
      setYoyData(null);
    }
  }, [pharmacyId, authToken, referenceDate]);

  // Load YoY data when pharmacyId and referenceDate are available
  useEffect(() => {
    if (metricType === 'turnover' && pharmacyId && referenceDate) {
      loadYoyData();
    } else {
      setYoyData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pharmacyId, metricType, referenceDate]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Reload data based on metric type and period
      if (metricType === 'turnover') {
        await loadTurnoverData(selectedPeriod);
      } else if (metricType === 'gp') {
        await loadGPData(selectedPeriod);
      } else if (metricType === 'purchases') {
        await loadPurchasesData(selectedPeriod);
      } else if (metricType === 'basket') {
        await loadBasketData(selectedPeriod);
      }
      
      // Reload insights and YoY if turnover
      if (metricType === 'turnover') {
        await Promise.all([
          loadInsightsData(),
          loadYoyData(),
        ]);
      }
    } catch (error) {
      console.error('Error refreshing trends:', error);
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricType, selectedPeriod, pharmacyId, referenceDate, authToken]);

  // Load data based on period and metric type
  useEffect(() => {
    // Only load if we have all required data and period is W, M, 6M, or Y
    if ((selectedPeriod === 'W' || selectedPeriod === 'M' || selectedPeriod === '6M' || selectedPeriod === 'Y') && pharmacyId && referenceDate) {
      if (metricType === 'turnover') {
        loadTurnoverData(selectedPeriod);
      } else if (metricType === 'gp') {
        loadGPData(selectedPeriod);
      } else if (metricType === 'purchases') {
        loadPurchasesData(selectedPeriod);
      } else if (metricType === 'basket') {
        loadBasketData(selectedPeriod);
      } else {
        // Reset state for other metric types
        setTurnoverData([]);
        setGpData([]);
        setPurchasesData([]);
        setBasketData([]);
        setSelectedBarDate(null);
        setLoading(false);
      }
    } else {
      // Reset state if conditions not met
      setTurnoverData([]);
      setGpData([]);
      setPurchasesData([]);
      setBasketData([]);
      setSelectedBarDate(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricType, selectedPeriod, pharmacyId, referenceDate]);

  const formatDateForDisplay = (dateString, period = 'W') => {
    const date = new Date(dateString + 'T00:00:00');
    if (period === 'M') {
      // For monthly view, return day number
      return date.getDate().toString();
    } else {
      // For weekly view, return day name
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days[date.getDay()];
    }
  };

  const formatDateFull = (dateString) => {
    const date = new Date(dateString + 'T00:00:00');
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Get current data based on metric type
  const currentData = metricType === 'gp' ? gpData : (metricType === 'purchases' ? purchasesData : (metricType === 'basket' ? basketData : turnoverData));
  const isGP = metricType === 'gp';
  const isPurchases = metricType === 'purchases';
  const isBasket = metricType === 'basket';
  
  // Calculate average value
  // For GP, exclude days with 0% GP (which might be days with no sales or incomplete data)
  // For yearly period, exclude the current incomplete month (last month) from average calculation
  const averageValue = currentData.length > 0
    ? (() => {
        // For yearly period, exclude the last month (current incomplete month) from average
        const dataForAverage = (selectedPeriod === 'Y' && currentData.length === 12)
          ? currentData.slice(0, -1) // Exclude last month
          : currentData;
        
        if (dataForAverage.length === 0) return 0;
        
        if (isGP) {
          // Filter out days with 0% GP and calculate average only from days with actual GP
          const validGPDays = dataForAverage.filter(d => d.gp > 0);
          if (validGPDays.length === 0) return 0;
          return validGPDays.reduce((sum, d) => sum + d.gp, 0) / validGPDays.length;
        } else if (isPurchases) {
          return dataForAverage.reduce((sum, d) => sum + d.purchases, 0) / dataForAverage.length;
        } else if (isBasket) {
          return dataForAverage.reduce((sum, d) => sum + d.basket, 0) / dataForAverage.length;
        } else {
          return dataForAverage.reduce((sum, d) => sum + d.turnover, 0) / dataForAverage.length;
        }
      })()
    : 0;

  // Get selected value
  const selectedValue = selectedBarDate
    ? currentData.find(d => d.date === selectedBarDate)?.[isGP ? 'gp' : (isPurchases ? 'purchases' : (isBasket ? 'basket' : 'turnover'))] || 0
    : averageValue;

  // Get max value for chart scaling
  const maxValue = currentData.length > 0
    ? Math.max(...currentData.map(d => isGP ? d.gp : (isPurchases ? d.purchases : (isBasket ? d.basket : d.turnover))), 1)
    : 1;

  const handleBarPress = (date) => {
    if (selectedBarDate === date) {
      // Deselect if clicking the same bar
      setSelectedBarDate(null);
    } else {
      setSelectedBarDate(date);
    }
  };

  const renderYoyCard = () => {
    if (!yoyData) return null;

    const { currentYear, prevYear, currentMTD, prevYearSameDayMTD, percentChange, currentDay, lastDayOfMonth } = yoyData;
    const isHigher = currentMTD >= prevYearSameDayMTD;
    
    // Get max value for scaling
    const maxCurrent = Math.max(...currentYear.filter(d => d.cumulative !== null).map(d => d.cumulative), 1);
    const maxPrev = Math.max(...prevYear.map(d => d.cumulative), 1);
    const maxValue = Math.max(maxCurrent, maxPrev, 1);

    // Chart dimensions
    const chartWidth = SCREEN_WIDTH - 80; // Account for padding
    const chartHeight = 100;
    const padding = { top: 10, bottom: 20, left: 0, right: 0 };
    const graphWidth = chartWidth - padding.left - padding.right;
    const graphHeight = chartHeight - padding.top - padding.bottom;

    // Calculate current day position
    const currentDayX = ((currentDay - 1) / (lastDayOfMonth - 1)) * graphWidth + padding.left;
    const currentDayY = chartHeight - padding.bottom - ((currentMTD / maxValue) * graphHeight);
    const prevYearY = chartHeight - padding.bottom - ((prevYearSameDayMTD / maxValue) * graphHeight);

    // Build path strings for lines
    const buildPath = (data, isCurrentYear) => {
      const points = [];
      data.forEach((point, index) => {
        if (isCurrentYear && point.cumulative === null) return;
        const x = (index / (lastDayOfMonth - 1)) * graphWidth + padding.left;
        const y = chartHeight - padding.bottom - ((point.cumulative / maxValue) * graphHeight);
        points.push(`${x},${y}`);
      });
      return points.length > 0 ? `M ${points.join(' L ')}` : '';
    };

    const prevYearPath = buildPath(prevYear, false);
    const currentYearPath = buildPath(currentYear.filter(d => d.cumulative !== null), true);

    return (
      <View style={styles.yoyCard}>
        {/* Legend and values - combined */}
        <View style={styles.yoyLegendContainer}>
          <View style={styles.yoyLegendItem}>
            <Text style={[styles.yoyLegendLabel, { color: colors.accentPrimary }]}>This Year</Text>
            <View style={styles.yoyValueRow}>
              <Text style={styles.yoyCurrencySymbol}>R</Text>
              <Text style={[styles.yoyValue, { color: colors.accentPrimary }]}>{formatMoney(currentMTD)}</Text>
            </View>
          </View>
          <View style={styles.yoyLegendItem}>
            <Text style={[styles.yoyLegendLabel, { color: colors.textMuted }]}>Last Year</Text>
            <View style={styles.yoyValueRow}>
              <Text style={styles.yoyCurrencySymbol}>R</Text>
              <Text style={[styles.yoyValue, { color: colors.textMuted }]}>{formatMoney(prevYearSameDayMTD)}</Text>
            </View>
          </View>
        </View>

        {/* Chart */}
        <View style={styles.yoyChartContainer}>
          <Svg width={chartWidth} height={chartHeight} style={styles.yoySvg}>
            {/* Previous year line (grey, full month) */}
            {prevYearPath && (
              <Path
                d={prevYearPath}
                fill="none"
                stroke={colors.textMuted + '80'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Current year line (orange, up to current day) */}
            {currentYearPath && (
              <Path
                d={currentYearPath}
                fill="none"
                stroke={colors.accentPrimary}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Current day vertical line */}
            <Line
              x1={currentDayX}
              y1={padding.top}
              x2={currentDayX}
              y2={chartHeight - padding.bottom}
              stroke={colors.textMuted + '40'}
              strokeWidth="1"
              strokeDasharray="4,4"
            />

            {/* Previous year same day dot on grey line - render first so it's behind */}
            <Circle
              cx={currentDayX}
              cy={prevYearY}
              r="4"
              fill={colors.textMuted}
            />

            {/* Current day dot on orange line - render last so it's in front */}
            <Circle
              cx={currentDayX}
              cy={currentDayY}
              r="4"
              fill={colors.accentPrimary}
            />
          </Svg>

          {/* Percentage block overlay - bottom right corner */}
          <View style={styles.yoyPercentageOverlay}>
            <View style={[
              styles.yoyPercentageBlock,
              isHigher ? styles.yoyPercentagePositive : styles.yoyPercentageNegative
            ]}>
              <Text style={styles.yoyPercentageText}>
                {isHigher ? '+' : ''}{percentChange.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderInsightsCard = () => {
    if (insightsData.length === 0) return null;

    // Calculate average turnover
    const avgTurnover = insightsData.reduce((sum, d) => sum + d.turnover, 0) / insightsData.length;
    
    // Get max turnover for scaling (use max of data or average, whichever is higher)
    const maxDataTurnover = Math.max(...insightsData.map(d => d.turnover));
    const maxTurnoverInsights = Math.max(maxDataTurnover, avgTurnover, 1);

    return (
      <View style={styles.insightsCard}>
        <View style={styles.insightsChartContainer}>
          {/* Left section - Average label and value */}
          <View style={styles.insightsLeftSection}>
            <Text style={styles.insightsAverageLabel}>Average Turnover</Text>
            <View style={styles.insightsValueContainer}>
              <Text style={styles.insightsCurrencySymbol}>R</Text>
              <Text style={styles.insightsAverageValue}>{formatMoney(avgTurnover)}</Text>
            </View>
          </View>
          
          {/* Right section - Bars chart */}
          <View style={styles.insightsChartSection}>
            <View style={styles.insightsChartArea}>
              {/* Average line - positioned based on average value */}
              <View 
                style={[
                  styles.insightsAverageLineHorizontal,
                  {
                    bottom: `${(avgTurnover / maxTurnoverInsights) * 100}%`,
                  }
                ]} 
              />
              
              {/* Bars */}
              <View style={styles.insightsBarsContainer}>
                {insightsData.map((item, index) => {
                  const barHeight = maxTurnoverInsights > 0 ? (item.turnover / maxTurnoverInsights) * 100 : 0;
                  return (
                    <View key={item.date} style={styles.insightsBarWrapper}>
                      <View
                        style={[
                          styles.insightsBar,
                          {
                            height: Math.max(barHeight, 2) + '%',
                          },
                        ]}
                      />
                      <Text style={styles.insightsDayLabel}>{item.dayLabel}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderMonthlyTotalsChart = () => {
    const isGP = metricType === 'gp';
    const isPurchases = metricType === 'purchases';
    const isBasket = metricType === 'basket';
    const currentData = isGP ? gpData : (isPurchases ? purchasesData : (isBasket ? basketData : turnoverData));
    const chartTitle = `Monthly Total ${getMetricTitle()}`;
    const chartColor = isGP ? colors.chartBasket : (isPurchases ? colors.chartGP : (isBasket ? colors.chartBasketSize : colors.chartTurnover));
    
    // Only show for yearly period and when we have complete data
    if (selectedPeriod !== 'Y' || currentData.length !== 12) {
      return null;
    }

    // Get monthly totals
    const monthlyTotals = currentData.map(item => {
      if (isGP) {
        return item.totalGP || 0;
      } else if (isPurchases) {
        return item.totalPurchases || 0;
      } else if (isBasket) {
        // For basket, show total turnover as the monthly total
        return item.totalTurnover || 0;
      } else {
        return item.totalTurnover || 0;
      }
    });

    // Calculate max value for scaling
    const maxTotal = Math.max(...monthlyTotals, 1);
    
    // Calculate average total - exclude the last month (current incomplete month) from average
    const monthlyTotalsForAverage = monthlyTotals.slice(0, -1); // Exclude last month
    const avgTotal = monthlyTotalsForAverage.length > 0
      ? monthlyTotalsForAverage.reduce((sum, val) => sum + val, 0) / monthlyTotalsForAverage.length
      : 0;

    // Get selected value
    const selectedTotalValue = selectedMonthlyTotalDate
      ? (() => {
          const selectedItem = currentData.find(d => d.date === selectedMonthlyTotalDate);
          if (!selectedItem) return avgTotal;
          if (isGP) {
            return selectedItem.totalGP || 0;
          } else if (isPurchases) {
            return selectedItem.totalPurchases || 0;
          } else if (isBasket) {
            return selectedItem.totalTurnover || 0;
          } else {
            return selectedItem.totalTurnover || 0;
          }
        })()
      : avgTotal;

    const handleMonthlyTotalBarPress = (date) => {
      if (selectedMonthlyTotalDate === date) {
        // Deselect if clicking the same bar
        setSelectedMonthlyTotalDate(null);
      } else {
        setSelectedMonthlyTotalDate(date);
      }
    };

    return (
      <View style={styles.monthlyTotalsChartWrapper}>
        <Text style={styles.chartTitle}>{chartTitle}</Text>
        <View style={styles.chartContainer}>
          {/* Average/Selected Summary */}
          <View style={styles.averageContainer}>
            <Text style={styles.averageLabel}>
              {selectedMonthlyTotalDate 
                ? formatDateFull(selectedMonthlyTotalDate).toUpperCase() 
                : 'MONTHLY AVERAGE'}
            </Text>
            <View style={styles.valueContainer}>
              <Text style={styles.currencySymbol}>R</Text>
              <Text style={styles.averageValue}>
                {formatMoney(selectedTotalValue)}
              </Text>
            </View>
            {selectedMonthlyTotalDate ? (
              (() => {
                const selectedItem = currentData.find(d => d.date === selectedMonthlyTotalDate);
                if (selectedItem?.endDate) {
                  return (
                    <Text style={styles.averageDate}>
                      {formatDateFull(selectedItem.date)} - {formatDateFull(selectedItem.endDate)}
                    </Text>
                  );
                }
                return <Text style={styles.averageDate}>{' '}</Text>;
              })()
            ) : (
              currentData.length > 0 && (
                <Text style={styles.averageDate}>
                  {currentData[0]?.endDate
                    ? `${formatDateFull(currentData[0].date)} - ${formatDateFull(currentData[currentData.length - 1].endDate)}`
                    : `${formatDateFull(currentData[0].date)} - ${formatDateFull(currentData[currentData.length - 1].date)}`
                  }
                </Text>
              )
            )}
          </View>

          {/* Bars */}
          <View style={styles.barsContainer}>
            {currentData.map((item, index) => {
              const totalValue = isGP 
                ? (item.totalGP || 0)
                : (isPurchases 
                    ? (item.totalPurchases || 0)
                    : (isBasket 
                        ? (item.totalTurnover || 0)
                        : (item.totalTurnover || 0)));
              const barHeight = maxTotal > 0 ? (totalValue / maxTotal) * 112 : 0;
              const isSelected = selectedMonthlyTotalDate === item.date;
              
              return (
                <TouchableOpacity
                  key={item.date}
                  onPress={() => handleMonthlyTotalBarPress(item.date)}
                  style={styles.barWrapper}
                  activeOpacity={0.7}
                >
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(barHeight, 2),
                          backgroundColor: isSelected 
                            ? chartColor 
                            : chartColor + '40', // More transparent (25% opacity)
                          borderWidth: isSelected ? 2 : 0,
                          borderColor: chartColor,
                        },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          
          {/* X-Axis Labels */}
          <View style={styles.xAxisContainer}>
            {currentData.map((item, index) => (
              <View key={item.date} style={styles.xAxisLabelWrapper}>
                <Text style={styles.xAxisLabel}>{item.formattedDate}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderBarChart = () => {
    const isGP = metricType === 'gp';
    const isPurchases = metricType === 'purchases';
    const isBasket = metricType === 'basket';
    const currentData = isGP ? gpData : (isPurchases ? purchasesData : (isBasket ? basketData : turnoverData));
    const chartTitle = `${getMetricTitle()} Trend`;
    const chartColor = isGP ? colors.chartBasket : (isPurchases ? colors.chartGP : (isBasket ? colors.chartBasketSize : colors.chartTurnover));
    
    // Always show loading if loading state is true
    if (loading) {
      return (
        <View>
          <Text style={styles.chartTitle}>{chartTitle}</Text>
          <View style={styles.chartContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
          </View>
        </View>
      );
    }

    // Don't render chart if no data or incomplete data
    if (currentData.length === 0) {
      return (
        <View>
          <Text style={styles.chartTitle}>{chartTitle}</Text>
          <View style={styles.chartContainer}>
            <Text style={styles.placeholderText}>No data available</Text>
          </View>
        </View>
      );
    }

    // For 6M period, ensure we have 26 weeks of data
    if (selectedPeriod === '6M' && currentData.length !== 26) {
      return (
        <View>
          <Text style={styles.chartTitle}>{chartTitle}</Text>
          <View style={styles.chartContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
          </View>
        </View>
      );
    }

    // For Y period, ensure we have 12 months of data
    if (selectedPeriod === 'Y' && currentData.length !== 12) {
      return (
        <View>
          <Text style={styles.chartTitle}>{chartTitle}</Text>
          <View style={styles.chartContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
          </View>
        </View>
      );
    }

    // Calculate selected bar index for positioning
    const selectedIndex = selectedBarDate 
      ? currentData.findIndex(d => d.date === selectedBarDate)
      : -1;

    return (
      <View>
        <Text style={styles.chartTitle}>{chartTitle}</Text>
        <View style={styles.chartContainer}>
          {/* Average/Date Summary inside card */}
          <View style={styles.averageContainer}>
            <Text style={styles.averageLabel}>
              {selectedPeriod === '6M' || selectedPeriod === 'Y'
                ? 'DAILY AVERAGE'
                : (selectedBarDate 
                    ? formatDateFull(selectedBarDate).toUpperCase() 
                    : 'AVERAGE')}
            </Text>
            <View style={styles.valueContainer}>
              {!isGP && <Text style={styles.currencySymbol}>R</Text>}
              <Text style={styles.averageValue}>
                {isGP 
                  ? selectedValue.toFixed(1)
                  : formatMoney(selectedValue)
                }
              </Text>
              {isGP && <Text style={[styles.currencySymbol, { marginLeft: 4, marginRight: 0 }]}>%</Text>}
            </View>
            {selectedBarDate ? (
              (selectedPeriod === '6M' || selectedPeriod === 'Y') ? (
                // For 6M and Y, show the range below the value
                (() => {
                  const selectedItem = currentData.find(d => d.date === selectedBarDate);
                  if (selectedItem?.endDate) {
                    return (
                      <Text style={styles.averageDate}>
                        {formatDateFull(selectedItem.date)} - {formatDateFull(selectedItem.endDate)}
                      </Text>
                    );
                  }
                  return <Text style={styles.averageDate}>{' '}</Text>;
                })()
              ) : (
                <Text style={styles.averageDate}>{' '}</Text>
              )
            ) : (
              currentData.length > 0 && (
                <Text style={styles.averageDate}>
                  {(selectedPeriod === '6M' || selectedPeriod === 'Y') && currentData[currentData.length - 1]?.endDate
                    ? `${formatDateFull(currentData[0].date)} - ${formatDateFull(currentData[currentData.length - 1].endDate)}`
                    : `${formatDateFull(currentData[0].date)} - ${formatDateFull(currentData[currentData.length - 1].date)}`
                  }
                </Text>
              )
            )}
          </View>

          {/* Bars */}
          <View style={styles.barsContainer}>
            {currentData.map((item, index) => {
              const value = isGP ? item.gp : (isPurchases ? item.purchases : (isBasket ? item.basket : item.turnover));
              const barHeight = maxValue > 0 ? (value / maxValue) * 112 : 0;
              const isSelected = selectedBarDate === item.date;
              
              return (
                <TouchableOpacity
                  key={item.date}
                  onPress={() => handleBarPress(item.date)}
                  style={styles.barWrapper}
                  activeOpacity={0.7}
                >
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(barHeight, 2),
                          backgroundColor: isSelected 
                            ? chartColor 
                            : chartColor + '40', // More transparent (25% opacity)
                          borderWidth: isSelected ? 2 : 0,
                          borderColor: chartColor,
                        },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          
          {/* X-Axis Labels */}
          <View style={styles.xAxisContainer}>
            {(() => {
              // For weekly view, show all day labels
              if (selectedPeriod === 'W') {
                return currentData.map((item, index) => (
                  <View key={item.date} style={styles.xAxisLabelWrapper}>
                    <Text style={styles.xAxisLabel}>{item.formattedDate}</Text>
                  </View>
                ));
              } else if (selectedPeriod === 'M') {
                // Monthly: show every 7 days plus last day
                const labelIndices = [0, 7, 14, 21, 28];
                if (currentData.length > 28) {
                  labelIndices.push(currentData.length - 1);
                }
                return labelIndices.map((idx) => {
                  const item = currentData[idx];
                  if (!item) return null;
                  return (
                    <Text key={item.date} style={styles.xAxisLabel}>{item.formattedDate}</Text>
                  );
                });
              } else if (selectedPeriod === '6M') {
                // 6M: show month names - find unique months and their positions
                // Only render if we have complete data (26 weeks)
                if (currentData.length !== 26) return null;
                
                const monthLabels = [];
                let lastMonth = -1;
                currentData.forEach((item, index) => {
                  if (item.month !== undefined && item.month !== lastMonth) {
                    monthLabels.push({
                      label: item.formattedDate,
                      index: index,
                      key: `${item.month}-${index}`,
                    });
                    lastMonth = item.month;
                  }
                });
                return monthLabels.map((m) => (
                  <Text key={m.key} style={styles.xAxisLabel}>{m.label}</Text>
                ));
              } else if (selectedPeriod === 'Y') {
                // Y: show all month names (12 months)
                // Only render if we have complete data (12 months)
                if (currentData.length !== 12) return null;
                
                return currentData.map((item, index) => (
                  <View key={item.date} style={styles.xAxisLabelWrapper}>
                    <Text style={styles.xAxisLabel}>{item.formattedDate}</Text>
                  </View>
                ));
              }
              return null;
            })()}
          </View>
        </View>
      </View>
    );
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 80 : 60}
              tint="light"
              style={styles.backButtonBlur}
            >
              <BackArrowIcon size={20} color={colors.textPrimary} />
            </BlurView>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>{getMetricTitle()}</Text>
          
          <View style={styles.headerSpacer} />
        </View>

        {/* Period Toggles */}
        <View style={styles.periodToggleWrapper}>
          <View style={styles.periodContainer}>
            {periods.map((period) => (
              <TouchableOpacity
                key={period.key}
                onPress={() => {
                  setSelectedPeriod(period.key);
                  setSelectedBarDate(null); // Reset selection when changing period
                  setSelectedMonthlyTotalDate(null); // Reset monthly totals selection when changing period
                }}
                style={styles.periodButtonWrapper}
              >
                <LinearGradient
                  colors={selectedPeriod === period.key
                    ? [colors.accentPrimary, colors.accentPrimaryHover]
                    : ['transparent', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.periodButton}
                >
                  <Text
                    style={[
                      styles.periodButtonText,
                      selectedPeriod === period.key && styles.periodButtonTextActive,
                    ]}
                  >
                    {period.label}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Content Area */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
          }
        >
          {/* Chart */}
          {(metricType === 'turnover' || metricType === 'gp' || metricType === 'purchases' || metricType === 'basket') && (selectedPeriod === 'W' || selectedPeriod === 'M' || selectedPeriod === '6M' || selectedPeriod === 'Y') ? (
            <>
              {renderBarChart()}
              {/* Monthly Totals Chart - only show for yearly period */}
              {selectedPeriod === 'Y' && renderMonthlyTotalsChart()}
            </>
          ) : (
            <View>
              <Text style={styles.chartTitle}>{getMetricTitle()} Trend</Text>
              <View style={styles.chartContainer}>
                <Text style={styles.placeholderText}>
                  Chart will be displayed here
                </Text>
                <Text style={styles.placeholderSubtext}>
                  Period: {selectedPeriod} | Metric: {getMetricTitle()}
                </Text>
              </View>
            </View>
          )}

          {/* Insights Section */}
          {metricType === 'turnover' && (
            <View style={styles.insightsSection}>
              <Text style={styles.insightsTitle}>Insights</Text>
              {renderYoyCard()}
            </View>
          )}
        </ScrollView>

        {/* Loading Overlay for refresh */}
        <LoadingOverlay
          visible={refreshing}
          message="Refreshing data..."
        />
      </SafeAreaView>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  backButtonBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Platform.OS === 'ios' 
      ? 'rgba(255, 255, 255, 0.7)' 
      : 'rgba(255, 255, 255, 0.9)',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  periodToggleWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  periodContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 999,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    height: 48,
  },
  periodButtonWrapper: {
    flex: 1,
    marginHorizontal: 2,
  },
  periodButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 10,
  },
  periodButtonText: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    opacity: 0.5,
  },
  periodButtonTextActive: {
    opacity: 1,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 12,
    paddingLeft: 0,
  },
  averageContainer: {
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingLeft: 0,
  },
  averageLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  currencySymbol: {
    fontSize: 26,
    fontFamily: typography.fontFamily.black,
    fontWeight: typography.fontWeight.black,
    color: colors.textMuted,
    marginRight: 4,
    marginLeft: 0,
  },
  averageValue: {
    fontSize: 26,
    fontFamily: typography.fontFamily.black,
    fontWeight: typography.fontWeight.black,
    color: colors.textPrimary,
  },
  averageDate: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  chartContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 20,
    padding: 20,
    minHeight: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  monthlyTotalsChartWrapper: {
    marginTop: 24,
  },
  chartOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 112,
    position: 'relative',
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  barContainer: {
    width: '100%',
    height: 112,
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  bar: {
    width: '70%',
    borderRadius: 4,
    minHeight: 2,
  },
  xAxisContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 0,
  },
  xAxisLabelWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xAxisLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 16,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  insightsSection: {
    marginTop: 24,
  },
  insightsTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  insightsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 20,
    padding: 20,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginTop: 0,
  },
  insightsChartContainer: {
    flexDirection: 'row',
    height: 120,
  },
  insightsLeftSection: {
    width: '33%',
    justifyContent: 'flex-start',
    paddingRight: 16,
    paddingTop: 8,
  },
  insightsAverageLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  insightsValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  insightsCurrencySymbol: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    marginRight: 4,
  },
  insightsAverageValue: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  insightsChartSection: {
    flex: 1,
    width: '67%',
  },
  insightsChartArea: {
    flex: 1,
    position: 'relative',
    height: 100,
    paddingTop: 12,
  },
  insightsAverageLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accentPrimary,
    zIndex: 2,
  },
  insightsBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '100%',
    paddingBottom: 20,
    position: 'relative',
  },
  insightsBarWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    position: 'relative',
  },
  insightsBar: {
    width: '70%',
    backgroundColor: colors.textMuted + '40',
    borderRadius: 4,
    minHeight: 2,
  },
  insightsDayLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    marginTop: 4,
  },
  // YoY Card styles
  yoyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 20,
    padding: 20,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  yoyLegendContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 16,
    gap: 32,
  },
  yoyLegendItem: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  yoyLegendLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 4,
  },
  yoyValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  yoyCurrencySymbol: {
    fontSize: 18,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    marginRight: 3,
  },
  yoyValue: {
    fontSize: 18,
    fontFamily: typography.fontFamily.black,
    fontWeight: typography.fontWeight.black,
  },
  yoyChartContainer: {
    height: 100,
    marginBottom: 0,
    position: 'relative',
  },
  yoySvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  yoyPercentageOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    zIndex: 10,
  },
  yoyPercentageBlock: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  yoyPercentagePositive: {
    backgroundColor: '#59BA47',
  },
  yoyPercentageNegative: {
    backgroundColor: '#FF4509',
  },
  yoyPercentageText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
});

export default TrendsScreen;
