import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import ChatMessage from '../models/chatMessageModel.js';
import ChatTemplate from '../models/chatTemplateModel.js';
import ChatSession from '../models/chatSessionModel.js';
import Order from '../models/orderModel.js';
import Notification from '../models/notificationModel.js';
import { getChatSocket } from '../sockets/chatSocket.js';
import { uploadToCloudinary } from '../utils/cloudinaryUploader.js';
import { decrypt } from '../utils/encryption.js';
import { initRedis, getRedisClient, isRedisReady } from '../config/redisClient.js';

const TEMPLATE_CACHE_TTL_SECONDS = Math.max(30, Number(process.env.CHAT_TEMPLATE_CACHE_TTL_SECONDS || 120));
const TEMPLATE_MAX_DEPTH = 5;
const MAX_CHILDREN_PER_STEP = 20;

const cacheEnv = () =>
  String(process.env.CACHE_ENV || process.env.NODE_ENV || 'dev')
    .toLowerCase()
    .startsWith('prod')
    ? 'prod'
    : 'dev';

const sanitizeText = (value, maxLength = 500) =>
  String(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const sanitizeMultiline = (value, maxLength = 5000) =>
  String(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .trim()
    .slice(0, maxLength);

const normalizeRoles = (value) => {
  if (!value) return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  return Array.from(
    new Set(
      list
        .map((item) => sanitizeText(item, 40).toLowerCase())
        .filter(Boolean)
    )
  );
};

const getAudienceTokens = (user) => {
  const tokens = new Set(['all']);
  const role = String(user?.role || '').toLowerCase();
  const accountType = String(user?.accountType || '').toLowerCase();

  if (role) tokens.add(role);
  if (accountType) tokens.add(accountType);

  if (role === 'admin' || role === 'founder') tokens.add('admin');
  if (role === 'manager') tokens.add('manager');

  if (accountType === 'shop') {
    tokens.add('seller');
    tokens.add('vendeur');
    tokens.add('boutique_owner');
    tokens.add('shop');
  } else {
    tokens.add('client');
    tokens.add('user');
    tokens.add('person');
  }

  return Array.from(tokens);
};

const buildRoleFilter = (user) => {
  const tokens = getAudienceTokens(user);
  return {
    $or: [
      { roles: { $exists: false } },
      { roles: { $size: 0 } },
      { roles: 'all' },
      { roles: { $in: tokens } }
    ]
  };
};

const toTemplateNode = (template, extra = {}) => ({
  id: String(template?._id || ''),
  _id: template?._id,
  title: template?.title || template?.question || '',
  question: template?.question || template?.title || '',
  type: template?.type || 'question',
  category: template?.category || '',
  content: template?.content || template?.response || '',
  response: template?.response || template?.content || '',
  parentId: template?.parentId ? String(template.parentId) : null,
  order: Number(template?.order || 0),
  priority: Number(template?.priority || 0),
  usageCount: Number(template?.usageCount || 0),
  lastUsedAt: template?.lastUsedAt || null,
  entityType: template?.entityType || '',
  entityId: template?.entityId || '',
  active: Boolean(template?.active !== false),
  roles: Array.isArray(template?.roles) ? template.roles : [],
  metadata: template?.metadata || {},
  createdAt: template?.createdAt || null,
  updatedAt: template?.updatedAt || null,
  ...extra
});

const withRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  return initRedis();
};

const getCache = async (key) => {
  const client = await withRedis();
  if (!client || !key) return null;
  const raw = await client.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const setCache = async (key, value, ttlSeconds = TEMPLATE_CACHE_TTL_SECONDS) => {
  const client = await withRedis();
  if (!client || !key) return false;
  const payload = JSON.stringify(value);
  await client.set(key, payload, { EX: Math.max(10, Number(ttlSeconds || TEMPLATE_CACHE_TTL_SECONDS)) });
  return true;
};

const invalidateTemplateCache = async () => {
  const client = await withRedis();
  if (!client) return 0;
  const pattern = `${cacheEnv()}:chat:templates:*`;
  let cursor = '0';
  let deleted = 0;

  do {
    // Redis v4 scan response shape differs between clients
    // eslint-disable-next-line no-await-in-loop
    const reply = await client.scan(cursor, { MATCH: pattern, COUNT: 200 });
    cursor = reply?.cursor ?? reply?.[0] ?? '0';
    const keys = reply?.keys ?? reply?.[1] ?? [];
    if (Array.isArray(keys) && keys.length) {
      // eslint-disable-next-line no-await-in-loop
      deleted += Number(await client.del(keys));
    }
  } while (cursor !== '0');

  return deleted;
};

const templateCacheKey = ({ parentId = 'root', user }) => {
  const audience = getAudienceTokens(user)
    .filter((item) => item !== 'all')
    .sort()
    .join('_') || 'all';
  return `${cacheEnv()}:chat:templates:${String(parentId)}:${audience}`;
};

const getTemplateQuery = ({ parentId = null, user, activeOnly = true }) => {
  const query = {
    ...(activeOnly ? { active: true } : {}),
    ...(parentId === null ? { parentId: null } : { parentId }),
    ...buildRoleFilter(user)
  };
  return query;
};

const loadTemplatesByParent = async ({ parentId = null, user, activeOnly = true }) => {
  const key = templateCacheKey({ parentId: parentId || 'root', user });
  const cached = await getCache(key);
  if (Array.isArray(cached)) return cached;

  const query = getTemplateQuery({ parentId, user, activeOnly });
  const templates = await ChatTemplate.find(query)
    .sort({ priority: -1, order: 1, createdAt: 1 })
    .lean();

  await setCache(key, templates).catch(() => {});
  return templates;
};

const normalizeType = (value) => {
  const type = String(value || 'question').toLowerCase();
  if (['question', 'info', 'action', 'link'].includes(type)) return type;
  return 'question';
};

const normalizeEntityType = (value) => {
  const entityType = String(value || '').toLowerCase();
  if (['order', 'product', 'dispute', 'payment', 'shop', 'external_link'].includes(entityType)) {
    return entityType;
  }
  return '';
};

const parseTemplatePayload = (body = {}) => {
  const title = sanitizeText(body.title || body.question, 180);
  const content = sanitizeMultiline(body.content || body.response, 6000);
  const category = sanitizeText(body.category, 80);
  const type = normalizeType(body.type);
  const entityType = normalizeEntityType(body.entityType);
  const entityId = sanitizeText(body.entityId, 180);
  const order = Number.isFinite(Number(body.order)) ? Number(body.order) : 0;
  const priority = Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0;
  const active = typeof body.active === 'boolean' ? body.active : true;
  const roles = normalizeRoles(body.roles);
  const metadata =
    body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata
      : {};

  let parentId = null;
  if (body.parentId) {
    parentId = mongoose.Types.ObjectId.isValid(String(body.parentId)) ? String(body.parentId) : '__invalid__';
  }

  return {
    title,
    question: title,
    type,
    category,
    content,
    response: content,
    parentId,
    order,
    priority,
    entityType,
    entityId,
    roles,
    active,
    metadata
  };
};

const getUserChatContext = async (user) => {
  if (!user?._id) return {};
  const userId = user._id;

  const [pendingOrders, lastOrder, lastNotification] = await Promise.all([
    Order.countDocuments({
      customer: userId,
      status: {
        $in: [
          'pending',
          'pending_payment',
          'pending_installment',
          'installment_active',
          'paid',
          'ready_for_delivery',
          'out_for_delivery',
          'delivering'
        ]
      }
    }),
    Order.findOne({ customer: userId }).sort({ createdAt: -1 }).select('_id status paymentType').lean(),
    Notification.findOne({ user: userId }).sort({ createdAt: -1 }).select('type metadata').lean()
  ]);

  return {
    pendingOrders: Number(pendingOrders || 0),
    lastOrder,
    lastNotificationType: lastNotification?.type || '',
    accountType: String(user?.accountType || '').toLowerCase(),
    role: String(user?.role || '').toLowerCase()
  };
};

const rankRootTemplates = (templates = [], context = {}) => {
  const hasPendingOrders = Number(context.pendingOrders || 0) > 0;
  const notifType = String(context.lastNotificationType || '');
  const accountType = String(context.accountType || '');
  const role = String(context.role || '');

  const scoreTemplate = (template, index) => {
    let score = Number(template?.priority || 0) * 100 - Number(template?.order || 0) * 3 - index;
    const text = `${template?.title || ''} ${template?.category || ''} ${template?.content || ''}`.toLowerCase();

    if (hasPendingOrders && /(commande|livraison|order|pickup|retard)/i.test(text)) score += 70;
    if (/installment|tranche|payment|paiement|refund|remboursement/i.test(notifType) && /(paiement|payment|tranche|refund)/i.test(text)) score += 45;
    if (accountType === 'shop' && /(vendeur|boutique|shop|boost|promo)/i.test(text)) score += 35;
    if ((role === 'admin' || role === 'founder' || role === 'manager') && /(admin|système|system|configuration)/i.test(text)) score += 30;

    return score;
  };

  return [...templates].sort((a, b) => {
    const aScore = scoreTemplate(a, 1);
    const bScore = scoreTemplate(b, 1);
    if (bScore !== aScore) return bScore - aScore;
    if (Number(b.priority || 0) !== Number(a.priority || 0)) return Number(b.priority || 0) - Number(a.priority || 0);
    if (Number(a.order || 0) !== Number(b.order || 0)) return Number(a.order || 0) - Number(b.order || 0);
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });
};

const getChildrenCountMap = async (rootIds = [], user) => {
  if (!rootIds.length) return new Map();
  const match = {
    parentId: { $in: rootIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
    active: true,
    ...buildRoleFilter(user)
  };
  const rows = await ChatTemplate.aggregate([
    { $match: match },
    { $group: { _id: '$parentId', count: { $sum: 1 } } }
  ]);
  return new Map(rows.map((row) => [String(row._id), Number(row.count || 0)]));
};

export const listChatHistory = asyncHandler(async (req, res) => {
  const limit = Math.min(200, Math.max(20, Number(req.query.limit) || 100));
  const search = req.query.search;

  let query = {};
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

  const decryptedMessages = messages.map((msg) => {
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
        // eslint-disable-next-line no-console
        console.error('Decryption error:', error);
      }
    }
    return msg;
  });

  res.json(decryptedMessages);
});

export const listChatTemplates = asyncHandler(async (req, res) => {
  const activeOnly = String(req.query.activeOnly || 'true') !== 'false';
  const templates = await ChatTemplate.find(activeOnly ? { active: true } : {})
    .sort({ parentId: 1, priority: -1, order: 1, createdAt: 1 })
    .lean();
  res.json(templates.map((template) => toTemplateNode(template)));
});

export const listAdminChatTemplates = asyncHandler(async (req, res) => {
  const templates = await ChatTemplate.find({})
    .sort({ parentId: 1, priority: -1, order: 1, createdAt: 1 })
    .lean();

  const countRows = await ChatTemplate.aggregate([
    { $group: { _id: '$parentId', count: { $sum: 1 } } }
  ]);
  const countMap = new Map(countRows.map((row) => [String(row._id || 'root'), Number(row.count || 0)]));

  const nodes = templates.map((template) =>
    toTemplateNode(template, { childrenCount: Number(countMap.get(String(template._id)) || 0) })
  );
  res.json({ templates: nodes });
});

export const listRootChatTemplates = asyncHandler(async (req, res) => {
  const user = req.user || null;
  const roots = await loadTemplatesByParent({ parentId: null, user, activeOnly: true });
  const context = await getUserChatContext(user);
  const ranked = rankRootTemplates(roots, context);
  const childrenCountMap = await getChildrenCountMap(ranked.map((item) => item._id), user);

  res.json({
    templates: ranked.slice(0, MAX_CHILDREN_PER_STEP).map((template) =>
      toTemplateNode(template, {
        childrenCount: Number(childrenCountMap.get(String(template._id)) || 0)
      })
    ),
    context: {
      pendingOrders: Number(context.pendingOrders || 0),
      lastNotificationType: context.lastNotificationType || '',
      role: context.role || '',
      accountType: context.accountType || ''
    }
  });
});

export const listChatTemplatesByParent = asyncHandler(async (req, res) => {
  const { parentId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(parentId)) {
    return res.status(400).json({ message: 'Parent invalide.' });
  }

  const user = req.user || null;
  const parent = await ChatTemplate.findById(parentId).lean();
  if (!parent || parent.active === false) {
    return res.status(404).json({ message: 'Étape introuvable.' });
  }

  const children = await loadTemplatesByParent({ parentId, user, activeOnly: true });
  res.json({
    parent: toTemplateNode(parent),
    templates: children.slice(0, MAX_CHILDREN_PER_STEP).map((template) => toTemplateNode(template))
  });
});

export const startChatSession = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Authentification requise.' });

  const { startStepId = null, resume = true } = req.body || {};

  if (resume) {
    const existing = await ChatSession.findOne({ userId, completed: false })
      .sort({ updatedAt: -1 })
      .lean();
    if (existing) {
      return res.json({ session: existing, resumed: true });
    }
  }

  let lastStepId = null;
  if (startStepId) {
    if (!mongoose.Types.ObjectId.isValid(String(startStepId))) {
      return res.status(400).json({ message: 'Étape de départ invalide.' });
    }
    const step = await ChatTemplate.findOne({
      _id: startStepId,
      active: true,
      ...buildRoleFilter(req.user)
    }).lean();
    if (!step) {
      return res.status(404).json({ message: 'Étape de départ introuvable.' });
    }
    lastStepId = step._id;
  }

  const session = await ChatSession.create({
    userId,
    startedAt: new Date(),
    lastStepId,
    completed: false,
    path: lastStepId ? [lastStepId] : []
  });

  res.status(201).json({ session, resumed: false });
});

export const updateChatSession = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { sessionId, lastStepId, completed } = req.body || {};

  if (!sessionId || !mongoose.Types.ObjectId.isValid(String(sessionId))) {
    return res.status(400).json({ message: 'Session invalide.' });
  }

  const session = await ChatSession.findOne({ _id: sessionId, userId });
  if (!session) return res.status(404).json({ message: 'Session introuvable.' });

  if (lastStepId !== undefined && lastStepId !== null && lastStepId !== '') {
    if (!mongoose.Types.ObjectId.isValid(String(lastStepId))) {
      return res.status(400).json({ message: 'Étape invalide.' });
    }

    const step = await ChatTemplate.findOne({
      _id: lastStepId,
      active: true,
      ...buildRoleFilter(req.user)
    }).lean();
    if (!step) return res.status(404).json({ message: 'Étape introuvable.' });

    session.lastStepId = step._id;
    const existsInPath = session.path.some((item) => String(item) === String(step._id));
    if (!existsInPath && session.path.length < TEMPLATE_MAX_DEPTH * MAX_CHILDREN_PER_STEP) {
      session.path.push(step._id);
    }

    await ChatTemplate.updateOne(
      { _id: step._id },
      { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } }
    );
  }

  if (typeof completed === 'boolean') session.completed = completed;
  await session.save();

  res.json({ session });
});

export const getChatSessionByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(String(userId))) {
    return res.status(400).json({ message: 'Utilisateur invalide.' });
  }

  const requesterId = String(req.user?.id || '');
  const requesterRole = String(req.user?.role || '');
  const isAdmin = requesterRole === 'admin' || requesterRole === 'manager';

  if (!isAdmin && requesterId !== String(userId)) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }

  const session = await ChatSession.findOne({ userId })
    .sort({ updatedAt: -1 })
    .populate({ path: 'lastStepId', select: 'title question content response type entityType entityId parentId' })
    .populate({ path: 'path', select: 'title question content response type entityType entityId parentId' })
    .lean();

  if (!session) return res.json({ session: null });

  res.json({
    session: {
      ...session,
      lastStepId: session.lastStepId ? toTemplateNode(session.lastStepId) : null,
      path: Array.isArray(session.path) ? session.path.map((item) => toTemplateNode(item)) : []
    }
  });
});

export const createChatTemplate = asyncHandler(async (req, res) => {
  const payload = parseTemplatePayload(req.body || {});
  if (!payload.title || !payload.content) {
    return res.status(400).json({ message: 'Titre et contenu requis.' });
  }

  if (payload.parentId === '__invalid__') {
    return res.status(400).json({ message: 'Parent invalide.' });
  }

  if (payload.parentId) {
    const parentExists = await ChatTemplate.exists({ _id: payload.parentId });
    if (!parentExists) return res.status(404).json({ message: 'Parent introuvable.' });
  }

  const template = await ChatTemplate.create({
    ...payload,
    parentId: payload.parentId || null,
    createdBy: req.user.id
  });

  await invalidateTemplateCache().catch(() => {});
  res.status(201).json(toTemplateNode(template.toObject()));
});

export const updateChatTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant invalide.' });
  }

  const template = await ChatTemplate.findById(id);
  if (!template) return res.status(404).json({ message: 'Modèle introuvable.' });

  const payload = parseTemplatePayload({ ...template.toObject(), ...(req.body || {}) });
  if (!payload.title || !payload.content) {
    return res.status(400).json({ message: 'Titre et contenu requis.' });
  }

  if (payload.parentId === '__invalid__') {
    return res.status(400).json({ message: 'Parent invalide.' });
  }
  if (payload.parentId && String(payload.parentId) === String(template._id)) {
    return res.status(400).json({ message: 'Un nœud ne peut pas être son propre parent.' });
  }
  if (payload.parentId) {
    const parentExists = await ChatTemplate.exists({ _id: payload.parentId });
    if (!parentExists) return res.status(404).json({ message: 'Parent introuvable.' });
  }

  template.title = payload.title;
  template.question = payload.question;
  template.type = payload.type;
  template.category = payload.category;
  template.content = payload.content;
  template.response = payload.response;
  template.parentId = payload.parentId || null;
  template.order = payload.order;
  template.priority = payload.priority;
  template.entityType = payload.entityType;
  template.entityId = payload.entityId;
  template.roles = payload.roles;
  template.active = payload.active;
  template.metadata = payload.metadata;

  await template.save();
  await invalidateTemplateCache().catch(() => {});
  res.json(toTemplateNode(template.toObject()));
});

export const deleteChatTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant invalide.' });
  }

  const template = await ChatTemplate.findById(id);
  if (!template) return res.status(404).json({ message: 'Modèle introuvable.' });

  const hasChildren = await ChatTemplate.exists({ parentId: template._id });
  if (hasChildren) {
    template.active = false;
    await template.save();
    await invalidateTemplateCache().catch(() => {});
    return res.json({ id: template._id, softDeleted: true });
  }

  await template.deleteOne();
  await invalidateTemplateCache().catch(() => {});
  res.json({ id: template._id, softDeleted: false });
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

export const uploadChatAttachment = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Fichier requis.' });
  }

  try {
    const fileType = req.file.mimetype.startsWith('image/')
      ? 'image'
      : req.file.mimetype.startsWith('audio/')
      ? 'audio'
      : 'document';

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
    // eslint-disable-next-line no-console
    console.error('Upload error:', error);
    res.status(500).json({ message: "Erreur lors de l'upload du fichier." });
  }
});

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

  message.reactions = message.reactions.filter((item) => item.userId.toString() !== req.user.id.toString());
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

export const removeReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ message: 'Identifiant de message invalide.' });
  }

  const message = await ChatMessage.findById(messageId);
  if (!message) {
    return res.status(404).json({ message: 'Message introuvable.' });
  }

  message.reactions = message.reactions.filter((item) => item.userId.toString() !== req.user.id.toString());
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
