import admin from 'firebase-admin';

let firebaseApp = null;

const parseServiceAccount = () => {
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!raw) return null;

  try {
    const json = raw.trim().startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const getFirebaseAdminApp = () => {
  if (firebaseApp) return firebaseApp;
  if (admin.apps?.length) {
    firebaseApp = admin.app();
    return firebaseApp;
  }

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) return null;
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    ...(process.env.FIREBASE_STORAGE_BUCKET ? { storageBucket: process.env.FIREBASE_STORAGE_BUCKET } : {})
  });
  return firebaseApp;
};

export const getFirebaseAdminAuth = () => {
  const app = getFirebaseAdminApp();
  return app ? admin.auth(app) : null;
};

export const getFirebaseAdminStorage = () => {
  const app = getFirebaseAdminApp();
  if (!app || !process.env.FIREBASE_STORAGE_BUCKET) return null;
  return admin.storage(app);
};
