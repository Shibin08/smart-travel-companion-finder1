import { useState, useEffect, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import ChatInterface from '../components/ChatInterface';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { mockUsers } from '../data/mockUsers';
import type { Match, User } from '../types';
import { fetchUserPublicProfile } from '../utils/apiClient';
import { useRealtimeConversation } from '../hooks/useRealtimeConversation';

const CHAT_SEEN_STORAGE_KEY = 'tcf_chat_seen_v1';

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

const markConversationSeen = (otherUserId: string, timestamp?: string) => {
  const map = readSeenMap();
  map[otherUserId] = timestamp ?? new Date().toISOString();
  localStorage.setItem(CHAT_SEEN_STORAGE_KEY, JSON.stringify(map));
};

export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const { getMatchById, endChat } = useApp();
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [chatEndedAt, setChatEndedAt] = useState<string | null>(null);

  useEffect(() => { document.title = 'Chat — TravelMatch'; }, []);

  useEffect(() => {
    if (!chatId || !user) return;

    let cancelled = false;
    setChatEndedAt(null);

    const inferredUserId = chatId.startsWith('api-') ? chatId.replace('api-', '') : chatId;
    const userData = mockUsers.find((candidate) => candidate.userId === inferredUserId);
    const fallbackName = (location.state as { userName?: string } | null)?.userName ?? inferredUserId;

    const buildFallbackUser = (name: string, photoUrl?: string): User => ({
      userId: inferredUserId,
      name,
      email: '',
      age: 0,
      gender: 'Other',
      verificationStatus: 'Pending',
      bio: 'Backend conversation contact',
      photoUrl,
      homeCountry: 'Unknown',
      currentCity: 'Unknown',
      profile: {
        budget: 'Medium',
        travelStyle: 'Leisure',
        interests: ['Travel'],
      },
      preferences: {
        notifications: true,
        locationSharing: false,
        publicProfile: true,
      },
      stats: {
        tripsCompleted: 0,
        reviewsReceived: 0,
        averageRating: 0,
        responseRate: 0,
      },
    });

    if (userData) {
      setOtherUser(userData);
    } else {
      // Set fallback immediately, then try to fetch photo from backend
      setOtherUser(buildFallbackUser(fallbackName));
      void fetchUserPublicProfile(inferredUserId)
        .then((profile) => {
          if (cancelled) return;
          const photoUrl = profile.photo_url
            ? (profile.photo_url.startsWith('http') ? profile.photo_url : `${import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000'}${profile.photo_url}`)
            : undefined;
          setOtherUser(buildFallbackUser(profile.name || fallbackName, photoUrl));
        })
        .catch(() => {
          // keep fallback user without photo
        });
    }

    return () => { cancelled = true; };
  }, [chatId, user?.userId]);

  const {
    messages,
    sendMessage,
    setTypingState,
    connectionStatus,
    isOtherUserTyping,
    chatError,
    clearChatError,
  } = useRealtimeConversation({
    chatId: chatId ?? '',
    otherUserId: otherUser?.userId ?? '',
    currentUserId: user?.userId,
    enabled: Boolean(chatId && user && otherUser && !chatEndedAt),
  });

  useEffect(() => {
    if (!otherUser?.userId) return;
    const lastMessageTimestamp = messages[messages.length - 1]?.timestamp;
    markConversationSeen(otherUser.userId, lastMessageTimestamp ?? new Date().toISOString());
  }, [messages, otherUser?.userId]);

  const chatMatch = useMemo<Match | null>(() => {
    if (!otherUser || !chatId) return null;

    const existing = getMatchById(chatId);
    if (existing) {
      return existing;
    }

    return {
      matchId: chatId,
      tripId: 'chat-direct',
      user: otherUser,
      score: 75,
      matchStatus: 'Pending',
      compatibilityScore: {
        overall: 75,
        components: {
          interestSimilarity: 0.75,
          budgetCompatibility: 0.75,
          travelStyleMatch: 0.75,
          personalityMatch: 0.75,
          scheduleOverlap: 0.75,
          locationProximity: 0.75,
          verificationBonus: 0,
        },
        strengths: [],
        concerns: [],
        recommendations: [],
      },
      matchDetails: {
        interestMatch: otherUser.profile.interests,
        budgetCompatibility: 'Medium',
        dateOverlap: true,
        destinationMatch: true,
        styleMatch: true,
        personalityCompatibility: 'Medium',
        languageMatch: true,
        locationProximity: otherUser.currentCity === user?.currentCity ? 'Same City' : 'Different',
      },
      chatEnabled: false,
      createdAt: new Date().toISOString(),
    };
  }, [chatId, otherUser, user?.currentCity, getMatchById]);

  const handleSendMessage = (text: string, replyTo?: { messageId: string; senderId: string; text: string }) => {
    if (!user || !chatId || !otherUser || chatEndedAt) return;
    sendMessage(text, replyTo);
  };

  const handleEndChat = async () => {
    if (!chatMatch) {
      return { ok: false, error: 'Unable to resolve chat context.' };
    }

    const result = await endChat(chatMatch.matchId);
    if (result.ok) {
      setChatEndedAt(new Date().toISOString());
    }
    return result;
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl shadow-sm p-8 max-w-sm mx-auto">
          <p className="text-gray-500">Please log in to access chat.</p>
        </div>
      </div>
    );
  }

  if (!otherUser) {
    return (
      <div className="text-center py-12">
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl shadow-sm p-8 max-w-sm mx-auto">
          <p className="text-gray-500">Chat not found or you don't have permission to access it.</p>
        </div>
      </div>
    );
  }

  if (!chatMatch) {
    return (
      <div className="text-center py-12">
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl shadow-sm p-8 max-w-sm mx-auto">
          <p className="text-gray-500">Unable to load chat context.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)]">
      <ChatInterface
        match={chatMatch}
        currentUser={user}
        messages={messages}
        onSendMessage={handleSendMessage}
        onTypingChange={setTypingState}
        onEndChat={handleEndChat}
        chatEndedAt={chatEndedAt}
        connectionStatus={connectionStatus}
        isOtherUserTyping={isOtherUserTyping}
        networkError={chatError}
        onDismissNetworkError={clearChatError}
        onBackToConversations={() => {
          if (otherUser?.userId) {
            markConversationSeen(otherUser.userId, chatEndedAt ?? new Date().toISOString());
          }
        }}
      />
    </div>
  );
}
