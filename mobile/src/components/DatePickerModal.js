import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Dimensions,
} from 'react-native';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DatePickerModal = ({ visible, selectedDate, onDateSelect, onClose }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (visible && selectedDate) {
      // Set current month to the selected date's month
      const dateParts = selectedDate.split('-');
      if (dateParts.length === 3) {
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        setCurrentMonth(new Date(year, month, 1));
      }
    }
  }, [visible, selectedDate]);

  const formatYmdLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTodayDate = () => {
    return formatYmdLocal(new Date());
  };

  const handleToday = () => {
    const today = new Date();
    const todayStr = formatYmdLocal(today);
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    if (onDateSelect && typeof onDateSelect === 'function') {
      onDateSelect(todayStr);
    }
  };

  const handlePrevMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
  };

  const handleDaySelect = (dateStr) => {
    if (onDateSelect && typeof onDateSelect === 'function') {
      onDateSelect(dateStr);
    }
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = getTodayDate();
    
    const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    
    // Build weeks array - each week is an array of 7 days (null for empty cells)
    const weeks = [];
    let currentWeek = [];
    
    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      currentWeek.push(null);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(day);
      
      // If we've filled 7 days, start a new week
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    
    // Add remaining days of the last week (with trailing empty cells)
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }
    
    return (
      <View style={styles.calendarContainer}>
        {/* Weekday headers */}
        <View style={styles.weekRow}>
          {weekdays.map((weekday) => (
            <View key={weekday} style={styles.weekdayCell}>
              <Text style={styles.weekdayText}>{weekday}</Text>
            </View>
          ))}
        </View>
        
        {/* Calendar weeks */}
        {weeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.weekRow}>
            {week.map((day, dayIndex) => {
              if (day === null) {
                return (
                  <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.dayCell}>
                    <Text style={styles.dayTextEmpty}></Text>
                  </View>
                );
              }
              
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === today;
              
              return (
                <TouchableOpacity
                  key={`day-${day}`}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                  ]}
                  onPress={() => handleDaySelect(dateStr)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isToday && !isSelected && styles.dayTextToday,
                      isSelected && styles.dayTextSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const monthDisplay = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

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
              onPress={handlePrevMonth}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.navIcon}>‹</Text>
            </TouchableOpacity>
            
            <Text style={styles.monthText}>{monthDisplay}</Text>
            
            <TouchableOpacity
              style={styles.navButton}
              onPress={handleNextMonth}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.navIcon}>›</Text>
            </TouchableOpacity>
          </View>
          
          {/* Calendar */}
          {renderCalendar()}
          
          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.footerButtonSecondary}
              onPress={handleToday}
            >
              <Text style={styles.footerButtonSecondaryText}>Today</Text>
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
  monthText: {
    fontSize: 18,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  calendarContainer: {
    marginBottom: 16,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekdayText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 2,
  },
  dayCellToday: {
    // Today styling is handled via text color
  },
  dayCellSelected: {
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
  dayText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  dayTextEmpty: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: 'transparent',
  },
  dayTextToday: {
    fontFamily: typography.fontFamily.semibold,
    color: colors.accentPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  dayTextSelected: {
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

export default DatePickerModal;

