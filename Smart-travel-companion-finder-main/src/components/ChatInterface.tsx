import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Lock, MessageCircle, Smile, Reply, X,
  MoreVertical, VolumeX, Volume2, Ban, Trash2, Flag, User as UserIcon, Plane, MapPin, ArrowLeft, CheckCircle2,
} from 'lucide-react';
import type { ChatMessage, Match, User } from '../types';
import type { RealtimeConnectionStatus } from '../hooks/useRealtimeConversation';
import UserAvatar from './UserAvatar';

interface ChatInterfaceProps {
  match: Match;
  currentUser: User;
  messages: ChatMessage[];
  onSendMessage: (text: string, replyTo?: { messageId: string; senderId: string; text: string }) => void;
  onTypingChange?: (isTyping: boolean) => void;
  onClearChat?: () => void;
  onEndChat?: () => Promise<{ ok: boolean; error?: string }>;
  chatEndedAt?: string | null;
  onBackToConversations?: () => void;
  connectionStatus?: RealtimeConnectionStatus;
  isOtherUserTyping?: boolean;
  networkError?: string | null;
  onDismissNetworkError?: () => void;
}

type ToastTone = 'neutral' | 'success' | 'error';

const CHAT_SEEN_STORAGE_KEY = 'tcf_chat_seen_v1';

interface ToastState {
  tone: ToastTone;
  message: string;
}

const EMOJI_LIST = ['ðŸ˜€', 'ðŸ˜‚', 'ðŸ˜', 'ðŸ¥°', 'ðŸ˜Ž', 'ðŸ¤”', 'ðŸ‘', 'ðŸ‘Ž', 'â¤ï¸', 'ðŸ”¥', 'ðŸŽ‰', 'âœˆï¸', 'ðŸŒ', 'ðŸ–ï¸', 'â›°ï¸', 'ðŸ—ºï¸', 'ðŸ˜¢', 'ðŸ˜¡', 'ðŸ¤', 'âœ…', 'ðŸ’¯', 'ðŸ™', 'ðŸ‘‹', 'ðŸ¤©'];

const CHAT_THEME = {
  myBubble: 'bg-cyan-600',
  myText: 'text-white',
  theirBubble: 'bg-white',
  theirText: 'text-gray-900',
  bg: 'bg-gray-50',
  accent: 'text-cyan-200',
};

const normalizeTimestamp = (value: string): string => (value.endsWith('Z') ? value : `${value}Z`);

const toEpoch = (value: string | null | undefined): number => {
  if (!value) return Number.NaN;
  const parsed = new Date(normalizeTimestamp(value)).getTime();
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

const readSeenMap = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(CHAT_SEEN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const getMessageDayKey = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const formatMessageDayLabel = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
  const messageKey = getMessageDayKey(timestamp);

  if (messageKey === todayKey) return 'Today';
  if (messageKey === yesterdayKey) return 'Yesterday';

  return date.toLocaleDateString([], {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function ChatInterface({
  match,
  currentUser,
  messages,
  onSendMessage,
  onTypingChange,
  onClearChat,
  onEndChat,
  chatEndedAt,
  onBackToConversations,
  connectionStatus = 'idle',
  isOtherUserTyping = false,
  networkError,
  onDismissNetworkError,
}: ChatInterfaceProps) {
  const navigate = useNavigate();
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isEndingChat, setIsEndingChat] = useState(false);
  const [showEndChatConfirm, setShowEndChatConfirm] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [peerSeenAt, setPeerSeenAt] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousMessageCountRef = useRef(0);
  const shouldAutoScrollRef = useRef(true);
  const toastTimerRef = useRef<number | null>(null);

  const isLocked = match.matchStatus !== 'Matched';
  const canShowEndChat = match.matchStatus === 'Matched';
  const canEndChatNow = Boolean(match.canEndChat);
  const endChatUnlockLabel = useMemo(() => {
    if (!match.endChatAvailableOn) return null;
    const datePart = match.endChatAvailableOn.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const [year, month, day] = datePart.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    const parsed = new Date(match.endChatAvailableOn);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return match.endChatAvailableOn;
  }, [match.endChatAvailableOn]);
  const endChatLockedMessage = endChatUnlockLabel
    ? `You can end chat only after the trip ends (on or after ${endChatUnlockLabel}).`
    : 'You can end chat only after the trip ends for both travelers.';
  const hasMessages = messages.length > 0;
  const theme = CHAT_THEME;

  const showToast = useCallback((msg: string, tone: ToastTone = 'neutral') => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ tone, message: msg });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2800);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!networkError || !onDismissNetworkError) {
      return;
    }

    const timer = window.setTimeout(() => {
      onDismissNetworkError();
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [networkError, onDismissNetworkError]);

  useEffect(() => {
    const refreshPeerSeenAt = () => {
      const seenMap = readSeenMap();
      setPeerSeenAt(seenMap[currentUser.userId] ?? null);
    };

    refreshPeerSeenAt();

    const onStorage = (event: StorageEvent) => {
      if (event.key === CHAT_SEEN_STORAGE_KEY || event.key === null) {
        refreshPeerSeenAt();
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [currentUser.userId, messages.length]);

  useEffect(() => () => {
    onTypingChange?.(false);
  }, [onTypingChange]);

  // Close emoji picker & menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const introText = useMemo(
    () => `Start planning your ${match.user.profile.travelStyle.toLowerCase()} trip together.`,
    [match.user.profile.travelStyle],
  );

  const connectionMeta = useMemo(() => {
    switch (connectionStatus) {
      case 'connected':
        return {
          dotClass: 'bg-emerald-400',
          label: 'Online',
          bannerTone: null,
          bannerText: '',
        };
      case 'connecting':
        return {
          dotClass: 'bg-amber-400',
          label: 'Connecting',
          bannerTone: 'info' as const,
          bannerText: 'Connecting to realtime chat. Messages can still fall back to the backup send path if needed.',
        };
      case 'reconnecting':
        return {
          dotClass: 'bg-amber-400',
          label: 'Reconnecting',
          bannerTone: 'warn' as const,
          bannerText: 'Realtime chat disconnected. Trying to reconnect automatically.',
        };
      case 'offline':
        return {
          dotClass: 'bg-rose-400',
          label: 'Offline',
          bannerTone: 'error' as const,
          bannerText: 'Realtime updates are unavailable right now. Messages may use the backup send path.',
        };
      default:
        return {
          dotClass: 'bg-gray-300',
          label: 'Offline',
          bannerTone: null,
          bannerText: '',
        };
    }
  }, [connectionStatus]);

  const toastStyleClass = toast?.tone === 'success'
    ? 'bg-emerald-600 text-white'
    : toast?.tone === 'error'
      ? 'bg-rose-600 text-white'
      : 'bg-gray-900 text-white';

  const connectionBannerClass = connectionMeta.bannerTone === 'error'
    ? 'bg-rose-50 text-rose-700 border-b border-rose-200/70'
    : connectionMeta.bannerTone === 'warn'
      ? 'bg-amber-50 text-amber-800 border-b border-amber-200/70'
      : 'bg-cyan-50 text-cyan-800 border-b border-cyan-200/70';

  const handleDraftChange = (value: string) => {
    setNewMessage(value);
    onTypingChange?.(value.trim().length > 0);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    if (messagesContainerRef.current) {
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTo({
            top: messagesContainerRef.current.scrollHeight,
            behavior,
          });
        }
      }, 0);
    }
  };

  const isNearBottom = () => {
    if (!messagesContainerRef.current) return true;
    const el = messagesContainerRef.current;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const handleMessagesScroll = () => {
    shouldAutoScrollRef.current = isNearBottom();
  };

  useEffect(() => {
    const prevCount = previousMessageCountRef.current;
    const hasNewMessage = messages.length > prevCount;
    const isInitialLoad = prevCount === 0;

    if (isInitialLoad || !hasNewMessage || shouldAutoScrollRef.current) {
      scrollToBottom(isInitialLoad ? 'auto' : 'smooth');
    }

    previousMessageCountRef.current = messages.length;
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const reply = replyingTo
      ? { messageId: replyingTo.messageId, senderId: replyingTo.senderId, text: replyingTo.text }
      : undefined;
    onSendMessage(newMessage.trim(), reply);
    setNewMessage('');
    onTypingChange?.(false);
    setReplyingTo(null);
    setShowEmojiPicker(false);
  };

  const handleReply = (msg: ChatMessage) => {
    setReplyingTo(msg);
    inputRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
    onTypingChange?.(true);
    inputRef.current?.focus();
  };

  const handleMute = () => {
    setIsMuted((v) => !v);
    showToast(isMuted ? `Unmuted ${match.user.name}` : `Muted ${match.user.name}`);
    setShowMenu(false);
  };

  const handleBlock = () => {
    showToast(`${match.user.name} has been blocked. You won't see messages from them.`, 'error');
    setShowMenu(false);
    // Navigate away from the chat since user is blocked
    navigate('/chat');
  };

  const handleClearChat = () => {
    if (onClearChat) {
      onClearChat();
    }
    showToast('Chat cleared');
    setShowMenu(false);
  };

  const handleReport = () => {
    showToast(`${match.user.name} has been reported. Our team will review this.`, 'success');
    setShowMenu(false);
  };

  const handleEndChat = async () => {
    if (!onEndChat) {
      showToast('End chat action is unavailable right now.', 'error');
      setShowMenu(false);
      return;
    }
    if (!canEndChatNow) {
      showToast(endChatLockedMessage, 'error');
      setShowMenu(false);
      return;
    }

    setShowEndChatConfirm(false);
    setIsEndingChat(true);
    const result = await onEndChat();
    setIsEndingChat(false);
    setShowMenu(false);

    if (!result.ok) {
      showToast(result.error || 'Could not end chat right now.', 'error');
      return;
    }

    showToast('Chat ended. This conversation is now closed.', 'success');
  };

  const promptEndChat = () => {
    if (!canEndChatNow) {
      showToast(endChatLockedMessage, 'error');
      setShowMenu(false);
      return;
    }
    setShowMenu(false);
    setShowEndChatConfirm(true);
  };

  const handleViewProfile = () => {
    setShowMenu(false);
    navigate(`/match/${match.matchId}`);
  };

  if (chatEndedAt) {
    const endedLabel = new Date(chatEndedAt).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div className="h-full bg-gradient-to-br from-gray-50/80 to-cyan-50/30 backdrop-blur-sm rounded-2xl border border-gray-200/60 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-white/85 rounded-2xl border border-gray-200 shadow-sm p-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 mb-4">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Chat Ended</h3>
          <p className="text-sm text-gray-600 mt-2">
            This conversation was closed on <span className="font-medium">{endedLabel}</span>.
          </p>
          <button
            type="button"
            onClick={() => {
              onBackToConversations?.();
              navigate('/chat');
            }}
            className="mt-5 inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-cyan-600 text-white hover:bg-cyan-700 transition-colors"
          >
            Back to conversations
          </button>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="h-96 bg-gradient-to-br from-gray-50/80 to-cyan-50/30 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center text-center p-6 border border-gray-200/60">
        <div className="bg-white p-5 rounded-2xl mb-4 shadow-md border border-gray-100 relative">
          <Lock className="h-8 w-8 text-gray-400" />
          <div className="absolute -top-1 -right-1 p-1 bg-cyan-600 rounded-full">
            <MapPin className="h-3 w-3 text-white" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-gray-900">Chat Locked</h3>
        <p className="max-w-xs text-gray-500 mt-2 text-sm">
          You need to connect with {match.user.name} and have them accept your request to start chatting.
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs text-cyan-600 font-medium bg-cyan-50 px-4 py-2 rounded-full">
          <Plane className="h-3.5 w-3.5" /> Connect first to plan your trip together
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-md overflow-hidden">
      {/* Toast notification */}
      {(toast || networkError) && (
        <div className={`absolute top-16 left-1/2 -translate-x-1/2 z-[60] text-xs px-4 py-2 rounded-full shadow-lg whitespace-nowrap transform-gpu ${toast ? toastStyleClass : 'bg-rose-600 text-white'} ${networkError ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          <div className="flex items-center gap-2">
            <span>{toast?.message ?? networkError}</span>
            {!toast && networkError && onDismissNetworkError && (
              <button
                type="button"
                onClick={onDismissNetworkError}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
                aria-label="Dismiss chat error"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3.5 border-b border-gray-200/60 flex items-center bg-white/80 backdrop-blur-sm">
        <button type="button" onClick={() => navigate(-1)} className="p-1.5 mr-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <button type="button" onClick={handleViewProfile} className="relative shrink-0 group/avatar">
          <UserAvatar src={match.user.photoUrl} name={match.user.name} className="h-10 w-10 rounded-full group-hover/avatar:ring-2 group-hover/avatar:ring-cyan-400 transition-all text-sm" />
          <span className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white ${connectionMeta.dotClass}`} />
        </button>
        <div className="ml-3 flex-1 min-w-0">
          <button type="button" onClick={handleViewProfile} className="text-sm font-medium text-gray-900 hover:text-cyan-600 transition-colors flex items-center gap-1.5">
            {match.user.name}
            {isMuted && <VolumeX size={12} className="text-gray-400" />}
          </button>
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <span className={`inline-flex h-2 w-2 rounded-full ${isOtherUserTyping ? 'bg-cyan-500' : connectionMeta.dotClass}`} />
            <span>{isOtherUserTyping ? `${match.user.name} is typing...` : connectionMeta.label}</span>
          </p>
        </div>

        {/* Three-dot menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => { setShowMenu((v) => !v); }}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <MoreVertical size={20} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 overflow-hidden">
              {/* View Profile */}
              <button
                onClick={handleViewProfile}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <UserIcon size={16} />
                View Profile
              </button>

              {/* Mute */}
              <button
                onClick={handleMute}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {isMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}
                {isMuted ? 'Unmute' : 'Mute'}
              </button>

              {/* Block */}
              <button
                onClick={handleBlock}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Ban size={16} />
                Block
              </button>

              <div className="border-t border-gray-100 my-1" />

              {/* Clear Chat */}
              <button
                onClick={handleClearChat}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={16} />
                Clear Chat
              </button>

              {canShowEndChat && (
                <>
                  <button
                    onClick={promptEndChat}
                    disabled={isEndingChat}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      isEndingChat
                        ? 'text-gray-400 bg-gray-50 cursor-not-allowed'
                        : !canEndChatNow
                          ? 'text-gray-500 hover:bg-gray-50'
                        : 'text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    <Lock size={16} />
                    {isEndingChat ? 'Ending Chat...' : 'End Chat'}
                  </button>
                  {!isEndingChat && !canEndChatNow && endChatUnlockLabel && (
                    <p className="px-4 py-1 text-[11px] text-gray-500">
                      Only after trip ends: {endChatUnlockLabel}
                    </p>
                  )}
                </>
              )}

              {/* Report */}
              <button
                onClick={handleReport}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Flag size={16} />
                Report
              </button>
            </div>
          )}
        </div>
      </div>

      {connectionMeta.bannerTone && (
        <div className={`px-4 py-2 text-xs font-medium ${connectionBannerClass}`}>
          {connectionMeta.bannerText}
        </div>
      )}

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className={`flex-1 overflow-y-auto p-4 space-y-4 ${theme.bg}`}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        {!hasMessages ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 relative">
              <MessageCircle className="h-7 w-7 text-cyan-600" />
              <div className="absolute -top-1 -right-1 p-1 bg-cyan-500 rounded-full">
                <Plane className="h-3 w-3 text-white" />
              </div>
            </div>
            <h4 className="mt-4 font-bold text-gray-800">No messages yet</h4>
            <p className="text-sm text-gray-500 mt-1">{introText}</p>
            <p className="text-xs text-cyan-600 mt-3 bg-cyan-50 px-4 py-1.5 rounded-full font-medium">Say hello to start planning! ðŸ‘‹</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const currentDayKey = getMessageDayKey(msg.timestamp);
            const previousDayKey = index > 0 ? getMessageDayKey(messages[index - 1].timestamp) : '';
            const showDayDivider = index === 0 || currentDayKey !== previousDayKey;
            const isMe = msg.senderId === currentUser.userId;
            const messageEpoch = toEpoch(msg.timestamp);
            const peerSeenEpoch = toEpoch(peerSeenAt);
            const isSeenByPeer = isMe
              && msg.deliveryStatus === 'sent'
              && Number.isFinite(messageEpoch)
              && Number.isFinite(peerSeenEpoch)
              && messageEpoch <= peerSeenEpoch;
            const deliveryLabel = msg.deliveryStatus === 'sending'
              ? 'Sending...'
              : msg.deliveryStatus === 'failed'
                ? 'Failed'
                : isSeenByPeer
                  ? 'Seen'
                  : 'Delivered';

            return (
              <div key={msg.messageId}>
                {showDayDivider && (
                  <div className="flex justify-center my-1">
                    <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                      {formatMessageDayLabel(msg.timestamp)}
                    </span>
                  </div>
                )}
                <div className={`group flex items-end gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {/* Reply button (appears on hover, left side for other's messages) */}
                  {!isMe && (
                    <button
                      onClick={() => handleReply(msg)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 mb-1"
                      title="Reply"
                    >
                      <Reply size={14} />
                    </button>
                  )}
                  <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${isMe ? `${theme.myBubble} ${theme.myText}` : `${theme.theirBubble} ${theme.theirText} shadow-sm border border-gray-100/60`}`}>
                    {/* Quoted reply preview */}
                    {msg.replyTo && (
                      <div className={`mb-1.5 pb-1.5 border-b text-[11px] ${isMe ? 'border-white/20' : 'border-gray-200'}`}>
                        <div className={`pl-2 border-l-2 ${isMe ? 'border-white/40 text-white/70' : 'border-cyan-500 text-gray-500'}`}>
                          <p className={`font-medium text-[10px] ${isMe ? 'text-white/80' : 'text-gray-600'}`}>
                            {msg.replyTo.senderId === currentUser.userId ? 'You' : match.user.name}
                          </p>
                          <p className={`truncate max-w-[180px] ${isMe ? 'text-white/75' : 'text-gray-500'}`}>{msg.replyTo.text}</p>
                        </div>
                      </div>
                    )}
                    <p className={isMe ? 'text-white' : 'text-gray-800'}>{msg.text}</p>
                    <p className={`text-[10px] mt-1 ${isMe ? theme.accent : 'text-gray-400'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMe && msg.deliveryStatus && (
                        <span className={msg.deliveryStatus === 'failed' ? 'text-rose-200' : isSeenByPeer ? 'text-emerald-200' : ''}>
                          {' '}
                          - {deliveryLabel}
                        </span>
                      )}
                    </p>
                  </div>
                  {/* Reply button (appears on hover, right side for own messages) */}
                  {isMe && (
                    <button
                      onClick={() => handleReply(msg)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 mb-1"
                      title="Reply"
                    >
                      <Reply size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isOtherUserTyping && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-white px-3 py-2 text-xs text-gray-600 shadow-sm">
              <span>{match.user.name} is typing</span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-bounce" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Reply preview bar */}
      {replyingTo && (
        <div className="px-3 pt-2 pb-1 border-t border-gray-200 bg-gray-50 flex items-center gap-2">
          <Reply size={14} className="text-cyan-600 shrink-0" />
          <div className="flex-1 min-w-0 pl-2 border-l-2 border-cyan-500">
            <p className="text-[11px] font-medium text-cyan-700">
              {replyingTo.senderId === currentUser.userId ? 'You' : match.user.name}
            </p>
            <p className="text-xs text-gray-500 truncate">{replyingTo.text}</p>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className={`p-3 border-t border-gray-200/60 bg-white/80 backdrop-blur-sm ${replyingTo ? 'border-t-0' : ''}`}>
        <div className="flex items-center space-x-2">
          {/* Emoji picker */}
          <div className="relative" ref={emojiPickerRef}>
            <button
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
              className={`p-2 rounded-full transition-colors ${
                showEmojiPicker ? 'bg-cyan-100 text-cyan-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              aria-label="Toggle emoji picker"
              aria-expanded={showEmojiPicker}
            >
              <Smile size={20} />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-12 left-0 bg-white rounded-xl shadow-lg border border-gray-200 p-2 w-64 z-50">
                <div className="grid grid-cols-8 gap-1">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="text-xl hover:bg-gray-100 rounded p-1 transition-colors"
                      aria-label={`Insert ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => handleDraftChange(e.target.value)}
            onBlur={() => onTypingChange?.(false)}
            className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm bg-gray-50/50 transition-colors"
            placeholder="Type a message..."
          />
          <button type="submit" className="p-2.5 bg-gradient-to-r from-cyan-600 to-sky-700 text-white rounded-full hover:shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50 transition-all" disabled={!newMessage.trim()} aria-label="Send message">
            <Send size={20} />
          </button>
        </div>
      </form>

      {showEndChatConfirm && (
        <div className="absolute inset-0 z-[70] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-xl p-5">
            <h4 className="text-base font-bold text-gray-900">End this chat?</h4>
            <p className="text-sm text-gray-600 mt-2">
              After ending, this chat will be closed for both travelers and moved out of active conversations.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEndChatConfirm(false)}
                className="px-3.5 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void handleEndChat(); }}
                className="px-3.5 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700"
              >
                Confirm End Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


