import React from 'react';
import { View } from 'react-native';
import { cn } from '../lib/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}

export function Card({ children, className, padded = true }: CardProps) {
  return (
    <View
      className={cn(
        'bg-white rounded-2xl shadow-sm',
        padded && 'p-4',
        className,
      )}
    >
      {children}
    </View>
  );
}
