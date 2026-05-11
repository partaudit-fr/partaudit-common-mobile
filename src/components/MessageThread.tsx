// Conversation thread — shared between mobile-client and mobile-pro. The
// host app passes the api client, the conversation id, and an onBack
// callback (router pathnames differ across apps). Send a message, mark
// as read on open, pull-to-refresh. Reactions/replies/edit are out of
// scope for v1.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, FlatList, TextInput, Image,
  StyleSheet, Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Send } from 'lucide-react-native';
import type { ApiClient } from '../api/createApiClient';
import { createMessagingEndpoints } from '../api/endpoints/messaging';
import { useAuth } from '../providers/AuthProvider';

interface Msg {
  id: string;
  senderId: number;
  senderName: string;
  content: string;
  createdAt: string;
  readAt?: string;
}

function transform(m: any): Msg {
  return {
    id: String(m.id),
    senderId: Number(m.sender_id ?? 0),
    senderName: m.sender_name || '',
    content: m.content || '',
    createdAt: m.created_at || '',
    readAt: m.read_at || undefined,
  };
}

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateSeparator(iso: string, locale: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return locale === 'fr' ? "Aujourd'hui" : 'Today';
  if (d.toDateString() === yesterday.toDateString()) return locale === 'fr' ? 'Hier' : 'Yesterday';
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

function getInitials(name: string) {
  return (name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

interface MessageThreadProps {
  api: ApiClient;
  conversationId: string;
  onBack: () => void;
}

export default function MessageThread({ api, conversationId: id, onBack }: MessageThreadProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const messaging = useMemo(() => createMessagingEndpoints(api), [api]);
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList>(null);

  const [input, setInput] = useState('');

  const myUserId = Number((user as any)?.id || 0);

  // Conversation header info (avatar, name) from the conversations list cache.
  const { data: convsData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messaging.getConversations(),
  });
  const conv = useMemo(() => {
    const raw = (convsData as any)?.conversations || (convsData as any)?.items || (Array.isArray(convsData) ? convsData : []);
    return (raw as any[]).find((c) => String(c.id) === id);
  }, [convsData, id]);

  const otherName = conv?.other_participant_name || conv?.name || '';
  const otherImage = conv?.other_participant_image || conv?.image || '';

  // Messages.
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['messages', id],
    queryFn: () => messaging.getMessages(id!, 1, 50),
    enabled: !!id,
    refetchOnMount: 'always',
  });
  const messages: Msg[] = useMemo(() => {
    const raw = (messagesData as any)?.messages || [];
    // Backend paginates desc; reverse to render oldest first.
    return [...raw].reverse().map(transform);
  }, [messagesData]);

  // Mark as read on mount (and whenever new messages arrive).
  useEffect(() => {
    if (!id) return;
    messaging.markAsRead(id).then(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts'] });
    }).catch(() => { /* ignore */ });
  }, [id, messages.length]);

  const sendMut = useMutation({
    mutationFn: (content: string) =>
      messaging.sendMessage(id!, { content } as any),
    onSuccess: () => {
      setInput('');
      queryClient.invalidateQueries({ queryKey: ['messages', id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // Scroll to the last message after the next render tick.
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    },
  });

  const onSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMut.isPending) return;
    sendMut.mutate(trimmed);
  };

  // Day separators between consecutive messages on different dates.
  const items = useMemo(() => {
    const out: Array<{ kind: 'msg'; m: Msg } | { kind: 'sep'; key: string; label: string }> = [];
    let lastDay = '';
    messages.forEach((m) => {
      const d = new Date(m.createdAt).toDateString();
      if (d !== lastDay) {
        out.push({ kind: 'sep', key: `sep-${d}`, label: formatDateSeparator(m.createdAt, i18n.language) });
        lastDay = d;
      }
      out.push({ kind: 'msg', m });
    });
    return out;
  }, [messages, i18n.language]);

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onBack} hitSlop={12}>
          <ChevronLeft size={24} color="#111827" />
        </Pressable>
        <View style={s.headerCenter}>
          {otherImage ? (
            <Image source={{ uri: otherImage }} style={s.headerAvatar} />
          ) : (
            <View style={[s.headerAvatar, s.headerAvatarFallback]}>
              <Text style={s.headerAvatarText}>{getInitials(otherName)}</Text>
            </View>
          )}
          <Text style={s.headerName} numberOfLines={1}>{otherName || t('messages.title')}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        {isLoading ? (
          <View style={s.center}><ActivityIndicator size="large" color="#25408D" /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(it) => it.kind === 'sep' ? it.key : it.m.id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              if (item.kind === 'sep') {
                return (
                  <View style={s.dayRow}>
                    <View style={s.dayLine} />
                    <Text style={s.daySep}>{item.label}</Text>
                    <View style={s.dayLine} />
                  </View>
                );
              }
              const m = item.m;
              const mine = m.senderId === myUserId;
              return (
                <View style={[s.bubbleRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                  <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther]}>
                    <Text style={[s.bubbleContent, mine && { color: '#FFF' }]}>{m.content}</Text>
                    <Text style={[s.bubbleTime, mine && { color: 'rgba(255,255,255,0.7)' }]}>
                      {formatTime(m.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={[s.composer, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={s.composerInput}
            value={input}
            onChangeText={setInput}
            placeholder={t('messages.composerPlaceholder')}
            placeholderTextColor="#9CA3AF"
            multiline
          />
          <Pressable
            style={[s.sendBtn, (!input.trim() || sendMut.isPending) && { opacity: 0.5 }]}
            onPress={onSend}
            disabled={!input.trim() || sendMut.isPending}
          >
            <Send size={18} color="#FFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 32, height: 32, borderRadius: 10 },
  headerAvatarFallback: { backgroundColor: '#EBF0FF', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { fontSize: 12, fontWeight: '700', color: '#25408D' },
  headerName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },

  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  dayLine: { flex: 1, height: 1, backgroundColor: '#F3F4F6' },
  daySep: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },

  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  bubble: { maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleMine: { backgroundColor: '#25408D', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#F3F4F6', borderBottomLeftRadius: 4 },
  bubbleContent: { fontSize: 14, color: '#111827', lineHeight: 19 },
  bubbleTime: { fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: 'right' },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FFF',
  },
  composerInput: {
    flex: 1, minHeight: 40, maxHeight: 120,
    backgroundColor: '#F3F4F6', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#111827',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#25408D',
    alignItems: 'center', justifyContent: 'center',
  },
});
