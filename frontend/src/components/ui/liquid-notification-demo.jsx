import React from 'react';
import { Bell, PackageCheck } from 'lucide-react';
import { LiquidGlassCard } from './liquid-notification';

export default function DemoOne() {
  return (
    <div
      className="mx-auto flex h-[40rem] w-full max-w-[28rem] flex-col justify-end gap-3 rounded-2xl p-4 pb-8 pt-2 sm:p-6"
      style={{
        background:
          'url("https://images.unsplash.com/photo-1534259070436-a95806b8621a?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D") center / cover no-repeat'
      }}
    >
      <LiquidGlassCard
        shadowIntensity="md"
        blurIntensity="lg"
        borderRadius="18px"
        glowIntensity="lg"
        draggable={false}
        expandable
        expandedWidth="min(410px, calc(100vw - 2rem))"
        expandedHeight="305px"
        width="min(410px, calc(100vw - 2rem))"
        height="90px"
        className="z-10"
      >
        <div className="relative z-10 flex h-full items-center p-4 text-white">
          <div className="mr-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/25">
            <Bell className="h-6 w-6" />
          </div>

          <div className="min-w-0 flex-grow pr-4">
            <div className="truncate text-base font-semibold">HDMarket</div>
            <div className="truncate text-sm text-white/95">
              Nouvelle notification livraison disponible
            </div>
            <div className="text-xs text-white/80">Touchez pour voir les details</div>
          </div>
          <div className="ml-2 shrink-0 self-start pt-1 text-xs text-white/80">12:34</div>
        </div>

        <img
          src="https://images.unsplash.com/photo-1517142089942-ba376ce32a0f?q=80&w=1170&auto=format&fit=crop"
          alt="notification preview"
          className="z-20 mx-auto h-full w-[92%] rounded-xl object-cover pb-3"
          loading="lazy"
        />
      </LiquidGlassCard>

      <LiquidGlassCard
        width="min(410px, calc(100vw - 2rem))"
        height="90px"
        shadowIntensity="md"
        blurIntensity="lg"
        borderRadius="18px"
        glowIntensity="lg"
        draggable={false}
        className="z-10"
      >
        <div className="relative z-10 flex items-center p-4 text-white">
          <div className="mr-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/25">
            <PackageCheck className="h-6 w-6" />
          </div>

          <div className="min-w-0 flex-grow pr-4">
            <div className="truncate text-base font-semibold">Mise a jour commande</div>
            <div className="truncate text-sm text-white/95">Votre colis est pret pour retrait</div>
          </div>
          <div className="ml-2 shrink-0 self-start pt-1 text-xs text-white/80">Maintenant</div>
        </div>
      </LiquidGlassCard>
    </div>
  );
}
