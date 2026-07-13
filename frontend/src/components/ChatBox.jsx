import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  X,
  Shield,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  RotateCcw,
  ArrowLeft,
  ChevronDown,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import api from '../services/api';

const MOBILE_CHAT_BREAKPOINT = 768;
const MOBILE_NAV_HEIGHT = 70;
const CHAT_BASE_GAP = 22;
const SCROLL_BUTTON_GAP = 18;
const CHAT_ON_SCROLL_EXTRA = 56;

const welcomeMessage = {
  id: 'welcome',
  from: 'assistant',
  text: "Bonjour. Je suis l'assistant HDMarket. Choisissez un sujet pour avancer rapidement.",
  createdAt: new Date().toISOString(),
  kind: 'info'
};

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

  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return 'Hier';
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
};

const normalizeNode = (node = {}) => ({
  id: String(node.id || node._id || ''),
  title: String(node.title || node.question || '').trim(),
  type: String(node.type || 'question'),
  content: String(node.content || node.response || '').trim(),
  category: String(node.category || '').trim(),
  entityType: String(node.entityType || '').trim(),
  entityId: String(node.entityId || '').trim(),
  metadata: node.metadata && typeof node.metadata === 'object' ? node.metadata : {},
  childrenCount: Number(node.childrenCount || 0),
  priority: Number(node.priority || 0),
  order: Number(node.order || 0)
});

const getNodeLink = (node, user) => {
  const metadataPath = String(node?.metadata?.path || node?.metadata?.url || '').trim();
  if (metadataPath) return metadataPath;

  const entityId = String(node?.entityId || '').trim();
  const entityType = String(node?.entityType || '').trim().toLowerCase();
  if (!entityId && entityType !== 'payment') return '';

  if (entityType === 'order') return `/orders/detail/${entityId}`;
  if (entityType === 'product') return `/product/${entityId}`;
  if (entityType === 'shop') return `/shop/${entityId}`;
  if (entityType === 'dispute') {
    if (user?.role === 'admin' || user?.role === 'founder' || user?.role === 'manager' || user?.canManageComplaints) return '/admin/complaints';
    if (user?.accountType === 'shop') return '/seller/disputes';
    return '/reclamations';
  }
  if (entityType === 'payment') {
    if (user?.role === 'admin' || user?.role === 'founder' || user?.role === 'manager' || user?.canVerifyPayments) return '/admin/payment-verification';
    return '/orders';
  }
  if (entityType === 'external_link') return entityId;
  return '';
};

const buildMessagesFromSteps = (steps = []) => {
  const base = [welcomeMessage];
  steps.forEach((step, index) => {
    base.push({
      id: `user-step-${step.id}-${index}`,
      from: 'user',
      text: step.title,
      createdAt: new Date().toISOString(),
      kind: 'selection'
    });
    if (step.content) {
      base.push({
        id: `assistant-step-${step.id}-${index}`,
        from: 'assistant',
        text: step.content,
        createdAt: new Date().toISOString(),
        kind: 'answer',
        link: getNodeLink(step, null)
      });
    }
  });
  return base;
};

const ChatBox = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const token = user?.token;
  const userId = user?._id || user?.id || '';

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([welcomeMessage]);
  const [options, setOptions] = useState([]);
  const [stepStack, setStepStack] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [error, setError] = useState('');
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [contextHint, setContextHint] = useState(null);

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
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_CHAT_BREAKPOINT;
  });
  const [scrollTopButtonVisible, setScrollTopButtonVisible] = useState(false);
  const listRef = useRef(null);
  const initializedRef = useRef(false);

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
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, options, isOpen]);

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

  const loadRootOptions = async () => {
    const { data } = await api.get('/chat/templates/root');
    const rootNodes = Array.isArray(data?.templates) ? data.templates.map(normalizeNode) : [];
    setOptions(rootNodes);
    setContextHint(data?.context || null);
    return rootNodes;
  };

  const loadChildrenOptions = async (parentId) => {
    const { data } = await api.get(`/chat/templates/${parentId}`);
    const childNodes = Array.isArray(data?.templates) ? data.templates.map(normalizeNode) : [];
    setOptions(childNodes);
    return childNodes;
  };

  const pushSessionUpdate = async (payload = {}) => {
    if (!sessionId) return;
    try {
      await api.patch('/chat/session/update', {
        sessionId,
        ...payload
      });
    } catch {
      // keep UI flow even if session update fails
    }
  };

  const initializeGuidedChat = async ({ forceRestart = false } = {}) => {
    if (!token || !userId) return;
    setLoadingSession(true);
    setError('');
    try {
      const { data: startData } = await api.post('/chat/session/start', { resume: !forceRestart });
      const nextSessionId = String(startData?.session?._id || startData?.session?.id || '');
      setSessionId(nextSessionId);

      const { data: sessionData } = await api.get(`/chat/session/${userId}`);
      const pathNodesRaw = Array.isArray(sessionData?.session?.path) ? sessionData.session.path : [];
      const pathNodes = pathNodesRaw.map(normalizeNode).filter((node) => node.id);

      if (pathNodes.length > 0 && !forceRestart) {
        setStepStack(pathNodes);
        setMessages(buildMessagesFromSteps(pathNodes));
        const lastNode = pathNodes[pathNodes.length - 1];
        const children = await loadChildrenOptions(lastNode.id);
        if (!children.length) {
          await pushSessionUpdate({ completed: true, lastStepId: lastNode.id });
        }
      } else {
        setStepStack([]);
        setMessages([welcomeMessage]);
        await loadRootOptions();
        if (nextSessionId) {
          await pushSessionUpdate({ completed: false, lastStepId: null });
        }
      }
      initializedRef.current = true;
    } catch (err) {
      setError(err?.response?.data?.message || "Impossible d'initialiser l'assistant.");
    } finally {
      setLoadingSession(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !token || !userId) return;
    if (initializedRef.current) return;
    initializeGuidedChat().catch(() => {});
  }, [isOpen, token, userId]);

  useEffect(() => {
    if (!token) {
      setMessages([welcomeMessage]);
      setOptions([]);
      setStepStack([]);
      setSessionId('');
      setContextHint(null);
      initializedRef.current = false;
    }
  }, [token]);

  const handleSelectOption = async (node) => {
    if (!node?.id || loading) return;
    setLoading(true);
    setError('');
    try {
      const normalized = normalizeNode(node);
      const nextStack = [...stepStack, normalized];
      setStepStack(nextStack);
      setMessages(buildMessagesFromSteps(nextStack));
      await pushSessionUpdate({ lastStepId: normalized.id, completed: false });

      const children = await loadChildrenOptions(normalized.id);
      if (!children.length) {
        await pushSessionUpdate({ lastStepId: normalized.id, completed: true });
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Impossible de charger l'étape suivante.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = async () => {
    if (loading || !stepStack.length) return;
    setLoading(true);
    setError('');
    try {
      const nextStack = stepStack.slice(0, -1);
      setStepStack(nextStack);
      setMessages(buildMessagesFromSteps(nextStack));

      if (!nextStack.length) {
        await loadRootOptions();
        await pushSessionUpdate({ lastStepId: null, completed: false });
      } else {
        const previous = nextStack[nextStack.length - 1];
        await loadChildrenOptions(previous.id);
        await pushSessionUpdate({ lastStepId: previous.id, completed: false });
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Impossible de revenir à l’étape précédente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    setOptions([]);
    setStepStack([]);
    setMessages([welcomeMessage]);
    initializedRef.current = false;
    await initializeGuidedChat({ forceRestart: true });
  };

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

  const chatBottomOffset = scrollTopButtonVisible
    ? MOBILE_NAV_HEIGHT + SCROLL_BUTTON_GAP + CHAT_ON_SCROLL_EXTRA
    : MOBILE_NAV_HEIGHT + CHAT_BASE_GAP;

  const hasActionLink = stepStack.length ? getNodeLink(stepStack[stepStack.length - 1], user) : '';
  const noOptions = !loadingSession && !loading && options.length === 0;

  const openLink = (target) => {
    const link = String(target || '').trim();
    if (!link) return;
    if (/^https?:\/\//i.test(link)) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(link);
  };

  const handleHideChat = () => {
    setIsChatHidden(true);
    try {
      localStorage.setItem('hdmarket_chat_hidden', 'true');
    } catch {
      // noop
    }
  };

  const handleShowChat = () => {
    setIsChatHidden(false);
    setIsOpen(true);
    setIsButtonCollapsed(false);
    try {
      localStorage.removeItem('hdmarket_chat_hidden');
      localStorage.removeItem('hdmarket_chat_button_collapsed');
    } catch {
      // noop
    }
  };

  const handleCollapseButton = () => {
    setIsOpen(false);
    setIsButtonCollapsed(true);
    try {
      localStorage.setItem('hdmarket_chat_button_collapsed', 'true');
    } catch {
      // noop
    }
  };

  const handleExpandButton = () => {
    setIsButtonCollapsed(false);
    try {
      localStorage.removeItem('hdmarket_chat_button_collapsed');
    } catch {
      // noop
    }
  };

  if (!token) return null;

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
            className={`flex items-center justify-center gap-2 rounded-full bg-[#e85d00] text-white shadow-[0_16px_40px_rgba(255,106,0,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#f05f00] active:translate-y-0 ${
              isButtonCollapsed ? 'h-11 w-11 min-w-11 rounded-l-full' : 'px-4 py-2.5 pl-4 pr-12'
            }`}
            title="Afficher l'assistant"
          >
            {isButtonCollapsed ? (
              <ChevronLeft className="h-5 w-5" />
            ) : (
              <>
                <Eye className="h-4 w-4" />
                <span className="text-sm font-medium">Assistant</span>
              </>
            )}
          </button>
          {!isButtonCollapsed && (
            <button
              type="button"
            onClick={(event) => {
                event.stopPropagation();
                handleCollapseButton();
              }}
              className="absolute -right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#111827] text-white shadow-md transition-colors hover:bg-[#e85d00]"
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
      {isOpen && (
        <div className="mb-3 w-[380px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-[0_24px_70px_rgba(17,24,39,0.20)] ring-1 ring-white/80 dark:border-orange-950/60 dark:bg-neutral-950">
          <div className="sticky top-0 z-10 border-b border-gray-200/80 bg-gradient-to-br from-[#e85d00] via-[#ff7a1a] to-[#f04423] px-4 pb-3 pt-4 text-white dark:border-orange-950/60">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/18 text-white shadow-inner ring-1 ring-white/25 backdrop-blur">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">Assistant HDMarket</h3>
                  <p className="text-xs font-medium text-white/80">Commandes, paiements, livraison</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleHideChat}
                  className="rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                  aria-label="Masquer le chat"
                  title="Masquer le chat"
                >
                  <EyeOff className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                  aria-label="Fermer le chat"
                  title="Fermer le chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/16 px-3 py-2 text-xs font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur">
              <Shield className="h-3.5 w-3.5" />
              <span>Réponses officielles · Parcours guidé</span>
            </div>
          </div>

          <div
            ref={listRef}
            onScroll={handleScroll}
            className="relative max-h-[390px] min-h-[260px] space-y-1 overflow-y-auto bg-gray-50 px-3 py-3 dark:bg-neutral-950"
          >
            {groupedMessages.map((item, index) => {
              if (item.type === 'date') {
                return (
                  <div key={`date-${item.date}-${index}`} className="my-3 flex items-center justify-center">
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-500 shadow-sm ring-1 ring-gray-200 dark:bg-neutral-900 dark:text-neutral-400 dark:ring-neutral-800">
                      {formatDateHeader(item.date)}
                    </div>
                  </div>
                );
              }

              const isUser = item.from === 'user';
              return (
                <div key={item.id || `msg-${index}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm ${
                      isUser
                        ? 'bg-[#e85d00] text-white shadow-[0_10px_24px_rgba(255,106,0,0.20)]'
                        : 'bg-white text-neutral-800 shadow-sm ring-1 ring-gray-200 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{item.text}</p>
                    {!!item.link && !isUser && (
                      <button
                        type="button"
                        onClick={() => openLink(item.link)}
                        className="mt-2 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-bold text-[#e85d00] transition hover:bg-orange-100 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ouvrir
                      </button>
                    )}
                    <div className={`mt-1 text-[10px] ${isUser ? 'text-neutral-300 dark:text-neutral-700' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      {formatTimestamp(item.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}

            {loadingSession && (
              <div className="space-y-2 py-2">
                <div className="h-3 w-32 animate-pulse rounded-full bg-orange-100 dark:bg-neutral-800" />
                <div className="h-3 w-44 animate-pulse rounded-full bg-orange-100 dark:bg-neutral-800" />
              </div>
            )}

            {showScrollDown && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="sticky bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white p-2 shadow ring-1 ring-gray-200 transition hover:bg-gray-100 dark:bg-neutral-900 dark:ring-neutral-700 dark:hover:bg-neutral-800"
              >
                <ChevronDown className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
              </button>
            )}
          </div>

          <div className="border-t border-gray-200 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
            {contextHint?.pendingOrders > 0 && (
              <div className="mb-2 rounded-2xl border border-gray-200 bg-gray-100 px-3 py-2 text-xs font-medium text-orange-800 dark:border-orange-950/60 dark:bg-orange-950/30 dark:text-orange-200">
                {contextHint.pendingOrders} commande(s) active(s) détectée(s), suggestions adaptées automatiquement.
              </div>
            )}

            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleGoBack}
                disabled={!stepStack.length || loading || loadingSession}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-3 text-xs font-bold text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-orange-950/60 dark:bg-orange-950/30 dark:text-orange-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Retour
              </button>
              <button
                type="button"
                onClick={handleRestart}
                disabled={loading || loadingSession}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 text-xs font-bold text-neutral-700 transition hover:border-gray-200 hover:text-[#e85d00] disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Recommencer
              </button>
              {hasActionLink && (
                <button
                  type="button"
                  onClick={() => openLink(hasActionLink)}
                  className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-full bg-[#e85d00] px-3 text-xs font-bold text-white shadow-[0_8px_20px_rgba(255,106,0,0.22)] transition hover:bg-[#f05f00]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ouvrir
                </button>
              )}
            </div>

            {error ? (
              <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>
            ) : null}

            <div className="flex max-h-[140px] flex-wrap gap-1.5 overflow-y-auto pr-1">
              {loading ? (
                <div className="h-10 w-full animate-pulse rounded-2xl bg-orange-100 dark:bg-neutral-800" />
              ) : options.length ? (
                options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelectOption(option)}
                    className="inline-flex min-h-10 items-center rounded-full border border-gray-200 bg-gray-50 px-3.5 py-2 text-left text-xs font-bold text-neutral-800 shadow-sm transition hover:-translate-y-0.5 hover:border-[#e85d00] hover:bg-[#e85d00] hover:text-white active:translate-y-0 dark:border-orange-950/60 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-[#e85d00] dark:hover:bg-[#e85d00] dark:hover:text-white"
                  >
                    {option.title}
                  </button>
                ))
              ) : noOptions ? (
                <div className="w-full rounded-2xl border border-gray-200 bg-gray-100 px-3 py-2 text-xs text-orange-800 dark:border-orange-950/60 dark:bg-orange-950/30 dark:text-orange-200">
                  Aucun choix supplémentaire. Utilisez “Recommencer” pour explorer une autre branche.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="relative flex items-center">
        <button
          type="button"
          onClick={isButtonCollapsed ? handleExpandButton : () => setIsOpen((prev) => !prev)}
          className={`group relative flex items-center justify-center gap-2 rounded-full bg-[#e85d00] text-white shadow-[0_18px_45px_rgba(255,106,0,0.34)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#f05f00] active:translate-y-0 ${
            isButtonCollapsed ? 'h-11 w-11 min-w-11 rounded-l-full' : 'px-5 py-3 pl-5 pr-12'
          }`}
          title={isButtonCollapsed ? "Afficher l'assistant" : isOpen ? 'Fermer' : 'Assistant'}
        >
          {isButtonCollapsed ? (
            <ChevronLeft className="h-5 w-5" />
          ) : (
            <>
              <MessageCircle className={`h-5 w-5 transition-transform duration-300 ${isOpen ? 'rotate-12' : 'group-hover:scale-110'}`} />
              <span className="font-medium">{isOpen ? 'Fermer' : 'Assistant'}</span>
            </>
          )}
        </button>
        {!isButtonCollapsed && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleCollapseButton();
            }}
            className="absolute -right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#111827] text-white shadow-md transition-colors hover:bg-[#e85d00]"
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
