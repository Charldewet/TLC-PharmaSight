import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';

/**
 * LoadingOverlay - A reusable loading modal overlay
 * 
 * Props:
 * - visible: boolean - Whether the overlay is visible
 * - message: string - Optional message to display (default: "Loading...")
 * - transparent: boolean - Whether to use transparent background (default: true)
 */
const LoadingOverlay = ({ 
  visible, 
  message = 'Loading...', 
  transparent = true,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 100 : 80}
        tint="light"
        style={styles.overlayBlur}
        reducedTransparencyFallbackColor="rgba(0, 0, 0, 0.5)"
      >
        <View style={styles.overlay}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 100 : 80}
            tint="light"
            style={styles.blurContainer}
            reducedTransparencyFallbackColor="rgba(255, 255, 255, 0.9)"
          >
            <View style={styles.content}>
              <ActivityIndicator 
                size="large" 
                color={colors.accentPrimary} 
                style={styles.spinner}
              />
              {message && (
                <Text style={styles.message}>{message}</Text>
              )}
            </View>
          </BlurView>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayBlur: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurContainer: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  content: {
    paddingVertical: 28,
    paddingHorizontal: 40,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  spinner: {
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});

export default LoadingOverlay;

