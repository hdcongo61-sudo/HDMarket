import React, { useCallback, useEffect, useState } from 'react';
import { Share2, Plus, TrendingUp } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import ShareProductModal from '../components/social/ShareProductModal';

const CHANNEL_OPTIONS = [
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK', label: 'Facebook' }
];

function NewCampaignForm({ products, onCreated, onCancel }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: '', productId: products[0]?._id || '', channel: 'TIKTOK' });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.productId) return;
    setSubmitting(true);
    try {
      await api.post('/social-commerce/campaigns', form);
      showToast('Campagne créée.', { variant: 'success' });
      onCreated();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Impossible de créer la campagne.', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl border border-neutral-100 bg-white p-4">
      <input
        required
        placeholder="Nom de la campagne (ex : TikTok Table Basse Août)"
        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        value={form.name}
        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
      />
      <select
        required
        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        value={form.productId}
        onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value }))}
      >
        {products.map((product) => (
          <option key={product._id} value={product._id}>
            {product.title}
          </option>
        ))}
      </select>
      <select
        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        value={form.channel}
        onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value }))}
      >
        {CHANNEL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-[#141210] text-sm font-black text-white disabled:opacity-50"
        >
          Créer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-neutral-200 px-4 text-sm font-bold text-neutral-600"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

export default function SellerSocialCommerce() {
  const { showToast } = useToast();
  const [analytics, setAnalytics] = useState(null);
  const [products, setProducts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [shareProduct, setShareProduct] = useState(null);

  const load = useCallback(async () => {
    const [analyticsRes, productsRes, campaignsRes] = await Promise.all([
      api.get('/social-commerce/analytics', { params: { days: 30 }, silentGlobalError: true }),
      api.get('/social-commerce/products', { silentGlobalError: true }),
      api.get('/social-commerce/campaigns', { silentGlobalError: true })
    ]);
    setAnalytics(analyticsRes.data?.data || null);
    setProducts(productsRes.data?.data || []);
    setCampaigns(campaignsRes.data?.data || []);
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => showToast('Impossible de charger le Social Commerce.', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [load, showToast]);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-3 py-4 sm:px-5">
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff0e4] text-[#e85d00]">
          <Share2 className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-[#e85d00]">Ce mois-ci</p>
          <h1 className="text-xl font-black text-[#141210]">Social Commerce</h1>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-neutral-100" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Visites sociales', value: analytics?.clicks ?? 0 },
              { label: 'Conversations', value: analytics?.conversations ?? 0 },
              { label: 'Commandes', value: analytics?.orders ?? 0 },
              { label: 'Conversion', value: `${analytics?.conversionRate ?? 0}%` }
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-neutral-100 bg-white p-4">
                <p className="text-2xl font-black text-[#141210]">{stat.value}</p>
                <p className="mt-0.5 text-[11px] font-bold text-neutral-400">{stat.label}</p>
              </div>
            ))}
          </div>

          {analytics?.topChannels?.length > 0 && (
            <div className="rounded-2xl border border-neutral-100 bg-white p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-black text-neutral-600">
                <TrendingUp className="h-3.5 w-3.5" /> Canaux les plus actifs
              </p>
              <div className="space-y-2">
                {analytics.topChannels.map((row) => (
                  <div key={row.channel} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-600">{row.channel}</span>
                    <span className="font-black text-[#141210]">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-[#141210]">Mes produits</h2>
            </div>
            <div className="space-y-2">
              {products.length === 0 && (
                <p className="rounded-2xl border border-dashed border-neutral-200 bg-white p-6 text-center text-sm text-neutral-400">
                  Aucun produit approuvé pour le moment.
                </p>
              )}
              {products.map((product) => (
                <button
                  key={product._id}
                  type="button"
                  onClick={() => setShareProduct({ id: product._id, title: product.title })}
                  className="flex w-full items-center gap-3 rounded-2xl border border-neutral-100 bg-white p-3 text-left active:scale-[0.99]"
                >
                  <img
                    src={product.images?.[0] || ''}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-xl bg-neutral-100 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#141210]">{product.title}</p>
                    <p className="text-[11px] text-neutral-400">{product.socialCode} · {product.clicks} clics</p>
                  </div>
                  <Share2 className="h-4 w-4 shrink-0 text-neutral-300" />
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-[#141210]">Campagnes</h2>
              {!showCampaignForm && (
                <button
                  type="button"
                  onClick={() => setShowCampaignForm(true)}
                  disabled={!products.length}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#141210] px-3 text-xs font-black text-white disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> Nouvelle
                </button>
              )}
            </div>
            {showCampaignForm && (
              <NewCampaignForm
                products={products}
                onCancel={() => setShowCampaignForm(false)}
                onCreated={() => {
                  setShowCampaignForm(false);
                  load();
                }}
              />
            )}
            <div className="mt-2 space-y-2">
              {campaigns.length === 0 && !showCampaignForm && (
                <p className="rounded-2xl border border-dashed border-neutral-200 bg-white p-6 text-center text-sm text-neutral-400">
                  Aucune campagne pour le moment.
                </p>
              )}
              {campaigns.map((campaign) => (
                <div key={campaign._id} className="rounded-2xl border border-neutral-100 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#141210]">{campaign.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        campaign.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-400'
                      }`}
                    >
                      {campaign.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    {campaign.channel} · {campaign.campaignCode} · {campaign.productId?.title || ''}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {shareProduct && (
        <ShareProductModal
          productId={shareProduct.id}
          productTitle={shareProduct.title}
          onClose={() => setShareProduct(null)}
        />
      )}
    </div>
  );
}
