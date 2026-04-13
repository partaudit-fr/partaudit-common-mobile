export type ContentType = 'text' | 'html';

export interface Conversation {
  id: string;
  other_participant_id: number;
  other_participant_name: string;
  other_participant_image?: string;
  last_message_preview?: string;
  last_message_at?: string;
  unread_count: number;
  reservation_id?: string;
  archived_at?: string;
  pinned_at?: string;
  created_at: string;
}

export type ConversationDetail = Conversation;

export interface CreateConversationResponse {
  conversation: Conversation;
}

export interface ReactionCount {
  emoji: string;
  count: number;
  user_ids: number[];
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: number;
  sender_name: string;
  content: string;
  content_type: ContentType;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  reply_to_message_id?: string;
  reply_to_content?: string;
  reply_to_sender_name?: string;
  edited_at?: string;
  deleted_at?: string;
  reactions?: ReactionCount[];
  read_at?: string;
  created_at: string;
}

export interface PaginatedMessages {
  messages: Message[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface CreateConversationRequest {
  other_user_id: number;
  reservation_id?: string;
}

export interface SendMessageRequest {
  content: string;
  content_type: ContentType;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  reply_to_message_id?: string;
}

export interface MessageSearchResult {
  message: Message;
  highlight?: string;
}

export interface SearchMessagesResponse {
  results: MessageSearchResult[];
  total: number;
  query: string;
}

export interface DeleteMessageRequest {
  for_all: boolean;
}

export interface PinConversationRequest {
  pinned: boolean;
}

export interface AddReactionRequest {
  emoji: string;
}

export interface EditMessageRequest {
  content: string;
}

export interface UnreadCountResponse {
  total_unread: number;
}

// WebSocket Event Types
export type WSEventType =
  | 'new_message'
  | 'message_read'
  | 'typing'
  | 'stop_typing'
  | 'heartbeat'
  | 'connected'
  | 'presence'
  | 'reaction_added'
  | 'reaction_removed'
  | 'message_edited'
  | 'error';

export interface WSEvent<T = unknown> {
  type: WSEventType;
  payload: T;
}

export interface WSNewMessagePayload {
  message: Message;
  conversation_id: string;
}

export interface WSMessageReadPayload {
  conversation_id: string;
  reader_id: number;
  read_at: string;
}

export interface WSReactionPayload {
  conversation_id: string;
  message_id: string;
  user_id: number;
  emoji: string;
}

export interface WSMessageEditedPayload {
  conversation_id: string;
  message_id: string;
  content: string;
  edited_at: string;
}

export interface WSTypingPayload {
  conversation_id: string;
  user_id: number;
  user_name?: string;
}

export interface WSConnectedPayload {
  status: string;
  client_id: string;
}

export interface WSHeartbeatPayload {
  timestamp: number;
}

export interface WSPresencePayload {
  user_id?: number;
  online?: boolean;
  online_users?: number[];
  user_statuses?: Record<number, boolean>;
}

export interface WSClientMessage {
  action: 'typing' | 'stop_typing' | 'presence_query';
  conversation_id?: string;
  user_ids?: number[];
}
