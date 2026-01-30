export const requireRole = (roles = []) => (req, res, next) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

export const requireFeedbackAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  // Allow if user is admin or has canReadFeedback permission
  if (req.user.role === 'admin' || req.user.canReadFeedback === true) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};

export const requirePaymentVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  // Allow if user is admin or has canVerifyPayments permission
  if (req.user.role === 'admin' || req.user.canVerifyPayments === true) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};

export const requireBoostManagement = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  // Allow if user is admin or has canManageBoosts permission
  if (req.user.role === 'admin' || req.user.canManageBoosts === true) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};
