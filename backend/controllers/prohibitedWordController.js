import asyncHandler from 'express-async-handler';
import ProhibitedWord from '../models/prohibitedWordModel.js';

export const listProhibitedWords = asyncHandler(async (req, res) => {
  const words = await ProhibitedWord.find().sort({ createdAt: 1 }).lean();
  res.json(words.map((word) => ({ id: word._id, word: word.word })));
});

export const createProhibitedWord = asyncHandler(async (req, res) => {
  const normalized = (req.body.word || '').toString().trim().toLowerCase();
  if (!normalized) {
    return res.status(400).json({ message: 'Le mot interdit est requis.' });
  }
  const existing = await ProhibitedWord.findOne({ word: normalized });
  if (existing) {
    return res.status(400).json({ message: 'Ce mot est déjà dans la liste.' });
  }
  const created = await ProhibitedWord.create({
    word: normalized,
    createdBy: req.user.id
  });
  res.status(201).json({ id: created._id, word: created.word });
});

export const deleteProhibitedWord = asyncHandler(async (req, res) => {
  const deleted = await ProhibitedWord.findByIdAndDelete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ message: 'Mot interdit introuvable.' });
  }
  res.json({ id: deleted._id });
});
