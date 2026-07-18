import React, { useContext, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import {
  setAnalyticsUser,
  trackPageView,
  trackRealtimeMonitoringEvent
} from '../services/analytics';
import { hasAnalyticsConsent, PRIVACY_EVENT } from '../services/privacyPreferences';

export default function AnalyticsTracker() {
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const [analyticsAllowed, setAnalyticsAllowed] = React.useState(hasAnalyticsConsent);

  useEffect(() => {
    const update = () => setAnalyticsAllowed(hasAnalyticsConsent());
    window.addEventListener(PRIVACY_EVENT, update);
    return () => window.removeEventListener(PRIVACY_EVENT, update);
  }, []);

  useEffect(() => {
    if (analyticsAllowed) setAnalyticsUser(user);
  }, [user, analyticsAllowed]);

  useEffect(() => {
    if (!analyticsAllowed) return;
    const path = `${location.pathname}${location.search || ''}`;
    trackPageView({ path });
    trackRealtimeMonitoringEvent({
      eventType: 'page_view',
      path,
      role: user?.role || '',
      accountType: user?.accountType || ''
    });
  }, [location, user?.role, user?.accountType, analyticsAllowed]);

  return null;
}
