import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Notification from '../models/notificationModel.js';

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const hasApplyFlag = process.argv.includes('--apply');
const hasVerboseFlag = process.argv.includes('--verbose');

const extractObjectId = (value, depth = 0) => {
  if (depth > 3 || value == null) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return OBJECT_ID_REGEX.test(trimmed) ? trimmed : '';
  }

  if (typeof value === 'object') {
    const candidates = [value._id, value.id, value.$oid, value.orderId, value.value];
    for (const candidate of candidates) {
      const resolved = extractObjectId(candidate, depth + 1);
      if (resolved) return resolved;
    }
  }

  return '';
};

const normalizeUrl = (value) => String(value || '').trim();

const extractOrderIdFromLink = (value) => {
  const raw = normalizeUrl(value);
  if (!raw || raw.includes('[object Object]')) return '';

  try {
    const parsed = new URL(raw, 'https://hdmarket.local');
    const queryOrderId = extractObjectId(parsed.searchParams.get('orderId'));
    if (queryOrderId) return queryOrderId;

    const path = parsed.pathname || '';
    const pathMatch = path.match(/\/(?:orders|seller\/orders)\/detail\/([a-f\d]{24})/i);
    if (pathMatch?.[1]) return pathMatch[1];
  } catch {
    const plainMatch = raw.match(/([a-f\d]{24})/i);
    if (plainMatch?.[1]) return plainMatch[1];
  }

  return '';
};

const resolveOrderId = (notification) => {
  const metadata = notification?.metadata && typeof notification.metadata === 'object'
    ? notification.metadata
    : {};

  return (
    extractObjectId(metadata.orderId) ||
    extractObjectId(notification?.entityId) ||
    extractObjectId(metadata.entityId) ||
    extractOrderIdFromLink(notification?.deepLink) ||
    extractOrderIdFromLink(notification?.actionLink) ||
    extractOrderIdFromLink(metadata.deepLink)
  );
};

const buildMessageLink = (orderId) =>
  orderId
    ? `/orders/messages?orderId=${encodeURIComponent(orderId)}`
    : '/orders/messages';

const run = async () => {
  await connectDB();

  const cursor = Notification.find({ type: 'order_message' })
    .select('_id type deepLink actionLink metadata entityId')
    .cursor();

  let scanned = 0;
  let toUpdate = 0;
  let alreadyClean = 0;
  let unresolvedOrderId = 0;
  const operations = [];

  for await (const notification of cursor) {
    scanned += 1;

    const metadata =
      notification?.metadata && typeof notification.metadata === 'object'
        ? notification.metadata
        : {};

    const orderId = resolveOrderId(notification);
    if (!orderId) unresolvedOrderId += 1;

    const targetLink = buildMessageLink(orderId);
    const currentDeepLink = normalizeUrl(notification?.deepLink);
    const currentActionLink = normalizeUrl(notification?.actionLink);
    const currentMetadataDeepLink = normalizeUrl(metadata?.deepLink);

    const needsUpdate =
      currentDeepLink !== targetLink ||
      currentActionLink !== targetLink ||
      currentMetadataDeepLink !== targetLink;

    if (!needsUpdate) {
      alreadyClean += 1;
      continue;
    }

    toUpdate += 1;

    if (hasVerboseFlag) {
      // eslint-disable-next-line no-console
      console.log(
        `[migrate:order-message-deeplinks] ${String(notification._id)} -> ${targetLink}`
      );
    }

    if (hasApplyFlag) {
      operations.push({
        updateOne: {
          filter: { _id: notification._id },
          update: {
            $set: {
              deepLink: targetLink,
              actionLink: targetLink,
              metadata: {
                ...metadata,
                deepLink: targetLink
              }
            }
          }
        }
      });
    }

    if (operations.length >= 500) {
      // eslint-disable-next-line no-await-in-loop
      await Notification.bulkWrite(operations, { ordered: false });
      operations.length = 0;
    }
  }

  if (hasApplyFlag && operations.length) {
    await Notification.bulkWrite(operations, { ordered: false });
  }

  // eslint-disable-next-line no-console
  console.log('[migrate:order-message-deeplinks] Summary');
  // eslint-disable-next-line no-console
  console.log(`- mode: ${hasApplyFlag ? 'APPLY' : 'DRY_RUN'}`);
  // eslint-disable-next-line no-console
  console.log(`- scanned: ${scanned}`);
  // eslint-disable-next-line no-console
  console.log(`- toUpdate: ${toUpdate}`);
  // eslint-disable-next-line no-console
  console.log(`- alreadyClean: ${alreadyClean}`);
  // eslint-disable-next-line no-console
  console.log(`- unresolvedOrderId: ${unresolvedOrderId}`);
};

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[migrate:order-message-deeplinks] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
