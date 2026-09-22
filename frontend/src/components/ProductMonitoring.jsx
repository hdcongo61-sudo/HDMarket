import { useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import CartContext from '../context/CartContext';
import { hasAnalyticsConsent, subscribePrivacyPreference } from '../services/privacyPreferences';
import { initProductMonitoring, disableProductMonitoring, setMonitoringUser, monitoringPage, captureMonitoring } from '../services/productMonitoring';

export default function ProductMonitoring() {
  const { user, loading } = useContext(AuthContext);
  const { cart, loading: cartLoading } = useContext(CartContext);
  const location = useLocation();
  const [consent, setConsent] = useState(() => { try { return hasAnalyticsConsent(); } catch { return false; } });
  const [ready, setReady] = useState(false);
  const lastView = useRef('');
  const lastCheckoutView = useRef('');
  useEffect(() => subscribePrivacyPreference(() => {
    const allowed = hasAnalyticsConsent();
    if (!allowed) disableProductMonitoring();
    setConsent(allowed);
  }), []);
  useEffect(() => {
    let active = true;
    if (!consent) { disableProductMonitoring(); setReady(false); lastView.current = ''; return; }
    initProductMonitoring().then(instance => { if (active) setReady(Boolean(instance)); });
    return () => { active = false; };
  }, [consent]);
  useEffect(() => {
    if (!ready || !consent || loading) return;
    setMonitoringUser(user);
    const identity = String(user?._id || user?.id || 'guest');
    const viewKey = `${location.key}:${identity}`;
    if (lastView.current === viewKey) return;
    lastView.current = viewKey;
    const page = monitoringPage(location.pathname);
    captureMonitoring('$pageview', { page, $pathname: page, $current_url: `${window.location.origin}${page}` });
    const event = page === '/product/:item' ? 'product_viewed' : page === '/cart' ? 'cart_viewed' : page === '/payment' ? 'payment_return_viewed' : page === '/search' ? 'search_viewed' : null;
    if (event) captureMonitoring(event, { page });
  }, [ready, consent, loading, user, location.key, location.pathname]);
  useEffect(() => {
    if (!ready || !consent || loading || cartLoading || !user || !cart.items?.length || location.pathname !== '/orders/checkout') return;
    const key = `${location.key}:${user._id || user.id}`;
    if (lastCheckoutView.current === key) return;
    if (captureMonitoring('checkout_viewed', { page: '/orders/checkout' })) lastCheckoutView.current = key;
  }, [ready, consent, loading, cartLoading, cart.items?.length, user, location.key, location.pathname]);
  useEffect(() => {
    if (!ready || !consent || loading) return;
    const page = monitoringPage(location.pathname);
    let started = document.hidden ? null : performance.now();
    let seconds = 0;
    let depth = 0;
    const scroll = () => { const height = document.documentElement.scrollHeight - window.innerHeight; depth = Math.max(depth, height > 0 ? Math.min(100, Math.round(window.scrollY / height * 100)) : 100); };
    const flush = () => {
      if (started !== null) seconds += (performance.now() - started) / 1000;
      started = null;
      if (seconds >= 1) captureMonitoring('page_engagement', { page, active_seconds: Math.round(seconds), scroll_percent: depth });
      seconds = 0;
    };
    const visibility = () => { if (document.hidden) flush(); else started = performance.now(); };
    scroll();
    window.addEventListener('scroll', scroll, { passive: true });
    const leave = () => { flush(); captureMonitoring('$pageleave', { page, $pathname: page, $current_url: `${window.location.origin}${page}` }); };
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', visibility);
    return () => { flush(); window.removeEventListener('scroll', scroll); window.removeEventListener('pagehide', leave); document.removeEventListener('visibilitychange', visibility); };
  }, [ready, consent, loading, location.key, location.pathname]);
  return null;
}
