import asyncHandler from 'express-async-handler';
import Order from '../models/orderModel.js';
import DeliveryRequest from '../models/deliveryRequestModel.js';
import DeliveryLog from '../models/deliveryLogModel.js';
import User from '../models/userModel.js';

// ─── GET ORDER TRACKING DATA ──────────────────────────────

export const getOrderTracking = asyncHandler(async (req, res) => {
  const orderId = req.params.id;

  const order = await Order.findById(orderId)
    .select('status timeline platformDeliveryRequestId seller customer createdAt')
    .lean();

  if (!order) {
    return res.status(404).json({ message: 'Commande introuvable' });
  }

  // Authorization: only buyer, seller, or admin
  const userId = String(req.user.id);
  const isBuyer = String(order.customer) === userId;
  const isSeller = String(order.seller) === userId;
  const isAdmin = ['admin', 'founder'].includes(req.user.role);
  if (!isBuyer && !isSeller && !isAdmin) {
    return res.status(403).json({ message: 'Accès non autorisé' });
  }

  // Get delivery request if platform delivery
  let deliveryRequest = null;
  if (order.platformDeliveryRequestId) {
    deliveryRequest = await DeliveryRequest.findById(order.platformDeliveryRequestId)
      .select('status currentLocation currentLocationUpdatedAt assignedDeliveryGuyId timeline')
      .populate('assignedDeliveryGuyId', 'name phone')
      .lean();
  }

  // Get delivery logs
  const deliveryLogs = await DeliveryLog.find({ orderId })
    .select('timestamp location actionType')
    .sort({ timestamp: 1 })
    .lean();

  // Get seller and buyer locations
  const [seller, buyer] = await Promise.all([
    User.findById(order.seller).select('shopLocation shopName').lean(),
    User.findById(order.customer).select('location address city commune name').lean()
  ]);

  // Build checkpoints from timeline + delivery logs
  const checkpoints = buildCheckpoints(order, deliveryRequest, deliveryLogs, seller, buyer);

  // Current position
  let currentPosition = null;
  if (deliveryRequest?.currentLocation?.coordinates) {
    currentPosition = {
      lat: deliveryRequest.currentLocation.coordinates[1],
      lng: deliveryRequest.currentLocation.coordinates[0]
    };
  } else if (deliveryLogs.length > 0) {
    const lastLog = deliveryLogs[deliveryLogs.length - 1];
    if (lastLog.location?.latitude && lastLog.location?.longitude) {
      currentPosition = {
        lat: lastLog.location.latitude,
        lng: lastLog.location.longitude
      };
    }
  }

  // Map center (default to current position, seller, or Brazzaville)
  const mapCenter = currentPosition ||
    (seller?.shopLocation?.coordinates
      ? { lat: seller.shopLocation.coordinates[1], lng: seller.shopLocation.coordinates[0] }
      : { lat: -4.2634, lng: 15.2429 }); // Brazzaville center

  res.json({
    orderId: order._id,
    status: order.status,
    createdAt: order.createdAt,
    currentPosition,
    mapCenter,
    checkpoints,
    hasDeliveryRequest: !!deliveryRequest,
    courierName: deliveryRequest?.assignedDeliveryGuyId?.name || null,
    courierPhone: deliveryRequest?.assignedDeliveryGuyId?.phone || null,
    currentPositionUpdatedAt: deliveryRequest?.currentLocationUpdatedAt || null
  });
});

// ─── BUILD CHECKPOINTS ────────────────────────────────────

const CHECKPOINT_ICONS = {
  placed: { icon: '🛒', label: 'Commandé' },
  confirmed: { icon: '✅', label: 'Confirmé' },
  accepted: { icon: '📦', label: 'Accepté' },
  ready_for_delivery: { icon: '📋', label: 'Prêt' },
  delivery_assigned: { icon: '🚚', label: 'Livreur assigné' },
  delivering: { icon: '🚀', label: 'En livraison' },
  delivery_in_progress: { icon: '🚀', label: 'En livraison' },
  delivery_proof_submitted: { icon: '📸', label: 'Preuve soumise' },
  delivered: { icon: '🏠', label: 'Livré' },
  completed: { icon: '✅', label: 'Terminé' },
  picked_up_confirmed: { icon: '🤝', label: 'Récupéré' },
  confirmed_by_client: { icon: '✅', label: 'Confirmé' }
};

const buildCheckpoints = (order, deliveryRequest, deliveryLogs, seller, buyer) => {
  const checkpoints = [];

  // 1. Order placed
  if (order.createdAt) {
    checkpoints.push({
      type: 'placed',
      icon: '🛒',
      label: 'Commande passée',
      time: order.createdAt,
      description: 'Votre commande a été enregistrée',
      active: true
    });
  }

  // 2. Timeline events from order
  const timeline = Array.isArray(order.timeline) ? order.timeline : [];
  for (const event of timeline) {
    const config = CHECKPOINT_ICONS[event.type] || { icon: '📍', label: event.type };
    checkpoints.push({
      type: event.type,
      icon: config.icon,
      label: config.label,
      time: event.at,
      description: '',
      active: true,
      by: event.by
    });
  }

  // 3. Delivery logs with coordinates
  for (const log of deliveryLogs) {
    const hasCoords = log.location?.latitude && log.location?.longitude;
    checkpoints.push({
      type: log.actionType,
      icon: log.actionType === 'SIGNATURE_CAPTURED' ? '✍️' : '📸',
      label: log.actionType === 'PROOF_UPLOADED' ? 'Preuve de livraison' :
             log.actionType === 'SIGNATURE_CAPTURED' ? 'Signature' : 'Confirmation',
      time: log.timestamp,
      description: '',
      active: true,
      coordinates: hasCoords ? { lat: log.location.latitude, lng: log.location.longitude } : null
    });
  }

  // 4. Seller location
  if (seller?.shopLocation?.coordinates) {
    checkpoints.push({
      type: 'seller_location',
      icon: '🏪',
      label: `Boutique: ${seller.shopName || 'Vendeur'}`,
      time: order.createdAt,
      description: '',
      active: true,
      coordinates: {
        lat: seller.shopLocation.coordinates[1],
        lng: seller.shopLocation.coordinates[0]
      }
    });
  }

  // 5. Buyer location
  if (buyer?.location?.coordinates) {
    checkpoints.push({
      type: 'buyer_location',
      icon: '🏠',
      label: `Livraison: ${buyer.name || 'Acheteur'}`,
      time: order.createdAt,
      description: '',
      active: true,
      coordinates: {
        lat: buyer.location.coordinates[1],
        lng: buyer.location.coordinates[0]
      }
    });
  }

  // Sort by time
  checkpoints.sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0));

  // Mark last checkpoint as current
  if (checkpoints.length > 0) {
    checkpoints[checkpoints.length - 1].isCurrent = true;
  }

  return checkpoints;
};
