import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ScrollView,
} from 'react-native';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';

const MonthPickerModal = ({ visible, selectedMonth, onMonthSelect, onClose }) => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (visible && selectedMonth) {
      // Set current year to the selected month's year
      const [year] = selectedMonth.split('-').map(Number);
      setCurrentYear(year);
    } else if (visible) {
      setCurrentYear(new Date().getFullYear());
    }
  }, [visible, selectedMonth]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevYear = () => {
    setCurrentYear(currentYear - 1);
  };

  const handleNextYear = () => {
    setCurrentYear(currentYear + 1);
  };

  const handleMonthSelect = (monthIndex) => {
    const monthStr = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    if (onMonthSelect && typeof onMonthSelect === 'function') {
      onMonthSelect(monthStr);
    }
  };

  const handleCurrentMonth = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    setCurrentYear(year);
    if (onMonthSelect && typeof onMonthSelect === 'function') {
      onMonthSelect(monthStr);
    }
  };

  const isSelected = (monthIndex) => {
    if (!selectedMonth) return false;
    const [year, month] = selectedMonth.split('-').map(Number);
    return year === currentYear && month === monthIndex + 1;
  };

  const isCurrentMonth = (monthIndex) => {
    const today = new Date();
    return today.getFullYear() === currentYear && today.getMonth() === monthIndex;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Background overlay - closes modal when pressed */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        
        {/* Modal content - doesn't close when pressed */}
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={handlePrevYear}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.navIcon}>‹</Text>
            </TouchableOpacity>
            
            <Text style={styles.yearText}>{currentYear}</Text>
            
            <TouchableOpacity
              style={styles.navButton}
              onPress={handleNextYear}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.navIcon}>›</Text>
            </TouchableOpacity>
          </View>
          
          {/* Months Grid */}
          <View style={styles.monthsContainer}>
            {months.map((month, index) => {
              const selected = isSelected(index);
              const current = isCurrentMonth(index);
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.monthCell,
                    selected && styles.monthCellSelected,
                  ]}
                  onPress={() => handleMonthSelect(index)}
                >
                  <Text
                    style={[
                      styles.monthText,
                      current && !selected && styles.monthTextCurrent,
                      selected && styles.monthTextSelected,
                    ]}
                  >
                    {month.slice(0, 3)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          
          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.footerButtonSecondary}
              onPress={handleCurrentMonth}
            >
              <Text style={styles.footerButtonSecondaryText}>Current Month</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.footerButtonPrimary}
              onPress={onClose}
            >
              <Text style={styles.footerButtonPrimaryText}>Done</Text>
            </TouchableOpacity>
          </View>
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
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.15,
    shadowRadius: 60,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  navButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  navIcon: {
    fontSize: 24,
    fontFamily: typography.fontFamily.light,
    color: colors.textPrimary,
    fontWeight: '300',
    lineHeight: 24,
  },
  yearText: {
    fontSize: 18,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  monthsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthCell: {
    width: '22%',
    aspectRatio: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 12,
    marginHorizontal: 2,
  },
  monthCellSelected: {
    backgroundColor: colors.accentPrimary,
    shadowColor: colors.accentPrimary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  monthText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  monthTextCurrent: {
    fontFamily: typography.fontFamily.semibold,
    color: colors.accentPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  monthTextSelected: {
    fontFamily: typography.fontFamily.semibold,
    color: '#FFFFFF',
    fontWeight: typography.fontWeight.semibold,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  footerButtonSecondary: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
  },
  footerButtonSecondaryText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  footerButtonPrimary: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
  },
  footerButtonPrimaryText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
});

export default MonthPickerModal;

