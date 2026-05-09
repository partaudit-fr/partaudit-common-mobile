import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'primary';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const variantContainerStyles: Record<BadgeVariant, ViewStyle> = {
  default: { backgroundColor: '#F3F4F6' },
  success: { backgroundColor: '#DCFCE7' },
  warning: { backgroundColor: '#FEF3C7' },
  error: { backgroundColor: '#FEF2F2' },
  primary: { backgroundColor: '#E0E7FF' },
};

const variantTextStyles: Record<BadgeVariant, TextStyle> = {
  default: { color: '#374151' },
  success: { color: '#15803D' },
  warning: { color: '#B45309' },
  error: { color: '#B91C1C' },
  primary: { color: '#4338CA' },
};

export function Badge({ label, variant = 'default', style }: BadgeProps) {
  return (
    <View style={[styles.container, variantContainerStyles[variant], style]}>
      <Text style={[styles.text, variantTextStyles[variant]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});
