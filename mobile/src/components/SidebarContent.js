import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useAuth } from '../context/AuthContext';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import {
  DashboardIcon,
  DailySummaryIcon,
  MonthlySummaryIcon,
  StockManagementIcon,
  SearchIcon,
  UsersIcon,
  TrendingUpIcon,
  TargetIconNav,
} from './Icons';

const SidebarContent = (props) => {
  const { user, logout } = useAuth();
  
  // Get active route from navigation state
  const activeRoute = props.state?.routes[props.state?.index]?.name || 'Dashboard';
  const activeTab = activeRoute === 'Dashboard' ? 'dashboard' : 
                    activeRoute === 'DailySummary' ? 'daily-summary' : 
                    activeRoute === 'MonthlySummary' ? 'monthly-summary' :
                    activeRoute === 'StockManagement' ? 'stock-management' :
                    activeRoute === 'StockQueries' ? 'stock-queries' :
                    activeRoute === 'DebtorTools' ? 'debtor-tools' :
                    activeRoute === 'Targets' ? 'targets' :
                    activeRoute === 'DailyTracking' ? 'daily' :
                    'dashboard';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', Icon: DashboardIcon, route: 'Dashboard' },
    { id: 'daily-summary', label: 'Daily Summary', Icon: DailySummaryIcon, route: 'DailySummary' },
    { id: 'monthly-summary', label: 'Monthly Summary', Icon: MonthlySummaryIcon, route: 'MonthlySummary' },
    { id: 'stock-management', label: 'Stock Management', Icon: StockManagementIcon, route: 'StockManagement' },
    { id: 'stock-queries', label: 'Stock Queries', Icon: SearchIcon, route: 'StockQueries' },
    { id: 'debtor-tools', label: 'Debtor Tools', Icon: UsersIcon, route: 'DebtorTools' },
    { id: 'targets', label: 'Targets', Icon: TargetIconNav, route: 'Targets' },
    { id: 'daily', label: 'Daily Tracking', Icon: TrendingUpIcon, route: 'DailyTracking' },
  ];

  const handleNavPress = (item) => {
    if (item.route) {
      props.navigation.navigate(item.route);
    }
    // Close drawer after selection
    props.navigation.closeDrawer();
  };

  const handleLogout = async () => {
    await logout();
    props.navigation.closeDrawer();
  };

  return (
    <View style={styles.wrapper}>
      <BlurView 
        intensity={Platform.OS === 'ios' ? 80 : 50} 
        tint="light" 
        style={styles.blurContainer}
        reducedTransparencyFallbackColor="rgba(255, 255, 255, 0.8)"
      >
        {/* Subtle gradient overlay on top */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.15)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradientOverlay}
          pointerEvents="none"
        />
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
        <Image 
          source={require('../../assets/logo.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Navigation */}
      <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
        <View style={styles.navSection}>
          <Text style={styles.navSectionTitle}>NAVIGATION</Text>
          {navItems.map((item) => {
            const IconComponent = item.Icon;
            const isActive = activeTab === item.id;
            const iconColor = isActive ? '#FFFFFF' : colors.textSecondary;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.navItem,
                  isActive && styles.navItemActive,
                  !item.route && styles.navItemDisabled,
                ]}
                onPress={() => handleNavPress(item)}
                disabled={!item.route}
              >
                <View style={styles.navItemIcon}>
                  <IconComponent size={20} color={iconColor} />
                </View>
                <Text
                  style={[
                    styles.navItemText,
                    isActive && styles.navItemTextActive,
                    !item.route && styles.navItemTextDisabled,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.username || 'User'}</Text>
        </View>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  blurContainer: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 32,
    elevation: 8,
  },
  container: {
    flex: 1,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    zIndex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.sidebarBorder,
    alignItems: 'center',
    position: 'relative',
    zIndex: 10,
  },
  logo: {
    width: 135,
    height: 45,
  },
  nav: {
    flex: 1,
    padding: 16,
    position: 'relative',
    zIndex: 10,
  },
  navSection: {
    marginBottom: 24,
  },
  navSectionTitle: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: colors.textMuted,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: colors.accentPrimary,
  },
  navItemIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  navItemTextActive: {
    fontFamily: typography.fontFamily.semibold,
    color: '#FFFFFF',
    fontWeight: typography.fontWeight.semibold,
  },
  navItemDisabled: {
    opacity: 0.5,
  },
  navItemTextDisabled: {
    opacity: 0.5,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.sidebarBorder,
    position: 'relative',
    zIndex: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  userName: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  signOutBtn: {
    padding: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
  },
  signOutText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.statusError,
  },
});

export default SidebarContent;

