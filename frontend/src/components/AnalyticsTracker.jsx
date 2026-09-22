import React, { useContext, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import {
  setAnalyticsUser,
  disableAnalytics,
  trackPageView,
  trackRealtimeMonitoringEvent
} from '../services/analytics';
import { hasAnalyticsConsent, subscribePrivacyPreference } from '../services/privacyPreferences';

export default function AnalyticsTracker() {
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const [analyticsAllowed, setAnalyticsAllowed] = React.useState(hasAnalyticsConsent);

  useEffect(() => subscribePrivacyPreference(() => {
    const allowed = hasAnalyticsConsent();
    if (!allowed) disableAnalytics();
    setAnalyticsAllowed(allowed);
  }), []);

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
