import posthog from 'posthog-js';
import { guardMonitoringTransport } from '../../src/services/monitoringTransport';

let allowed = true;
posthog.init('phc_test', {
  api_host: `${window.location.origin}/__privacy_ingest`,
  autocapture: false, capture_pageview: false, capture_pageleave: false,
  advanced_disable_flags: true, disable_session_recording: true,
  disable_external_dependency_loading: true, disable_surveys: true,
  disable_conversations: true, disable_product_tours: true,
  opt_out_persistence_by_default: true,
  opt_out_useragent_filter: true,
  before_send: event => allowed ? event : null
});
const guard = guardMonitoringTransport(posthog, () => allowed);
if (!guard) throw new Error('Installed SDK dispatch interface changed');
window.privacyTransportTest = {
  queueThenWithdraw() {
    posthog.capture('queued_with_consent');
    allowed = false;
    posthog.opt_out_capturing();
    guard.revoke();
  },
  grantAndCapture() {
    allowed = true;
    guard.resume();
    posthog.opt_in_capturing({ captureEventName: false });
    posthog.capture('new_consent', {}, { send_instantly: true });
  }
};
document.getElementById('status').textContent = 'Transport ready';
