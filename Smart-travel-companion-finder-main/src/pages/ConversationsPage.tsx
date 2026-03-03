import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, RefreshCw } from 'lucide-react';
import { fetchConversations, fetchUserPublicProfile, type BackendConversationSummary } from '../utils/apiClient';
import UserAvatar from '../components/UserAvatar';
import { resolvePhoto } from '../utils/photoUtils';
import { ConversationSkeleton } from '../components/Skeleton';

const TOKEN_STORAGE_KEY = 'tcf_token';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<BackendConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoMap, setPhotoMap] = useState<Record<string, string | undefined>>({});

  useEffect(() => { document.title = 'Conversations — Travel Companion Finder'; }, []);

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
      // Fetch photos for each conversation partner
      const photos: Record<string, string | undefined> = {};
      await Promise.all(
        result.map(async (c) => {
          try {
            const profile = await fetchUserPublicProfile(c.user_id);
            photos[c.user_id] = resolvePhoto(profile.photo_url ?? undefined) || undefined;
          } catch { /* ignore */ }
        }),
      );
      setPhotoMap(photos);
    } catch {
      setError('Unable to load conversations from backend right now.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadConversations();
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
          <p className="text-sm text-gray-500">Your latest backend chat history</p>
        </div>
        <button
          onClick={() => void loadConversations()}
          className="inline-flex items-center px-3 py-2 rounded-md text-sm border border-gray-300 bg-white hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </button>
      </div>

      {isLoading ? (
        <ConversationSkeleton />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      ) : conversations.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <MessageCircle className="h-8 w-8 text-gray-400 mx-auto" />
          <p className="mt-3 text-gray-700 font-medium">No conversations yet</p>
          <p className="text-sm text-gray-500 mt-1">Confirm a match and send a message to start chatting.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((item) => (
            <Link
              key={item.user_id}
              to={`/chat/api-${item.user_id}`}
              state={{ userName: item.name }}
              className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-300 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    src={photoMap[item.user_id]}
                    name={item.name}
                    className="h-10 w-10 rounded-full shrink-0"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-1">{item.last_message}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(item.last_message_timestamp.endsWith('Z') ? item.last_message_timestamp : item.last_message_timestamp + 'Z').toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
