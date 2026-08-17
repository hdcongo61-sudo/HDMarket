import React, { useContext, useEffect, useState } from 'react';
import { Check, ChevronDown, Globe2, X } from 'lucide-react';
import { useCountry } from '../../context/CountryContext';
import CartContext from '../../context/CartContext';

export default function CountrySelector({ compact = false, className = '' }) {
  const { country, countries, changeCountry, confirmCountry, needsConfirmation, loading } = useCountry();
  const { cart } = useContext(CartContext);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (needsConfirmation && country) setOpen(true);
  }, [country, needsConfirmation]);

  const choose = async (next) => {
    if (String(next.id || next._id) === String(country?.id || country?._id)) {
      await confirmCountry();
      return setOpen(false);
    }
    if ((cart?.items || []).length > 0 && String(cart.countryId || '') === String(country?.id || country?._id)) {
      setPending(next);
      return;
    }
    setSaving(true);
    try {
      await changeCountry(next);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const confirmChange = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      await changeCountry(pending);
      setPending(null);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading || !country}
        className={`inline-flex min-h-10 items-center rounded-full border border-[#e8ded2] bg-white text-sm font-bold text-[#29231e] shadow-sm transition hover:border-[#e85d00] ${compact ? 'gap-1 px-2' : 'gap-2 px-3'} ${className}`}
        aria-label="Changer de pays"
      >
        <span className="text-lg" aria-hidden>{country?.flagEmoji || '🌍'}</span>
        {!compact ? <span>{country?.name || 'Pays'}</span> : null}
        <ChevronDown size={14} className="text-[#8b8177]" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="w-full max-w-md rounded-t-[28px] bg-[#f8f5f0] p-5 shadow-2xl sm:rounded-[28px]" role="dialog" aria-modal="true" aria-label="Choisir un pays">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#e85d00]"><Globe2 size={15} /> Pays</p>
                <h2 className="mt-1 text-2xl font-black text-[#17130f]">Explorer HDMarket</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#6f675f]"><X size={18} /></button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#e8ded2] bg-white">
              {countries.map((item) => {
                const active = String(item.id || item._id) === String(country?.id || country?._id);
                return (
                  <button key={item.id || item._id} type="button" disabled={saving} onClick={() => choose(item)} className="flex min-h-16 w-full items-center gap-3 border-b border-[#eee7df] px-4 text-left last:border-0 hover:bg-[#fff8f1]">
                    <span className="text-2xl">{item.flagEmoji || '🌍'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-extrabold text-[#211c18]">{item.name}</span>
                      <span className="block text-xs font-medium text-[#8b8177]">{item.currency?.code} · {item.phoneCode}{item.status === 'TEST' ? ' · Test' : ''}</span>
                    </span>
                    {active ? <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e85d00] text-white"><Check size={15} /></span> : null}
                  </button>
                );
              })}
            </div>
            {needsConfirmation ? <button type="button" onClick={async () => { await confirmCountry(); setOpen(false); }} className="mt-4 min-h-12 w-full rounded-2xl bg-[#e85d00] font-black text-white">Continuer avec {country?.name}</button> : null}
          </section>
        </div>
      ) : null}

      {pending ? (
        <div className="fixed inset-0 z-[170] grid place-items-center bg-black/50 p-5">
          <section className="w-full max-w-sm rounded-[26px] bg-white p-6 shadow-2xl" role="alertdialog" aria-modal="true">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff1e6] text-[#e85d00]"><Globe2 size={23} /></div>
            <h2 className="mt-4 text-xl font-black text-[#1f1a16]">Changer de pays ?</h2>
            <p className="mt-2 text-sm leading-6 text-[#71685f]">Votre panier contient des produits de {country?.name}. Il sera conservé, mais vous devrez revenir dans ce pays pour finaliser cette commande.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setPending(null)} className="min-h-12 rounded-2xl border border-[#ded6cd] font-bold">Annuler</button>
              <button type="button" disabled={saving} onClick={confirmChange} className="min-h-12 rounded-2xl bg-[#e85d00] font-bold text-white">Changer</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
