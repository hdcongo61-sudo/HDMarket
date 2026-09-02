import React, { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, ChartBarIcon, CheckBadgeIcon, CheckIcon, CursorArrowRaysIcon, EyeIcon, FlagIcon, MegaphoneIcon, PlayIcon, ShieldExclamationIcon, ShoppingCartIcon, TrashIcon, UserMinusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const FILTERS = ['', 'pending', 'approved', 'rejected', 'hidden', 'deleted'];
const LABELS = { '': 'Toutes', pending: 'En attente', approved: 'Publiées', rejected: 'Refusées', hidden: 'Masquées', deleted: 'Supprimées' };

function Stat({ icon: Icon, label, value }) {
  return <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900"><div className="flex items-center gap-2 text-xs font-semibold text-neutral-500"><Icon className="h-[15px] w-[15px]" />{label}</div><p className="mt-2 text-2xl font-black">{Number(value || 0).toLocaleString('fr-FR')}</p></div>;
}

export default function AdminProductVideos() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [tab, setTab] = useState('videos');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [videosResult, analyticsResult, reportsResult] = await Promise.all([
        api.get('/product-videos/admin', { params: { status: filter || undefined, limit: 50 }, headers: { 'x-skip-cache': '1' } }),
        api.get('/product-videos/admin/analytics', { headers: { 'x-skip-cache': '1' } }),
        api.get('/product-videos/admin/reports', { headers: { 'x-skip-cache': '1' } })
      ]);
      setItems(videosResult.data?.items || []);
      setAnalytics(analyticsResult.data || {});
      setReports(reportsResult.data?.items || []);
    } catch (error) {
      showToast(error.response?.data?.message || 'Centre vidéo indisponible.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [filter, showToast]);

  useEffect(() => { load(); }, [load]);

  const refreshAnalytics = useCallback(() => {
    api.get('/product-videos/admin/analytics', { headers: { 'x-skip-cache': '1' } })
      .then(({ data }) => setAnalytics(data || {}))
      .catch(() => {});
  }, []);

  const moderate = async (video, action, reason = '') => {
    if (action === 'ban_seller' && !window.confirm('Suspendre ce vendeur et masquer la vidéo ?')) return;
    if (action === 'delete' && !window.confirm('Supprimer définitivement cette vidéo (fichier, commentaires et statistiques inclus) ? Cette action est irréversible.')) return;
    setBusyId(video._id);
    try {
      const { data } = await api.patch(`/product-videos/admin/${video._id}`, { action, reason });
      if (action === 'delete') {
        // Hard delete on the backend: drop the card, its open reports, and
        // re-sync the counter tiles.
        setItems((current) => current.filter((item) => item._id !== video._id));
        setReports((current) => current.filter((report) => String(report.video?._id || '') !== String(video._id)));
        refreshAnalytics();
        showToast('Vidéo supprimée définitivement.', { variant: 'success' });
        return;
      }
      setItems((current) => current.map((item) => item._id === video._id ? { ...item, ...data } : item));
      showToast('Action de modération appliquée.', { variant: 'success' });
      if (['approve', 'reject', 'hide'].includes(action) && filter) {
        setItems((current) => current.filter((item) => item._id !== video._id));
      }
      if (['approve', 'reject', 'hide', 'restore'].includes(action)) refreshAnalytics();
    } catch (error) {
      showToast(error.response?.data?.message || 'Action impossible.', { variant: 'error' });
    } finally {
      setBusyId('');
    }
  };

  const resolveReport = async (report, status) => {
    try {
      await api.patch(`/product-videos/admin/reports/${report._id}`, { status, resolution: status === 'resolved' ? 'Traité par la modération' : 'Signalement non retenu' });
      setReports((current) => current.filter((item) => item._id !== report._id));
      showToast('Signalement clôturé.', { variant: 'success' });
    } catch (error) {
      showToast(error.response?.data?.message || 'Action impossible.', { variant: 'error' });
    }
  };

  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">Confiance & croissance</p><h1 className="text-3xl font-black">HDMarket Videos</h1><p className="mt-1 text-sm text-neutral-500">Modération, mise en avant, sponsoring et conversion du flux achetable.</p></div><button type="button" onClick={load} className="flex h-10 items-center gap-2 rounded-xl border border-neutral-200 px-4 text-sm font-bold dark:border-white/10"><ArrowPathIcon className="h-4 w-4" /> Actualiser</button></div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8"><Stat icon={PlayIcon} label="Vidéos" value={analytics.videos} /><Stat icon={ShieldExclamationIcon} label="En attente" value={analytics.pending} /><Stat icon={EyeIcon} label="Vues" value={analytics.views} /><Stat icon={ChartBarIcon} label="Complétions" value={analytics.completions} /><Stat icon={CursorArrowRaysIcon} label="Clics produit" value={analytics.productClicks} /><Stat icon={ShoppingCartIcon} label="Ajouts panier" value={analytics.addToCarts} /><Stat icon={MegaphoneIcon} label="Sponsorisé" value={analytics.sponsored} /><Stat icon={FlagIcon} label="Signalements" value={analytics.reports} /></div>

      <div className="flex border-b border-neutral-200 dark:border-white/10"><button type="button" onClick={() => setTab('videos')} className={`px-5 py-3 text-sm font-bold ${tab === 'videos' ? 'border-b-2 border-violet-600 text-violet-600' : 'text-neutral-500'}`}>Vidéos</button><button type="button" onClick={() => setTab('reports')} className={`px-5 py-3 text-sm font-bold ${tab === 'reports' ? 'border-b-2 border-violet-600 text-violet-600' : 'text-neutral-500'}`}>Signalements ({reports.length})</button></div>

      {tab === 'videos' ? <>
        <div className="flex flex-wrap gap-2">{FILTERS.map((value) => <button key={value || 'all'} type="button" onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-xs font-bold ${filter === value ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950' : 'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300'}`}>{LABELS[value]}</button>)}</div>
        {loading ? <div className="grid min-h-64 place-items-center"><ArrowPathIcon className="animate-spin" /></div> : null}
        {!loading && !items.length ? <div className="rounded-3xl border border-dashed border-neutral-300 p-12 text-center text-neutral-500 dark:border-white/15">Aucune vidéo dans cette file.</div> : null}
        <div className="grid gap-4 xl:grid-cols-2">{items.map((video) => <article key={video._id} className="grid overflow-hidden rounded-2xl border border-neutral-200 bg-white sm:grid-cols-[180px_1fr] dark:border-white/10 dark:bg-neutral-900"><div className="relative aspect-[4/5] bg-neutral-950 sm:aspect-auto"><img src={video.thumbnailUrl || video.product?.images?.[0]} alt="" className="h-full w-full object-cover" loading="lazy" />{video.sponsored ? <span className="absolute left-2 top-2 rounded-full bg-violet-600 px-2 py-1 text-[10px] font-bold text-white">Sponsorisé</span> : null}{video.featured ? <CheckBadgeIcon className="absolute right-2 top-2 text-amber-300" fill="currentColor" /> : null}</div><div className="flex min-w-0 flex-col p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-neutral-500">{video.seller?.shopName || video.seller?.name}</p><h2 className="mt-1 line-clamp-2 font-black">{video.product?.title || 'Produit supprimé'}</h2></div><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold uppercase dark:bg-white/10">{LABELS[video.status] || video.status}</span></div><p className="mt-3 line-clamp-3 text-sm text-neutral-600 dark:text-neutral-300">{video.caption || 'Sans légende'}</p><div className="mt-3 flex flex-wrap gap-3 text-xs text-neutral-500"><span>{video.counters?.views || 0} vues</span><span>{video.counters?.likes || 0} J’aime</span><span>{video.counters?.productClicks || 0} clics</span></div>{video.moderationReason ? <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30">{video.moderationReason}</p> : null}<div className="mt-auto flex flex-wrap gap-2 pt-4">{video.status !== 'approved' ? <button type="button" disabled={busyId === video._id} onClick={() => moderate(video, 'approve')} className="flex h-9 items-center gap-1 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-white"><CheckIcon className="h-3.5 w-3.5" /> Approuver</button> : <button type="button" onClick={() => moderate(video, 'hide', 'Masquée par la modération')} className="flex h-9 items-center gap-1 rounded-lg border border-neutral-200 px-3 text-xs font-bold dark:border-white/10"><XMarkIcon className="h-3.5 w-3.5" /> Masquer</button>}<button type="button" onClick={() => moderate(video, video.featured ? 'unfeature' : 'feature')} className="h-9 rounded-lg border border-amber-200 px-3 text-xs font-bold text-amber-700">{video.featured ? 'Retirer sélection' : 'Mettre en avant'}</button><button type="button" onClick={() => moderate(video, video.sponsored ? 'unsponsor' : 'sponsor')} className="h-9 rounded-lg border border-violet-200 px-3 text-xs font-bold text-violet-700">{video.sponsored ? 'Retirer sponsor' : 'Sponsoriser'}</button>{video.status === 'pending' ? <button type="button" onClick={() => moderate(video, 'reject', 'Contenu non conforme aux règles vidéo HDMarket')} className="h-9 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-600">Refuser</button> : null}<button type="button" title="Suspendre le vendeur" onClick={() => moderate(video, 'ban_seller', 'Contenu vidéo non conforme')} className="grid h-9 w-9 place-items-center rounded-lg border border-rose-200 text-rose-600"><UserMinusIcon className="h-[15px] w-[15px]" /></button><button type="button" title="Supprimer" onClick={() => moderate(video, 'delete', 'Suppression administrative')} className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-500 dark:border-white/10"><TrashIcon className="h-[15px] w-[15px]" /></button></div></div></article>)}</div>
      </> : <div className="space-y-3">{!reports.length ? <div className="rounded-3xl border border-dashed border-neutral-300 p-12 text-center text-neutral-500 dark:border-white/15">Aucun signalement ouvert.</div> : null}{reports.map((report) => <article key={report._id} className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4 md:flex-row md:items-center dark:border-white/10 dark:bg-neutral-900"><img src={report.video?.thumbnailUrl || report.video?.product?.images?.[0]} alt="" className="h-24 w-20 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase text-rose-600">{report.category}</p><h2 className="mt-1 font-bold">{report.video?.product?.title || 'Vidéo'}</h2><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{report.reason || 'Aucun détail fourni.'}</p><p className="mt-2 text-xs text-neutral-500">Signalé par {report.reporter?.name || report.reporter?.email || 'Utilisateur'}</p></div><div className="flex gap-2"><button type="button" onClick={() => resolveReport(report, 'dismissed')} className="h-10 rounded-xl border border-neutral-200 px-4 text-xs font-bold dark:border-white/10">Classer</button><button type="button" onClick={async () => { if (report.video?._id) await moderate(report.video, 'hide', 'Masquée après signalement'); resolveReport(report, 'resolved'); }} className="h-10 rounded-xl bg-rose-500 px-4 text-xs font-bold text-white">Masquer et résoudre</button></div></article>)}</div>}
    </div>
  );
}
