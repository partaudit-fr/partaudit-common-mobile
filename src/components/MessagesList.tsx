// Messages list — shared between mobile-client and mobile-pro. The
// consuming app passes its auth-scoped ApiClient + a routing callback
// (since expo-router pathnames differ across apps). The list itself
// handles search, pinned-first ordering, unread badges, and the same
// conversation cards in both apps.

import React, { useMemo, useState } from 'react';
import {
  View, Text, Pressable, FlatList, Image, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Pin, AlertCircle } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ApiClient } from '../api/createApiClient';
import { createMessagingEndpoints } from '../api/endpoints/messaging';
import { useAuth } from '../providers/AuthProvider';

interface ConvCard {
  id: string;
  name: string;
  image: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isPinned: boolean;
}

function getInitials(name: string) {
  return (name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

interface MessagesListProps {
  api: ApiClient;
  /** Called when the user taps a conversation. The host app handles routing. */
  onOpenConversation: (conversationId: string) => void;
  /** Called when the unauthenticated CTA is pressed. Defaults to no-op. */
  onLoginPress?: () => void;
}

export default function MessagesList({ api, onOpenConversation, onLoginPress }: MessagesListProps) {
  const { isAuthenticated } = useAuth();
  const { t, i18n } = useTranslation();
  const messaging = useMemo(() => createMessagingEndpoints(api), [api]);
  const [search, setSearch] = useState('');

  const formatTime = (iso: string): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days < 1) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (days === 1) return i18n.language === 'fr' ? 'Hier' : 'Yesterday';
    if (days < 7) return d.toLocaleDateString(i18n.language, { weekday: 'short' });
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messaging.getConversations(),
    enabled: isAuthenticated,
    refetchOnMount: 'always',
  });

  const conversations: ConvCard[] = useMemo(() => {
    const raw = (data as any)?.conversations || (data as any)?.items || (Array.isArray(data) ? data : []);
    return (raw as any[]).map((c) => ({
      id: String(c.id),
      name: c.other_participant_name || c.name || '—',
      image: c.other_participant_image || c.image || '',
      lastMessage: c.last_message_preview || c.lastMessage || '',
      lastMessageAt: c.last_message_at || c.lastMessageAt || '',
      unreadCount: c.unread_count || 0,
      isPinned: !!c.pinned_at,
    }));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? conversations.filter((c) => c.name.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q))
      : conversations;
    return [...list].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });
  }, [conversations, search]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.header}><Text style={s.headerTitle}>{t('messages.title')}</Text></View>
        <View style={s.empty}>
          <AlertCircle size={40} color="#D1D5DB" />
          <Text style={s.emptyTitle}>{t('messages.loginRequired')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}><Text style={s.headerTitle}>{t('messages.title')}</Text></View>

      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Search size={16} color="#9CA3AF" />
          <TextInput
            style={s.searchInput}
            placeholder={t('messages.searchPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#25408D" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(it, idx) => String(it.id ?? `conv-${idx}`)}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#25408D" />}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>{t('messages.noMessage')}</Text>
              <Text style={s.emptyDesc}>{t('messages.noMessageDesc')}</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [s.row, pressed && s.rowPressed]}
              onPress={() => onOpenConversation(item.id)}
            >
              <View style={s.avatarWrap}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, s.avatarFallback]}>
                    <Text style={s.avatarText}>{getInitials(item.name)}</Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.rowTop}>
                  <View style={s.rowName}>
                    {item.isPinned && <Pin size={12} color="#25408D" />}
                    <Text style={[s.name, item.unreadCount > 0 && s.nameBold]} numberOfLines={1}>{item.name}</Text>
                  </View>
                  <Text style={[s.time, item.unreadCount > 0 && s.timeBold]}>{formatTime(item.lastMessageAt)}</Text>
                </View>
                <View style={s.rowBottom}>
                  <Text
                    style={[
                      s.preview,
                      item.unreadCount > 0 && s.previewBold,
                      !item.lastMessage && s.previewEmpty,
                    ]}
                    numberOfLines={2}
                  >
                    {item.lastMessage || t('messages.noConvMessage')}
                  </Text>
                  {item.unreadCount > 0 && (
                    <View style={s.unread}>
                      <Text style={s.unreadText}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#111827' },
  searchWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, height: 42,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  separator: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 82 },

  row: { flexDirection: 'row', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  rowPressed: { backgroundColor: '#F9FAFB' },
  avatarWrap: {},
  avatar: { width: 52, height: 52, borderRadius: 16 },
  avatarFallback: { backgroundColor: '#EBF0FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '700', color: '#25408D' },

  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowName: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, marginRight: 8 },
  name: { fontSize: 15, fontWeight: '500', color: '#374151' },
  nameBold: { fontWeight: '700', color: '#111827' },
  time: { fontSize: 12, color: '#9CA3AF' },
  timeBold: { color: '#25408D', fontWeight: '600' },

  rowBottom: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 2 },
  preview: { flex: 1, fontSize: 13, color: '#9CA3AF', lineHeight: 19 },
  previewBold: { color: '#6B7280' },
  previewEmpty: { fontStyle: 'italic', color: '#D1D5DB' },

  unread: {
    minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#25408D',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginTop: 2,
  },
  unreadText: { fontSize: 11, fontWeight: '700', color: '#FFF' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 8, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
});
