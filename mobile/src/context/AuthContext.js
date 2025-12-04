import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_KEY, API_ENDPOINTS } from '../config/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);

  useEffect(() => {
    // Check if user is logged in on app start
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const username = await AsyncStorage.getItem('username');
      const userId = await AsyncStorage.getItem('user_id');

      if (token && username) {
        setAuthToken(token);
        setUser({
          username,
          user_id: userId ? parseInt(userId) : null,
        });
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      // Login directly to the external API (same as web app backend does)
      // Web app: POST /auth/login with JSON body {username, password}
      // Headers: Authorization: Bearer {API_KEY}
      const loginUrl = `${API_BASE_URL}${API_ENDPOINTS.LOGIN}`;
      console.log('[Auth] Login URL:', loginUrl);
      console.log('[Auth] API_BASE_URL:', API_BASE_URL);
      
      // Build headers - use API key (same as web app backend)
      const headers = {
        'Content-Type': 'application/json',
      };
      if (API_KEY) {
        headers['Authorization'] = `Bearer ${API_KEY}`;
      }
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ username, password }),
      });

      console.log('[Auth] Login response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[Auth] Login response data:', JSON.stringify(data, null, 2));
        
        // Extract token (API may return it in different fields)
        const token = data.token || data.access_token || data.api_key;
        const canonicalUsername = data.username || data.user?.username || username;
        const userId = data.user_id || data.user?.user_id || data.id;
        
        console.log('[Auth] Extracted token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
        console.log('[Auth] Extracted username:', canonicalUsername);
        console.log('[Auth] Extracted userId:', userId);
        
        // Store auth data
        if (token) {
          await AsyncStorage.setItem('auth_token', token);
          setAuthToken(token);
          console.log('[Auth] ✅ Token stored successfully');
        } else {
          console.warn('[Auth] ⚠️ No token received from login response!');
        }
        if (canonicalUsername) {
          await AsyncStorage.setItem('username', canonicalUsername);
        }
        if (userId) {
          await AsyncStorage.setItem('user_id', userId.toString());
        }
        
        setUser({
          username: canonicalUsername,
          user_id: userId,
        });
        
        return { success: true, username: canonicalUsername };
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || errorData.message || 'Invalid username or password';
        console.error('[Auth] Login error:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('[Auth] Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(['auth_token', 'username', 'user_id']);
      setUser(null);
      setAuthToken(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value = {
    user,
    authToken,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
