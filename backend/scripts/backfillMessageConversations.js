/**
 * One-time backfill: sets `conversation` on every historical OrderMessage
 * document (previously keyed only by `order`, before the buyer/seller
 * messaging redesign that lets a conversation exist without an order).
 *
 * For each distinct `order` referenced by existing messages, finds or
 * creates the matching order-anchored Conversation (buyerId = order.customer,
 * sellerId = first item's shopId), then sets `conversation` on all of that
 * order's messages. Dry-run by default — pass --apply to write.
 *
 * Must run against the target database BEFORE deploying the schema change
 * that makes OrderMessage.conversation required, or any load-then-save on a
 * historical message (e.g. reactions) will fail validation.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import OrderMessage from '../models/orderMessageModel.js';
import Order from '../models/orderModel.js';
import Conversation from '../models/conversationModel.js';

const hasApplyFlag = process.argv.includes('--apply');
const hasVerboseFlag = process.argv.includes('--verbose');

const getOrderSellerId = (order) => order?.items?.[0]?.snapshot?.shopId || null;

const run = async () => {
  await connectDB();

  const orderIds = await OrderMessage.distinct('order', {
    order: { $ne: null },
    conversation: { $exists: false }
  });

  let scanned = 0;
  let conversationsCreated = 0;
  let conversationsReused = 0;
  let messagesUpdated = 0;
  let unresolvedOrders = 0;

  for (const orderId of orderIds) {
    scanned += 1;

    const order = await Order.findById(orderId).select('customer items.snapshot.shopId').lean();
    if (!order) {
      unresolvedOrders += 1;
      if (hasVerboseFlag) {
        console.log(`[backfill:message-conversations] order ${String(orderId)} not found, skipping`);
      }
      continue;
    }

    const sellerId = getOrderSellerId(order);
    if (!order.customer || !sellerId) {
      unresolvedOrders += 1;
      if (hasVerboseFlag) {
        console.log(`[backfill:message-conversations] order ${String(orderId)} missing customer/seller, skipping`);
      }
      continue;
    }

    let conversation = await Conversation.findOne({ orderId });
    if (!conversation) {
      conversationsCreated += 1;
      if (hasApplyFlag) {
        conversation = await Conversation.create({ buyerId: order.customer, sellerId, orderId });
      }
    } else {
      conversationsReused += 1;
    }

    if (hasVerboseFlag) {
      console.log(`[backfill:message-conversations] order ${String(orderId)} -> conversation ${String(conversation?._id || '(dry-run)')}`);
    }

    if (hasApplyFlag && conversation) {
      const result = await OrderMessage.updateMany(
        { order: orderId, conversation: { $exists: false } },
        { $set: { conversation: conversation._id } }
      );
      messagesUpdated += Number(result?.modifiedCount || 0);
    } else {
      const count = await OrderMessage.countDocuments({ order: orderId, conversation: { $exists: false } });
      messagesUpdated += count;
    }
  }

  console.log('[backfill:message-conversations] Summary');
  console.log(`- mode: ${hasApplyFlag ? 'APPLY' : 'DRY_RUN'}`);
  console.log(`- distinct orders scanned: ${scanned}`);
  console.log(`- conversations created: ${conversationsCreated}`);
  console.log(`- conversations reused: ${conversationsReused}`);
  console.log(`- messages ${hasApplyFlag ? 'updated' : 'pending update'}: ${messagesUpdated}`);
  console.log(`- unresolved orders (skipped): ${unresolvedOrders}`);
};

run()
  .catch((error) => {
    console.error('[backfill:message-conversations] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
