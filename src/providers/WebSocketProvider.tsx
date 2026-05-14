import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
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
          case 'new_message':
            handleNewMessage(wsEvent.payload as WSNewMessagePayload);
            break;
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
  }, [user, wsUrl, getAccessToken]);

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
