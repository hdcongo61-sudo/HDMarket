import { useContext, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import {
  setAnalyticsUser,
  trackPageView,
  trackRealtimeMonitoringEvent
} from '../services/analytics';

export default function AnalyticsTracker() {
  const location = useLocation();
  const { user } = useContext(AuthContext);

  useEffect(() => {
    setAnalyticsUser(user);
  }, [user]);

  useEffect(() => {
    const path = `${location.pathname}${location.search || ''}`;
    trackPageView({ path });
    trackRealtimeMonitoringEvent({
      eventType: 'page_view',
      path,
      role: user?.role || '',
      accountType: user?.accountType || ''
    });
  }, [location, user?.role, user?.accountType]);

  return null;
}
