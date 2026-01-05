import twilio from 'twilio';

const getTwilioConfig = () => ({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  serviceSid: process.env.TWILIO_VERIFY_SERVICE_SID
});

export const isTwilioConfigured = () => {
  const { accountSid, authToken, serviceSid } = getTwilioConfig();
  return Boolean(accountSid && authToken && serviceSid);
};

const getTwilioClient = () => {
  const { accountSid, authToken, serviceSid } = getTwilioConfig();
  if (!accountSid || !authToken || !serviceSid) {
    const err = new Error(
      'Twilio n’est pas configuré. Définissez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_VERIFY_SERVICE_SID.'
    );
    err.status = 503;
    throw err;
  }
  return { client: twilio(accountSid, authToken), serviceSid };
};

export const normalizePhone = (phone) => {
  const raw = typeof phone === 'string' ? phone.trim() : phone ? String(phone).trim() : '';
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) {
    return `+${digits}`;
  }
  if (digits.startsWith('00')) {
    return `+${digits.slice(2)}`;
  }
  if (digits.startsWith('242')) {
    return `+${digits}`;
  }
  return `+242${digits}`;
};

export const buildPhoneCandidates = (phone) => {
  const raw = typeof phone === 'string' ? phone.trim() : phone ? String(phone).trim() : '';
  if (!raw) return [];
  const compact = raw.replace(/\s+/g, '');
  const normalized = normalizePhone(raw);
  const candidates = [raw, compact, normalized].filter(Boolean);
  return Array.from(new Set(candidates));
};

export const sendVerificationCode = async (phone, channel = 'sms') => {
  const { client, serviceSid } = getTwilioClient();
  const to = normalizePhone(phone);
  if (!to) {
    const err = new Error('Numéro de téléphone invalide.');
    err.status = 400;
    throw err;
  }
  try {
    return await client.verify.v2.services(serviceSid).verifications.create({ to, channel });
  } catch (error) {
    if (error?.code === 60200) {
      const err = new Error(
        'Numéro de téléphone invalide. Utilisez le format international (ex: +242XXXXXXXXX).'
      );
      err.status = 400;
      throw err;
    }
    throw error;
  }
};

export const checkVerificationCode = async (phone, code) => {
  const { client, serviceSid } = getTwilioClient();
  const to = normalizePhone(phone);
  if (!to) {
    const err = new Error('Numéro de téléphone invalide.');
    err.status = 400;
    throw err;
  }
  if (!code) {
    const err = new Error('Code de vérification manquant.');
    err.status = 400;
    throw err;
  }
  try {
    return await client.verify.v2.services(serviceSid).verificationChecks.create({ to, code });
  } catch (error) {
    if (error?.code === 60200) {
      const err = new Error(
        'Numéro de téléphone invalide. Utilisez le format international (ex: +242XXXXXXXXX).'
      );
      err.status = 400;
      throw err;
    }
    throw error;
  }
};
