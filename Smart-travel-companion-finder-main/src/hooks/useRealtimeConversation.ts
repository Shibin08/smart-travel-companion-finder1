import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import {
  buildChatWebSocketUrl,
  fetchConversation,
  sendChatMessage,
  type BackendChatMessage,
  type BackendChatSocketConversation,
  type BackendChatSocketEvent,
} from '../utils/apiClient';

const TOKEN_STORAGE_KEY = 'tcf_token';
const LOCAL_TYPING_IDLE_MS = 1200;
const REMOTE_TYPING_RESET_MS = 2400;
const RECONNECT_BASE_DELAY_MS = 1500;
const RECONNECT_MAX_DELAY_MS = 5000;

export type RealtimeConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline';

const normalizeTimestamp = (value: string): string => (value.endsWith('Z') ? value : `${value}Z`);

const compareMessages = (left: ChatMessage, right: ChatMessage) => {
  const leftTime = new Date(left.timestamp).getTime();
  const rightTime = new Date(right.timestamp).getTime();
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return left.messageId.localeCompare(right.messageId);
};

const sortMessages = (messages: ChatMessage[]) => [...messages].sort(compareMessages);

const clearWindowTimer = (timerRef: { current: number | null }) => {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
};

const mapBackendMessage = (chatId: string, message: BackendChatMessage): ChatMessage => ({
  messageId: `api-${message.message_id}`,
  chatId,
  senderId: message.sender_id,
  text: message.message_text,
  timestamp: normalizeTimestamp(message.timestamp),
  messageType: 'text',
  deliveryStatus: 'sent',
  isEdited: false,
  readBy: [message.sender_id],
  reactions: [],
});

const isConversationMessage = (
  message: BackendChatMessage,
  currentUserId: string,
  otherUserId: string,
) =>
  (message.sender_id === currentUserId && message.receiver_id === otherUserId)
  || (message.sender_id === otherUserId && message.receiver_id === currentUserId);

const markMessageFailed = (messages: ChatMessage[], messageId: string): ChatMessage[] =>
  messages.map((message) =>
    message.messageId === messageId
      ? { ...message, deliveryStatus: 'failed' as const }
      : message,
  );

const reconcileIncomingMessage = (
  messages: ChatMessage[],
  chatId: string,
  incoming: BackendChatMessage,
  clientMessageId?: string,
): ChatMessage[] => {
  const savedMessageId = `api-${incoming.message_id}`;
  const existingBySavedId = messages.findIndex((message) => message.messageId === savedMessageId);
  if (existingBySavedId >= 0) {
    return sortMessages(
      messages.map((message) =>
        message.messageId === savedMessageId
          ? {
              ...message,
              timestamp: normalizeTimestamp(incoming.timestamp),
              deliveryStatus: 'sent' as const,
            }
          : message,
      ),
    );
  }

  if (clientMessageId) {
    const optimisticIndex = messages.findIndex((message) => message.messageId === clientMessageId);
    if (optimisticIndex >= 0) {
      return sortMessages(
        messages.map((message) =>
          message.messageId === clientMessageId
            ? {
                ...message,
                messageId: savedMessageId,
                timestamp: normalizeTimestamp(incoming.timestamp),
                deliveryStatus: 'sent' as const,
              }
            : message,
        ),
      );
    }
  }

  return sortMessages([...messages, mapBackendMessage(chatId, incoming)]);
};

interface UseRealtimeConversationOptions {
  chatId: string;
  otherUserId: string;
  currentUserId?: string;
  enabled?: boolean;
  onConversationActivity?: (conversation: BackendChatSocketConversation) => void;
}

export function useRealtimeConversation({
  chatId,
  otherUserId,
  currentUserId,
  enabled = true,
  onConversationActivity,
}: UseRealtimeConversationOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('idle');
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const remoteTypingTimerRef = useRef<number | null>(null);
  const localTypingTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const localTypingRef = useRef(false);
  const onConversationActivityRef = useRef(onConversationActivity);

  const clearRemoteTyping = () => {
    clearWindowTimer(remoteTypingTimerRef);
    setIsOtherUserTyping(false);
  };

  const clearChatError = () => {
    setChatError(null);
  };

  const sendTypingEvent = (isTyping: boolean) => {
    if (!enabled || !otherUserId) {
      return;
    }

    const websocket = socketRef.current;
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      websocket.send(
        JSON.stringify({
          type: 'typing',
          receiver_id: otherUserId,
          is_typing: isTyping,
        }),
      );
    } catch {
      // Ignore transient typing send failures.
    }
  };

  const stopTyping = () => {
    clearWindowTimer(localTypingTimerRef);
    if (!localTypingRef.current) {
      return;
    }

    localTypingRef.current = false;
    sendTypingEvent(false);
  };

  const setTypingState = (isTyping: boolean) => {
    if (!enabled || !currentUserId || !otherUserId) {
      return;
    }

    if (!isTyping) {
      stopTyping();
      return;
    }

    if (!localTypingRef.current) {
      localTypingRef.current = true;
      sendTypingEvent(true);
    }

    clearWindowTimer(localTypingTimerRef);
    localTypingTimerRef.current = window.setTimeout(() => {
      stopTyping();
    }, LOCAL_TYPING_IDLE_MS);
  };

  useEffect(() => {
    onConversationActivityRef.current = onConversationActivity;
  }, [onConversationActivity]);

  useEffect(() => {
    if (!enabled || !otherUserId) {
      setMessages([]);
      clearRemoteTyping();
      return;
    }

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setMessages([]);
      setConnectionStatus('offline');
      setChatError('Login token missing. Please sign in again.');
      clearRemoteTyping();
      return;
    }

    let cancelled = false;
    void fetchConversation(token, otherUserId)
      .then((conversation) => {
        if (cancelled) {
          return;
        }

        setMessages(sortMessages(conversation.map((message) => mapBackendMessage(chatId, message))));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setMessages([]);
        setChatError('Unable to load earlier messages right now. New messages can still appear here.');
      });

    return () => {
      cancelled = true;
    };
  }, [chatId, enabled, otherUserId]);

  useEffect(() => {
    if (!enabled || !currentUserId || !otherUserId) {
      setConnectionStatus('idle');
      clearRemoteTyping();
      stopTyping();
      return;
    }

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setConnectionStatus('offline');
      setChatError('Login token missing. Please sign in again.');
      clearRemoteTyping();
      stopTyping();
      return;
    }

    let disposed = false;

    const connect = () => {
      if (disposed) {
        return;
      }

      clearWindowTimer(reconnectTimerRef);
      setConnectionStatus(reconnectAttemptRef.current === 0 ? 'connecting' : 'reconnecting');

      const websocket = new WebSocket(buildChatWebSocketUrl(token));
      socketRef.current = websocket;

      websocket.onopen = () => {
        if (disposed || socketRef.current !== websocket) {
          return;
        }

        reconnectAttemptRef.current = 0;
        setConnectionStatus('connected');
      };

      websocket.onmessage = (event) => {
        let payload: BackendChatSocketEvent;
        try {
          payload = JSON.parse(event.data) as BackendChatSocketEvent;
        } catch {
          return;
        }

        if (payload.type === 'chat_message') {
          onConversationActivityRef.current?.(payload.conversation);
          if (!isConversationMessage(payload.message, currentUserId, otherUserId)) {
            return;
          }

          if (payload.message.sender_id === otherUserId) {
            clearRemoteTyping();
          }

          setMessages((previous) =>
            reconcileIncomingMessage(previous, chatId, payload.message, payload.client_message_id),
          );
          return;
        }

        if (payload.type === 'typing') {
          if (payload.sender_id !== otherUserId) {
            return;
          }

          if (!payload.is_typing) {
            clearRemoteTyping();
            return;
          }

          setIsOtherUserTyping(true);
          clearWindowTimer(remoteTypingTimerRef);
          remoteTypingTimerRef.current = window.setTimeout(() => {
            setIsOtherUserTyping(false);
            remoteTypingTimerRef.current = null;
          }, REMOTE_TYPING_RESET_MS);
          return;
        }

        if (payload.type === 'error') {
          if (payload.client_message_id) {
            const failedMessageId = payload.client_message_id;
            setMessages((previous) => markMessageFailed(previous, failedMessageId));
          }

          setChatError(payload.detail || 'Could not send your message right now.');
        }
      };

      websocket.onerror = () => {
        if (!disposed && socketRef.current === websocket) {
          setConnectionStatus((previous) =>
            previous === 'connected' ? 'reconnecting' : previous,
          );
        }
      };

      websocket.onclose = (event) => {
        if (socketRef.current === websocket) {
          socketRef.current = null;
        }

        stopTyping();
        clearRemoteTyping();

        if (disposed) {
          return;
        }

        if (event.code === 1008) {
          setConnectionStatus('offline');
          setChatError('Your chat session expired. Please sign in again.');
          return;
        }

        reconnectAttemptRef.current += 1;
        setConnectionStatus('reconnecting');

        const reconnectDelay = Math.min(
          RECONNECT_MAX_DELAY_MS,
          RECONNECT_BASE_DELAY_MS * reconnectAttemptRef.current,
        );

        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, reconnectDelay);
      };
    };

    connect();

    return () => {
      disposed = true;
      stopTyping();
      clearRemoteTyping();
      clearWindowTimer(reconnectTimerRef);
      if (socketRef.current) {
        const activeSocket = socketRef.current;
        socketRef.current = null;
        activeSocket.close();
      }
    };
  }, [chatId, currentUserId, enabled, otherUserId]);

  const sendMessage = (
    text: string,
    replyTo?: { messageId: string; senderId: string; text: string },
  ) => {
    if (!enabled || !currentUserId) {
      return;
    }

    stopTyping();

    const clientMessageId = `${chatId}-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      messageId: clientMessageId,
      chatId,
      senderId: currentUserId,
      text,
      timestamp: new Date().toISOString(),
      messageType: 'text',
      deliveryStatus: 'sending',
      isEdited: false,
      readBy: [currentUserId],
      reactions: [],
      replyTo,
    };

    setMessages((previous) => sortMessages([...previous, optimisticMessage]));

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setConnectionStatus('offline');
      setMessages((previous) => markMessageFailed(previous, clientMessageId));
      setChatError('Login token missing. Please sign in again.');
      return;
    }

    const websocket = socketRef.current;
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      try {
        websocket.send(
          JSON.stringify({
            type: 'send_message',
            receiver_id: otherUserId,
            message_text: text,
            client_message_id: clientMessageId,
          }),
        );
        return;
      } catch {
        // Fall through to the REST write path.
      }
    }

    void sendChatMessage(token, otherUserId, text)
      .then((savedMessage) => {
        setMessages((previous) =>
          reconcileIncomingMessage(previous, chatId, savedMessage, clientMessageId),
        );
      })
      .catch((error: unknown) => {
        setMessages((previous) => markMessageFailed(previous, clientMessageId));
        setChatError(
          error instanceof Error && error.message
            ? error.message
            : 'Could not send your message right now.',
        );
      });
  };

  return {
    messages,
    sendMessage,
    setTypingState,
    connectionStatus,
    isOtherUserTyping,
    chatError,
    clearChatError,
  };
}
