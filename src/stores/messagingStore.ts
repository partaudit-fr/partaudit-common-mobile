import { create } from 'zustand';
import type {
  Conversation,
  Message,
  MessageSearchResult,
  WSNewMessagePayload,
  WSMessageReadPayload,
  WSTypingPayload,
  WSPresencePayload,
} from '../types/messaging';

interface TypingUser {
  user_id: number;
  user_name?: string;
  timestamp: number;
}

interface ConversationPagination {
  page: number;
  hasMore: boolean;
  isLoadingMore: boolean;
}

interface MessagingState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messagesByConversation: Record<string, Message[]>;
  loadedConversations: Set<string>;
  paginationByConversation: Record<string, ConversationPagination>;
  typingUsers: Record<string, TypingUser[]>;
  onlineUsers: Set<number>;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  totalUnreadCount: number;
  isConnected: boolean;
  error: string | null;
  replyingTo: Message | null;
  editingMessage: Message | null;
  searchQuery: string;
  searchResults: MessageSearchResult[];
  isSearching: boolean;
}

interface MessagingActions {
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;
  setCurrentConversation: (conversationId: string | null) => void;
  setMessages: (conversationId: string, messages: Message[], hasMore: boolean) => void;
  addMessage: (conversationId: string, message: Message) => void;
  prependMessages: (conversationId: string, messages: Message[], hasMore: boolean) => void;
  isConversationLoaded: (conversationId: string) => boolean;
  getPagination: (conversationId: string) => ConversationPagination;
  setLoadingMore: (conversationId: string, loading: boolean) => void;
  incrementPage: (conversationId: string) => void;
  setUserTyping: (conversationId: string, user_id: number, user_name?: string) => void;
  removeUserTyping: (conversationId: string, user_id: number) => void;
  clearTypingUsers: (conversationId: string) => void;
  handleNewMessage: (payload: WSNewMessagePayload) => void;
  handleMessageRead: (payload: WSMessageReadPayload) => void;
  handleTyping: (payload: WSTypingPayload, isTyping: boolean) => void;
  handlePresence: (payload: WSPresencePayload) => void;
  isUserOnline: (user_id: number) => boolean;
  setLoadingConversations: (loading: boolean) => void;
  setLoadingMessages: (loading: boolean) => void;
  setSending: (sending: boolean) => void;
  setTotalUnreadCount: (count: number) => void;
  decrementUnreadCount: (conversationId: string) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  setReplyingTo: (message: Message | null) => void;
  setEditingMessage: (message: Message | null) => void;
  updateMessage: (conversationId: string, message_id: string, updates: Partial<Message>) => void;
  deleteMessage: (conversationId: string, message_id: string) => void;
  togglePinConversation: (conversationId: string) => void;
  addReaction: (conversationId: string, message_id: string, emoji: string, user_id: number) => void;
  removeReaction: (conversationId: string, message_id: string, emoji: string, user_id: number) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: MessageSearchResult[]) => void;
  setIsSearching: (searching: boolean) => void;
  clearSearch: () => void;
}

const initialState: MessagingState = {
  conversations: [],
  currentConversationId: null,
  messagesByConversation: {},
  loadedConversations: new Set<string>(),
  paginationByConversation: {},
  typingUsers: {},
  onlineUsers: new Set<number>(),
  isLoadingConversations: false,
  isLoadingMessages: false,
  isSending: false,
  totalUnreadCount: 0,
  isConnected: false,
  error: null,
  replyingTo: null,
  editingMessage: null,
  searchQuery: '',
  searchResults: [],
  isSearching: false,
};

export const useMessagingStore = create<MessagingState & MessagingActions>((set, get) => ({
  ...initialState,

  setConversations: (conversations) => set({ conversations }),

  addConversation: (conversation) => {
    set((state) => ({
      conversations: [conversation, ...state.conversations.filter((c) => c.id !== conversation.id)],
    }));
  },

  updateConversation: (conversationId, updates) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, ...updates } : conv,
      ),
    }));
  },

  setCurrentConversation: (conversationId) => set({ currentConversationId: conversationId }),

  setMessages: (conversationId, messages, hasMore) => {
    set((state) => {
      const newLoadedConversations = new Set(state.loadedConversations);
      newLoadedConversations.add(conversationId);
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: messages,
        },
        loadedConversations: newLoadedConversations,
        paginationByConversation: {
          ...state.paginationByConversation,
          [conversationId]: { page: 1, hasMore, isLoadingMore: false },
        },
      };
    });
  },

  addMessage: (conversationId, message) => {
    set((state) => {
      const existingMessages = state.messagesByConversation[conversationId] || [];
      if (existingMessages.some((m) => m.id === message.id)) return state;
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [message, ...existingMessages],
        },
      };
    });
  },

  prependMessages: (conversationId, messages, hasMore) => {
    set((state) => {
      const existingMessages = state.messagesByConversation[conversationId] || [];
      const existingIds = new Set(existingMessages.map((m) => m.id));
      const newMessages = messages.filter((m) => !existingIds.has(m.id));
      const currentPagination = state.paginationByConversation[conversationId] || {
        page: 1,
        hasMore: true,
        isLoadingMore: false,
      };
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [...existingMessages, ...newMessages],
        },
        paginationByConversation: {
          ...state.paginationByConversation,
          [conversationId]: { ...currentPagination, hasMore, isLoadingMore: false },
        },
      };
    });
  },

  isConversationLoaded: (conversationId) => get().loadedConversations.has(conversationId),

  getPagination: (conversationId) =>
    get().paginationByConversation[conversationId] || { page: 1, hasMore: true, isLoadingMore: false },

  setLoadingMore: (conversationId, loading) => {
    set((state) => {
      const current = state.paginationByConversation[conversationId] || {
        page: 1,
        hasMore: true,
        isLoadingMore: false,
      };
      return {
        paginationByConversation: {
          ...state.paginationByConversation,
          [conversationId]: { ...current, isLoadingMore: loading },
        },
      };
    });
  },

  incrementPage: (conversationId) => {
    set((state) => {
      const current = state.paginationByConversation[conversationId] || {
        page: 1,
        hasMore: true,
        isLoadingMore: false,
      };
      return {
        paginationByConversation: {
          ...state.paginationByConversation,
          [conversationId]: { ...current, page: current.page + 1 },
        },
      };
    });
  },

  setUserTyping: (conversationId, user_id, user_name) => {
    set((state) => {
      const existingTypers = state.typingUsers[conversationId] || [];
      const filtered = existingTypers.filter((t) => t.user_id !== user_id);
      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: [...filtered, { user_id, user_name, timestamp: Date.now() }],
        },
      };
    });
  },

  removeUserTyping: (conversationId, user_id) => {
    set((state) => {
      const existingTypers = state.typingUsers[conversationId] || [];
      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: existingTypers.filter((t) => t.user_id !== user_id),
        },
      };
    });
  },

  clearTypingUsers: (conversationId) => {
    set((state) => ({
      typingUsers: { ...state.typingUsers, [conversationId]: [] },
    }));
  },

  handleNewMessage: (payload) => {
    const { message, conversation_id } = payload;
    const state = get();

    const conv = state.conversations.find((c) => c.id === conversation_id);
    const enrichedMessage = {
      ...message,
      sender_name: message.sender_name || conv?.other_participant_name || 'Inconnu',
    };

    get().addMessage(conversation_id, enrichedMessage);

    get().updateConversation(conversation_id, {
      last_message_preview: enrichedMessage.content.substring(0, 100),
      last_message_at: enrichedMessage.created_at,
      unread_count:
        state.currentConversationId === conversation_id ? 0 : (conv?.unread_count || 0) + 1,
    });

    set((state) => {
      const conversation = state.conversations.find((c) => c.id === conversation_id);
      if (conversation) {
        return {
          conversations: [
            conversation,
            ...state.conversations.filter((c) => c.id !== conversation_id),
          ],
        };
      }
      return state;
    });

    if (state.currentConversationId !== conversation_id) {
      set((state) => ({ totalUnreadCount: state.totalUnreadCount + 1 }));
    }

    get().removeUserTyping(conversation_id, enrichedMessage.sender_id);
  },

  handleMessageRead: (payload) => {
    const { conversation_id, reader_id, read_at } = payload;
    set((state) => {
      const messages = state.messagesByConversation[conversation_id];
      if (!messages) return state;
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversation_id]: messages.map((msg) =>
            msg.sender_id !== reader_id && !msg.read_at ? { ...msg, read_at } : msg,
          ),
        },
      };
    });
  },

  handleTyping: (payload, isTyping) => {
    const { conversation_id, user_id, user_name } = payload;
    if (isTyping) {
      get().setUserTyping(conversation_id, user_id, user_name);
    } else {
      get().removeUserTyping(conversation_id, user_id);
    }
  },

  handlePresence: (payload) => {
    set((state) => {
      const newOnlineUsers = new Set(state.onlineUsers);

      if (payload.user_id !== undefined && payload.online !== undefined) {
        if (payload.online) newOnlineUsers.add(payload.user_id);
        else newOnlineUsers.delete(payload.user_id);
      }

      if (payload.online_users) {
        payload.online_users.forEach((id) => newOnlineUsers.add(id));
      }

      if (payload.user_statuses) {
        Object.entries(payload.user_statuses).forEach(([id, online]) => {
          const user_id = Number(id);
          if (online) newOnlineUsers.add(user_id);
          else newOnlineUsers.delete(user_id);
        });
      }

      return { onlineUsers: newOnlineUsers };
    });
  },

  isUserOnline: (user_id) => get().onlineUsers.has(user_id),

  setLoadingConversations: (loading) => set({ isLoadingConversations: loading }),
  setLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
  setSending: (sending) => set({ isSending: sending }),

  setTotalUnreadCount: (count) => set({ totalUnreadCount: count }),

  decrementUnreadCount: (conversationId) => {
    set((state) => {
      const conv = state.conversations.find((c) => c.id === conversationId);
      const decrement = conv?.unread_count || 0;
      return {
        totalUnreadCount: Math.max(0, state.totalUnreadCount - decrement),
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c,
        ),
      };
    });
  },

  setConnected: (connected) => set({ isConnected: connected }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),

  setReplyingTo: (message) => set({ replyingTo: message, editingMessage: null }),
  setEditingMessage: (message) => set({ editingMessage: message, replyingTo: null }),

  updateMessage: (conversationId, message_id, updates) => {
    set((state) => {
      const messages = state.messagesByConversation[conversationId];
      if (!messages) return state;
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: messages.map((msg) =>
            msg.id === message_id ? { ...msg, ...updates } : msg,
          ),
        },
      };
    });
  },

  deleteMessage: (conversationId, message_id) => {
    set((state) => {
      const messages = state.messagesByConversation[conversationId];
      if (!messages) return state;
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: messages.map((msg) =>
            msg.id === message_id
              ? { ...msg, deleted_at: new Date().toISOString(), content: '' }
              : msg,
          ),
        },
      };
    });
  },

  togglePinConversation: (conversationId) => {
    set((state) => {
      const conversations = state.conversations.map((conv) => {
        if (conv.id === conversationId) {
          return { ...conv, pinned_at: conv.pinned_at ? undefined : new Date().toISOString() };
        }
        return conv;
      });
      conversations.sort((a, b) => {
        if (a.pinned_at && !b.pinned_at) return -1;
        if (!a.pinned_at && b.pinned_at) return 1;
        const aTime = a.last_message_at || a.created_at;
        const bTime = b.last_message_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
      return { conversations };
    });
  },

  addReaction: (conversationId, message_id, emoji, user_id) => {
    set((state) => {
      const messages = state.messagesByConversation[conversationId];
      if (!messages) return state;
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: messages.map((msg) => {
            if (msg.id !== message_id) return msg;

            let reactions = (msg.reactions || [])
              .map((r) => {
                const newUserIds = r.user_ids.filter((id) => Number(id) !== Number(user_id));
                if (newUserIds.length === 0) return null;
                return { ...r, count: newUserIds.length, user_ids: newUserIds };
              })
              .filter((r): r is NonNullable<typeof r> => r !== null);

            const existingReaction = reactions.find((r) => r.emoji === emoji);
            if (existingReaction) {
              existingReaction.count += 1;
              existingReaction.user_ids = [...existingReaction.user_ids, user_id];
            } else {
              reactions = [...reactions, { emoji, count: 1, user_ids: [user_id] }];
            }
            return { ...msg, reactions };
          }),
        },
      };
    });
  },

  removeReaction: (conversationId, message_id, emoji, user_id) => {
    set((state) => {
      const messages = state.messagesByConversation[conversationId];
      if (!messages) return state;
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: messages.map((msg) => {
            if (msg.id !== message_id) return msg;
            const reactions = (msg.reactions || [])
              .map((r) => {
                if (r.emoji !== emoji) return r;
                const newUserIds = r.user_ids.filter((id) => Number(id) !== Number(user_id));
                if (newUserIds.length === 0) return null;
                return { ...r, count: newUserIds.length, user_ids: newUserIds };
              })
              .filter((r): r is NonNullable<typeof r> => r !== null);
            return { ...msg, reactions };
          }),
        },
      };
    });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setIsSearching: (searching) => set({ isSearching: searching }),
  clearSearch: () => set({ searchQuery: '', searchResults: [], isSearching: false }),
}));
