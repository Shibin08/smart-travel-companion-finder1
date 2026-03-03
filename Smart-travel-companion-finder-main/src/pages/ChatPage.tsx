import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import ChatInterface from '../components/ChatInterface';
import { useAuth } from '../context/AuthContext';
import { mockUsers } from '../data/mockUsers';
import type { ChatMessage, Match, User } from '../types';
import { fetchConversation, fetchUserPublicProfile, sendChatMessage } from '../utils/apiClient';
import { ChatManager } from '../utils/chatManager';

const TOKEN_STORAGE_KEY = 'tcf_token';

export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => { document.title = 'Chat — Travel Companion Finder'; }, []);

  const getLocalMessages = useCallback((id: string, limit: number) => {
    return ChatManager.getInstance().getChatMessages(id, limit);
  }, []);

  useEffect(() => {
    if (!chatId || !user) return;

    // Prevent duplicate loads for the same chatId
    loadedRef.current = false;

    const inferredUserId = chatId.startsWith('api-') ? chatId.replace('api-', '') : chatId;
    const userData = mockUsers.find((candidate) => candidate.userId === inferredUserId);
    const fallbackName = (location.state as { userName?: string } | null)?.userName ?? inferredUserId;

    const buildFallbackUser = (name: string, photoUrl?: string): User => ({
      userId: inferredUserId,
      name,
      email: `${inferredUserId}@example.com`,
      age: 0,
      gender: 'Other',
      verificationStatus: 'Pending',
      bio: 'Backend conversation contact',
      photoUrl,
      homeCountry: 'Unknown',
      currentCity: 'Unknown',
      profile: {
        budget: 'Medium',
        travelStyle: 'Standard',
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
          const photoUrl = profile.photo_url
            ? (profile.photo_url.startsWith('http') ? profile.photo_url : `${import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000'}${profile.photo_url}`)
            : undefined;
          setOtherUser(buildFallbackUser(profile.name || fallbackName, photoUrl));
        })
        .catch(() => {
          // keep fallback user without photo
        });
    }

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setMessages(getLocalMessages(chatId, 50));
      loadedRef.current = true;
      return;
    }

    void (async () => {
      try {
        const backendMessages = await fetchConversation(token, inferredUserId);
        if (!loadedRef.current) {
          setMessages(
            backendMessages.map((message) => ({
              messageId: `api-${message.message_id}`,
              chatId,
              senderId: message.sender_id,
              text: message.message_text,
              timestamp: message.timestamp.endsWith('Z') ? message.timestamp : message.timestamp + 'Z',
              messageType: 'text',
              isEdited: false,
              readBy: [message.sender_id],
              reactions: [],
            })),
          );
          loadedRef.current = true;
        }
      } catch {
        if (!loadedRef.current) {
          setMessages(getLocalMessages(chatId, 50));
          loadedRef.current = true;
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, user?.userId]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    if (!chatId || !user) return;

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return;

    const inferredUserId = chatId.startsWith('api-') ? chatId.replace('api-', '') : chatId;

    const interval = setInterval(async () => {
      try {
        const backendMessages = await fetchConversation(token, inferredUserId);
        const mapped = backendMessages.map((message) => ({
          messageId: `api-${message.message_id}`,
          chatId,
          senderId: message.sender_id,
          text: message.message_text,
          timestamp: message.timestamp.endsWith('Z') ? message.timestamp : message.timestamp + 'Z',
          messageType: 'text' as const,
          isEdited: false,
          readBy: [message.sender_id],
          reactions: [] as { emoji: string; userId: string }[],
        }));
        setMessages((prev) => {
          // Only update if there are truly new messages
          if (mapped.length !== prev.length) return mapped;
          const lastNew = mapped[mapped.length - 1]?.messageId;
          const lastOld = prev[prev.length - 1]?.messageId;
          return lastNew !== lastOld ? mapped : prev;
        });
      } catch {
        // silently skip polling failures
      }
    }, 5000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, user?.userId]);

  const chatMatch = useMemo<Match | null>(() => {
    if (!otherUser || !chatId) return null;

    return {
      matchId: chatId,
      tripId: 'chat-direct',
      user: otherUser,
      score: 75,
      matchStatus: 'Matched',
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
      chatEnabled: true,
      createdAt: new Date().toISOString(),
    };
  }, [chatId, otherUser, user?.currentCity]);

  const handleSendMessage = (text: string, replyTo?: { messageId: string; senderId: string; text: string }) => {
    if (!user || !chatId || !otherUser) return;

    const optimistic: ChatMessage = {
      messageId: `${chatId}-${Date.now()}`,
      chatId,
      senderId: user.userId,
      text,
      timestamp: new Date().toISOString(),
      messageType: 'text',
      isEdited: false,
      readBy: [user.userId],
      reactions: [],
      replyTo,
    };

    setMessages((prev) => [...prev, optimistic]);

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return;

    void sendChatMessage(token, otherUser.userId, text)
      .then((saved) => {
        setMessages((prev) =>
          prev.map((message) =>
            message.messageId === optimistic.messageId
              ? {
                  ...message,
                  messageId: `api-${saved.message_id}`,
                  timestamp: saved.timestamp.endsWith('Z') ? saved.timestamp : saved.timestamp + 'Z',
                }
              : message,
          ),
        );
      })
      .catch(() => {
        // keep optimistic message if backend send fails
      });
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Please log in to access chat.</p>
      </div>
    );
  }

  if (!otherUser) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Chat not found or you don't have permission to access it.</p>
      </div>
    );
  }

  if (!chatMatch) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Unable to load chat context.</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)]">
      <ChatInterface match={chatMatch} currentUser={user} messages={messages} onSendMessage={handleSendMessage} onClearChat={() => setMessages([])} />
    </div>
  );
}
