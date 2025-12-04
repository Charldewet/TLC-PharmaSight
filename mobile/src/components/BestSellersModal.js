import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { dashboardAPI } from '../services/api';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';

const BestSellersModal = ({ visible, onClose, pharmacyId, date, fromDate, toDate, isDailyView = true }) => {
  const [loading, setLoading] = useState(false);
  const [bestSellers, setBestSellers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      if (!pharmacyId || (!date && (!fromDate || !toDate))) {
        console.log('[BestSellersModal] Missing pharmacyId or date/range:', { pharmacyId, date, fromDate, toDate });
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setBestSellers([]);

        console.log('[BestSellersModal] Loading best sellers for:', { pharmacyId, date, fromDate, toDate });
        const data = await dashboardAPI.getBestSellers(pharmacyId, date, fromDate, toDate, 20);
        console.log('[BestSellersModal] Raw API response:', JSON.stringify(data, null, 2));
        
        // Handle different response structures
        let sellers = [];
        if (Array.isArray(data)) {
          sellers = data;
        } else if (data.best_sellers) {
          sellers = data.best_sellers;
        } else if (data.stock_activity) {
          sellers = data.stock_activity;
        } else if (data.items) {
          sellers = data.items;
        } else if (data.data && Array.isArray(data.data)) {
          sellers = data.data;
        }

        console.log('[BestSellersModal] Parsed sellers:', sellers.length);
        setBestSellers(sellers.slice(0, 20));
      } catch (err) {
        console.error('[BestSellersModal] Error loading best sellers:', err);
        const errorMessage = err.response?.data?.detail || err.response?.data?.message || err.message || 'Unknown error';
        setError(`Failed to load: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    if (visible && pharmacyId && (date || (fromDate && toDate))) {
      loadData();
    } else if (!visible) {
      setBestSellers([]);
      setError(null);
    }
  }, [visible, pharmacyId, date, fromDate, toDate]);

  const getProductName = (item) => {
    return item.product_description || item.description || item.product_name || item.name || item.title || 'Unknown Product';
  };

  const getProductCode = (item) => {
    return item.nappi_code || item.product_code || item.code || '';
  };

  const getQuantity = (item) => {
    return item.qty_sold || item.quantity_sold || item.qty || item.quantity || item.total_quantity || item.units_sold || 0;
  };

  const getGPPercent = (item) => {
    return item.gp_percent || item.gp_pct || item.margin_pct || 0;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Background - tap to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        
        {/* Modal content */}
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>Top 20 Best Sellers</Text>
              <Text style={styles.subtitle}>
                {fromDate && toDate ? `${fromDate} to ${toDate}` : date}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeIcon}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.accentPrimary} />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : error ? (
              <View style={styles.centerContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : bestSellers.length === 0 ? (
              <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>No products found for this period</Text>
              </View>
            ) : (
              bestSellers.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <View style={styles.rankContainer}>
                    <Text style={styles.rank}>{index + 1}</Text>
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {getProductName(item)}
                    </Text>
                    <Text style={styles.productCode}>
                      {getProductCode(item)}
                    </Text>
                  </View>
                  <View style={styles.itemStats}>
                    <Text style={styles.quantity}>{getQuantity(item)} units</Text>
                    <Text style={styles.gpPercent}>{getGPPercent(item).toFixed(1)}% GP</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 60,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 24,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
    lineHeight: 28,
    textAlign: 'center',
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.statusError,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  rank: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.accentPrimary,
  },
  itemDetails: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  productCode: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  itemStats: {
    alignItems: 'flex-end',
  },
  quantity: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
    marginBottom: 4,
  },
  gpPercent: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
});

export default BestSellersModal;
