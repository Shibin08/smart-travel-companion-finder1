import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, RefreshCw, Plane, Globe } from 'lucide-react';
import {
  buildChatWebSocketUrl,
  fetchConversations,
  fetchUserPublicProfile,
  type BackendChatSocketEvent,
  type BackendConversationSummary,
} from '../utils/apiClient';
import UserAvatar from '../components/UserAvatar';
import { resolvePhoto } from '../utils/photoUtils';
import { ConversationSkeleton } from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';

const TOKEN_STORAGE_KEY = 'tcf_token';
const CHAT_SEEN_STORAGE_KEY = 'tcf_chat_seen_v1';

const normalizeTimestamp = (value: string): string => (value.endsWith('Z') ? value : `${value}Z`);

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

const markConversationSeen = (otherUserId: string, timestamp: string) => {
  const map = readSeenMap();
  map[otherUserId] = normalizeTimestamp(timestamp);
  localStorage.setItem(CHAT_SEEN_STORAGE_KEY, JSON.stringify(map));
};

export default function ConversationsPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<BackendConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoMap, setPhotoMap] = useState<Record<string, string | undefined>>({});
  const [seenMap, setSeenMap] = useState<Record<string, string>>({});
  const photoMapRef = useRef<Record<string, string | undefined>>({});
  const reconnectTimerRef = useRef<number | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);

  useEffect(() => { document.title = 'Conversations - TravelMatch'; }, []);

  useEffect(() => {
    setSeenMap(readSeenMap());
  }, []);

  useEffect(() => {
    photoMapRef.current = photoMap;
  }, [photoMap]);

  const ensurePhoto = async (userId: string) => {
    if (photoMapRef.current[userId]) {
      return;
    }

    try {
      const profile = await fetchUserPublicProfile(userId);
      const resolved = resolvePhoto(profile.photo_url ?? undefined) || undefined;
      setPhotoMap((prev) => (prev[userId] ? prev : { ...prev, [userId]: resolved }));
    } catch {
      // Ignore per-user photo failures.
    }
  };

  const loadConversations = async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setError('Login token not found. Please sign in again.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await fetchConversations(token);
      setConversations(result);

      const photos: Record<string, string | undefined> = {};
      await Promise.all(
        result.map(async (conversation) => {
          try {
            const profile = await fetchUserPublicProfile(conversation.user_id);
            photos[conversation.user_id] = resolvePhoto(profile.photo_url ?? undefined) || undefined;
          } catch {
            // Ignore per-user photo failures.
          }
        }),
      );
      setPhotoMap(photos);
      setSeenMap(readSeenMap());
    } catch {
      setError('Unable to load conversations from backend right now.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      return;
    }

    let disposed = false;

    const connect = () => {
      if (disposed) {
        return;
      }

      const websocket = new WebSocket(buildChatWebSocketUrl(token));
      websocketRef.current = websocket;
      websocket.onmessage = (event) => {
        let payload: BackendChatSocketEvent;
        try {
          payload = JSON.parse(event.data) as BackendChatSocketEvent;
        } catch {
          return;
        }

        if (payload.type !== 'chat_message') {
          return;
        }

        const summary = payload.conversation;
        setConversations((prev) => {
          const next = [
            summary,
            ...prev.filter((conversation) => conversation.user_id !== summary.user_id),
          ];
          next.sort(
            (left, right) =>
              new Date(normalizeTimestamp(right.last_message_timestamp)).getTime()
              - new Date(normalizeTimestamp(left.last_message_timestamp)).getTime(),
          );
          return next;
        });
        void ensurePhoto(summary.user_id);

        if (payload.message.sender_id === user?.userId) {
          markConversationSeen(summary.user_id, payload.message.timestamp);
          setSeenMap(readSeenMap());
        }
      };

      websocket.onclose = () => {
        if (websocketRef.current === websocket) {
          websocketRef.current = null;
        }
        if (!disposed) {
          reconnectTimerRef.current = window.setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
    };
  }, [user?.userId]);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="relative overflow-hidden bg-gradient-to-r from-cyan-700 via-sky-700 to-teal-700 rounded-3xl p-5 sm:p-6 shadow-xl shadow-cyan-500/20 text-white animate-slide-up">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <Plane className="absolute top-3 right-[10%] h-6 w-6 text-white/10 animate-float rotate-[-20deg]" />
          <Globe className="absolute bottom-3 left-[8%] h-7 w-7 text-white/10 animate-float-delayed" />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-3">
              <span className="p-2 bg-white/15 rounded-xl backdrop-blur-sm">
                <MessageCircle className="h-5 w-5" />
              </span>
              Conversations
            </h1>
            <p className="text-cyan-100 text-sm mt-1">Your latest chat history</p>
          </div>
          <button
            onClick={() => void loadConversations()}
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm border border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-200 font-medium text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <ConversationSkeleton />
      ) : error ? (
        <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/60 rounded-2xl p-4 text-sm text-red-700">{error}</div>
      ) : conversations.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl p-8 text-center shadow-sm">
          <div className="inline-flex items-center justify-center p-4 bg-gray-100/80 rounded-2xl">
            <MessageCircle className="h-8 w-8 text-gray-400" />
          </div>
          <p className="mt-3 text-gray-700 font-medium">No conversations yet</p>
          <p className="text-sm text-gray-500 mt-1">Confirm a match and send a message to start chatting.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((item) => {
            const lastMessageTime = normalizeTimestamp(item.last_message_timestamp);
            const seenAt = seenMap[item.user_id];
            const isUnread = !seenAt || new Date(lastMessageTime).getTime() > new Date(seenAt).getTime();

            return (
              <Link
                key={item.user_id}
                to={`/chat/api-${item.user_id}`}
                state={{ userName: item.name }}
                onClick={() => {
                  markConversationSeen(item.user_id, item.last_message_timestamp);
                  setSeenMap(readSeenMap());
                }}
                className="block bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl p-4 hover:border-cyan-300 hover:shadow-md transition-all duration-200 group"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      src={photoMap[item.user_id]}
                      name={item.name}
                      className="h-10 w-10 rounded-full shrink-0"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        {item.name}
                        {isUnread && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-100 text-cyan-700 border border-cyan-200">
                            New
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-1">{item.last_message}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(lastMessageTime).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
