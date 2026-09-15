import React, { useEffect, useState } from 'react';
import { ArrowRightIcon, GlobeAltIcon, PlusIcon, UsersIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import api from '../services/api';

const statusStyles = {
  ACTIVE: 'bg-emerald-100 text-emerald-700', TEST: 'bg-amber-100 text-amber-700',
  DRAFT: 'bg-neutral-200 text-neutral-700', DISABLED: 'bg-rose-100 text-rose-700'
};

const TOTAL_CARDS = [
  { key: 'countries', label: 'Marchés ouverts', suffix: ' pays', format: (value) => value },
  { key: 'users', label: 'Utilisateurs', suffix: '', format: (value) => Number(value).toLocaleString('fr-FR') },
  { key: 'orders', label: 'Commandes', suffix: '', format: (value) => Number(value).toLocaleString('fr-FR') },
  { key: 'gmv', label: 'Volume cumulé (GMV)', suffix: '', format: (value) => Number(value).toLocaleString('fr-FR') }
];

export default function AdminGlobalOverview() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/countries/global-overview')
      .then(({ data }) => setPayload(data))
      .catch((requestError) => setError(requestError?.response?.data?.message || 'Chargement impossible.'));
  }, []);

  const items = payload?.items || [];
  const totals = payload?.totals || { countries: 0, users: 0, orders: 0, gmv: 0 };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#e85d00]">HDMarket Global</p>
          <h1 className="mt-1 text-3xl font-black text-[#1d1814]">Vue globale</h1>
          <p className="mt-1 text-sm text-[#80766c]">L’ensemble des marchés en un coup d’œil — utilisateurs, commandes et volume par pays.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/users" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-[#e2d8cd] bg-white px-4 font-black text-[#514940] transition hover:border-[#e85d00]"><UsersIcon className="h-[18px] w-[18px] text-[#e85d00]" /> Affecter des admins</Link>
          <Link to="/admin/countries" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#e85d00] px-5 font-black text-white transition hover:bg-[#c94f00]"><PlusIcon className="h-[18px] w-[18px]" /> Gérer les pays</Link>
        </div>
      </div>

      {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p> : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TOTAL_CARDS.map((card) => (
          <div key={card.key} className="rounded-[24px] border border-[#e8ded3] bg-white p-5">
            <p className="text-xs font-black uppercase tracking-wide text-[#8b8177]">{card.label}</p>
            <p className="mt-2 text-3xl font-black text-[#211b16]">{card.format(totals[card.key] || 0)}{card.suffix}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 flex items-center gap-2 text-sm font-black uppercase tracking-[.14em] text-[#80766c]"><GlobeAltIcon className="h-4 w-4 text-[#e85d00]" /> Par marché</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link key={item._id} to={`/admin/countries/${item._id}`} className="rounded-[26px] border border-[#e8ded3] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <span className="text-4xl">{item.flagEmoji}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${statusStyles[item.status]}`}>{item.status}</span>
            </div>
            <h3 className="mt-3 text-xl font-black text-[#201b17]">{item.name}</h3>
            <p className="text-sm text-[#82786e]">{item.officialName}</p>
            <div className="mt-5 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-[#f8f5f0] p-2"><b className="block">{Number(item.stats?.users || 0).toLocaleString('fr-FR')}</b><span className="text-[11px] text-[#8b8178]">Utilisateurs</span></div>
              <div className="rounded-xl bg-[#f8f5f0] p-2"><b className="block">{Number(item.stats?.orders || 0).toLocaleString('fr-FR')}</b><span className="text-[11px] text-[#8b8178]">Commandes</span></div>
              <div className="rounded-xl bg-[#f8f5f0] p-2"><b className="block">{Number(item.stats?.products || 0).toLocaleString('fr-FR')}</b><span className="text-[11px] text-[#8b8178]">Produits</span></div>
              <div className="rounded-xl bg-[#f8f5f0] p-2"><b className="block">{Number(item.stats?.gmv || 0).toLocaleString('fr-FR')}</b><span className="text-[11px] text-[#8b8178]">GMV</span></div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#eee8e1]"><div className="h-full rounded-full bg-[#e85d00]" style={{ width: `${item.readiness?.score || 0}%` }} /></div>
              <span className="ml-3 text-xs font-black text-[#8b8177]">{item.readiness?.score || 0}%</span>
            </div>
            <p className="mt-3 flex items-center gap-1 text-xs font-black text-[#e85d00]">Ouvrir la fiche <ArrowRightIcon className="h-3.5 w-3.5" /></p>
          </Link>
        ))}
      </div>

      <section className="mt-8 rounded-[24px] border border-[#f0d9c6] bg-[#fffaf5] p-5 sm:p-6">
        <h2 className="text-lg font-black text-[#211b16]">Comment affecter un pays à un admin ?</h2>
        <ol className="mt-3 grid gap-3 text-sm font-semibold text-[#8a7263] md:grid-cols-3">
          <li className="rounded-2xl bg-white p-4 ring-1 ring-[#f0e9e0]"><b className="text-[#e85d00]">1.</b> Ouvrez <Link to="/admin/users" className="font-black text-[#e85d00] underline">Utilisateurs</Link> et choisissez un compte <b>admin</b>.</li>
          <li className="rounded-2xl bg-white p-4 ring-1 ring-[#f0e9e0]"><b className="text-[#e85d00]">2.</b> Cochez les <b>pays administrés</b> dans la section « Pays assignés » puis enregistrez.</li>
          <li className="rounded-2xl bg-white p-4 ring-1 ring-[#f0e9e0]"><b className="text-[#e85d00]">3.</b> Cet admin ne verra que ses pays. Sans restriction, il garde l’accès global.</li>
        </ol>
      </section>
    </div>
  );
}
