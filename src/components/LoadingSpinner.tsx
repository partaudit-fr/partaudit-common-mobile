import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { cn } from '../lib/cn';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  fullScreen?: boolean;
  className?: string;
}

export function LoadingSpinner({
  size = 'large',
  color = '#4F46E5',
  fullScreen = false,
  className,
}: LoadingSpinnerProps) {
  return (
    <View
      className={cn(
        'items-center justify-center',
        fullScreen ? 'flex-1 bg-white' : 'p-5',
        className,
      )}
    >
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}
