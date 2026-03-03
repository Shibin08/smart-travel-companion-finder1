import type { Chat, ChatMessage } from '../types';
import { devLog } from './devLogger';

export class ChatManager {
  private static instance: ChatManager;
  private chats: Map<string, Chat> = new Map();
  private messages: Map<string, ChatMessage[]> = new Map();
  private typingUsers: Map<string, Set<string>> = new Map();

  static getInstance(): ChatManager {
    if (!ChatManager.instance) {
      ChatManager.instance = new ChatManager();
    }
    return ChatManager.instance;
  }

  async createChat(
    participants: string[],
    type: 'match',
    matchId?: string
  ): Promise<Chat> {
    const chatId = `chat-${Date.now()}-${participants.join('-')}`;
    
    const chat: Chat = {
      chatId,
      participants,
      matchId,
      type,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    this.chats.set(chatId, chat);
    this.messages.set(chatId, []);
    this.typingUsers.set(chatId, new Set());

    return chat;
  }

  async sendMessage(
    chatId: string,
    senderId: string,
    text: string,
    messageType: ChatMessage['messageType'] = 'text'
  ): Promise<ChatMessage> {
    const chat = this.chats.get(chatId);
    if (!chat || !chat.participants.includes(senderId)) {
      throw new Error('Chat not found or user not in chat');
    }

    const message: ChatMessage = {
      messageId: `msg-${Date.now()}-${senderId}`,
      chatId,
      senderId,
      text,
      timestamp: new Date().toISOString(),
      messageType,
      isEdited: false,
      readBy: [senderId], // Sender has read their own message
      reactions: [],
    };

    const chatMessages = this.messages.get(chatId) || [];
    chatMessages.push(message);
    this.messages.set(chatId, chatMessages);

    // Update last message in chat
    chat.lastMessage = message;

    // Simulate real-time delivery
    this.simulateMessageDelivery(message, chat.participants);

    return message;
  }

  private simulateMessageDelivery(message: ChatMessage, participants: string[]): void {
    // In production, this would use WebSockets or Server-Sent Events
    devLog(`📨 Message delivered to chat ${message.chatId}:`);
    devLog(`   From: ${message.senderId}`);
    devLog(`   To: ${participants.filter(p => p !== message.senderId).join(', ')}`);
    devLog(`   Message: ${message.text}`);
  }

  async editMessage(
    chatId: string,
    messageId: string,
    senderId: string,
    newText: string
  ): Promise<ChatMessage | null> {
    const chatMessages = this.messages.get(chatId);
    if (!chatMessages) return null;

    const message = chatMessages.find(m => m.messageId === messageId);
    if (!message || message.senderId !== senderId) return null;

    message.text = newText;
    message.isEdited = true;
    message.editedAt = new Date().toISOString();

    // Update last message if this was the last message
    const chat = this.chats.get(chatId);
    if (chat && chat.lastMessage?.messageId === messageId) {
      chat.lastMessage = message;
    }

    return message;
  }

  async deleteMessage(chatId: string, messageId: string, senderId: string): Promise<boolean> {
    const chatMessages = this.messages.get(chatId);
    if (!chatMessages) return false;

    const messageIndex = chatMessages.findIndex(m => m.messageId === messageId);
    if (messageIndex === -1) return false;

    const message = chatMessages[messageIndex];
    if (message.senderId !== senderId) return false;

    // Soft delete by replacing with placeholder
    chatMessages[messageIndex] = {
      ...message,
      text: 'This message has been deleted',
      messageType: 'text',
      isEdited: true,
      editedAt: new Date().toISOString(),
    };

    return true;
  }

  async markAsRead(chatId: string, userId: string): Promise<void> {
    const chatMessages = this.messages.get(chatId);
    if (!chatMessages) return;

    chatMessages.forEach(message => {
      if (!message.readBy.includes(userId)) {
        message.readBy.push(userId);
      }
    });
  }

  async addReaction(
    chatId: string,
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<ChatMessage | null> {
    const chatMessages = this.messages.get(chatId);
    if (!chatMessages) return null;

    const message = chatMessages.find(m => m.messageId === messageId);
    if (!message) return null;

    // Remove existing reaction from this user
    message.reactions = message.reactions.filter(r => r.userId !== userId);
    
    // Add new reaction
    message.reactions.push({ emoji, userId });

    return message;
  }

  async removeReaction(
    chatId: string,
    messageId: string,
    userId: string
  ): Promise<ChatMessage | null> {
    const chatMessages = this.messages.get(chatId);
    if (!chatMessages) return null;

    const message = chatMessages.find(m => m.messageId === messageId);
    if (!message) return null;

    message.reactions = message.reactions.filter(r => r.userId !== userId);

    return message;
  }

  setTyping(chatId: string, userId: string, isTyping: boolean): void {
    const typingUsers = this.typingUsers.get(chatId) || new Set();
    
    if (isTyping) {
      typingUsers.add(userId);
    } else {
      typingUsers.delete(userId);
    }

    this.typingUsers.set(chatId, typingUsers);
  }

  getTypingUsers(chatId: string, currentUserId: string): string[] {
    const typingUsers = this.typingUsers.get(chatId) || new Set();
    return Array.from(typingUsers).filter(userId => userId !== currentUserId);
  }

  getChat(chatId: string): Chat | null {
    return this.chats.get(chatId) || null;
  }

  getChatMessages(chatId: string, limit = 50): ChatMessage[] {
    const messages = this.messages.get(chatId) || [];
    return messages.slice(-limit);
  }

  getUserChats(userId: string): Chat[] {
    return Array.from(this.chats.values()).filter(chat => 
      chat.participants.includes(userId) && chat.isActive
    );
  }

  getUnreadCount(chatId: string, userId: string): number {
    const messages = this.messages.get(chatId) || [];
    return messages.filter(message => 
      !message.readBy.includes(userId) && message.senderId !== userId
    ).length;
  }

  getTotalUnreadCount(userId: string): number {
    const userChats = this.getUserChats(userId);
    return userChats.reduce((total, chat) => 
      total + this.getUnreadCount(chat.chatId, userId), 0
    );
  }

  async sendLocationMessage(
    chatId: string,
    senderId: string,
    latitude: number,
    longitude: number,
    address?: string
  ): Promise<ChatMessage> {
    const locationText = `📍 Location: ${address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}`;
    return await this.sendMessage(chatId, senderId, locationText, 'location');
  }

  async sendImageMessage(
    chatId: string,
    senderId: string,
    imageUrl: string,
    caption?: string
  ): Promise<ChatMessage> {
    const imageText = caption ? `🖼️ ${caption}\n${imageUrl}` : `🖼️ Image: ${imageUrl}`;
    return await this.sendMessage(chatId, senderId, imageText, 'image');
  }

  searchMessages(chatId: string, query: string): ChatMessage[] {
    const messages = this.messages.get(chatId) || [];
    const normalizedQuery = query.toLowerCase();
    
    return messages.filter(message => 
      message.text.toLowerCase().includes(normalizedQuery)
    );
  }

  getChatParticipants(chatId: string): string[] {
    const chat = this.chats.get(chatId);
    return chat ? chat.participants : [];
  }

  isUserInChat(chatId: string, userId: string): boolean {
    const chat = this.chats.get(chatId);
    return chat ? chat.participants.includes(userId) : false;
  }
}

// React hook for chat functionality
export const useChat = () => {
  const chatManager = ChatManager.getInstance();

  const createChat = async (
    participants: string[],
    type: 'match',
    matchId?: string
  ) => {
    return await chatManager.createChat(participants, type, matchId);
  };

  const sendMessage = async (chatId: string, senderId: string, text: string) => {
    return await chatManager.sendMessage(chatId, senderId, text);
  };

  const editMessage = async (chatId: string, messageId: string, senderId: string, newText: string) => {
    return await chatManager.editMessage(chatId, messageId, senderId, newText);
  };

  const deleteMessage = async (chatId: string, messageId: string, senderId: string) => {
    return await chatManager.deleteMessage(chatId, messageId, senderId);
  };

  const markAsRead = async (chatId: string, userId: string) => {
    await chatManager.markAsRead(chatId, userId);
  };

  const addReaction = async (chatId: string, messageId: string, userId: string, emoji: string) => {
    return await chatManager.addReaction(chatId, messageId, userId, emoji);
  };

  const sendLocation = async (chatId: string, senderId: string, latitude: number, longitude: number, address?: string) => {
    return await chatManager.sendLocationMessage(chatId, senderId, latitude, longitude, address);
  };

  const getChat = (chatId: string) => {
    return chatManager.getChat(chatId);
  };

  const getMessages = (chatId: string, limit = 50) => {
    return chatManager.getChatMessages(chatId, limit);
  };

  const getUserChats = (userId: string) => {
    return chatManager.getUserChats(userId);
  };

  const getUnreadCount = (chatId: string, userId: string) => {
    return chatManager.getUnreadCount(chatId, userId);
  };

  const getTotalUnreadCount = (userId: string) => {
    return chatManager.getTotalUnreadCount(userId);
  };

  return {
    createChat,
    sendMessage,
    editMessage,
    deleteMessage,
    markAsRead,
    addReaction,
    sendLocation,
    getChat,
    getMessages,
    getUserChats,
    getUnreadCount,
    getTotalUnreadCount,
  };
};
