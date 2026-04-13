import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { cn } from '../lib/cn';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  imageUrl?: string;
  name?: string;
  size?: AvatarSize;
  online?: boolean;
  className?: string;
}

const sizeClasses: Record<AvatarSize, { container: string; text: string; indicator: string }> = {
  sm: { container: 'w-8 h-8', text: 'text-xs', indicator: 'w-2.5 h-2.5' },
  md: { container: 'w-10 h-10', text: 'text-sm', indicator: 'w-3 h-3' },
  lg: { container: 'w-14 h-14', text: 'text-xl', indicator: 'w-3.5 h-3.5' },
  xl: { container: 'w-20 h-20', text: 'text-3xl', indicator: 'w-4 h-4' },
};

function getInitials(name?: string): string {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export function Avatar({ imageUrl, name, size = 'md', online, className }: AvatarProps) {
  const s = sizeClasses[size];

  return (
    <View className={cn('relative', className)}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          className={cn('rounded-full bg-gray-200', s.container)}
        />
      ) : (
        <View className={cn('rounded-full bg-brand-100 items-center justify-center', s.container)}>
          <Text className={cn('font-semibold text-brand-700', s.text)}>
            {getInitials(name)}
          </Text>
        </View>
      )}
      {online !== undefined && (
        <View
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-white',
            s.indicator,
            online ? 'bg-green-500' : 'bg-gray-400',
          )}
        />
      )}
    </View>
  );
}
