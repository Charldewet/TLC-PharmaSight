import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { ShoppingCartIcon } from './Icons';
import { formatMoney } from '../utils/formatters';

const SpendAnalyticsCard = ({ 
  title,
  purchases,
  comparisonValue, // budget or turnover
  percentage,
  difference, // for Purchase vs Budget only
  differenceLabel, // "Above Budget", "Below Budget", etc.
  color, // 'green' or 'orange'
}) => {
  const isGreen = color === 'green';
  const cardColor = isGreen ? colors.chartGP : colors.chartTurnover;
  
  // Calculate progress for circular indicator (0-100%)
  const progress = percentage !== null && percentage !== undefined && !isNaN(percentage) 
    ? Math.min(Math.max(percentage, 0), 100) 
    : 0;
  
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  // Generate unique gradient ID based on title
  const gradientId = title.toUpperCase().includes('BUDGET') ? 'pieGradientBudget' : 'pieGradientTurnover';

  return (
    <View style={styles.card}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <ShoppingCartIcon size={16} color={cardColor} />
        </View>
        <Text style={[styles.cardTitle, { color: cardColor }]}>{title}</Text>
      </View>

      {/* Card Content */}
      <View style={styles.cardContent}>
        {/* Metrics */}
        <View style={styles.metrics}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>PURCHASES</Text>
            <Text style={styles.metricValue}>
              {purchases !== null && purchases !== undefined ? `R ${formatMoney(purchases)}` : '—'}
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>
              {title.toUpperCase().includes('BUDGET') ? 'BUDGET' : 'TURNOVER'}
            </Text>
            <Text style={styles.metricValue}>
              {comparisonValue !== null && comparisonValue !== undefined ? `R ${formatMoney(comparisonValue)}` : '—'}
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>
              {differenceLabel || (title.toUpperCase().includes('BUDGET') ? 'DIFFERENCE' : '% OF TURNOVER')}
            </Text>
            <Text style={[
              styles.metricValue,
              title.toUpperCase().includes('BUDGET') && difference !== null && difference !== undefined && difference < 0 
                ? { color: colors.chartGP } 
                : title.toUpperCase().includes('BUDGET') && difference !== null && difference !== undefined && difference > 0
                ? { color: colors.statusError }
                : {}
            ]}>
              {title.toUpperCase().includes('BUDGET') 
                ? (difference !== null && difference !== undefined 
                    ? `R ${formatMoney(Math.abs(difference))}` 
                    : '—')
                : (percentage !== null && percentage !== undefined && !isNaN(percentage)
                    ? `${Math.round(percentage)}%`
                    : '—')
              }
            </Text>
          </View>
        </View>

        {/* Circular Progress Indicator */}
        <View style={styles.chartWrapper}>
          <Svg width="120" height="120" viewBox="0 0 120 120">
            <Defs>
              <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={isGreen ? '#59BA47' : '#FF4509'} stopOpacity="1" />
                <Stop offset="100%" stopColor={isGreen ? '#7DD87A' : '#FFA500'} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            {/* Background circle */}
            <Circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={colors.surfaceBorder}
              strokeWidth="20"
            />
            {/* Progress circle */}
            <Circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="20"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
          </Svg>
          <View style={styles.chartCenter}>
            <Text style={styles.chartPercentage}>
              {percentage !== null && percentage !== undefined && !isNaN(percentage) 
                ? `${Math.round(percentage)}%` 
                : '0%'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 20,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    width: '100%',
    marginBottom: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    marginRight: 6,
  },
  cardTitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metrics: {
    flex: 1,
    marginRight: 16,
  },
  metricItem: {
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 9,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  chartWrapper: {
    width: 120,
    height: 120,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartCenter: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPercentage: {
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
});

export default SpendAnalyticsCard;

