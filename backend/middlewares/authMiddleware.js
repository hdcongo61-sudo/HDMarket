import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  let token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token && req.query?.token) {
    token = req.query.token;
  }
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('role isBlocked blockedReason');
    if (!user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    if (user.isBlocked) {
      const reason = user.blockedReason ? ` Motif : ${user.blockedReason}` : '';
      return res.status(403).json({
        message: `Votre compte est suspendu. Contactez l’administrateur pour plus d’informations.${reason}`,
        reason: user.blockedReason || '',
        code: 'ACCOUNT_BLOCKED'
      });
    }
    req.user = { id: user._id.toString(), role: user.role };
    if (req.query?.token) {
      delete req.query.token;
    }
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Token invalid' });
  }
};

export const admin = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ message: 'Seuls les administrateurs peuvent accéder à cette ressource.' });
};
