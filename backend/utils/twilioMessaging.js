import twilio from 'twilio';
import { normalizePhone } from './firebaseVerification.js';

const getTwilioMessagingConfig = () => ({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  fromNumber: process.env.TWILIO_FROM_NUMBER || '+18777804236'
});

export const isTwilioMessagingConfigured = () => {
  const { accountSid, authToken, fromNumber } = getTwilioMessagingConfig();
  return Boolean(accountSid && authToken && fromNumber);
};

const getTwilioMessagingClient = () => {
  const { accountSid, authToken, fromNumber } = getTwilioMessagingConfig();
  if (!accountSid || !authToken || !fromNumber) {
    const err = new Error(
      'Twilio n’est pas configuré pour les SMS. Définissez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_FROM_NUMBER.'
    );
    err.status = 503;
    throw err;
  }
  return { client: twilio(accountSid, authToken), fromNumber };
};

export const sendSms = async (phone, body) => {
  const { client, fromNumber } = getTwilioMessagingClient();
  const to = normalizePhone(phone);
  if (!to) {
    const err = new Error('Numéro de téléphone invalide.');
    err.status = 400;
    throw err;
  }
  if (!body || !body.trim()) {
    const err = new Error('Message SMS vide.');
    err.status = 400;
    throw err;
  }
  return client.messages.create({
    to,
    from: fromNumber,
    body: body.trim()
  });
};
