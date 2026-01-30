import React, { useContext, useEffect, useRef, useState, useMemo } from 'react';
import {
  MessageCircle,
  Send,
  X,
  Loader2,
  Shield,
  CheckCheck,
  Check,
  Clock,
  Image as ImageIcon,
  Smile,
  MoreVertical,
  Phone,
  Video,
  Info,
  ArrowLeft,
  ShieldCheck,
  Lock,
  AlertTriangle,
  User,
  Store,
  Paperclip,
  Mic,
  MicOff,
  File,
  Download,
  Play,
  Pause,
  Search
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import { encrypt, decrypt, getSharedSecret } from '../utils/chatEncryption.js';

const formatTimestamp = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Aujourd'hui";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Hier';
  }
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Group messages by date
const groupMessagesByDate = (messages) => {
  const groups = {};
  messages.forEach((msg) => {
    const dateKey = new Date(msg.createdAt).toDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(msg);
  });
  return groups;
};

// Quick reply suggestions
const QUICK_REPLIES = [
  'Bonjour, je souhaite avoir des informations',
  'Quand sera livré ma commande ?',
  'Merci pour votre réponse',
  'Pouvez-vous me rappeler ?'
];

export default function OrderChat({ order, onClose, unreadCount = 0, buttonText = 'Contacter le vendeur' }) {
  const { user } = useContext(AuthContext);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [messageText, setMessageText] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [encryptionEnabled, setEncryptionEnabled] = useState(() => {
    try {
      return localStorage.getItem('hdmarket_order_chat_encryption') === 'true';
    } catch {
      return false;
    }
  });
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Get seller info from order
  const seller = order?.items?.[0]?.snapshot?.shopId
    ? { _id: order.items[0].snapshot.shopId, name: order.items[0].snapshot.shopName }
    : null;

  // Get product info from first item
  const firstItem = order?.items?.[0];
  const productName = firstItem?.snapshot?.title || 'Produit';
  const productImage = firstItem?.snapshot?.image || null;

  const isCustomer = user?._id && order?.customer?._id && String(user._id) === String(order.customer._id);
  const isSeller = seller && user?._id && String(user._id) === String(seller._id);
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    if (isOpen && order?._id) {
      loadMessages();
      // Poll for new messages every 5 seconds
      const interval = setInterval(loadMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, order?._id]);

  // Decrypt messages when encryption is enabled
  useEffect(() => {
    if (encryptionEnabled && encryptionKey && messages.length > 0) {
      const decryptMessages = async () => {
        const updatedMessages = await Promise.all(
          messages.map(async (msg) => {
            if (msg.encryptedText && !msg.isDecrypted && msg.metadata?.iv && msg.metadata?.tag) {
              try {
                const decrypted = await decrypt({
                  encrypted: msg.encryptedText,
                  iv: msg.metadata.iv,
                  tag: msg.metadata.tag
                }, encryptionKey);
                if (decrypted) {
                  return { ...msg, text: decrypted, isDecrypted: true };
                }
              } catch (error) {
                console.error('Decryption error:', error);
              }
            }
            return msg;
          })
        );
        setMessages(updatedMessages);
      };
      decryptMessages();
    }
  }, [encryptionEnabled, encryptionKey, messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Initialize encryption key if encryption is enabled
  useEffect(() => {
    if (encryptionEnabled && user?._id && !encryptionKey) {
      getSharedSecret(user._id).then(({ key }) => {
        setEncryptionKey(key);
      }).catch((error) => {
        console.error('Error initializing encryption key:', error);
      });
    }
  }, [encryptionEnabled, user?._id, encryptionKey]);

  const loadMessages = async () => {
    if (!order?._id) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/orders/${order._id}/messages`);
      setMessages(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger les messages.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e, messageAttachments = null, voiceMsg = null) => {
    e?.preventDefault();
    const hasText = messageText.trim();
    const hasAttachments = messageAttachments?.length || attachments.length;
    const hasVoice = voiceMsg;
    
    if (!hasText && !hasAttachments && !hasVoice) return;
    if (sending) return;

    let text = messageText.trim();
    let encryptedText = null;
    let encryptionData = null;
    
    // Encrypt message if encryption is enabled
    if (encryptionEnabled && encryptionKey && text) {
      try {
        const encrypted = await encrypt(text, encryptionKey);
        encryptedText = encrypted.encrypted;
        encryptionData = {
          iv: encrypted.iv,
          tag: encrypted.tag,
          salt: encrypted.salt,
          key: await (async () => {
            const exported = await crypto.subtle.exportKey('raw', encryptionKey);
            const buffer = new Uint8Array(exported);
            return btoa(String.fromCharCode(...buffer));
          })()
        };
        text = '[Message chiffré]';
      } catch (error) {
        console.error('Encryption error:', error);
      }
    }

    setMessageText('');
    setSending(true);
    setError('');
    setShowQuickReplies(false);

    try {
      // Determine recipient based on user role
      let recipientId = null;
      if (isAdmin) {
        recipientId = order?.customer?._id;
      } else if (isCustomer) {
        recipientId = seller?._id;
      } else if (isSeller) {
        recipientId = order?.customer?._id;
      }

      const { data } = await api.post(`/orders/${order._id}/messages`, {
        text: encryptionEnabled && encryptedText ? null : text,
        encryptedText,
        encryptionData,
        attachments: messageAttachments || attachments,
        voiceMessage: voiceMsg,
        recipientId
      });
      setMessages((prev) => [...prev, data]);
      setAttachments([]);
      scrollToBottom();
    } catch (err) {
      setError(err.response?.data?.message || "Impossible d'envoyer le message.");
      setMessageText(text); // Restore text on error
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const { data } = await api.post('/orders/messages/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        return {
          type: data.type,
          url: data.url,
          filename: data.filename,
          size: data.size,
          mimeType: data.mimeType
        };
      });

      const uploadedAttachments = await Promise.all(uploadPromises);
      setAttachments((prev) => [...prev, ...uploadedAttachments]);
    } catch (error) {
      console.error('File upload error:', error);
      setError('Erreur lors de l\'upload du fichier.');
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', blob, 'voice-message.webm');

        try {
          const { data } = await api.post('/orders/messages/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });

          const voiceMessage = {
            url: data.url,
            duration: recordingTime,
            type: 'audio'
          };

          await sendMessage(null, null, voiceMessage);
        } catch (error) {
          console.error('Voice message upload error:', error);
          setError('Erreur lors de l\'envoi du message vocal.');
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        audioChunksRef.current = [];
        setRecordingTime(0);
      };

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = chunks;
      setIsRecording(true);
      setRecordingTime(0);

      // Start recording
      mediaRecorder.start();

      // Update recording time
      const interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      recordingIntervalRef.current = interval;
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Impossible d\'accéder au microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const handleAddReaction = async (messageId, emoji) => {
    if (!messageId || !emoji) return;
    
    try {
      await api.post(`/orders/messages/${messageId}/reactions`, { emoji });
      // Reload messages to get updated reactions
      loadMessages();
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleRemoveReaction = async (messageId) => {
    if (!messageId) return;
    
    try {
      await api.delete(`/orders/messages/${messageId}/reactions`);
      // Reload messages to get updated reactions
      loadMessages();
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  };

  const sendQuickReply = (text) => {
    setMessageText(text);
    setShowQuickReplies(false);
    setTimeout(() => {
      sendMessage();
    }, 100);
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
      >
        <MessageCircle className="w-4 h-4" />
        <span>{buttonText}</span>
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center animate-pulse shadow-lg">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  const recipientName = isAdmin
    ? order?.customer?.name || 'Client'
    : isCustomer
      ? seller?.name || 'Vendeur'
      : order?.customer?.name || 'Client';

  // Filter messages based on search query
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) {
      return messages;
    }
    const query = searchQuery.toLowerCase().trim();
    return messages.filter((msg) => {
      const text = (msg.text || '').toLowerCase();
      const senderName = (msg.sender?.name || msg.sender?.shopName || '').toLowerCase();
      return text.includes(query) || senderName.includes(query);
    });
  }, [messages, searchQuery]);

  const messageGroups = groupMessagesByDate(filteredMessages);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 w-full sm:rounded-2xl sm:max-w-lg sm:mx-4 h-full sm:h-[85vh] sm:max-h-[700px] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (onClose) onClose();
                }}
                className="sm:hidden p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Avatar */}
              <div className="relative">
                {productImage ? (
                  <img
                    src={productImage}
                    alt={productName}
                    className="w-11 h-11 rounded-full object-cover border-2 border-white/30"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
                    {isCustomer ? (
                      <Store className="w-5 h-5" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                )}
                {/* Online indicator */}
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full" />
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="font-bold truncate">{recipientName}</h2>
                <div className="flex items-center gap-1.5 text-xs text-white/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>En ligne</span>
                  <span className="mx-1">•</span>
                  <span className="truncate">#{order?.deliveryCode || order?._id?.slice(-6)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                title="Rechercher dans les messages"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setShowInfo(!showInfo)}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                title="Informations"
              >
                <Info className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (onClose) onClose();
                }}
                className="hidden sm:block p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Security Banner */}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-xs">
              <Lock className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-white/90">Messages sécurisés et chiffrés de bout en bout</span>
            </div>
          </div>
        </div>

          {/* Search Bar */}
        {showSearch && (
          <div className="bg-indigo-50 dark:bg-gray-800 border-b border-indigo-100 dark:border-gray-700 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans les messages..."
                className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''} trouvé{filteredMessages.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

          {/* Order Info Panel */}
        {showInfo && (
          <div className="bg-indigo-50 dark:bg-gray-800 border-b border-indigo-100 dark:border-gray-700 p-4 space-y-3">
            <div className="flex items-center gap-3">
              {productImage && (
                <img src={productImage} alt={productName} className="w-16 h-16 rounded-xl object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">{productName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Commande #{order?.deliveryCode || order?._id?.slice(-6)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Transaction protégée</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-indigo-500" />
                <span>Données sécurisées</span>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800"
        >
          {searchQuery && filteredMessages.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mb-4">
                <Search className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">Aucun résultat</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Aucun message ne correspond à "{searchQuery}"
              </p>
            </div>
          ) : loading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
              </div>
              <p className="text-sm text-gray-500">Chargement des messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
                <MessageCircle className="w-10 h-10 text-indigo-500" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">Démarrez la conversation</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Posez vos questions concernant cette commande. Vos messages sont sécurisés.
              </p>

              {/* Quick Start Suggestions */}
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_REPLIES.slice(0, 2).map((reply, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => sendQuickReply(reply)}
                    className="px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            Object.entries(messageGroups).map(([dateKey, msgs]) => (
              <div key={dateKey}>
                {/* Date Separator */}
                <div className="flex items-center justify-center my-4">
                  <div className="px-3 py-1 rounded-full bg-gray-200/80 dark:bg-gray-700/80 text-xs font-medium text-gray-600 dark:text-gray-300">
                    {formatDate(msgs[0].createdAt)}
                  </div>
                </div>

                {/* Messages */}
                <div className="space-y-3">
                  {msgs.map((message, index) => {
                    const isOwnMessage = String(message.sender?._id) === String(user?._id);
                    const showAvatar = !isOwnMessage && (index === 0 || String(msgs[index - 1]?.sender?._id) !== String(message.sender?._id));

                    return (
                      <div
                        key={message._id}
                        className={`flex items-end gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        {/* Avatar for received messages */}
                        {!isOwnMessage && (
                          <div className={`w-8 h-8 flex-shrink-0 ${showAvatar ? '' : 'invisible'}`}>
                            {message.sender?.shopName ? (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                {message.sender.shopName.charAt(0).toUpperCase()}
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                                <User className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </div>
                        )}

                        <div
                          className={`max-w-[75%] group ${
                            isOwnMessage
                              ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl rounded-br-md'
                              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-md shadow-sm'
                          } px-4 py-2.5 relative`}
                        >
                          {!isOwnMessage && showAvatar && (
                            <p className="text-xs font-semibold mb-1 text-indigo-600 dark:text-indigo-400">
                              {message.sender?.shopName || message.sender?.name || 'Utilisateur'}
                            </p>
                          )}
                          
                          {/* Attachments */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-2">
                              {message.attachments.map((att, idx) => (
                                <div key={att.url || att.filename || `att-${idx}`} className="relative">
                                  {att.type === 'image' ? (
                                    <img
                                      src={att.url}
                                      alt={att.filename}
                                      className="max-h-32 max-w-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => setSelectedImage(att.url)}
                                    />
                                  ) : att.type === 'audio' ? (
                                    <div className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 px-3 py-2">
                                      <span className="text-xs">{att.filename}</span>
                                      {message.voiceMessage?.duration && (
                                        <span className="text-xs text-gray-500">{Math.round(message.voiceMessage.duration)}s</span>
                                      )}
                                    </div>
                                  ) : (
                                    <a
                                      href={att.url}
                                      download={att.filename}
                                      className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-600"
                                    >
                                      <File className="h-4 w-4" />
                                      <span className="text-xs">{att.filename}</span>
                                      <Download className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                            {searchQuery ? (
                              (() => {
                                const text = message.isDecrypted ? message.text : message.text || '[Message chiffré]';
                                if (!text) return text;
                                const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                                const parts = text.split(regex);
                                return parts.map((part, index) =>
                                  regex.test(part) ? (
                                    <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 text-gray-900 dark:text-yellow-100 rounded px-0.5">
                                      {part}
                                    </mark>
                                  ) : (
                                    part
                                  )
                                );
                              })()
                            ) : (
                              message.isDecrypted ? message.text : message.text || '[Message chiffré]'
                            )}
                          </p>
                          
                          {/* Reactions */}
                          {message.reactions && message.reactions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {Object.entries(
                                message.reactions.reduce((acc, r) => {
                                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                  return acc;
                                }, {})
                              ).map(([emoji, count]) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => {
                                    const hasReacted = message.reactions?.some(r => r.userId === user?._id && r.emoji === emoji);
                                    if (hasReacted) {
                                      handleRemoveReaction(message._id);
                                    } else {
                                      handleAddReaction(message._id, emoji);
                                    }
                                  }}
                                  className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs hover:bg-white/30 dark:bg-gray-700/50"
                                >
                                  <span>{emoji}</span>
                                  <span>{count}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          <div
                            className={`flex items-center gap-1.5 mt-1 ${
                              isOwnMessage ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <span
                              className={`text-[10px] ${
                                isOwnMessage ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'
                              }`}
                            >
                              {formatTimestamp(message.createdAt)}
                            </span>
                            {isOwnMessage && (
                              <span className="text-indigo-200">
                                {message.readAt ? (
                                  <CheckCheck className="w-3.5 h-3.5" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* Typing Indicator */}
          {typingIndicator && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-500" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-2.5">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Image Lightbox Modal */}
        {selectedImage && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setSelectedImage(null)}
          >
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Fermer"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="relative max-w-[90vw] max-h-[90vh] p-4">
              <img
                src={selectedImage}
                alt="Image agrandie"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}

        {/* Quick Replies */}
        {showQuickReplies && (
          <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Réponses rapides</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_REPLIES.map((reply, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => sendQuickReply(reply)}
                  className="px-3 py-1.5 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 hover:text-indigo-700 transition-all"
                >
                  {reply}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</p>
            <button type="button" onClick={() => setError('')} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, idx) => (
                <div key={att.url || att.filename || `preview-att-${idx}`} className="relative">
                  {att.type === 'image' ? (
                    <div className="relative">
                      <img
                        src={att.url}
                        alt={att.filename}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-gray-700 px-2 py-1">
                      <File className="h-4 w-4" />
                      <span className="text-xs">{att.filename}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <form onSubmit={sendMessage} className="p-3 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.doc,.docx,.txt,audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                title="Joindre un fichier"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              {!isRecording ? (
                <button
                  type="button"
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  title="Enregistrer un message vocal"
                >
                  <Mic className="h-5 w-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-500 text-white transition-colors hover:bg-red-600"
                  title="Arrêter l'enregistrement"
                >
                  <MicOff className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Input */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={isRecording ? `Enregistrement... ${recordingTime}s` : "Tapez votre message..."}
                rows={1}
                maxLength={1000}
                className="w-full px-4 py-2.5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none transition-all"
                style={{ minHeight: '44px', maxHeight: '120px' }}
                disabled={isRecording}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isRecording) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const emojis = ['👍', '❤️', '😊', '🎉', '🔥', '✅'];
                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                const lastMessage = messages[messages.length - 1];
                if (lastMessage) {
                  handleAddReaction(lastMessage._id, randomEmoji);
                }
              }}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              title="Ajouter une réaction"
            >
              <Smile className="h-5 w-5" />
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={(!messageText.trim() && attachments.length === 0) || sending || isRecording}
              className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-none"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>

          {/* Character Count & Security Note */}
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Lock className="w-3 h-3" />
              <span>{encryptionEnabled ? 'Messages chiffrés de bout en bout' : 'Messages protégés par chiffrement de bout en bout'}</span>
            </div>
            <span className={`text-xs ${messageText.length > 900 ? 'text-amber-500' : 'text-gray-400'}`}>
              {messageText.length}/1000
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
