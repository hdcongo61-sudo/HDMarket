import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import ChatMessage from '../models/chatMessageModel.js';
import ChatTemplate from '../models/chatTemplateModel.js';
import { getChatSocket } from '../sockets/chatSocket.js';
import { uploadToCloudinary } from '../utils/cloudinaryUploader.js';
import { encrypt, decrypt } from '../utils/encryption.js';

export const listChatHistory = asyncHandler(async (req, res) => {
  const limit = Math.min(200, Math.max(20, Number(req.query.limit) || 100));
  const search = req.query.search;
  
  let query = {};
  
  // Search functionality
  if (search && search.trim()) {
    query = {
      $or: [
        { text: { $regex: search.trim(), $options: 'i' } },
        { 'attachments.filename': { $regex: search.trim(), $options: 'i' } }
      ]
    };
  }
  
  const messages = await ChatMessage.find(query)
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();
  
  // Decrypt encrypted messages if user has the key
  const decryptedMessages = messages.map(msg => {
    if (msg.encryptedText && req.user) {
      try {
        const decrypted = decrypt({
          encrypted: msg.encryptedText,
          iv: msg.metadata?.iv,
          tag: msg.metadata?.tag,
          key: msg.metadata?.key
        });
        if (decrypted) {
          return { ...msg, text: decrypted, isDecrypted: true };
        }
      } catch (error) {
        console.error('Decryption error:', error);
      }
    }
    return msg;
  });
  
  res.json(decryptedMessages);
});

export const listChatTemplates = asyncHandler(async (req, res) => {
  const templates = await ChatTemplate.find().sort({ createdAt: -1 }).lean();
  res.json(templates);
});

export const createChatTemplate = asyncHandler(async (req, res) => {
  const { question, response } = req.body || {};
  if (!question || !response) {
    return res.status(400).json({ message: 'Question et réponse requises.' });
  }
  const template = await ChatTemplate.create({
    question,
    response,
    createdBy: req.user.id
  });
  res.status(201).json(template);
});

export const updateChatTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { question, response } = req.body || {};
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant invalide.' });
  }
  const template = await ChatTemplate.findById(id);
  if (!template) return res.status(404).json({ message: 'Modèle introuvable.' });
  if (question) template.question = question;
  if (response) template.response = response;
  await template.save();
  res.json(template);
});

export const deleteChatTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant invalide.' });
  }
  const template = await ChatTemplate.findById(id);
  if (!template) return res.status(404).json({ message: 'Modèle introuvable.' });
  await template.deleteOne();
  res.json({ id });
});

export const sendSupportMessage = asyncHandler(async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ message: 'Texte requis.' });
  const message = await ChatMessage.create({
    from: 'support',
    username: 'Support HDMarket',
    text
  });
  const payload = {
    id: message._id.toString(),
    from: message.from,
    text: message.text,
    createdAt: message.createdAt
  };
  const io = getChatSocket();
  if (io) {
    io.to('support').emit('message', payload);
  }
  res.status(201).json(payload);
});

// Upload chat attachments
export const uploadChatAttachment = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Fichier requis.' });
  }
  
  try {
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' :
                     req.file.mimetype.startsWith('audio/') ? 'audio' : 'document';
    
    const uploaded = await uploadToCloudinary({
      buffer: req.file.buffer,
      resourceType: fileType === 'image' ? 'image' : fileType === 'audio' ? 'video' : 'raw',
      folder: 'chat/attachments'
    });
    
    res.json({
      type: fileType,
      url: uploaded.secure_url || uploaded.url,
      filename: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'upload du fichier.' });
  }
});

// Add reaction to message
export const addReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ message: 'Identifiant de message invalide.' });
  }
  
  if (!emoji) {
    return res.status(400).json({ message: 'Emoji requis.' });
  }
  
  const message = await ChatMessage.findById(messageId);
  if (!message) {
    return res.status(404).json({ message: 'Message introuvable.' });
  }
  
  // Remove existing reaction from same user
  message.reactions = message.reactions.filter(
    r => r.userId.toString() !== req.user.id.toString()
  );
  
  // Add new reaction
  message.reactions.push({
    emoji,
    userId: req.user.id
  });
  
  await message.save();
  
  const io = getChatSocket();
  if (io) {
    io.emit('messageReaction', {
      messageId: message._id.toString(),
      reactions: message.reactions
    });
  }
  
  res.json(message);
});

// Remove reaction from message
export const removeReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ message: 'Identifiant de message invalide.' });
  }
  
  const message = await ChatMessage.findById(messageId);
  if (!message) {
    return res.status(404).json({ message: 'Message introuvable.' });
  }
  
  // Remove user's reaction
  message.reactions = message.reactions.filter(
    r => r.userId.toString() !== req.user.id.toString()
  );
  
  await message.save();
  
  const io = getChatSocket();
  if (io) {
    io.emit('messageReaction', {
      messageId: message._id.toString(),
      reactions: message.reactions
    });
  }
  
  res.json(message);
});

// Search messages
export const searchMessages = asyncHandler(async (req, res) => {
  const { query } = req.query;
  
  if (!query || !query.trim()) {
    return res.status(400).json({ message: 'Terme de recherche requis.' });
  }
  
  const searchTerm = query.trim();
  
  const messages = await ChatMessage.find({
    $or: [
      { text: { $regex: searchTerm, $options: 'i' } },
      { 'attachments.filename': { $regex: searchTerm, $options: 'i' } }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  
  res.json(messages);
});
