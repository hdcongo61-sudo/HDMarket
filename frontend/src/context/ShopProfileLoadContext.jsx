import React, { createContext, useContext, useMemo, useState } from 'react';

const ShopProfileLoadContext = createContext(null);

export function ShopProfileLoadProvider({ children }) {
  const [isShopProfileLoading, setShopProfileLoading] = useState(false);
  const [shopLogo, setShopLogo] = useState('');
  const [shopName, setShopName] = useState('');

  const value = useMemo(
    () => ({
      isShopProfileLoading,
      setShopProfileLoading,
      shopLogo,
      setShopLogo,
      shopName,
      setShopName
    }),
    [isShopProfileLoading, shopLogo, shopName]
  );

  return (
    <ShopProfileLoadContext.Provider value={value}>
      {children}
    </ShopProfileLoadContext.Provider>
  );
}

export function useShopProfileLoad() {
  const ctx = useContext(ShopProfileLoadContext);
  return ctx;
}
