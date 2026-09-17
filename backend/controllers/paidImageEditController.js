import crypto from 'node:crypto';
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import ImageEditJob from '../models/imageEditJobModel.js';
import { imageEditPricing, paidCheckoutFor, performImageEdit, validateImageEditInput } from '../services/paidImageEditService.js';
import { resolvePaymentProvider } from '../services/paymentService.js';
import { uploadToCloudinary, getCloudinaryFolder } from '../utils/cloudinaryUploader.js';

export const getImageEditPricing = asyncHandler(async (req, res) => res.json(await imageEditPricing(req.countryContext?.countryId)));
export const createImageEditJob = asyncHandler(async (req, res) => {
  const pricing = await imageEditPricing(req.countryContext?.countryId);
  if (!pricing.enabled) return res.status(503).json({ message: 'La retouche IA payante n’est pas encore activée.' });
  let input;
  try { input = validateImageEditInput(req.body || {}); } catch (e) { return res.status(400).json({ message: e.message }); }
  if (!req.file || !['image/png', 'image/jpeg', 'image/webp'].includes(req.file.mimetype) || req.file.size > 10 * 1024 * 1024) return res.status(400).json({ message: 'Choisissez une photo PNG, JPEG ou WebP de moins de 10 Mo.' });
  const payment = await resolvePaymentProvider({ provider: 'PAWAPAY', countryId: req.countryContext?.countryId || req.user.selectedCountryId || req.user.countryId, currency: 'XAF', user: req.user });
  const amount = pricing.operations.find(item => item.id === input.operation)?.amount;
  if (!Number.isInteger(amount) || amount < 10 || amount > 1000000) return res.status(503).json({ message: 'Le tarif doit être configuré par l’administrateur.' });
  const image = await uploadToCloudinary({ buffer: req.file.buffer, resourceType: 'image', folder: getCloudinaryFolder(['image-studio', String(req.user._id), 'originals']) });
  const job = await ImageEditJob.create({ user: req.user._id, ...input, sourceUrl: image.secure_url, sourceAssetId: image.public_id, amount, countryId: payment.countryContext.countryId, currency: 'XAF' });
  return res.status(201).json({ job: await viewJob(job) });
});
async function viewJob(job) {
  const { checkout, paid } = await paidCheckoutFor(job);
  return { id: String(job._id), operation: job.operation, prompt: job.prompt, marketingTitle: job.marketingTitle, marketingFacts: job.marketingFacts, marketingCopy: job.marketingCopy, amount: job.amount, currency: job.currency, state: job.state, resultUrl: job.resultUrl, sourceUrl: job.sourceUrl, checkoutId: job.checkoutId, paymentStatus: checkout?.status || '', paid, attempts: job.attempts, error: job.error, createdAt: job.createdAt, needsSupport: job.state === 'PROCESSING' && Date.now() - new Date(job.updatedAt).getTime() > 10 * 60 * 1000 };
}
async function ownedJob(req) {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  return ImageEditJob.findOne({ _id: req.params.id, user: req.user._id });
}
export const listImageEditJobs = asyncHandler(async (req, res) => {
  const jobs = await ImageEditJob.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20);
  res.json({ jobs: await Promise.all(jobs.map(viewJob)) });
});
export const getImageEditJob = asyncHandler(async (req, res) => {
  const job = await ownedJob(req);
  if (!job) return res.status(404).json({ message: 'Retouche introuvable.' });
  res.json({ job: await viewJob(job) });
});
export const runImageEditJob = asyncHandler(async (req, res) => {
  const job = await ownedJob(req);
  if (!job) return res.status(404).json({ message: 'Retouche introuvable.' });
  const { paid } = await paidCheckoutFor(job);
  if (paid && job.state === 'PROCESSING' && Date.now() - new Date(job.updatedAt).getTime() > 10 * 60000) {
    const recovered = await ImageEditJob.findOneAndUpdate({ _id: job._id, state: 'PROCESSING', runToken: job.runToken, updatedAt: { $lt: new Date(Date.now() - 10 * 60000) } }, { $set: { state: 'FAILED', runToken: '', error: 'Traitement interrompu. Réessayez sans repayer.' } }, { new: true });
    if (recovered) { job.state = recovered.state; job.runToken = ''; }
  }
  if (!paid) return res.status(402).json({ message: 'Le paiement doit être confirmé avant de lancer la retouche.' });
  if (job.state === 'COMPLETED' || job.state === 'PROCESSING') return res.json({ job: await viewJob(job) });
  if (!(await imageEditPricing(job.countryId)).enabled) return res.status(503).json({ message: 'Le service est temporairement indisponible. Votre paiement reste associé à cette retouche.' });
  const claimed = await ImageEditJob.findOneAndUpdate({ _id: job._id, state: { $in: ['AWAITING_PAYMENT', 'FAILED'] }, attempts: { $lt: 3 } }, { $set: { state: 'PROCESSING', error: '', runToken: crypto.randomUUID() }, $inc: { attempts: 1 } }, { new: true });
  if (!claimed) return res.status(409).json({ message: 'Contactez le support avec la référence de la retouche. Ne payez pas à nouveau.' });
  // A persisted claim prevents duplicate provider calls during polling or concurrent requests.
  void performImageEdit(claimed).catch(() => {});
  res.status(202).json({ job: await viewJob(claimed) });
});

const adminScope = req => req.user.role === 'founder' ? {} : { countryId: req.countryContext.countryId };
export const adminImageEditJobs = asyncHandler(async (req, res) => {
  const jobs = await ImageEditJob.find(adminScope(req)).sort({ createdAt: -1 }).limit(100);
  res.json({ jobs: await Promise.all(jobs.map(viewJob)) });
});
export const recoverImageEditJob = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Retouche introuvable.' });
  const job = await ImageEditJob.findOne({ _id: req.params.id, ...adminScope(req) });
  if (!job) return res.status(404).json({ message: 'Retouche introuvable.' });
  if (!(await paidCheckoutFor(job)).paid) return res.status(409).json({ message: 'Le paiement doit être confirmé.' });
  const updated = await ImageEditJob.findOneAndUpdate({ _id: job._id, $or: [{ state: 'FAILED' }, { state: 'PROCESSING', updatedAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } }] }, { $set: { state: 'FAILED', attempts: 0, runToken: '', error: 'Reprise autorisée par le support. Réessayez sans repayer.', recoveredBy: req.user._id, recoveredAt: new Date() } }, { new: true });
  if (!updated) return res.status(409).json({ message: 'Seules les retouches en échec ou bloquées depuis 10 minutes peuvent être reprises.' });
  res.json({ job: await viewJob(updated) });
});
