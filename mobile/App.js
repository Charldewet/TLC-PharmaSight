import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Lato_300Light,
  Lato_400Regular,
  Lato_700Bold,
  Lato_900Black,
} from '@expo-google-fonts/lato';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import DailySummaryScreen from './src/screens/DailySummaryScreen';
import MonthlySummaryScreen from './src/screens/MonthlySummaryScreen';
import StockManagementScreen from './src/screens/StockManagementScreen';
import StockQueriesScreen from './src/screens/StockQueriesScreen';
import DebtorToolsScreen from './src/screens/DebtorToolsScreen';
import TrendsScreen from './src/screens/TrendsScreen';
import TargetsScreen from './src/screens/TargetsScreen';
import DailyTrackingScreen from './src/screens/DailyTrackingScreen';
import SidebarContent from './src/components/SidebarContent';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <SidebarContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: 325,
          backgroundColor: 'transparent',
        },
        drawerType: 'front',
        swipeEnabled: true,
        swipeEdgeWidth: 50,
        overlayColor: 'rgba(0, 0, 0, 0.3)',
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} />
      <Drawer.Screen name="DailySummary" component={DailySummaryScreen} />
      <Drawer.Screen name="MonthlySummary" component={MonthlySummaryScreen} />
      <Drawer.Screen name="StockManagement" component={StockManagementScreen} />
      <Drawer.Screen name="StockQueries" component={StockQueriesScreen} />
      <Drawer.Screen name="DebtorTools" component={DebtorToolsScreen} />
      <Drawer.Screen name="Targets" component={TargetsScreen} />
      <Drawer.Screen name="DailyTracking" component={DailyTrackingScreen} />
      <Drawer.Screen 
        name="Trends" 
        component={TrendsScreen}
        options={{
          drawerItemStyle: { display: 'none' }, // Hide from drawer menu
        }}
      />
    </Drawer.Navigator>
  );
}

function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={DrawerNavigator} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Lato_300Light,
    Lato_400Regular,
    Lato_700Bold,
    Lato_900Black,
  });

  if (!fontsLoaded) {
    return null; // Or a loading screen
  }

  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </AuthProvider>
  );
}
