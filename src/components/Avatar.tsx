import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Image } from 'expo-image';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  imageUrl?: string;
  name?: string;
  size?: AvatarSize;
  online?: boolean;
  style?: ViewStyle;
}

const sizeValues: Record<AvatarSize, { container: number; fontSize: number; indicator: number }> = {
  sm: { container: 32, fontSize: 12, indicator: 10 },
  md: { container: 40, fontSize: 14, indicator: 12 },
  lg: { container: 56, fontSize: 20, indicator: 14 },
  xl: { container: 80, fontSize: 30, indicator: 16 },
};

function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Avatar({ imageUrl, name, size = 'md', online, style }: AvatarProps) {
  const s = sizeValues[size];

  // Untyped so it can be spread into both <View style> (ViewStyle) and
  // <Image style> (ImageStyle) — only `overflow` differs between the two
  // and we don't set it here.
  const containerSize = {
    width: s.container,
    height: s.container,
    borderRadius: s.container / 2,
  };

  const indicatorSize: ViewStyle = {
    width: s.indicator,
    height: s.indicator,
    borderRadius: s.indicator / 2,
  };

  const textSize: TextStyle = {
    fontSize: s.fontSize,
  };

  return (
    <View style={[styles.wrapper, style]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.image, containerSize]}
        />
      ) : (
        <View style={[styles.placeholder, containerSize]}>
          <Text style={[styles.initials, textSize]}>{getInitials(name)}</Text>
        </View>
      )}
      {online !== undefined && (
        <View
          style={[
            styles.indicator,
            indicatorSize,
            online ? styles.online : styles.offline,
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  image: {
    backgroundColor: '#E5E7EB',
  },
  placeholder: {
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '600',
    color: '#4338CA',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  online: {
    backgroundColor: '#22C55E',
  },
  offline: {
    backgroundColor: '#9CA3AF',
  },
});
