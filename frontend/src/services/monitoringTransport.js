// posthog-js 1.x only checks consent when capturing, before batching/retrying.
// Guard its dispatch boundaries as well. Keep this adapter covered when upgrading
// the SDK; fail closed if these installed-SDK interfaces change.
export const guardMonitoringTransport = (instance, permitted) => {
  // The distributed bundle mangles field names, but keeps these queue methods.
  const values = Object.values(instance);
  const batches = values.filter(value => typeof value?.enqueue === 'function' && typeof value?.unload === 'function' && typeof value?.enable === 'function');
  const retries = values.filter(value => typeof value?.retriableRequest === 'function' && typeof value?.unload === 'function' && typeof value?.resume === 'function');
  if (batches.length !== 1 || retries.length !== 1) return null;
  const [batch] = batches;
  const [retry] = retries;
  const targets = [
    [instance, '_send_request'],
    [batch, 'enqueue'],
    [retry, 'retriableRequest']
  ];
  if (targets.some(([owner, method]) => typeof owner?.[method] !== 'function')) return null;
  let epoch = 0;
  for (const [owner, method] of targets) {
    const send = owner[method].bind(owner);
    owner[method] = (request, ...args) => {
      if (!permitted()) return;
      if (request.hdmarketConsentEpoch !== undefined && request.hdmarketConsentEpoch !== epoch) return;
      return send({ ...request, hdmarketConsentEpoch: epoch }, ...args);
    };
  }
  return {
    revoke() {
      epoch += 1;
      // Drain obsolete requests through the guarded methods, without sending.
      batch.unload();
      retry.unload();
    },
    resume() { retry.resume(); }
  };
};
