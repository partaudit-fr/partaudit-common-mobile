import type { ApiClient } from '../createApiClient';
import type {
  Conversation,
  ConversationDetail,
  CreateConversationRequest,
  CreateConversationResponse,
  Message,
  SendMessageRequest,
  UnreadCountResponse,
  SearchMessagesResponse,
  AddReactionRequest,
  EditMessageRequest,
  PinConversationRequest,
} from '../../types/messaging';

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; status: number };
}

export interface GetMessagesResponse {
  messages: Message[];
  total: number;
  hasMore: boolean;
}

export function createMessagingEndpoints(api: ApiClient) {
  return {
    getConversations: (page = 1, pageSize = 20) =>
      api.get<{ conversations: Conversation[]; total: number }>(
        `/v1/conversations?limit=${pageSize}&offset=${(page - 1) * pageSize}`,
      ),

    getConversation: (conversationId: string) =>
      api.get<ConversationDetail>(`/v1/conversations/${conversationId}`),

    createConversation: (data: CreateConversationRequest) =>
      api.post<CreateConversationResponse>('/v1/conversations', data),

    getMessages: (conversationId: string, page = 1, pageSize = 20) =>
      api.get<{ messages: Message[]; total: number }>(
        `/v1/conversations/${conversationId}/messages?limit=${pageSize}&offset=${(page - 1) * pageSize}`,
      ),

    sendMessage: (conversationId: string, data: SendMessageRequest) =>
      api.post<Message>(`/v1/conversations/${conversationId}/messages`, data),

    markAsRead: (conversationId: string) =>
      api.put<{ success: boolean }>(`/v1/conversations/${conversationId}/read`, {}),

    archiveConversation: (conversationId: string, archive = true) =>
      api.put<{ success: boolean; action: string }>(
        `/v1/conversations/${conversationId}/archive`,
        { archive },
      ),

    getUnreadCount: () =>
      api.get<UnreadCountResponse>('/v1/unread-count'),

    searchMessages: (query: string, conversationId?: string, limit = 20, offset = 0) => {
      const params = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset) });
      if (conversationId) params.set('conversation_id', conversationId);
      return api.get<SearchMessagesResponse>(`/v1/messages/search?${params.toString()}`);
    },

    deleteMessage: (conversationId: string, messageId: string, forAll = false) =>
      api.del<{ success: boolean }>(
        `/v1/conversations/${conversationId}/messages/${messageId}?for_all=${forAll}`,
      ),

    pinConversation: (conversationId: string, pinned: boolean) =>
      api.put<{ success: boolean }>(
        `/v1/conversations/${conversationId}/pin`,
        { pinned } as PinConversationRequest,
      ),

    addReaction: (conversationId: string, messageId: string, emoji: string) =>
      api.post<{ success: boolean }>(
        `/v1/conversations/${conversationId}/messages/${messageId}/reactions`,
        { emoji } as AddReactionRequest,
      ),

    removeReaction: (conversationId: string, messageId: string, emoji: string) =>
      api.del<{ success: boolean }>(
        `/v1/conversations/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
      ),

    editMessage: (conversationId: string, messageId: string, content: string) =>
      api.put<Message>(
        `/v1/conversations/${conversationId}/messages/${messageId}`,
        { content } as EditMessageRequest,
      ),
  };
}
