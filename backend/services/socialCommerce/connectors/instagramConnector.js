import { MetaMessagingConnector } from './metaMessagingConnector.js';

export class InstagramConnector extends MetaMessagingConnector {
  constructor(opts) {
    super({ ...opts, channel: 'INSTAGRAM' });
  }
}
