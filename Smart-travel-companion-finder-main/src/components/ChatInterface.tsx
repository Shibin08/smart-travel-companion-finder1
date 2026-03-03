import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Lock, MessageCircle, Smile, Reply, X,
  MoreVertical, VolumeX, Volume2, Ban, Trash2, Flag, Palette, Check, User as UserIcon,
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

type ChatTheme = 'default' | 'ocean' | 'sunset' | 'forest' | 'lavender' | 'midnight';

const CHAT_THEMES: Record<ChatTheme, { label: string; myBubble: string; myText: string; theirBubble: string; theirText: string; bg: string; accent: string; preview: string }> = {
  default:  { label: 'Default',  myBubble: 'bg-teal-600',    myText: 'text-white',   theirBubble: 'bg-white',     theirText: 'text-gray-900', bg: 'bg-gray-50',    accent: 'text-teal-200', preview: 'bg-teal-600' },
  ocean:    { label: 'Ocean',    myBubble: 'bg-blue-600',    myText: 'text-white',   theirBubble: 'bg-blue-50',   theirText: 'text-blue-900', bg: 'bg-blue-50/50', accent: 'text-blue-200', preview: 'bg-blue-600' },
  sunset:   { label: 'Sunset',   myBubble: 'bg-orange-500',  myText: 'text-white',   theirBubble: 'bg-orange-50', theirText: 'text-orange-900', bg: 'bg-orange-50/30', accent: 'text-orange-200', preview: 'bg-orange-500' },
  forest:   { label: 'Forest',   myBubble: 'bg-green-700',   myText: 'text-white',   theirBubble: 'bg-green-50',  theirText: 'text-green-900', bg: 'bg-green-50/30', accent: 'text-green-200', preview: 'bg-green-700' },
  lavender: { label: 'Lavender', myBubble: 'bg-purple-600',  myText: 'text-white',   theirBubble: 'bg-purple-50', theirText: 'text-purple-900', bg: 'bg-purple-50/30', accent: 'text-purple-200', preview: 'bg-purple-600' },
  midnight: { label: 'Midnight', myBubble: 'bg-indigo-600',  myText: 'text-white',   theirBubble: 'bg-slate-100', theirText: 'text-slate-900', bg: 'bg-slate-100/50', accent: 'text-indigo-200', preview: 'bg-indigo-600' },
};

export default function ChatInterface({ match, currentUser, messages, onSendMessage, onClearChat }: ChatInterfaceProps) {
  const navigate = useNavigate();
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [chatTheme, setChatTheme] = useState<ChatTheme>('default');
  const [isMuted, setIsMuted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLocked = match.matchStatus !== 'Matched';
  const hasMessages = messages.length > 0;
  const theme = CHAT_THEMES[chatTheme];

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
        setShowThemePicker(false);
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

  const handleThemeSelect = (t: ChatTheme) => {
    setChatTheme(t);
    setShowThemePicker(false);
    setShowMenu(false);
    showToast(`Theme changed to ${CHAT_THEMES[t].label}`);
  };

  const handleViewProfile = () => {
    setShowMenu(false);
    navigate(`/match/${match.matchId}`);
  };

  if (isLocked) {
    return (
      <div className="h-96 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-center p-6 border border-gray-200">
        <div className="bg-gray-200 p-4 rounded-full mb-4">
          <Lock className="h-8 w-8 text-gray-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">Chat Locked</h3>
        <p className="max-w-xs text-gray-500 mt-2">
          You need to connect with {match.user.name} and have them accept your request to start chatting.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Toast notification */}
      {toast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white text-xs px-4 py-2 rounded-full shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center">
        <button type="button" onClick={handleViewProfile} className="relative shrink-0 group/avatar">
          <UserAvatar src={match.user.photoUrl} name={match.user.name} className="h-10 w-10 rounded-full group-hover/avatar:ring-2 group-hover/avatar:ring-teal-400 transition-all text-sm" />
          <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white bg-green-400" />
        </button>
        <div className="ml-3 flex-1 min-w-0">
          <button type="button" onClick={handleViewProfile} className="text-sm font-medium text-gray-900 hover:text-teal-600 transition-colors flex items-center gap-1.5">
            {match.user.name}
            {isMuted && <VolumeX size={12} className="text-gray-400" />}
          </button>
          <p className="text-xs text-gray-500">Available</p>
        </div>

        {/* Three-dot menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => { setShowMenu((v) => !v); setShowThemePicker(false); }}
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

              <div className="border-t border-gray-100 my-1" />

              {/* Chat Theme */}
              <button
                onClick={() => setShowThemePicker((v) => !v)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Palette size={16} />
                Chat Theme
              </button>

              {/* Theme picker submenu */}
              {showThemePicker && (
                <div className="px-3 pb-2 pt-1">
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(CHAT_THEMES) as ChatTheme[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => handleThemeSelect(key)}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded-lg text-[10px] transition-colors ${
                          chatTheme === key ? 'bg-gray-100 ring-1 ring-gray-300' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full ${CHAT_THEMES[key].preview} flex items-center justify-center`}>
                          {chatTheme === key && <Check size={12} className="text-white" />}
                        </span>
                        <span className="text-gray-600">{CHAT_THEMES[key].label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div ref={messagesContainerRef} className={`flex-1 overflow-y-auto p-4 space-y-4 ${theme.bg}`} style={{ display: 'flex', flexDirection: 'column' }}>
        {!hasMessages ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="bg-white rounded-full p-4 shadow-sm border border-gray-100">
              <MessageCircle className="h-6 w-6 text-teal-600" />
            </div>
            <h4 className="mt-4 font-semibold text-gray-800">No messages yet</h4>
            <p className="text-sm text-gray-500 mt-1">{introText}</p>
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
                <div className={`max-w-xs px-4 py-2 rounded-lg text-sm ${isMe ? `${theme.myBubble} ${theme.myText}` : `${theme.theirBubble} ${theme.theirText} shadow-sm`}`}>
                  {/* Quoted reply preview */}
                  {msg.replyTo && (
                    <div className={`mb-1.5 pb-1.5 border-b text-[11px] ${isMe ? 'border-white/20' : 'border-gray-200'}`}>
                      <div className={`pl-2 border-l-2 ${isMe ? 'border-white/40 text-white/70' : 'border-teal-500 text-gray-500'}`}>
                        <p className="font-medium text-[10px]">
                          {msg.replyTo.senderId === currentUser.userId ? 'You' : match.user.name}
                        </p>
                        <p className="truncate max-w-[180px]">{msg.replyTo.text}</p>
                      </div>
                    </div>
                  )}
                  <p>{msg.text}</p>
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
          <Reply size={14} className="text-teal-600 shrink-0" />
          <div className="flex-1 min-w-0 pl-2 border-l-2 border-teal-500">
            <p className="text-[11px] font-medium text-teal-700">
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
      <form onSubmit={handleSend} className={`p-3 border-t border-gray-200 bg-white ${replyingTo ? 'border-t-0' : ''}`}>
        <div className="flex items-center space-x-2">
          {/* Emoji picker */}
          <div className="relative" ref={emojiPickerRef}>
            <button
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
              className={`p-2 rounded-full transition-colors ${
                showEmojiPicker ? 'bg-teal-100 text-teal-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
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
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            placeholder="Type a message..."
          />
          <button type="submit" className="p-2 bg-teal-600 text-white rounded-full hover:bg-teal-700 disabled:opacity-50" disabled={!newMessage.trim()} aria-label="Send message">
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}
