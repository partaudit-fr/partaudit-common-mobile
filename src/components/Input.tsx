import React, { useState } from 'react';
import { View, TextInput, Text, type TextInputProps } from 'react-native';
import { cn } from '../lib/cn';

interface InputProps extends Omit<TextInputProps, 'className'> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function Input({
  label,
  error,
  hint,
  icon,
  className,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className={cn('mb-4', className)}>
      {label && (
        <Text className="text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </Text>
      )}
      <View className="relative">
        {icon && (
          <View className="absolute left-3 top-0 bottom-0 justify-center z-10">
            {icon}
          </View>
        )}
        <TextInput
          placeholderTextColor="#9CA3AF"
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          className={cn(
            'border rounded-xl px-4 py-3 text-base text-gray-900 bg-white',
            icon && 'pl-11',
            isFocused ? 'border-brand-500 border-2' : 'border-gray-300',
            error && 'border-red-500',
          )}
          {...props}
        />
      </View>
      {error && (
        <Text className="text-sm text-red-600 mt-1">{error}</Text>
      )}
      {hint && !error && (
        <Text className="text-sm text-gray-500 mt-1">{hint}</Text>
      )}
    </View>
  );
}
