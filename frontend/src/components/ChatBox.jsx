import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import AuthContext from '../context/AuthContext';
import api from '../services/api';

const formatTimestamp = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const welcomeMessage = {
  id: 'welcome',
  from: 'support',
  text: 'Bonjour 👋 Nous sommes prêts à vous aider. Posez votre question !',
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
  const listRef = useRef(null);
  const socketRef = useRef(null);
  const lastSentTriggerRef = useRef(null);

  const endpoint = (import.meta.env.VITE_API_URL || 'http://localhost:5010/api').replace(/\/api$/, '');

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
    socket.on('message', (payload) => {
      if (
        payload.from === 'user' &&
        lastSentTriggerRef.current &&
        payload.text === lastSentTriggerRef.current
      ) {
        lastSentTriggerRef.current = null;
        return;
      }
      setMessages((prev) => [...prev, payload]);
    });
    socket.on('connect', () => setReady(true));
    socket.on('disconnect', () => setReady(false));
    socket.on('connect_error', () => setReady(false));
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, endpoint]);

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
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, questionMessage, responseMessage]);
  };

  const quickTemplates = useMemo(() => templates.slice(0, 3), [templates]);
  const chatBottomOffset = scrollTopButtonVisible
    ? MOBILE_NAV_HEIGHT + SCROLL_BUTTON_GAP + CHAT_ON_SCROLL_EXTRA
    : MOBILE_NAV_HEIGHT + CHAT_BASE_GAP;

  if (!token) {
    return null;
  }

  return (
    <div
      className="fixed right-4 z-50 flex flex-col items-end sm:right-8"
      style={{
        bottom: isMobileViewport
          ? `calc(env(safe-area-inset-bottom, 0px) + ${chatBottomOffset}px)`
          : '24px'
      }}
    >
      {isOpen && (
        <div className="mb-3 w-80 max-w-xs rounded-2xl border border-indigo-100 bg-white/95 shadow-xl transition-all duration-200 dark:border-gray-700 dark:bg-gray-900/95">
          <div className="flex items-center justify-between rounded-t-2xl bg-indigo-600 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Support HDMarket</p>
              <p className="text-xs text-indigo-100">Nous répondons en direct.</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-indigo-100 transition hover:text-white"
              aria-label="Fermer le chat"
            >
              ✕
            </button>
          </div>
          <div className="flex max-h-48 flex-col gap-2 overflow-y-auto px-3 py-3 text-sm text-gray-700 dark:text-gray-200" ref={listRef}>
            {messages.length ? (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex flex-col rounded-2xl px-3 py-2 ${
                    message.from === 'user'
                      ? 'self-end bg-indigo-50 text-gray-900 dark:bg-indigo-500/20 dark:text-white'
                      : 'self-start bg-gray-100 text-gray-900 dark:bg-gray-800'
                  }`}
                >
                  <span>{message.text}</span>
                  <span className="mt-1 text-[10px] text-gray-400 dark:text-gray-400">
                    {formatTimestamp(message.createdAt)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500">Envoyez un message pour commencer la conversation.</p>
            )}
          </div>
          {quickTemplates.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pb-2">
              {quickTemplates.map((template) => (
                <button
                  key={template._id}
                  onClick={() => sendTemplate(template)}
                  className="rounded-full border border-indigo-200 px-3 py-1 text-xs text-indigo-600 hover:bg-indigo-50 dark:border-gray-700 dark:text-indigo-200"
                >
                  {template.question}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500"
      >
        Chat
        <span className="text-xs font-semibold">{ready ? 'Live' : 'Offline'}</span>
      </button>
    </div>
  );
};

export default ChatBox;
