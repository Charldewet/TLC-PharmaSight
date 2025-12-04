import React from "react";
import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function GradientBackground({ children, variant = 'app' }) {
    // Darker gradient for login screen
    const loginColors = [
      "#FFEEDD",   // soft warm tint at top (darker than before)
      "#FFD4B3",   // light orange
      "#F47A20",   // Local Choice orange
      "#D65A0A"    // darker orange at the bottom
    ];
    
    // Lighter gradient for app screens
    const appColors = [
      "#FFFBF8",   // very subtle warm white at top
      "#FFF5ED",   // very light cream
      "#FFEEDD",   // soft warm tint
      "#FFD4B3"    // light orange at the bottom
    ];
    
    const colors = variant === 'login' ? loginColors : appColors;
    const locations = variant === 'login' ? [0, 0.15, 0.4, 1] : [0, 0.25, 0.55, 1];
    
    return (
      <LinearGradient
        colors={colors}
        locations={locations}
        start={{ x: 0.5, y: 0 }}   // top center
        end={{ x: 0.5, y: 1 }}     // bottom center
        style={styles.gradient}
      >
        {children}
      </LinearGradient>
    );
  }

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
});

