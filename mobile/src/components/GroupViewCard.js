import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { DollarIcon, ShoppingCartIcon, GPIcon, BasketIcon } from './Icons';
import { formatMoney } from '../utils/formatters';

const GroupViewCard = ({ 
  title,
  type, // 'turnover', 'purchases', 'gp', 'basket'
  pharmacies,
  pharmacyData, // { [pharmacyId]: { value, comparison, percentage, ... } }
  icon: IconComponent,
  iconColor,
}) => {
  const getCardColor = () => {
    switch (type) {
      case 'turnover':
        return colors.chartTurnover;
      case 'purchases':
        return colors.chartGP;
      case 'gp':
        return colors.chartBasket;
      case 'basket':
        return colors.chartBasketSize;
      default:
        return colors.textSecondary;
    }
  };

  const cardColor = getCardColor();
  const isTurnover = type === 'turnover';
  const isPurchases = type === 'purchases';
  const isGP = type === 'gp';
  const isBasket = type === 'basket';

  const CardWrapper = isTurnover ? LinearGradient : View;
  const cardWrapperProps = isTurnover ? {
    colors: ['#FF4509', '#FFA500'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  } : {};

  return (
    <CardWrapper
      {...cardWrapperProps}
      style={[styles.card, isTurnover && styles.turnoverCard]}
    >
      {/* Card Header */}
      <View style={styles.cardHeader}>
        {IconComponent && (
          <View style={styles.cardIcon}>
            <IconComponent size={16} color={isTurnover ? '#FFFFFF' : cardColor} />
          </View>
        )}
        <Text style={[
          styles.cardTitle,
          { color: isTurnover ? '#FFFFFF' : cardColor }
        ]}>
          {title}
        </Text>
      </View>

      {/* Pharmacy List */}
      <View style={styles.pharmacyList}>
        {pharmacies.map((pharmacy, index) => {
          const pid = pharmacy.pharmacy_id || pharmacy.id;
          const data = pharmacyData[pid] || {};
          const isLast = index === pharmacies.length - 1;
          
          return (
            <View key={pid} style={[
              styles.pharmacyItem,
              isLast && styles.pharmacyItemLast,
              isTurnover && !isLast && styles.pharmacyItemTurnover
            ]}>
              <Text style={[
                styles.pharmacyName,
                isTurnover && styles.pharmacyNameWhite
              ]}>
                {pharmacy.pharmacy_name || pharmacy.name}
              </Text>
              
              <View style={styles.pharmacyValueRow}>
                <View style={styles.pharmacyValueWrapper}>
                  {!isGP && (
                    <Text style={[
                      styles.valueCurrency,
                      isTurnover && styles.valueCurrencyWhite
                    ]}>
                      R
                    </Text>
                  )}
                  <Text style={[
                    styles.valueAmount,
                    isTurnover && styles.valueAmountWhite
                  ]}>
                    {data.value !== null && data.value !== undefined
                      ? isGP
                        ? Math.round(data.value)
                        : formatMoney(data.value)
                      : '—'}
                  </Text>
                  {isGP && (
                    <Text style={[
                      styles.valueCurrency,
                      isTurnover && styles.valueCurrencyWhite
                    ]}>
                      %
                    </Text>
                  )}
                </View>
                
                {data.percentage !== null && data.percentage !== undefined && !isNaN(data.percentage) && (
                  <View style={[
                    styles.percentageBadge,
                    // For purchases: over budget (positive) = red, under budget (negative) = green
                    isPurchases 
                      ? (data.percentage >= 0 ? styles.negativeBadge : styles.positiveBadge)
                      : (data.percentage >= 0 ? styles.positiveBadge : styles.negativeBadge)
                  ]}>
                    <Text style={styles.percentageText}>
                      {data.percentage >= 0 ? '+' : ''}{Math.round(data.percentage)}%
                    </Text>
                  </View>
                )}
              </View>
              
              {data.comparison && (
                <Text style={[
                  styles.comparisonText,
                  isTurnover && styles.comparisonTextWhite
                ]}>
                  {data.comparison}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </CardWrapper>
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
  turnoverCard: {
    backgroundColor: 'transparent',
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
  pharmacyList: {
    gap: 12,
  },
  pharmacyItem: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  pharmacyItemLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  pharmacyItemTurnover: {
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  pharmacyName: {
    fontSize: 13,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  pharmacyNameWhite: {
    color: '#FFFFFF',
  },
  pharmacyValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pharmacyValueWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
  },
  valueCurrency: {
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    marginRight: 3,
    marginBottom: 1,
  },
  valueCurrencyWhite: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  valueAmount: {
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  valueAmountWhite: {
    color: '#FFFFFF',
  },
  percentageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  positiveBadge: {
    backgroundColor: '#59BA47',
  },
  negativeBadge: {
    backgroundColor: '#FF4509',
  },
  percentageText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  comparisonText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  comparisonTextWhite: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

export default GroupViewCard;

