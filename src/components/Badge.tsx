import React from 'react';
import { View, Text } from 'react-native';
import { cn } from '../lib/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'primary';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, { container: string; text: string }> = {
  default: { container: 'bg-gray-100', text: 'text-gray-700' },
  success: { container: 'bg-green-100', text: 'text-green-700' },
  warning: { container: 'bg-amber-100', text: 'text-amber-700' },
  error: { container: 'bg-red-100', text: 'text-red-700' },
  primary: { container: 'bg-brand-100', text: 'text-brand-700' },
};

export function Badge({ label, variant = 'default', className }: BadgeProps) {
  const v = variantClasses[variant];

  return (
    <View className={cn('self-start px-2.5 py-0.5 rounded-full', v.container, className)}>
      <Text className={cn('text-xs font-medium', v.text)}>{label}</Text>
    </View>
  );
}
