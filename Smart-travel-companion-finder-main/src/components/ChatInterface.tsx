import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Lock, MessageCircle, Smile, Reply, X,
  MoreVertical, VolumeX, Volume2, Ban, Trash2, Flag, User as UserIcon, Plane, MapPin, ArrowLeft,
} from 'lucide-react';
import type { ChatMessage, Match, User } from '../types';
import UserAvatar from './UserAvatar';

interface ChatInterfaceProps {
  match: Match;
  currentUser: User;
  messages: ChatMessage[];
  onSendMessage: (text: string, replyTo?: { messageId: string; senderId: string; text: string }) => void;
  onClearChat?: () => void;
}

const EMOJI_LIST = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '👎', '❤️', '🔥', '🎉', '✈️', '🌍', '🏖️', '⛰️', '🗺️', '😢', '😡', '🤝', '✅', '💯', '🙏', '👋', '🤩'];

const CHAT_THEME = {
  myBubble: 'bg-cyan-600',
  myText: 'text-white',
  theirBubble: 'bg-white',
  theirText: 'text-gray-900',
  bg: 'bg-gray-50',
  accent: 'text-cyan-200',
};

export default function ChatInterface({ match, currentUser, messages, onSendMessage, onClearChat }: ChatInterfaceProps) {
  const navigate = useNavigate();
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLocked = match.matchStatus !== 'Matched';
  const hasMessages = messages.length > 0;
  const theme = CHAT_THEME;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

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

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 0);
    }
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const reply = replyingTo
      ? { messageId: replyingTo.messageId, senderId: replyingTo.senderId, text: replyingTo.text }
      : undefined;
    onSendMessage(newMessage.trim(), reply);
    setNewMessage('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
  };

  const handleReply = (msg: ChatMessage) => {
    setReplyingTo(msg);
    inputRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleMute = () => {
    setIsMuted((v) => !v);
    showToast(isMuted ? `Unmuted ${match.user.name}` : `Muted ${match.user.name}`);
    setShowMenu(false);
  };

  const handleBlock = () => {
    showToast(`${match.user.name} has been blocked. You won't see messages from them.`);
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
    showToast(`${match.user.name} has been reported. Our team will review this.`);
    setShowMenu(false);
  };

  const handleViewProfile = () => {
    setShowMenu(false);
    navigate(`/match/${match.matchId}`);
  };

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
      {toast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white text-xs px-4 py-2 rounded-full shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3.5 border-b border-gray-200/60 flex items-center bg-white/80 backdrop-blur-sm">
        <button type="button" onClick={() => navigate(-1)} className="p-1.5 mr-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <button type="button" onClick={handleViewProfile} className="relative shrink-0 group/avatar">
          <UserAvatar src={match.user.photoUrl} name={match.user.name} className="h-10 w-10 rounded-full group-hover/avatar:ring-2 group-hover/avatar:ring-cyan-400 transition-all text-sm" />
          <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white bg-green-400" />
        </button>
        <div className="ml-3 flex-1 min-w-0">
          <button type="button" onClick={handleViewProfile} className="text-sm font-medium text-gray-900 hover:text-cyan-600 transition-colors flex items-center gap-1.5">
            {match.user.name}
            {isMuted && <VolumeX size={12} className="text-gray-400" />}
          </button>
          <p className="text-xs text-gray-500">Available</p>
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

      {/* Messages Container */}
      <div ref={messagesContainerRef} className={`flex-1 overflow-y-auto p-4 space-y-4 ${theme.bg}`} style={{ display: 'flex', flexDirection: 'column' }}>
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
            <p className="text-xs text-cyan-600 mt-3 bg-cyan-50 px-4 py-1.5 rounded-full font-medium">Say hello to start planning! 👋</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser.userId;
            return (
              <div key={msg.messageId} className={`group flex items-end gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
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
            );
          })
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
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm bg-gray-50/50 transition-colors"
            placeholder="Type a message..."
          />
          <button type="submit" className="p-2.5 bg-gradient-to-r from-cyan-600 to-sky-700 text-white rounded-full hover:shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50 transition-all" disabled={!newMessage.trim()} aria-label="Send message">
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}
