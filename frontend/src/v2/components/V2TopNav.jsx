import React from 'react';
import { Globe2, Moon, ShieldCheck, Sun } from 'lucide-react';
import V2Badge from './V2Badge';
import V2Button from './V2Button';

export default function V2TopNav({ darkMode = false, onToggleDarkMode }) {
  return (
    <header className="sticky top-0 z-20 border-b v2-divider bg-[color:var(--v2-bg)]/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-2xl bg-[var(--v2-accent)] text-white grid place-items-center text-sm font-bold">HD</div>
          <div>
            <p className="text-sm font-semibold tracking-tight">HDMarket V2</p>
            <p className="text-[11px] v2-text-soft">Local-first premium commerce</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <V2Badge tone="neutral"><Globe2 className="mr-1 h-3.5 w-3.5" />CGN · XAF</V2Badge>
          <V2Badge tone="success"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Trust Mode</V2Badge>
        </div>

        <V2Button variant="secondary" onClick={onToggleDarkMode} className="h-10 min-h-10 px-3">
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="hidden sm:inline">{darkMode ? 'Light' : 'Dark'}</span>
        </V2Button>
      </div>
    </header>
  );
}
