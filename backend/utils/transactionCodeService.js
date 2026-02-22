import Payment from '../models/paymentModel.js';
import ShopConversionRequest from '../models/shopConversionRequestModel.js';
import BoostRequest from '../models/boostRequestModel.js';
import Order from '../models/orderModel.js';

const TRANSACTION_CODE_REGEX = /^\d{10}$/;

export const normalizeTransactionCode = (value) => String(value || '').replace(/\D/g, '').trim();

export const isTransactionCodeValid = (value) => TRANSACTION_CODE_REGEX.test(normalizeTransactionCode(value));

const collectDistinctCodes = async (codes) => {
  const [paymentCodes, conversionCodes, boostCodes, orderPaymentCodes, installmentCodes] =
    await Promise.all([
      Payment.distinct('transactionNumber', { transactionNumber: { $in: codes } }),
      ShopConversionRequest.distinct('transactionNumber', { transactionNumber: { $in: codes } }),
      BoostRequest.distinct('paymentTransactionId', { paymentTransactionId: { $in: codes } }),
      Order.distinct('paymentTransactionCode', { paymentTransactionCode: { $in: codes } }),
      Order.distinct('installmentPlan.schedule.transactionProof.transactionCode', {
        'installmentPlan.schedule.transactionProof.transactionCode': { $in: codes }
      })
    ]);

  return [
    ...(Array.isArray(paymentCodes) ? paymentCodes : []),
    ...(Array.isArray(conversionCodes) ? conversionCodes : []),
    ...(Array.isArray(boostCodes) ? boostCodes : []),
    ...(Array.isArray(orderPaymentCodes) ? orderPaymentCodes : []),
    ...(Array.isArray(installmentCodes) ? installmentCodes : [])
  ];
};

export const findUsedTransactionCodes = async (inputCodes = []) => {
  const normalizedCodes = Array.from(
    new Set(
      (Array.isArray(inputCodes) ? inputCodes : [inputCodes])
        .map(normalizeTransactionCode)
        .filter((code) => TRANSACTION_CODE_REGEX.test(code))
    )
  );

  if (!normalizedCodes.length) {
    return new Set();
  }

  const distinctMatches = await collectDistinctCodes(normalizedCodes);
  const used = new Set(
    distinctMatches
      .map(normalizeTransactionCode)
      .filter((code) => TRANSACTION_CODE_REGEX.test(code) && normalizedCodes.includes(code))
  );

  return used;
};

export const isTransactionCodeAlreadyUsed = async (code) => {
  const normalized = normalizeTransactionCode(code);
  if (!TRANSACTION_CODE_REGEX.test(normalized)) {
    return false;
  }
  const used = await findUsedTransactionCodes([normalized]);
  return used.has(normalized);
};

export const TRANSACTION_CODE_REUSED_MESSAGE =
  'Ce code de transaction a déjà été utilisé. Veuillez saisir un code unique.';
