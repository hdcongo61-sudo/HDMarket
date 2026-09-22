import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import City from '../models/cityModel.js';
import Commune from '../models/communeModel.js';
import User from '../models/userModel.js';
import DeliveryRequest from '../models/deliveryRequestModel.js';
import Checkout from '../models/pawapayCheckoutModel.js';
import { withCommerceOperation } from './commerceOperationService.js';
import { orderConflict, orderOperationKey } from './orderCancellationService.js';
import { resolveDeliveryPricing } from '../utils/deliveryPricing.js';
import { isDeliveryFeeLocked } from './orderDeliveryFeeService.js';

export const quoteOrderAddress = async ({ orderId, userId, input, session = null }) => {
  const order = await Order.findOne({ _id: orderId, customer: userId }).session(session);
  if (!order) throw orderConflict('Commande introuvable.', 404);
  if (!input?.shippingAddress) throw orderConflict('Sélectionnez une ville, une commune, une adresse et un téléphone.', 400);
  if (order.deliveryMode !== 'DELIVERY' || ['cancelled', 'completed', 'confirmed_by_client', 'picked_up_confirmed', 'delivered', 'dispute_opened'].includes(order.status) ||
    order.disputeOpened || ['pending', 'processed'].includes(order.refundStatus) ||
    ['delivering', 'delivered'].includes(order.installmentSaleStatus) || (order.sponsoredPayment?.isSponsored && order.sponsoredPayment?.status === 'pending')) throw orderConflict('Cette adresse ne peut plus être modifiée.');
  const pendingPayment = await Checkout.exists({ 'actionContext.orderId': String(orderId), $or: [
    { status: { $in: ['CREATED', 'WAITING_PAYMENT', 'PROCESSING'] } },
    { paymentState: 'CONFIRMED', autoValidationState: { $ne: 'COMPLETED' } }
  ] }).session(session);
  if (pendingPayment) throw orderConflict('Attendez la fin du paiement avant de modifier l’adresse.');
  const address = input.shippingAddress || {};
  if (!mongoose.isValidObjectId(address.cityId) || !mongoose.isValidObjectId(address.communeId) ||
    String(address.addressLine || '').trim().length < 4 || !String(address.phone || '').trim()) throw orderConflict('Sélectionnez une ville, une commune, une adresse et un téléphone.', 400);
  const city = await City.findOne({ _id: address.cityId, countryId: order.countryId, isActive: true }).session(session);
  const commune = await Commune.findOne({ _id: address.communeId, cityId: address.cityId, countryId: order.countryId, isActive: true }).session(session);
  if (!city || !commune) throw orderConflict('La destination doit appartenir au pays de la commande.', 400);
  const destination = { cityId: city._id, cityName: city.name, communeId: commune._id, communeName: commune.name,
    addressLine: String(address.addressLine).trim().slice(0, 300), phone: String(address.phone).trim().slice(0, 30) };
  const seller = await User.findById(order.items[0]?.snapshot.shopId).session(session).lean();
  const delivery = resolveDeliveryPricing({ deliveryMode: 'DELIVERY', commune, shop: seller, items: order.items.map(item => item.snapshot) });
  const fee = isDeliveryFeeLocked(order) ? Number(order.deliveryFeeTotal) : Math.round(delivery.deliveryFeeTotal);
  if (order.paymentType === 'installment' && fee !== Number(order.deliveryFeeTotal)) throw orderConflict('Ce changement modifie les frais du devis en tranches. Contactez le support.');
  const totalAmount = Number(order.totalAmount) - Number(order.deliveryFeeTotal) + fee;
  if (totalAmount < Number(order.paidAmount) + Number(order.cashCollectedAmount || 0)) throw orderConflict('Ce changement nécessite un remboursement. Contactez le support.');
  const request = await DeliveryRequest.findOne({ orderId: order._id, status: { $nin: ['CANCELED', 'REJECTED', 'FAILED'] } }).session(session);
  if (request && (request.status !== 'PENDING' || request.assignmentStatus === 'ACCEPTED' ||
    String(order.shippingAddressSnapshot?.communeId) !== String(commune._id) || fee !== Number(order.deliveryFeeTotal))) {
    throw orderConflict('Une livraison est déjà organisée. Faites annuler la demande avant de changer de destination.');
  }
  return { order, request, destination, deliveryFeeTotal: fee, totalAmount, remainingAmount: totalAmount - Number(order.paidAmount) - Number(order.cashCollectedAmount || 0),
    deliveryFeeSource: isDeliveryFeeLocked(order) ? order.deliveryFeeSource : delivery.deliveryFeeSource };
};

export const changeOrderAddress = args => withCommerceOperation(orderOperationKey(args.orderId), async session => {
  const quote = await quoteOrderAddress({ ...args, session });
  const { order, request, destination } = quote;
  if (Number(args.input.expectedDeliveryFee) !== quote.deliveryFeeTotal || Number(args.input.expectedTotalAmount) !== quote.totalAmount) throw orderConflict('Vérifiez les nouveaux frais de livraison avant de confirmer.');
  if (request) {
    const updated = await DeliveryRequest.updateOne({ _id: request._id, status: 'PENDING', assignmentStatus: { $ne: 'ACCEPTED' }, updatedAt: request.updatedAt }, {
      $set: { dropoff: { cityId: destination.cityId, cityName: destination.cityName, communeId: destination.communeId,
        communeName: destination.communeName, address: destination.addressLine, coordinates: null } },
      $push: { timeline: { type: 'BUYER_ADDRESS_UPDATED', by: args.userId, at: new Date() } }
    }, { session });
    if (!updated.matchedCount) throw orderConflict('La livraison a changé. Actualisez avant de réessayer.');
  }
  order.shippingAddressSnapshot = destination;
  order.deliveryAddress = destination.addressLine;
  order.deliveryCity = destination.cityName;
  order.deliveryFeeTotal = quote.deliveryFeeTotal;
  order.deliveryFeeSource = quote.deliveryFeeSource;
  order.totalAmount = quote.totalAmount;
  order.remainingAmount = quote.remainingAmount;
  if (order.installmentPlan) order.markModified('installmentPlan');
  await order.save({ session });
  return order;
});
