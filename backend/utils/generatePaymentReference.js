import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const formatDatePart = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const randomToken = (length = 5) => {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map((byte) => ALPHABET[byte % ALPHABET.length])
    .join('');
};

export const generatePaymentReference = (date = new Date()) =>
  `HDM-PAY-${formatDatePart(date)}-${randomToken(5)}`;

export default generatePaymentReference;
