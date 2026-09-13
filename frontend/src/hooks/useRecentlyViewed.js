import { useCallback, useEffect, useState } from 'react';
import { clearRecentlyViewed, readRecentlyViewed } from '../utils/recentlyViewed';

export default function useRecentlyViewed() {
  const [items, setItems] = useState(readRecentlyViewed);

  useEffect(() => {
    const handleUpdate = () => setItems(readRecentlyViewed());
    window.addEventListener('hdmarket:recently-viewed-updated', handleUpdate);
    return () => window.removeEventListener('hdmarket:recently-viewed-updated', handleUpdate);
  }, []);

  const clear = useCallback(() => {
    clearRecentlyViewed();
    setItems([]);
  }, []);

  return { items, clear };
}
