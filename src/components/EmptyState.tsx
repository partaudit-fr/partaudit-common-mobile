import React from 'react';
import { View, Text } from 'react-native';
import { cn } from '../lib/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <View className={cn('flex-1 items-center justify-center p-8', className)}>
      {icon && <View className="mb-4">{icon}</View>}
      <Text className="text-lg font-semibold text-gray-900 text-center mb-2">
        {title}
      </Text>
      {description && (
        <Text className="text-sm text-gray-500 text-center leading-relaxed">
          {description}
        </Text>
      )}
      {action && <View className="mt-6">{action}</View>}
    </View>
  );
}
