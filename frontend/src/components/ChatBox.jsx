import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  MessageCircle,
  X,
  Send,
  Shield,
  Lock,
  Wifi,
  WifiOff,
  Check,
  CheckCheck,
  Headphones,
  Sparkles,
  ChevronDown,
  Eye,
  EyeOff,
  Minimize2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import api from '../services/api';

const formatTimestamp = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const formatDateHeader = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Aujourd'hui";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Hier';
  }
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
};

const welcomeMessage = {
  id: 'welcome',
  from: 'support',
  text: 'Bonjour ! 👋 Bienvenue sur le support HDMarket. Comment pouvons-nous vous aider ?',
  createdAt: new Date().toISOString()
};

const MOBILE_CHAT_BREAKPOINT = 768;
const MOBILE_NAV_HEIGHT = 70;
const CHAT_BASE_GAP = 22;
const SCROLL_BUTTON_GAP = 18;
const CHAT_ON_SCROLL_EXTRA = 56;

const ChatBox = () => {
  const { user } = useContext(AuthContext);
  const token = user?.token;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([welcomeMessage]);
  const [templates, setTemplates] = useState([]);
  const [ready, setReady] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isChatHidden, setIsChatHidden] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('hdmarket_chat_hidden');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [isButtonCollapsed, setIsButtonCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('hdmarket_chat_button_collapsed');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const socketRef = useRef(null);
  const lastSentTriggerRef = useRef(null);

  const endpoint = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/api$/, '');

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setReady(false);
      return undefined;
    }
    const socket = io(endpoint, {
      auth: token ? { token } : undefined,
      transports: ['websocket']
    });
    socketRef.current = socket;
    socket.on('message', async (payload) => {
      if (
        payload.from === 'user' &&
        lastSentTriggerRef.current &&
        payload.text === lastSentTriggerRef.current
      ) {
        lastSentTriggerRef.current = null;
        return;
      }
      
      setMessages((prev) => [...prev, payload]);
      if (!isOpen && payload.from === 'support') {
        setUnreadCount((prev) => prev + 1);
      }
      setIsTyping(false);
    });
    
    socket.on('typing', () => setIsTyping(true));
    socket.on('stopTyping', () => setIsTyping(false));
    socket.on('connect', () => setReady(true));
    socket.on('disconnect', () => setReady(false));
    socket.on('connect_error', () => setReady(false));
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, endpoint, isOpen]);

  useEffect(() => {
    if (!token) {
      setTemplates([]);
      return;
    }
    const loadTemplates = async () => {
      try {
        const { data: canned } = await api.get('/chat/templates');
        setTemplates(Array.isArray(canned) ? canned : []);
      } catch (error) {
        console.error('Templates load error:', error);
      }
    };
    loadTemplates();
  }, [token]);

  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_CHAT_BREAKPOINT;
  });
  const [scrollTopButtonVisible, setScrollTopButtonVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < MOBILE_CHAT_BREAKPOINT);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (event) => {
      const visible = Boolean(event?.detail?.visible);
      setScrollTopButtonVisible(visible);
    };
    window.addEventListener('hdmarket:scroll-top-visibility', handler);
    return () => window.removeEventListener('hdmarket:scroll-top-visibility', handler);
  }, []);

  useEffect(() => {
    if (!token) {
      setMessages([welcomeMessage]);
      return;
    }
    const loadHistory = async () => {
      try {
        const { data: history } = await api.get('/chat/history?limit=100');
        setMessages(history.length ? history : [welcomeMessage]);
      } catch (error) {
        console.error('Chat history load error:', error);
      }
    };
    loadHistory();
  }, [token]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 100);
  };

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };

  const sendMessage = async (text) => {
    if (!socketRef.current) return;
    if (!text?.trim()) return;
    
    const messageText = text.trim();
    lastSentTriggerRef.current = messageText;
    
    socketRef.current.emit('sendMessage', {
      text: messageText
    });
    
    const userMessage = {
      id: `local-user-${Date.now()}`,
      from: 'user',
      text: messageText,
      createdAt: new Date().toISOString(),
      status: 'sent'
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
  };

  const sendTemplate = (template) => {
    if (!socketRef.current || !template?.question) return;
    const trigger = template.question.trim();
    lastSentTriggerRef.current = trigger;
    socketRef.current.emit('sendMessage', { text: trigger });
    const responseMessage = {
      id: `local-response-${template._id}-${Date.now()}`,
      from: 'support',
      text: template.response || 'Le support vous répondra bientôt.',
      createdAt: new Date().toISOString()
    };
    const questionMessage = {
      id: `local-user-${template._id}-${Date.now()}`,
      from: 'user',
      text: trigger,
      createdAt: new Date().toISOString(),
      status: 'sent'
    };
    setMessages((prev) => [...prev, questionMessage, responseMessage]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await sendMessage(inputValue);
    }
  };

  const handleHideChat = () => {
    setIsChatHidden(true);
    try {
      localStorage.setItem('hdmarket_chat_hidden', 'true');
    } catch (error) {
      console.error('Failed to save chat hidden state:', error);
    }
  };

  const handleShowChat = () => {
    setIsChatHidden(false);
    setIsOpen(true);
    setIsButtonCollapsed(false);
    try {
      localStorage.removeItem('hdmarket_chat_hidden');
      localStorage.removeItem('hdmarket_chat_button_collapsed');
    } catch (error) {
      console.error('Failed to remove chat hidden state:', error);
    }
  };

  const handleCollapseButton = () => {
    setIsOpen(false);
    setIsButtonCollapsed(true);
    try {
      localStorage.setItem('hdmarket_chat_button_collapsed', 'true');
    } catch (error) {
      console.error('Failed to save button collapsed state:', error);
    }
  };

  const handleExpandButton = () => {
    setIsButtonCollapsed(false);
    try {
      localStorage.removeItem('hdmarket_chat_button_collapsed');
    } catch (error) {
      console.error('Failed to remove button collapsed state:', error);
    }
  };

  const quickTemplates = useMemo(() => templates.slice(0, 4), [templates]);
  const chatBottomOffset = scrollTopButtonVisible
    ? MOBILE_NAV_HEIGHT + SCROLL_BUTTON_GAP + CHAT_ON_SCROLL_EXTRA
    : MOBILE_NAV_HEIGHT + CHAT_BASE_GAP;

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDate = null;

    messages.forEach((message) => {
      const messageDate = new Date(message.createdAt).toDateString();
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ type: 'date', date: message.createdAt });
      }
      groups.push({ type: 'message', ...message });
    });

    return groups;
  }, [messages]);

  if (!token) {
    return null;
  }

  // If chat is hidden, show a small restore button (hideable to the right)
  if (isChatHidden) {
    return (
      <div
        className="fixed z-50 flex items-center transition-all duration-300 ease-out sm:right-6"
        style={{
          bottom: isMobileViewport
            ? `calc(env(safe-area-inset-bottom, 0px) + ${chatBottomOffset}px)`
            : '24px',
          right: isButtonCollapsed ? 0 : '1rem'
        }}
      >
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={isButtonCollapsed ? handleExpandButton : handleShowChat}
            className={`flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/40 ${
              isButtonCollapsed ? 'h-11 w-11 min-w-11 rounded-l-full' : 'px-4 py-2.5 pl-4 pr-12'
            }`}
            title="Afficher le support"
          >
            {unreadCount > 0 && !isButtonCollapsed && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </span>
            )}
            {unreadCount > 0 && isButtonCollapsed && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            {isButtonCollapsed ? (
              <ChevronLeft className="h-5 w-5" />
            ) : (
              <>
                <Eye className="h-4 w-4" />
                <span className="text-sm font-medium">Support</span>
              </>
            )}
          </button>
          {!isButtonCollapsed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCollapseButton();
              }}
              className="absolute -right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow-md transition-colors hover:bg-indigo-700"
              title="Rentrer le bouton"
              aria-label="Rentrer le bouton"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const fabContainerStyle = {
    bottom: isMobileViewport
      ? `calc(env(safe-area-inset-bottom, 0px) + ${chatBottomOffset}px)`
      : '24px',
    right: isButtonCollapsed ? 0 : '1rem'
  };

  return (
    <div
      className="fixed z-50 flex flex-col items-end transition-all duration-300 ease-out sm:right-6"
      style={fabContainerStyle}
    >
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-3 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white shadow-2xl transition-all duration-300 dark:border-gray-700 dark:bg-gray-900">
          {/* Header with Gradient */}
          <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-4 py-4">
            {/* Decorative Elements */}
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -left-6 -bottom-6 h-20 w-20 rounded-full bg-purple-400/20 blur-xl" />

            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                    <Headphones className="h-5 w-5 text-white" />
                  </div>
                  {/* Status indicator */}
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-indigo-600 ${ready ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Support HDMarket</h3>
                  <div className="flex items-center gap-1.5 text-xs text-white/80">
                    {ready ? (
                      <>
                        <Wifi className="h-3 w-3" />
                        <span>En ligne • Réponse rapide</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3 w-3" />
                        <span>Hors ligne</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleHideChat}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/90 bg-white/10 hover:bg-white/20 transition-colors"
                  aria-label="Masquer le chat"
                  title="Masquer le chat"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  <span>Masquer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                  aria-label="Fermer le chat"
                  title="Fermer le chat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Security Badge */}
            <div className="relative mt-3 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              <Lock className="h-3.5 w-3.5 text-emerald-300" />
              <span className="text-xs text-white/90">Conversation sécurisée et chiffrée</span>
            </div>
          </div>

          {/* Messages Area */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="relative flex max-h-[320px] min-h-[200px] flex-col gap-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white p-4 dark:from-gray-800 dark:to-gray-900"
          >
            {groupedMessages.map((item, index) => {
              if (item.type === 'date') {
                return (
                  <div key={`date-${item.date}-${index}`} className="my-3 flex items-center justify-center">
                    <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                      {formatDateHeader(item.date)}
                    </div>
                  </div>
                );
              }

              const isUser = item.from === 'user';
              return (
                <div
                  key={item.id || `msg-${index}-${item.createdAt}`}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-1`}
                >
                  <div
                    className={`group relative max-w-[85%] rounded-2xl px-3.5 py-2 ${
                      isUser
                        ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white'
                        : 'bg-white text-gray-800 shadow-sm ring-1 ring-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700'
                    }`}
                  >
                    {!isUser && (
                      <div className="mb-1 flex items-center gap-1.5">
                        <Shield className="h-3 w-3 text-indigo-500" />
                        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Support</span>
                      </div>
                    )}
                    
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {item.text}
                    </p>
                    <div className={`mt-1 flex items-center gap-1.5 text-[10px] ${isUser ? 'justify-end text-indigo-200' : 'text-gray-400'}`}>
                      <span>{formatTimestamp(item.createdAt)}</span>
                      {isUser && (
                        <span>
                          {item.status === 'read' ? (
                            <CheckCheck className="h-3 w-3 text-emerald-300" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start mb-1">
                <div className="flex items-center gap-1.5 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100 dark:bg-gray-800 dark:ring-gray-700">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="ml-1 text-xs text-gray-500">Support écrit...</span>
                </div>
              </div>
            )}

            {/* Scroll to bottom button */}
            {showScrollDown && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="sticky bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white p-2 shadow-lg ring-1 ring-gray-200 transition-all hover:bg-gray-50 dark:bg-gray-800 dark:ring-gray-700"
              >
                <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </button>
            )}
          </div>

          {/* Quick Replies */}
          {quickTemplates.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                <Sparkles className="h-3 w-3" />
                Réponses rapides
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickTemplates.map((template) => (
                  <button
                    key={template._id}
                    type="button"
                    onClick={() => sendTemplate(template)}
                    className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                  >
                    {template.question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="border-t border-gray-100 p-3 dark:border-gray-700">
            <div className="flex items-end gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Écrivez votre message..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-10 text-sm text-gray-800 placeholder-gray-400 transition-all focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/50"
                  disabled={!ready}
                />
              </div>
              <button
                type="submit"
                disabled={!inputValue.trim() || !ready}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/30 transition-all hover:from-indigo-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none dark:disabled:from-gray-600 dark:disabled:to-gray-700"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
              <Shield className="h-3 w-3" />
              Messages protégés
            </p>
          </form>
        </div>
      )}

      {/* Floating Action Button - hideable to the right */}
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={isButtonCollapsed ? handleExpandButton : () => setIsOpen((prev) => !prev)}
          className={`group relative flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/40 ${
            isButtonCollapsed ? 'h-11 w-11 min-w-11 rounded-l-full' : 'px-5 py-3 pl-5 pr-12'
          }`}
          title={isButtonCollapsed ? 'Afficher le support' : isOpen ? 'Fermer' : 'Support'}
        >
          {unreadCount > 0 && !isButtonCollapsed && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </span>
          )}
          {unreadCount > 0 && isButtonCollapsed && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          {isButtonCollapsed ? (
            <ChevronLeft className="h-5 w-5" />
          ) : (
            <>
              <MessageCircle className={`h-5 w-5 transition-transform duration-300 ${isOpen ? 'rotate-12' : 'group-hover:scale-110'}`} />
              <span className="font-medium">{isOpen ? 'Fermer' : 'Support'}</span>
              <span className={`flex h-2.5 w-2.5 rounded-full ${ready ? 'bg-emerald-400' : 'bg-gray-400'}`}>
                {ready && <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75" />}
              </span>
            </>
          )}
        </button>
        {!isButtonCollapsed && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCollapseButton();
            }}
            className="absolute -right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow-md transition-colors hover:bg-indigo-700"
            title="Rentrer le bouton"
            aria-label="Rentrer le bouton"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatBox;
