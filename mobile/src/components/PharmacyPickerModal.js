import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { PharmacyIcon } from './Icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_MODAL_HEIGHT = SCREEN_HEIGHT * 0.8; // Maximum 80% of screen height

const PharmacyPickerModal = ({ visible, pharmacies, selectedPharmacy, onSelect, onClose }) => {

  const handleSelect = (pharmacy) => {
    onSelect(pharmacy);
    onClose();
  };

  // Render pharmacy list items
  const renderPharmacyList = () => {
    if (!Array.isArray(pharmacies) || pharmacies.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No pharmacies found</Text>
          <Text style={styles.emptyStateSubtitle}>
            Please contact your administrator.
          </Text>
        </View>
      );
    }

    return pharmacies.map((pharmacy) => {
      const isSelected =
        (selectedPharmacy?.pharmacy_id || selectedPharmacy?.id) ===
        (pharmacy.pharmacy_id || pharmacy.id);
      const pharmacyId = pharmacy.pharmacy_id || pharmacy.id;
      const pharmacyName = pharmacy.pharmacy_name || pharmacy.name;
      
      return (
        <TouchableOpacity
          key={pharmacyId}
          style={[styles.option, isSelected && styles.optionSelected]}
          onPress={() => handleSelect(pharmacy)}
        >
          <View style={[styles.icon, isSelected && styles.iconSelected]}>
            <PharmacyIcon 
              size={20} 
              color={isSelected ? colors.accentPrimary : colors.textSecondary} 
            />
          </View>
          <Text
            style={[styles.optionText, isSelected && styles.optionTextSelected]}
          >
            {pharmacyName}
          </Text>
        </TouchableOpacity>
      );
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.modal} 
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Select Pharmacy</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.list} 
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              bounces={false}
            >
              {renderPharmacyList()}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.doneButton} onPress={onClose}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: MAX_MODAL_HEIGHT,
    minHeight: 500, // Ensures at least 5 pharmacies visible
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 60,
    elevation: 10,
  },
  modalContent: {
    flex: 1,
    flexDirection: 'column',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHover,
  },
  closeButtonText: {
    fontSize: 16,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    borderRadius: 12,
    marginBottom: 4,
  },
  optionSelected: {
    backgroundColor: 'rgba(255, 69, 9, 0.1)',
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconSelected: {
    backgroundColor: 'rgba(255, 69, 9, 0.15)',
  },
  optionText: {
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    flex: 1,
  },
  optionTextSelected: {
    color: colors.accentPrimary,
  },
  emptyState: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  doneButton: {
    backgroundColor: colors.accentPrimary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default PharmacyPickerModal;
