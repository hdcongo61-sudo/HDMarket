import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import ChatMessage from '../models/chatMessageModel.js';
import ChatTemplate from '../models/chatTemplateModel.js';
import { getChatSocket } from '../sockets/chatSocket.js';

export const listChatHistory = asyncHandler(async (req, res) => {
  const limit = Math.min(200, Math.max(20, Number(req.query.limit) || 100));
  const messages = await ChatMessage.find()
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();
  res.json(messages);
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
