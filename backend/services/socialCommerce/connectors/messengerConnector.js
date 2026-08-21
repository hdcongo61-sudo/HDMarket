import { MetaMessagingConnector } from './metaMessagingConnector.js';

export class MessengerConnector extends MetaMessagingConnector {
  constructor(opts) {
    super({ ...opts, channel: 'FACEBOOK_MESSENGER' });
  }
}
