import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    // Always scroll to top when route changes
    if (typeof window === 'undefined') return;
    
    // Use requestAnimationFrame to ensure DOM is ready
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    
    // Also scroll immediately as fallback
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
}
