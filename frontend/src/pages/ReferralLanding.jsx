import React, { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { storage } from '../utils/storage';

export const REFERRAL_CODE_STORAGE_KEY = 'hdmarket:referral-code';

/**
 * `/r/:code` — referral share link. Persists the code so it survives the
 * registration flow, then hands off to /register.
 */
export default function ReferralLanding() {
  const { code } = useParams();

  useEffect(() => {
    if (code) {
      storage.set(REFERRAL_CODE_STORAGE_KEY, String(code).trim().toUpperCase());
    }
  }, [code]);

  return <Navigate to="/register" replace />;
}
