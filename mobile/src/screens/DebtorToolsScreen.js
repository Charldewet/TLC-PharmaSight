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
  FlatList,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useAuth } from '../context/AuthContext';
import { debtorAPI } from '../services/api';
import PharmacyPickerModal from '../components/PharmacyPickerModal';
import LoadingOverlay from '../components/LoadingOverlay';
import GradientBackground from '../components/GradientBackground';
import { formatMoney } from '../utils/formatters';
import { API_BASE_URL } from '../config/api';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { PharmacyIcon, HamburgerIcon, DollarIcon, UsersIcon, CalendarIcon, ClockIcon, ChevronDownIcon, ChevronRightIcon } from '../components/Icons';
import { LinearGradient } from 'expo-linear-gradient';

const DebtorToolsScreen = ({ navigation }) => {
  const { user, authToken } = useAuth();
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [showPharmacyPicker, setShowPharmacyPicker] = useState(false);
  
  // Statistics
  const [statistics, setStatistics] = useState({
    total_accounts: 0,
    total_outstanding: 0,
    current: 0,
    d30: 0,
    d60: 0,
    d90: 0,
    d120: 0,
    d150: 0,
    d180: 0,
  });
  
  // Filters
  const [minBalance, setMinBalance] = useState(100);
  const [ageingBuckets, setAgeingBuckets] = useState(['current', 'd30', 'd60', 'd90', 'd120', 'd150', 'd180']);
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Debtors list
  const [debtors, setDebtors] = useState([]);
  const [selectedDebtors, setSelectedDebtors] = useState(new Set());
  const [expandedDebtors, setExpandedDebtors] = useState(new Set());
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 1000, // Reasonable page size
    total: 0,
    pages: 1,
  });
  
  // Sort
  const [sortColumn, setSortColumn] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(() => {
    loadPharmacies();
  }, [user, authToken]);

  useEffect(() => {
    if (selectedPharmacy) {
      loadStatistics();
      loadDebtors();
    }
  }, [selectedPharmacy, minBalance, ageingBuckets, hasEmail, hasPhone, searchQuery, sortColumn, sortOrder]);

  const loadPharmacies = async () => {
    if (!user?.username) {
      console.log('[loadPharmacies] No username available');
      return;
    }

    if (!authToken) {
      console.error('[loadPharmacies] No auth token available');
      Alert.alert('Error', 'Authentication required. Please log in again.');
      return;
    }

    try {
      setLoading(true);
      const data = await debtorAPI.getPharmacies(user.username);
      
      const pharmaciesList = data.pharmacies || [];
      
      if (pharmaciesList.length === 0) {
        console.warn('[loadPharmacies] No pharmacies returned from API');
        Alert.alert('Info', 'No pharmacies available. Please contact your administrator.');
      }
      
      // Sort pharmacies so "TLC GROUP" always appears last
      const sortedPharmacies = pharmaciesList.sort((a, b) => {
        const nameA = (a.pharmacy_name || a.name || '').toUpperCase();
        const nameB = (b.pharmacy_name || b.name || '').toUpperCase();
        if (nameA === 'TLC GROUP') return 1;
        if (nameB === 'TLC GROUP') return -1;
        return nameA.localeCompare(nameB);
      });
      
      setPharmacies(sortedPharmacies);
      
      // Initialize with first pharmacy if available
      if (sortedPharmacies.length > 0 && !selectedPharmacy) {
        setSelectedPharmacy(sortedPharmacies[0]);
      }
    } catch (error) {
      console.error('[loadPharmacies] Error loading pharmacies:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error occurred';
      Alert.alert('Error', `Failed to load pharmacies: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    if (!selectedPharmacy) return;
    
    const pid = selectedPharmacy.pharmacy_id || selectedPharmacy.id;
    
    try {
      const data = await debtorAPI.getStatistics(pid);
      setStatistics(data);
    } catch (error) {
      console.error('[loadStatistics] Error loading statistics:', error);
    }
  };

  const loadDebtors = async () => {
    if (!selectedPharmacy) return;
    
    const pid = selectedPharmacy.pharmacy_id || selectedPharmacy.id;
    
    try {
      setDataLoading(true);
      
      // Fetch first page to get total count
      const firstPageData = await debtorAPI.getDebtors(pid, {
        min_balance: minBalance,
        ageing_buckets: ageingBuckets.join(','),
        has_email: hasEmail || undefined,
        has_phone: hasPhone || undefined,
        search: searchQuery || undefined,
        exclude_medical_aid: true, // Exclude medical aid control accounts
        page: 1,
        per_page: 1000, // Use reasonable page size
        sort_by: sortColumn || undefined,
        sort_order: sortOrder || undefined,
      });
      
      const totalPages = firstPageData.pages || 1;
      let allDebtors = [...(firstPageData.debtors || [])];
      
      // If there are more pages, fetch them all
      if (totalPages > 1) {
        const remainingPages = [];
        for (let page = 2; page <= totalPages; page++) {
          remainingPages.push(
            debtorAPI.getDebtors(pid, {
              min_balance: minBalance,
              ageing_buckets: ageingBuckets.join(','),
              has_email: hasEmail || undefined,
              has_phone: hasPhone || undefined,
              search: searchQuery || undefined,
              exclude_medical_aid: true,
              page: page,
              per_page: 1000,
              sort_by: sortColumn || undefined,
              sort_order: sortOrder || undefined,
            })
          );
        }
        
        // Fetch all remaining pages in parallel
        const remainingResults = await Promise.all(remainingPages);
        remainingResults.forEach(result => {
          allDebtors = [...allDebtors, ...(result.debtors || [])];
        });
      }
      
      setDebtors(allDebtors);
      setPagination({
        page: 1,
        per_page: firstPageData.per_page || 1000,
        total: firstPageData.total || allDebtors.length,
        pages: totalPages,
      });
    } catch (error) {
      console.error('[loadDebtors] Error loading debtors:', error);
      console.error('[loadDebtors] Error details:', error.response?.data);
      Alert.alert('Error', `Failed to load debtors: ${error.response?.data?.detail || error.message}`);
    } finally {
      setDataLoading(false);
    }
  };

  const handlePharmacySelect = (pharmacy) => {
    setSelectedPharmacy(pharmacy);
    setShowPharmacyPicker(false);
    setSelectedDebtors(new Set());
  };

  const toggleAgeingBucket = (bucket) => {
    // Special handling for 150D+ which includes both d150 and d180
    if (bucket === 'd150plus') {
      const hasBoth = ageingBuckets.includes('d150') && ageingBuckets.includes('d180');
      if (hasBoth) {
        // Remove both
        setAgeingBuckets(ageingBuckets.filter(b => b !== 'd150' && b !== 'd180'));
      } else {
        // Add both
        const newBuckets = ageingBuckets.filter(b => b !== 'd150' && b !== 'd180');
        setAgeingBuckets([...newBuckets, 'd150', 'd180']);
      }
    } else {
      // Normal toggle for other buckets
      if (ageingBuckets.includes(bucket)) {
        setAgeingBuckets(ageingBuckets.filter(b => b !== bucket));
      } else {
        setAgeingBuckets([...ageingBuckets, bucket]);
      }
    }
  };

  const toggleDebtorSelection = (debtorId) => {
    const newSelected = new Set(selectedDebtors);
    if (newSelected.has(debtorId)) {
      newSelected.delete(debtorId);
    } else {
      newSelected.add(debtorId);
    }
    setSelectedDebtors(newSelected);
  };

  const toggleDebtorExpand = (debtorId, event) => {
    // Prevent the selection toggle when clicking expand button
    if (event) {
      event.stopPropagation();
    }
    const newExpanded = new Set(expandedDebtors);
    if (newExpanded.has(debtorId)) {
      newExpanded.delete(debtorId);
    } else {
      newExpanded.add(debtorId);
    }
    setExpandedDebtors(newExpanded);
  };

  const toggleSelectAll = () => {
    if (selectedDebtors.size === debtors.length) {
      setSelectedDebtors(new Set());
    } else {
      setSelectedDebtors(new Set(debtors.map(d => d.debtor_id || d.id)));
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const pid = selectedPharmacy.pharmacy_id || selectedPharmacy.id;
      const debtorIds = selectedDebtors.size > 0 ? Array.from(selectedDebtors) : null;
      await debtorAPI.downloadCSV(pid, debtorIds);
      Alert.alert('Success', 'CSV download started.');
    } catch (error) {
      Alert.alert('Error', 'Failed to download CSV. Please try again.');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const pid = selectedPharmacy.pharmacy_id || selectedPharmacy.id;
      const debtorIds = selectedDebtors.size > 0 ? Array.from(selectedDebtors) : null;
      await debtorAPI.downloadPDF(pid, debtorIds);
      Alert.alert('Success', 'PDF download started.');
    } catch (error) {
      Alert.alert('Error', 'Failed to download PDF. Please try again.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadPharmacies();
      if (selectedPharmacy) {
        await loadStatistics();
        await loadDebtors();
      }
    } finally {
      setRefreshing(false);
    }
  };

  const renderDebtorItem = ({ item }) => {
    const debtorId = item.debtor_id || item.id;
    const isSelected = selectedDebtors.has(debtorId);
    const isExpanded = expandedDebtors.has(debtorId);
    const buckets = [
      { key: 'current', label: 'Current' },
      { key: 'd30', label: '30D' },
      { key: 'd60', label: '60D' },
      { key: 'd90', label: '90D' },
      { key: 'd120', label: '120D' },
      { key: 'd150', label: '150D' },
      { key: 'd180', label: '180D' },
    ];
    
    return (
      <View style={[styles.debtorRow, isSelected && styles.debtorRowSelected]}>
        <View style={styles.debtorRowContent}>
          <View style={styles.debtorRowCheckbox}>
            <TouchableOpacity
              onPress={() => toggleDebtorSelection(debtorId)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                {isSelected && <Text style={styles.checkboxCheckmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.debtorRowInfo}>
            {/* Header Row - Always Visible */}
            <View style={styles.debtorHeaderRow}>
              <View style={styles.debtorHeaderLeft}>
                <Text style={styles.debtorName}>{item.name || '-'}</Text>
                <Text style={styles.debtorAccount}>{item.acc_no || item.account_number || '-'}</Text>
              </View>
              <TouchableOpacity
                onPress={(e) => toggleDebtorExpand(debtorId, e)}
                style={styles.debtorExpandButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {isExpanded ? (
                  <ChevronDownIcon size={20} color={colors.textSecondary} />
                ) : (
                  <ChevronRightIcon size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
            
            {/* Balance - Always Visible */}
            <View style={styles.debtorBalanceRow}>
              <Text style={styles.debtorBalance}>Balance: R {formatMoney(item.balance || 0)}</Text>
            </View>
            
            {/* Expanded Content - Contact Details and Buckets */}
            {isExpanded && (
              <>
                {/* Contact Details */}
                <View style={styles.debtorContactDetails}>
                  {item.phone ? (
                    <Text style={styles.debtorContactItem}>
                      <Text style={styles.debtorContactLabel}>Phone: </Text>
                      {item.phone}
                    </Text>
                  ) : (
                    <Text style={styles.debtorContactItem}>
                      <Text style={styles.debtorContactLabel}>Phone: </Text>
                      <Text style={styles.debtorContactEmpty}>No phone</Text>
                    </Text>
                  )}
                  {item.email ? (
                    <Text style={styles.debtorContactItem}>
                      <Text style={styles.debtorContactLabel}>Email: </Text>
                      {item.email}
                    </Text>
                  ) : (
                    <Text style={styles.debtorContactItem}>
                      <Text style={styles.debtorContactLabel}>Email: </Text>
                      <Text style={styles.debtorContactEmpty}>No email</Text>
                    </Text>
                  )}
                </View>
                
                {/* Ageing Buckets */}
                <View style={styles.debtorBuckets}>
                  {buckets.map(bucket => {
                    const value = item[bucket.key] || 0;
                    return (
                      <View key={bucket.key} style={styles.debtorBucket}>
                        <Text style={styles.debtorBucketLabel}>{bucket.label}</Text>
                        <Text style={styles.debtorBucketValue}>
                          {value > 0 ? `R ${formatMoney(value)}` : '-'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading && !selectedPharmacy) {
    return (
      <GradientBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.topBarWrapper}>
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
            <View style={styles.pageTitleSection}>
              <Text style={styles.pageTitle}>Debtor Tools</Text>
              <Text style={styles.pageSubtitle}>Manage and track debtor accounts</Text>
            </View>

            <View style={styles.selectorRow}>
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
          {selectedPharmacy && (
            <>
              {/* Summary Section */}
              <View style={styles.sectionHeadingContainer}>
                <Text style={styles.sectionHeading}>Summary</Text>
              </View>
              
              <View style={styles.summaryLayout}>
                {/* Total Outstanding Card */}
                <View style={styles.summaryCardPrimary}>
                  <LinearGradient
                    colors={['#FF6B35', '#FF8C42']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.summaryCardGradient}
                  >
                    <View style={styles.summaryCardHeader}>
                      <DollarIcon size={20} color="#FFFFFF" />
                      <Text style={styles.summaryCardTitleWhite}>TOTAL OUTSTANDING</Text>
                    </View>
                    <View style={styles.summaryCardValueRow}>
                      <Text style={styles.summaryCardCurrencyWhite}>R</Text>
                      <Text style={styles.summaryCardAmountWhite}>{formatMoney(statistics.total_outstanding || 0)}</Text>
                    </View>
                  </LinearGradient>
                </View>

                {/* Total Accounts Card */}
                <View style={styles.summaryCard}>
                  <View style={styles.summaryCardHeader}>
                    <UsersIcon size={16} color={colors.chartGP} />
                    <Text style={[styles.summaryCardTitle, { color: colors.chartGP }]}>TOTAL ACCOUNTS</Text>
                  </View>
                  <Text style={styles.summaryCardAmount}>{statistics.total_accounts || 0}</Text>
                </View>

                {/* Current Card */}
                <View style={styles.summaryCard}>
                  <View style={styles.summaryCardHeader}>
                    <ClockIcon size={16} color={colors.statusError} />
                    <Text style={[styles.summaryCardTitle, { color: colors.statusError }]}>CURRENT</Text>
                  </View>
                  <View style={styles.summaryCardValueRow}>
                    <Text style={styles.summaryCardCurrency}>R</Text>
                    <Text style={styles.summaryCardAmount}>{formatMoney(statistics.current || 0)}</Text>
                  </View>
                </View>

                {/* Ageing Buckets Card */}
                <View style={styles.ageingCard}>
                  <View style={styles.summaryCardHeader}>
                    <CalendarIcon size={16} color={colors.chartBasket} />
                    <Text style={[styles.summaryCardTitle, { color: colors.chartBasket }]}>AGEING BUCKETS</Text>
                  </View>
                  <View style={styles.ageingList}>
                    {[
                      { key: 'd30', label: '30 DAYS' },
                      { key: 'd60', label: '60 DAYS' },
                      { key: 'd90', label: '90 DAYS' },
                      { key: 'd120', label: '120 DAYS' },
                      { key: 'd150', label: '150 DAYS' },
                      { key: 'd180', label: '180+ DAYS' },
                    ].map(bucket => (
                      <View key={bucket.key} style={styles.ageingItem}>
                        <Text style={styles.ageingLabel}>{bucket.label}</Text>
                        <Text style={styles.ageingValue}>R {formatMoney(statistics[bucket.key] || 0)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              {/* Filters Section */}
              <View style={styles.sectionHeadingContainer}>
                <Text style={styles.sectionHeading}>Filters</Text>
              </View>
              
              <View style={styles.filtersCard}>
                {/* Minimum Balance */}
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Minimum Balance for 60+ Day Arrears</Text>
                  <View style={styles.sliderContainer}>
                    <Text style={styles.sliderValue}>R {minBalance}</Text>
                  </View>
                  <View style={styles.sliderControls}>
                    <TouchableOpacity
                      style={[styles.sliderButton, minBalance <= 0 && styles.sliderButtonDisabled]}
                      onPress={() => {
                        if (minBalance > 0) {
                          setMinBalance(Math.max(0, minBalance - 10));
                        }
                      }}
                      disabled={minBalance <= 0}
                    >
                      <Text style={styles.sliderButtonText}>-</Text>
                    </TouchableOpacity>
                    <View style={styles.sliderTrackWrapper}>
                      <Text style={styles.sliderMin}>R 0</Text>
                      <View style={styles.sliderTrack}>
                        <View style={[styles.sliderFill, { width: `${(minBalance / 2000) * 100}%` }]} />
                      </View>
                      <Text style={styles.sliderMax}>R 2000</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.sliderButton, minBalance >= 2000 && styles.sliderButtonDisabled]}
                      onPress={() => {
                        if (minBalance < 2000) {
                          setMinBalance(Math.min(2000, minBalance + 10));
                        }
                      }}
                      disabled={minBalance >= 2000}
                    >
                      <Text style={styles.sliderButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Ageing Buckets */}
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Ageing Buckets</Text>
                  <View style={styles.ageingBucketsContainer}>
                    {/* First Row */}
                    <View style={styles.ageingBucketsRow}>
                      {[
                        { key: 'current', label: 'Current' },
                        { key: 'd30', label: '30D' },
                        { key: 'd60', label: '60D' },
                      ].map(bucket => {
                        const isSelected = ageingBuckets.includes(bucket.key);
                        return (
                          <TouchableOpacity
                            key={bucket.key}
                            style={styles.ageingBucketButtonWrapper}
                            onPress={() => toggleAgeingBucket(bucket.key)}
                          >
                            {isSelected ? (
                              <LinearGradient
                                colors={[colors.accentPrimary, colors.accentPrimaryHover]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.ageingBucketButton}
                              >
                                <Text style={styles.ageingBucketButtonTextActive}>{bucket.label}</Text>
                              </LinearGradient>
                            ) : (
                              <View style={styles.ageingBucketButtonInactive}>
                                <Text style={styles.ageingBucketButtonText}>{bucket.label}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {/* Second Row */}
                    <View style={styles.ageingBucketsRow}>
                      {[
                        { key: 'd90', label: '90D' },
                        { key: 'd120', label: '120D' },
                        { key: 'd150plus', label: '150D+', buckets: ['d150', 'd180'] },
                      ].map(bucket => {
                        // For 150D+, check if both d150 and d180 are selected
                        const isSelected = bucket.key === 'd150plus' 
                          ? (ageingBuckets.includes('d150') && ageingBuckets.includes('d180'))
                          : ageingBuckets.includes(bucket.key);
                        return (
                          <TouchableOpacity
                            key={bucket.key}
                            style={styles.ageingBucketButtonWrapper}
                            onPress={() => toggleAgeingBucket(bucket.key)}
                          >
                            {isSelected ? (
                              <LinearGradient
                                colors={[colors.accentPrimary, colors.accentPrimaryHover]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.ageingBucketButton}
                              >
                                <Text style={styles.ageingBucketButtonTextActive}>{bucket.label}</Text>
                              </LinearGradient>
                            ) : (
                              <View style={styles.ageingBucketButtonInactive}>
                                <Text style={styles.ageingBucketButtonText}>{bucket.label}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Contact Filters */}
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Contact Filters</Text>
                  <View style={styles.checkboxGroup}>
                    <TouchableOpacity
                      style={styles.checkboxItem}
                      onPress={() => setHasEmail(!hasEmail)}
                    >
                      <View style={[styles.checkbox, hasEmail && styles.checkboxChecked]}>
                        {hasEmail && <Text style={styles.checkboxCheckmark}>✓</Text>}
                      </View>
                      <Text style={styles.checkboxLabel}>Only show accounts with email</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.checkboxItem}
                      onPress={() => setHasPhone(!hasPhone)}
                    >
                      <View style={[styles.checkbox, hasPhone && styles.checkboxChecked]}>
                        {hasPhone && <Text style={styles.checkboxCheckmark}>✓</Text>}
                      </View>
                      <Text style={styles.checkboxLabel}>Only show accounts with phone</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Export Actions */}
              <View style={styles.sectionHeadingContainer}>
                <Text style={styles.sectionHeading}>Export</Text>
                <Text style={styles.selectionInfo}>{selectedDebtors.size} debtors selected</Text>
              </View>
              
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSecondary]}
                  onPress={handleDownloadCSV}
                >
                  <Text style={styles.actionButtonTextSecondary}>Download CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSecondary]}
                  onPress={handleDownloadPDF}
                >
                  <Text style={styles.actionButtonTextSecondary}>Download PDF</Text>
                </TouchableOpacity>
              </View>

              {/* Search */}
              <View style={styles.sectionHeadingContainer}>
                <Text style={styles.sectionHeading}>Debtors</Text>
              </View>
              
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search accounts, names, emails, or phones..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Debtors List */}
              {dataLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.accentPrimary} />
                  <Text style={styles.loadingText}>Loading debtors...</Text>
                </View>
              ) : (
                <>
                  {debtors.length > 0 && (
                    <TouchableOpacity
                      style={styles.selectAllButton}
                      onPress={toggleSelectAll}
                    >
                      <View style={[styles.checkbox, selectedDebtors.size === debtors.length && styles.checkboxChecked]}>
                        {selectedDebtors.size === debtors.length && <Text style={styles.checkboxCheckmark}>✓</Text>}
                      </View>
                      <Text style={styles.selectAllText}>
                        {selectedDebtors.size === debtors.length ? 'Deselect All' : 'Select All'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  
                  <FlatList
                    data={debtors}
                    renderItem={renderDebtorItem}
                    keyExtractor={(item) => String(item.debtor_id || item.id)}
                    scrollEnabled={false}
                    ListEmptyComponent={
                      <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>No debtors match your current filters</Text>
                      </View>
                    }
                  />
                  
                </>
              )}
            </>
          )}

          {/* Empty State */}
          {pharmacies.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No pharmacies available</Text>
              <Text style={styles.emptyStateSubtext}>
                Please contact your administrator to grant pharmacy access.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Pharmacy Picker Modal */}
        <PharmacyPickerModal
          visible={showPharmacyPicker}
          pharmacies={pharmacies}
          selectedPharmacy={selectedPharmacy}
          onSelect={handlePharmacySelect}
          onClose={() => setShowPharmacyPicker(false)}
        />

        {/* Loading Overlay */}
        <LoadingOverlay
          visible={dataLoading}
          message="Loading data..."
        />

        {/* Floating Hamburger Menu Button */}
        <View style={styles.floatingHamburgerContainer}>
          <BlurView 
            intensity={Platform.OS === 'ios' ? 100 : 70} 
            tint="light" 
            style={styles.hamburgerToggle}
            reducedTransparencyFallbackColor="rgba(255, 255, 255, 0.9)"
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
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
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
  topBarFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  pageTitleSection: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 24,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginTop: 4,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  contentArea: {
    flex: 1,
  },
  contentAreaInner: {
    paddingHorizontal: 24,
    paddingTop: 180,
    paddingBottom: 120,
  },
  sectionHeadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 16,
  },
  sectionHeading: {
    fontSize: 16,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  selectionInfo: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  summaryLayout: {
    flexDirection: 'column',
    gap: 4,
    marginBottom: 8,
  },
  summaryCardPrimary: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 4,
  },
  summaryCardGradient: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  summaryCardTitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryCardTitleWhite: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  summaryCardValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  summaryCardCurrency: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  summaryCardCurrencyWhite: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: '#FFFFFF',
  },
  summaryCardAmount: {
    fontSize: 24,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  summaryCardAmountWhite: {
    fontSize: 24,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  ageingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ageingList: {
    marginTop: 8,
  },
  ageingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  ageingLabel: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  ageingValue: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  filtersCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  filterGroup: {
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  sliderContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderValue: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.accentPrimary,
  },
  sliderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sliderTrackWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderMin: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surfaceBorder,
    borderRadius: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: colors.accentPrimary,
    borderRadius: 2,
  },
  sliderMax: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  sliderButton: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderButtonDisabled: {
    opacity: 0.5,
  },
  sliderButtonText: {
    fontSize: 18,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  checkboxGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary,
  },
  checkboxCheckmark: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
  },
  ageingBucketsContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  ageingBucketsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  ageingBucketButtonWrapper: {
    flex: 1,
    minWidth: 0,
  },
  ageingBucketButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageingBucketButtonInactive: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  ageingBucketButtonText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  ageingBucketButtonTextActive: {
    fontSize: 13,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: colors.accentPrimary,
  },
  actionButtonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  actionButtonTextSecondary: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  searchContainer: {
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  selectAllText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  debtorRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  debtorRowSelected: {
    borderColor: colors.accentPrimary,
    borderWidth: 2,
    shadowColor: colors.accentPrimary,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  debtorRowContent: {
    flexDirection: 'row',
    gap: 12,
  },
  debtorRowCheckbox: {
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  debtorRowInfo: {
    flex: 1,
  },
  debtorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  debtorHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  debtorExpandButton: {
    padding: 4,
  },
  debtorName: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  debtorAccount: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  debtorBalanceRow: {
    marginBottom: 8,
  },
  debtorBuckets: {
    flexDirection: 'column',
    gap: 4,
    marginBottom: 4,
  },
  debtorBucket: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  debtorBucketLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
  },
  debtorBucketValue: {
    fontSize: 11,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  debtorBalance: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  debtorContactDetails: {
    marginTop: 8,
    marginBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  debtorContactItem: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  debtorContactLabel: {
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
  },
  debtorContactEmpty: {
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    paddingVertical: 16,
  },
  paginationButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  paginationInfo: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
});

export default DebtorToolsScreen;

