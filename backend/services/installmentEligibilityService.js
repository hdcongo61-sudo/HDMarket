import mongoose from 'mongoose';
import Order from '../models/orderModel.js';

export const calculateInstallmentEligibilityScore = async (customerId, session = null) => {
  const [summary = {}] = await Order.aggregate([
    { $match: { customer: new mongoose.Types.ObjectId(customerId), isDraft: { $ne: true } } },
    { $group: {
      _id: null,
      totalOrders: { $sum: 1 },
      deliveredOrders: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'completed']] }, 1, 0] } },
      cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
      completedInstallments: { $sum: { $cond: [{ $and: [
        { $eq: ['$paymentType', 'installment'] }, { $in: ['$status', ['installment_paid', 'completed']] }
      ] }, 1, 0] } },
      overdueCount: { $sum: { $cond: [{ $and: [
        { $eq: ['$paymentType', 'installment'] }, { $eq: ['$status', 'overdue_installment'] }
      ] }, 1, 0] } }
    } }
  ]).session(session);
  const completionRate = summary.totalOrders > 0 ? summary.deliveredOrders / summary.totalOrders : 0;
  const cancellationRate = summary.totalOrders > 0 ? summary.cancelledOrders / summary.totalOrders : 0;
  const score = 55 + Math.round(completionRate * 30) + Math.min(10, Number(summary.completedInstallments || 0) * 2)
    - Math.round(cancellationRate * 25) - Math.min(20, Number(summary.overdueCount || 0) * 4);
  return Math.max(0, Math.min(100, score));
};
