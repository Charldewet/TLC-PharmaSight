import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { DollarIcon, TargetIcon, GPIcon, BasketIcon, ShoppingCartIcon, TrendIcon, WarningIcon } from './Icons';

const DashboardCard = ({ 
  title, 
  value, 
  currency = 'R', 
  percentage, 
  comparison, 
  type = 'primary',
  invertPercentage = false, // For purchases: over budget (positive) = red, under budget (negative) = green
  threshold = null, // Custom threshold for percentage coloring (e.g., 75 means < 75% = green, >= 75% = orange)
  showWarning = false, // Show warning indicator (orange square with warning icon)
  onPress,
}) => {
  const cardStyles = [styles.card];

  // Get color based on card type/title
  const getCardColor = () => {
    if (title.includes('Turnover') || title.includes('Current Month')) {
      return colors.chartTurnover; // Orange
    } else if (title.includes('Target') || title.includes('MTD')) {
      return colors.chartTurnover; // Orange
    } else if (title === 'GP') {
      return colors.chartBasket; // Purple
    } else if (title === 'Basket') {
      return colors.chartBasketSize; // Bright Magenta/Pink
    } else if (title === 'Purchases') {
      return colors.chartGP; // Green
    } else if (title.includes('Purchase Budget')) {
      return colors.chartPurchases; // Yellow
    }
    return colors.textSecondary;
  };

  const cardColor = getCardColor();

  // Get icon based on card type
  const getIcon = () => {
    const iconSize = 16;
    
    if (title.includes('Turnover') || title.includes('Current Month')) {
      return <DollarIcon size={iconSize} color={cardColor} />;
    } else if (title.includes('Target') || title.includes('MTD')) {
      return <TargetIcon size={iconSize} color={cardColor} />;
    } else if (title === 'GP') {
      return <GPIcon size={iconSize} color={cardColor} />;
    } else if (title === 'Basket') {
      return <BasketIcon size={iconSize} color={cardColor} />;
    } else if (title.includes('Purchases') || title.includes('Purchase Budget')) {
      return <ShoppingCartIcon size={iconSize} color={cardColor} />;
    }
    return null;
  };

  const CardContent = (
    <>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          {getIcon() && <View style={styles.cardIcon}>{getIcon()}</View>}
          <Text style={[styles.cardTitle, { color: cardColor }]}>{title}</Text>
        </View>
        {onPress && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onPress();
            }}
            style={styles.trendIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <TrendIcon size={14} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Card Value Row */}
      <View style={styles.cardValueRow}>
        <View style={styles.cardValueWrapper}>
          {currency && currency !== '%' && (
            <Text style={styles.cardValueCurrency}>{currency}</Text>
          )}
          <Text style={styles.cardValueAmount}>{value || '—'}</Text>
          {currency === '%' && (
            <Text style={styles.cardValueCurrencyPercent}>%</Text>
          )}
        </View>
        {showWarning && (
          <View style={[styles.cardValuePercentage, styles.negative, styles.warningIndicator]}>
            <WarningIcon size={12} color="#FFFFFF" />
          </View>
        )}
      </View>
      
      {/* Card Comparison Row - Comparison Text and Percentage */}
      <View style={styles.cardComparisonRow}>
        {comparison && (
          <Text style={styles.cardComparisonText}>{comparison}</Text>
        )}
        {percentage !== undefined && percentage !== null && !isNaN(percentage) && (
          <View style={[
            styles.cardValuePercentage,
            // Custom threshold logic: if threshold is set, use it (e.g., < 75% = green, >= 75% = orange)
            // Otherwise, use invertPercentage logic
            threshold !== null
              ? (percentage < threshold ? styles.positive : styles.negative)
              : (invertPercentage 
                  ? (percentage >= 0 ? styles.negative : styles.positive)
                  : (percentage >= 0 ? styles.positive : styles.negative))
          ]}>
            <Text style={[
              styles.percentageText,
              threshold !== null
                ? (percentage < threshold ? styles.positiveText : styles.negativeText)
                : (invertPercentage 
                    ? (percentage >= 0 ? styles.negativeText : styles.positiveText)
                    : (percentage >= 0 ? styles.positiveText : styles.negativeText))
            ]}>
              {percentage >= 0 ? '+' : ''}{percentage.toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity 
        style={cardStyles} 
        onPress={onPress}
        activeOpacity={0.7}
      >
        {CardContent}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyles}>
      {CardContent}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 20,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    width: '100%',
    marginBottom: 0,
    minHeight: 100,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    minHeight: 20,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardIcon: {
    marginRight: 6,
  },
  trendIconButton: {
    padding: 0,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    letterSpacing: -0.1,
  },
  cardValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 2,
    minHeight: 32,
  },
  cardValueWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
  },
  cardValueCurrency: {
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    marginRight: 3,
    marginBottom: 1,
  },
  cardValueCurrencyPercent: {
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    marginLeft: 2,
    marginBottom: 1,
  },
  cardValueAmount: {
    fontSize: 24,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  cardValuePercentage: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positive: {
    backgroundColor: '#59BA47',
  },
  negative: {
    backgroundColor: '#FF4509',
  },
  percentageText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  positiveText: {
    color: '#FFFFFF',
  },
  negativeText: {
    color: '#FFFFFF',
  },
  cardComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  warningIndicator: {
    marginLeft: 8,
  },
  cardComparisonText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    lineHeight: 14,
    marginTop: 0,
    flex: 1,
  },
});

export default DashboardCard;
