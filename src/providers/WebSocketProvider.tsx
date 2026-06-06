import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useMessagingStore } from '../stores/messagingStore';
import type {
  WSEvent,
  WSNewMessagePayload,
  WSMessageReadPayload,
  WSTypingPayload,
  WSPresencePayload,
  WSReactionPayload,
  WSMessageEditedPayload,
  WSClientMessage,
} from '../types/messaging';
import { useAuth } from './AuthProvider';

interface WebSocketContextValue {
  sendTyping: (conversationId: string) => void;
  sendStopTyping: (conversationId: string) => void;
  queryPresence: (userIds: number[]) => void;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  sendTyping: () => {},
  sendStopTyping: () => {},
  queryPresence: () => {},
  isConnected: false,
});

interface WebSocketProviderProps {
  children: React.ReactNode;
  wsUrl: string;
}

export function WebSocketProvider({ children, wsUrl }: WebSocketProviderProps) {
  const { user, getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const {
    handleNewMessage,
    handleMessageRead,
    handleTyping,
    handlePresence,
    addReaction,
    removeReaction,
    updateMessage,
    setConnected,
    isConnected,
  } = useMessagingStore();

  // Mirror WS push events into the React Query cache so screens bound to
  // ['messages', id] / ['conversations'] update instantly without a refetch.
  // Without this, the WS only feeds Zustand and the UI (React Query-bound)
  // stays stale until a focus/navigation refetch — which surfaces as a
  // phantom pull-to-refresh spinner.
  const applyNewMessageToCache = useCallback((payload: WSNewMessagePayload) => {
    const convId = String(payload.conversation_id);
    const incoming = payload.message as any;

    queryClient.setQueryData<any>(['messages', convId], (prev) => {
      if (!prev) return prev;
      const list = (prev as any)?.messages || [];
      // Skip if we already have this id (echo of our own send + WS echo)
      if (list.some((m: any) => String(m.id) === String(incoming.id))) return prev;
      // Backend pagination is desc — prepend keeps order consistent.
      return { ...prev, messages: [incoming, ...list] };
    });

    queryClient.setQueryData<any>(['conversations'], (prev) => {
      if (!prev) return prev;
      const raw = (prev as any)?.conversations || (prev as any)?.items;
      if (!Array.isArray(raw)) return prev;
      const idx = raw.findIndex((c: any) => String(c.id) === convId);
      if (idx === -1) return prev;
      const preview = String(incoming.content || '').slice(0, 100);
      const updated = {
        ...raw[idx],
        last_message_preview: preview,
        last_message_at: incoming.created_at,
        // Only bump unread if the user isn't currently viewing this thread.
        unread_count:
          useMessagingStore.getState().currentConversationId === convId
            ? 0
            : (raw[idx].unread_count || 0) + 1,
      };
      const next = [updated, ...raw.filter((_: any, i: number) => i !== idx)];
      return (prev as any).conversations
        ? { ...prev, conversations: next }
        : { ...prev, items: next };
    });
  }, [queryClient]);

  const connect = useCallback(async () => {
    if (!user) return;

    const token = await getAccessToken();
    if (!token) return;

    const ws = new WebSocket(`${wsUrl}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Heartbeat every 30s
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'heartbeat' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const wsEvent = JSON.parse(event.data) as WSEvent;

        switch (wsEvent.type) {
          case 'new_message': {
            const p = wsEvent.payload as WSNewMessagePayload;
            handleNewMessage(p);
            applyNewMessageToCache(p);
            break;
          }
          case 'message_read':
            handleMessageRead(wsEvent.payload as WSMessageReadPayload);
            break;
          case 'typing':
            handleTyping(wsEvent.payload as WSTypingPayload, true);
            break;
          case 'stop_typing':
            handleTyping(wsEvent.payload as WSTypingPayload, false);
            break;
          case 'presence':
            handlePresence(wsEvent.payload as WSPresencePayload);
            break;
          case 'reaction_added': {
            const r = wsEvent.payload as WSReactionPayload;
            addReaction(r.conversation_id, r.message_id, r.emoji, r.user_id);
            break;
          }
          case 'reaction_removed': {
            const r = wsEvent.payload as WSReactionPayload;
            removeReaction(r.conversation_id, r.message_id, r.emoji, r.user_id);
            break;
          }
          case 'message_edited': {
            const e = wsEvent.payload as WSMessageEditedPayload;
            updateMessage(e.conversation_id, e.message_id, {
              content: e.content,
              edited_at: e.edited_at,
            });
            break;
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      // Reconnect after 3s
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [user, wsUrl, getAccessToken, applyNewMessageToCache]);

  useEffect(() => {
    connect();

    // Handle app state changes (background/foreground)
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connect();
        }
      }
    });

    return () => {
      subscription.remove();
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [connect]);

  function send(message: WSClientMessage) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }

  const sendTyping = useCallback((conversationId: string) => {
    send({ action: 'typing', conversation_id: conversationId });
  }, []);

  const sendStopTyping = useCallback((conversationId: string) => {
    send({ action: 'stop_typing', conversation_id: conversationId });
  }, []);

  const queryPresence = useCallback((userIds: number[]) => {
    send({ action: 'presence_query', user_ids: userIds });
  }, []);

  return (
    <WebSocketContext.Provider value={{ sendTyping, sendStopTyping, queryPresence, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}
