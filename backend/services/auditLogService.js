import AuditLog from '../models/auditLogModel.js';

const extractIp = (req = {}) => {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || '';
};

const extractDevice = (req = {}) => String(req.headers?.['user-agent'] || '');

export const createAuditLogEntry = async ({
  performedBy,
  targetUser = null,
  actionType,
  previousValue = null,
  newValue = null,
  req = null,
  meta = {}
} = {}) => {
  if (!performedBy || !actionType) return null;
  try {
    return await AuditLog.create({
      performedBy,
      targetUser,
      actionType,
      previousValue,
      newValue,
      ip: req ? extractIp(req) : '',
      device: req ? extractDevice(req) : '',
      meta: meta && typeof meta === 'object' ? meta : {}
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Audit log write error:', error?.message || error);
    }
    return null;
  }
};
