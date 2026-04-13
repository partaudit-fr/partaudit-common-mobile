import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { cn } from '../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

const variantClasses: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: 'bg-brand-600 active:bg-brand-700',
    text: 'text-white',
  },
  secondary: {
    container: 'bg-gray-100 active:bg-gray-200',
    text: 'text-gray-800',
  },
  outline: {
    container: 'bg-transparent border border-gray-300 active:bg-gray-50',
    text: 'text-gray-700',
  },
  ghost: {
    container: 'bg-transparent active:bg-gray-100',
    text: 'text-brand-600',
  },
  danger: {
    container: 'bg-red-600 active:bg-red-700',
    text: 'text-white',
  },
};

const sizeClasses: Record<ButtonSize, { container: string; text: string }> = {
  sm: { container: 'py-2 px-3 rounded-lg', text: 'text-sm' },
  md: { container: 'py-3 px-5 rounded-xl', text: 'text-base' },
  lg: { container: 'py-4 px-6 rounded-xl', text: 'text-lg' },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  className,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const v = variantClasses[variant];
  const s = sizeClasses[size];

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.8}
      className={cn(
        'flex-row items-center justify-center',
        v.container,
        s.container,
        fullWidth && 'w-full',
        isDisabled && 'opacity-50',
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'outline' || variant === 'ghost' ? '#4F46E5' : '#FFFFFF'} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon}
          <Text className={cn('font-semibold', v.text, s.text)}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
