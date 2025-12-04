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
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { dashboardAPI } from '../services/api';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { DownloadIcon } from './Icons';

const LowGPModal = ({ visible, onClose, pharmacyId, date, fromDate, toDate, isDailyView = true, pharmacyName = 'Unknown Pharmacy' }) => {
  const [loading, setLoading] = useState(false);
  const [worstGP, setWorstGP] = useState([]);
  const [error, setError] = useState(null);
  const [threshold, setThreshold] = useState('20');
  const [excludePdst, setExcludePdst] = useState(true);

  const loadWorstGP = async (pid, dateStr, dateFrom, dateTo, customThreshold = null, customExcludePdst = null) => {
    if (!pid || (!dateStr && (!dateFrom || !dateTo))) {
      console.log('[LowGPModal] Missing pharmacyId or date/range:', { pid, dateStr, dateFrom, dateTo });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const thresholdValue = customThreshold !== null ? customThreshold : parseFloat(threshold) || 20;
      const excludePdstValue = customExcludePdst !== null ? customExcludePdst : excludePdst;

      console.log('[LowGPModal] Loading worst GP for:', { pid, dateStr, dateFrom, dateTo, thresholdValue, excludePdstValue });
      // Match web app: limit=50 for monthly view (web app uses 50)
      const limit = (dateFrom && dateTo) ? 50 : 100; // 50 for monthly/range, 100 for daily
      const data = await dashboardAPI.getWorstGP(
        pid,
        dateStr,
        dateFrom,
        dateTo,
        limit,
        thresholdValue,
        excludePdstValue
      );
      console.log('[LowGPModal] Raw API response:', JSON.stringify(data, null, 2));
      
      // Handle different response structures
      let products = [];
      if (Array.isArray(data)) {
        products = data;
      } else if (data.worst_gp_products) {
        products = data.worst_gp_products;
      } else if (data.low_gp_products) {
        products = data.low_gp_products;
      } else if (data.items) {
        products = data.items;
      } else if (data.data && Array.isArray(data.data)) {
        products = data.data;
      }

      console.log('[LowGPModal] Parsed products:', products.length);
      setWorstGP(products);
    } catch (err) {
      console.error('[LowGPModal] Error loading worst GP:', err);
      const errorMessage = err.response?.data?.detail || err.response?.data?.message || err.message || 'Unknown error';
      setError(`Failed to load: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && pharmacyId && (date || (fromDate && toDate))) {
      setWorstGP([]);
      setError(null);
      loadWorstGP(pharmacyId, date, fromDate, toDate, parseFloat(threshold) || 20, excludePdst);
    } else if (!visible) {
      setWorstGP([]);
      setError(null);
    }
  }, [visible, pharmacyId, date, fromDate, toDate]);

  const handleApplyThreshold = () => {
    loadWorstGP(pharmacyId, date, fromDate, toDate, parseFloat(threshold) || 20, excludePdst);
  };

  const handleToggleExcludePdst = (value) => {
    setExcludePdst(value);
    loadWorstGP(pharmacyId, date, fromDate, toDate, parseFloat(threshold) || 20, value);
  };

  const getProductName = (item) => {
    return item.product_name || item.product_description || item.description || item.name || item.title || 'Unknown Product';
  };

  const getProductCode = (item) => {
    return item.nappi_code || item.product_code || item.code || '';
  };

  const getQuantity = (item) => {
    return item.quantity_sold || item.qty_sold || item.qty || item.quantity || item.total_quantity || item.units_sold || 0;
  };

  const getGPPercent = (item) => {
    return item.gp_percent || item.gp_pct || item.margin_pct || 0;
  };

  const generatePDFHTML = () => {
    const dateToUse = date || new Date().toISOString().split('T')[0];
    const thresholdValue = parseFloat(threshold) || 20;
    
    // Format date for display
    const formattedDate = dateToUse.length === 8 
      ? `${dateToUse.slice(0, 4)}-${dateToUse.slice(4, 6)}-${dateToUse.slice(6, 8)}`
      : dateToUse;

    // Generate table rows
    const tableRows = worstGP.map((item, index) => {
      const productName = getProductName(item);
      const productCode = getProductCode(item);
      const quantity = getQuantity(item);
      const gpPercent = getGPPercent(item);

      return `
        <tr>
          <td style="text-align: center; padding: 4px;">${index + 1}</td>
          <td style="padding: 4px;">${productName.substring(0, 45)}</td>
          <td style="padding: 4px;">${productCode}</td>
          <td style="text-align: center; padding: 4px;">${gpPercent.toFixed(1)}%</td>
          <td style="text-align: center; padding: 4px;">${quantity}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              font-size: 9pt;
              padding: 20px;
            }
            h1 {
              font-size: 16pt;
              margin-bottom: 8px;
            }
            .info {
              font-size: 10pt;
              margin-bottom: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
              padding: 6px;
              text-align: left;
              border-bottom: 2px solid #000;
            }
            td {
              padding: 4px;
              border-bottom: 1px solid #ddd;
            }
            .rank-col {
              width: 40px;
              text-align: center;
            }
            .name-col {
              width: 200px;
            }
            .code-col {
              width: 100px;
            }
            .gp-col {
              width: 60px;
              text-align: center;
            }
            .qty-col {
              width: 60px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <h1>${pharmacyName} - Low GP Products Report</h1>
          <div class="info">Date: ${formattedDate}</div>
          <div class="info">Threshold: Below ${thresholdValue}% GP</div>
          <div class="info">Total Products: ${worstGP.length}</div>
          
          <table>
            <thead>
              <tr>
                <th class="rank-col">Rank</th>
                <th class="name-col">Product Name</th>
                <th class="code-col">Product Code</th>
                <th class="gp-col">GP%</th>
                <th class="qty-col">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `;
  };

  const handleDownloadPDF = async () => {
    if (worstGP.length === 0) {
      Alert.alert('No Data', 'No products to download');
      return;
    }

    try {
      // Generate HTML
      const html = generatePDFHTML();
      
      // Generate PDF
      const { uri } = await Print.printToFileAsync({ html });
      
      // Generate filename
      const dateToUse = date || new Date().toISOString().split('T')[0];
      const thresholdValue = parseFloat(threshold) || 20;
      const formattedDate = dateToUse.length === 8 
        ? `${dateToUse.slice(0, 4)}-${dateToUse.slice(4, 6)}-${dateToUse.slice(6, 8)}`
        : dateToUse.replace(/-/g, '');
      
      const filename = `low-gp-products-${formattedDate}-below-${thresholdValue}percent.pdf`;
      
      // Create a new file path with the desired filename
      const newUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.moveAsync({
        from: uri,
        to: newUri,
      });

      // Share/download the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Low GP Products Report',
        });
      } else {
        Alert.alert('Success', `PDF saved to: ${newUri}`);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    }
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
              <Text style={styles.title}>Low GP Products</Text>
              <Text style={styles.subtitle}>
                {fromDate && toDate ? `${fromDate} to ${toDate}` : date}
              </Text>
            </View>
            <View style={styles.headerActions}>
              {worstGP.length > 0 && (
                <TouchableOpacity 
                  onPress={handleDownloadPDF} 
                  style={styles.downloadButton}
                >
                  <DownloadIcon size={18} color={colors.accentPrimary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeIcon}>×</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <View style={styles.thresholdContainer}>
              <Text style={styles.controlLabel}>GP% ≤</Text>
              <TextInput
                style={styles.thresholdInput}
                value={threshold}
                onChangeText={setThreshold}
                keyboardType="numeric"
                placeholder="20"
              />
              <TouchableOpacity
                style={styles.applyButton}
                onPress={handleApplyThreshold}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, !excludePdst && styles.toggleButtonActive]}
                onPress={() => handleToggleExcludePdst(false)}
              >
                <Text style={[styles.toggleButtonText, !excludePdst && styles.toggleButtonTextActive]}>
                  SEP
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, excludePdst && styles.toggleButtonActive]}
                onPress={() => handleToggleExcludePdst(true)}
              >
                <Text style={[styles.toggleButtonText, excludePdst && styles.toggleButtonTextActive]}>
                  NO SEP
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Count Display */}
          {!loading && !error && worstGP.length > 0 && (
            <View style={styles.countContainer}>
              <Text style={styles.countText}>
                Showing {worstGP.length} product{worstGP.length !== 1 ? 's' : ''} with GP% ≤ {threshold}%
              </Text>
            </View>
          )}

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
            ) : worstGP.length === 0 ? (
              <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>
                  No products found with GP% ≤ {threshold}%
                </Text>
              </View>
            ) : (
              worstGP.map((item, index) => (
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
                    <Text style={[styles.gpPercent, { color: colors.statusWarning }]}>
                      {getGPPercent(item).toFixed(1)}%
                    </Text>
                    <Text style={styles.quantity}>{getQuantity(item)} units</Text>
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
    maxHeight: '85%',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
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
  controls: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  thresholdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  controlLabel: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  thresholdInput: {
    width: 60,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
    backgroundColor: colors.bgSecondary,
    textAlign: 'center',
  },
  applyButton: {
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyButtonText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    color: '#FFFFFF',
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceBorder,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.accentPrimary,
  },
  toggleButtonText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  countContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.bgSecondary,
  },
  countText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
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
    color: colors.statusError,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
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
    color: colors.statusWarning,
  },
  itemDetails: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
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
  gpPercent: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 4,
  },
  quantity: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.textMuted,
  },
});

export default LowGPModal;
