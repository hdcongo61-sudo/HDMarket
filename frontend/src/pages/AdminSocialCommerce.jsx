import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  Share2,
  MessageCircle,
  Instagram,
  Facebook,
  Music2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Link2,
  Unlink,
  Activity,
  BookOpen,
  ChevronDown,
  Building2,
  Webhook,
  ShieldCheck,
  KeyRound
} from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';
import { useToast } from '../context/ToastContext';

const CHANNEL_META = {
  WHATSAPP: { label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-600 bg-emerald-50' },
  INSTAGRAM: { label: 'Instagram', icon: Instagram, color: 'text-pink-600 bg-pink-50' },
  FACEBOOK_MESSENGER: { label: 'Facebook Messenger', icon: Facebook, color: 'text-blue-600 bg-blue-50' },
  TIKTOK_MESSAGING: { label: 'TikTok Messaging', icon: Music2, color: 'text-neutral-600 bg-neutral-100' }
};

const STATUS_LABEL = {
  CONNECTED: 'Connecté',
  DISCONNECTED: 'Non connecté',
  PENDING: 'En attente',
  ERROR: 'Erreur',
  DISABLED: 'Désactivé'
};

const STATUS_STYLE = {
  CONNECTED: 'bg-emerald-50 text-emerald-700',
  DISCONNECTED: 'bg-neutral-100 text-neutral-500',
  PENDING: 'bg-amber-50 text-amber-700',
  ERROR: 'bg-red-50 text-red-700',
  DISABLED: 'bg-neutral-100 text-neutral-400'
};

const TABS = [
  { key: 'channels', label: 'Canaux' },
  { key: 'interactions', label: 'Interactions' },
  { key: 'analytics', label: 'Analytique' },
  { key: 'guide', label: 'Guide' }
];

// Code-styled inline chip for env var names / field labels inside the guide.
function Code({ children }) {
  return (
    <code className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-bold text-[#c2410c]">
      {children}
    </code>
  );
}

const GUIDE_SECTIONS = [
  {
    key: 'prereqs',
    icon: Building2,
    color: 'bg-neutral-100 text-neutral-600',
    title: '0. Avant de commencer',
    steps: [
      'Une Page Facebook pour HDMarket (créez-en une si besoin — gratuit, 5 minutes).',
      'Un compte Meta Business (business.facebook.com) — relie votre Page, votre numéro WhatsApp et votre compte Instagram.',
      'Un compte développeur Meta (developers.facebook.com) — même identifiants, juste activer le mode développeur.'
    ]
  },
  {
    key: 'app',
    icon: KeyRound,
    color: 'bg-violet-50 text-violet-600',
    title: '1. Créer l’app Meta (couvre les 3 canaux)',
    steps: [
      <>Sur developers.facebook.com → <strong>My Apps → Create App</strong>, type <strong>« Business »</strong>.</>,
      'Nommez-la (ex. « HDMarket ») et reliez-la à votre compte Meta Business.',
      <>Une fois créée, notez l’<strong>App ID</strong> et l’<strong>App Secret</strong> (Settings → Basic) → <Code>META_APP_ID</Code> / <Code>META_APP_SECRET</Code>.</>
    ]
  },
  {
    key: 'whatsapp',
    icon: MessageCircle,
    color: 'text-emerald-600 bg-emerald-50',
    title: '2. WhatsApp Cloud API — à faire en premier',
    intro: 'Tout le trafic TikTok/Instagram/Facebook redirige vers WhatsApp — c’est le canal le plus important.',
    steps: [
      <>Dans l’app → <strong>Add Product → WhatsApp → Set up</strong>. Meta fournit un numéro de test gratuit pour développer.</>,
      <>Sous <strong>WhatsApp → API Setup</strong> : le <strong>Phone Number ID</strong> → <Code>WHATSAPP_PHONE_NUMBER_ID</Code>, et un jeton temporaire (24h) → <Code>WHATSAPP_ACCESS_TOKEN</Code>. Pour la production, générez un <strong>jeton permanent</strong> via un utilisateur système (Business Settings) avec le scope <Code>whatsapp_business_messaging</Code>.</>,
      <>Configurez le webhook : URL de rappel <Code>https://votre-domaine/api/webhooks/social/whatsapp</Code>, Verify Token = une chaîne de votre choix → <Code>WHATSAPP_VERIFY_TOKEN</Code>. Abonnez-vous au champ <Code>messages</Code>.</>,
      <>Pour passer au numéro réel : <strong>WhatsApp → Phone Numbers → Add phone number</strong>, vérification par SMS/appel.</>,
      <>Le numéro affiché dans les liens de partage <Code>wa.me</Code> (<Code>SOCIAL_WHATSAPP_DISPLAY_NUMBER</Code>) est le numéro international réel (ex. <Code>242061234567</Code>), différent du Phone Number ID.</>
    ]
  },
  {
    key: 'instagram',
    icon: Instagram,
    color: 'text-pink-600 bg-pink-50',
    title: '3. Instagram Messaging',
    steps: [
      'Le compte Instagram doit être Business ou Créateur, relié à votre Page Facebook (app Instagram → Paramètres → comptes liés).',
      <>Dans l’app Meta : <strong>Add Product → Instagram → Instagram API setup with Facebook Login</strong>.</>,
      <>Générez un <strong>Page Access Token</strong> avec les scopes <Code>instagram_basic</Code>, <Code>instagram_manage_messages</Code>, <Code>pages_manage_metadata</Code> → <Code>INSTAGRAM_PAGE_ACCESS_TOKEN</Code>.</>,
      <>Notez l’<strong>Instagram Business Account ID</strong> (affiché pendant la configuration) → <Code>INSTAGRAM_BUSINESS_ACCOUNT_ID</Code>.</>,
      <>Webhook objet <Code>instagram</Code>, URL <Code>https://votre-domaine/api/webhooks/social/instagram</Code>, verify token → <Code>INSTAGRAM_VERIFY_TOKEN</Code>, champ <Code>messages</Code>.</>
    ]
  },
  {
    key: 'messenger',
    icon: Facebook,
    color: 'text-blue-600 bg-blue-50',
    title: '4. Facebook Messenger',
    steps: [
      <><strong>Add Product → Messenger → Messenger API settings</strong>.</>,
      <>Sous <strong>Access Tokens</strong>, générez un <strong>Page Access Token</strong> pour la Page HDMarket → <Code>FACEBOOK_PAGE_ACCESS_TOKEN</Code>.</>,
      <>Notez le <strong>Page ID</strong> → <Code>FACEBOOK_PAGE_ID</Code>.</>,
      <>Webhook : URL <Code>https://votre-domaine/api/webhooks/social/messenger</Code>, verify token → <Code>FACEBOOK_VERIFY_TOKEN</Code>, champ <Code>messages</Code>.</>
    ]
  },
  {
    key: 'review',
    icon: ShieldCheck,
    color: 'bg-amber-50 text-amber-700',
    title: '5. App Review (nécessaire pour le public)',
    steps: [
      <>En mode développement, seuls les comptes ajoutés comme testeurs/admins dans l’app peuvent l’utiliser — suffisant pour vos propres tests.</>,
      <>Pour toucher de vrais clients, Meta exige une <strong>App Review</strong> pour <Code>whatsapp_business_messaging</Code>, <Code>instagram_manage_messages</Code> et <Code>pages_messaging</Code> — une description du cas d’usage et un enregistrement d’écran du flux sont demandés. Comptez quelques jours.</>
    ]
  },
  {
    key: 'where',
    icon: Webhook,
    color: 'bg-sky-50 text-sky-700',
    title: '6. Où entrer ces valeurs',
    steps: [
      <>Soit dans <Code>backend/.env</Code> (voir <Code>.env.example</Code>),</>,
      <>soit directement ici, onglet <strong>Canaux → Connecter</strong> (réservé au fondateur) — chiffrées avant stockage.</>,
      <>Une fois WhatsApp renseigné, activez les flags <Code>social_commerce</Code> et <Code>social_whatsapp</Code> depuis Admin → Gestion des fonctionnalités, puis testez en envoyant un vrai message WhatsApp contenant le code d’un produit (ex. <Code>HD-8F42K</Code>) à votre numéro de test.</>
    ]
  }
];

function GuideAccordion() {
  const [openKey, setOpenKey] = useState(GUIDE_SECTIONS[0].key);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
        <p className="flex items-start gap-2 text-xs font-semibold text-sky-800">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0" />
          Ce guide couvre uniquement la configuration côté Meta (WhatsApp, Instagram, Messenger). TikTok n’a pas
          d’API de messagerie directe ici — le trafic TikTok passe par WhatsApp (référence produit dans la légende/bio).
        </p>
      </div>

      <div className="space-y-3">
        {GUIDE_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isOpen = openKey === section.key;
          return (
            <div key={section.key} className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? '' : section.key)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${section.color}`}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-black text-[#141210]">{section.title}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="border-t border-neutral-100 px-4 pb-4 pt-3">
                  {section.intro && <p className="mb-2 text-xs font-semibold text-neutral-500">{section.intro}</p>}
                  <ol className="space-y-2.5">
                    {section.steps.map((step, index) => (
                      <li key={index} className="flex gap-2.5 text-xs leading-relaxed text-neutral-700">
                        <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-black text-neutral-500">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConnectForm({ channel, onSubmit, submitting }) {
  const [fields, setFields] = useState({});
  const isWhatsApp = channel === 'WHATSAPP';

  return (
    <form
      className="mt-3 space-y-2 rounded-xl bg-neutral-50 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(fields);
      }}
    >
      {isWhatsApp ? (
        <>
          <input
            required
            placeholder="Phone Number ID (Meta Cloud API)"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
            value={fields.phoneNumberId || ''}
            onChange={(e) => setFields((prev) => ({ ...prev, phoneNumberId: e.target.value }))}
          />
          <input
            required
            placeholder="Access token"
            type="password"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
            value={fields.accessToken || ''}
            onChange={(e) => setFields((prev) => ({ ...prev, accessToken: e.target.value }))}
          />
        </>
      ) : (
        <input
          required
          placeholder="Page access token"
          type="password"
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
          value={fields.pageAccessToken || ''}
          onChange={(e) => setFields((prev) => ({ ...prev, pageAccessToken: e.target.value }))}
        />
      )}
      <input
        required
        placeholder="Verify token (webhook)"
        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
        value={fields.verifyToken || ''}
        onChange={(e) => setFields((prev) => ({ ...prev, verifyToken: e.target.value }))}
      />
      <input
        placeholder="App secret (partagé Meta, optionnel si déjà en variable d'environnement)"
        type="password"
        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
        value={fields.appSecret || ''}
        onChange={(e) => setFields((prev) => ({ ...prev, appSecret: e.target.value }))}
      />
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#141210] px-4 text-xs font-black text-white disabled:opacity-50"
      >
        <Link2 className="h-3.5 w-3.5" />
        Connecter
      </button>
    </form>
  );
}

export default function AdminSocialCommerce() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const canManageChannels = hasPermission(user, 'manage_social_channels');
  const [activeTab, setActiveTab] = useState('channels');
  const [connections, setConnections] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openChannel, setOpenChannel] = useState('');
  const [busyChannel, setBusyChannel] = useState('');

  const loadChannels = useCallback(async () => {
    const { data } = await api.get('/admin/social-commerce/connections', { silentGlobalError: true });
    setConnections(data?.data || []);
  }, []);

  const loadInteractions = useCallback(async () => {
    const { data } = await api.get('/admin/social-commerce/interactions', { params: { limit: 50 }, silentGlobalError: true });
    setInteractions(data?.data || []);
  }, []);

  const loadAnalytics = useCallback(async () => {
    const { data } = await api.get('/admin/social-commerce/analytics', { params: { days: 30 }, silentGlobalError: true });
    setAnalytics(data?.data || null);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadChannels(), loadInteractions(), loadAnalytics()])
      .catch(() => showToast('Impossible de charger le Social Commerce Hub.', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [loadChannels, loadInteractions, loadAnalytics, showToast]);

  const handleConnect = async (channel, credentials) => {
    setBusyChannel(channel);
    try {
      await api.post(`/admin/social-commerce/connections/${channel}`, { status: 'CONNECTED', credentials });
      showToast(`${CHANNEL_META[channel]?.label || channel} connecté.`, { variant: 'success' });
      setOpenChannel('');
      await loadChannels();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Connexion impossible.', { variant: 'error' });
    } finally {
      setBusyChannel('');
    }
  };

  const handleTest = async (channel) => {
    setBusyChannel(channel);
    try {
      const { data } = await api.post(`/admin/social-commerce/connections/${channel}/test`);
      showToast(data?.data?.ok ? 'Connexion fonctionnelle.' : 'Le test a échoué.', {
        variant: data?.data?.ok ? 'success' : 'error'
      });
      await loadChannels();
    } catch {
      showToast('Impossible de tester la connexion.', { variant: 'error' });
    } finally {
      setBusyChannel('');
    }
  };

  const handleDisconnect = async (connectionId, channel) => {
    if (!connectionId) return;
    setBusyChannel(channel);
    try {
      await api.delete(`/admin/social-commerce/connections/${connectionId}`);
      showToast('Canal déconnecté.', { variant: 'success' });
      await loadChannels();
    } catch {
      showToast('Impossible de déconnecter ce canal.', { variant: 'error' });
    } finally {
      setBusyChannel('');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-3 py-4 sm:px-5">
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff0e4] text-[#e85d00]">
          <Share2 className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-[#e85d00]">Admin</p>
          <h1 className="text-xl font-black text-[#141210]">Social Commerce Hub</h1>
        </div>
      </header>

      <div className="flex gap-1.5 overflow-x-auto rounded-2xl bg-neutral-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`min-h-9 flex-1 rounded-xl px-3 text-xs font-black transition ${
              activeTab === tab.key ? 'bg-white text-[#141210] shadow-sm' : 'text-neutral-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'guide' ? (
        <GuideAccordion />
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-neutral-100" />
          ))}
        </div>
      ) : activeTab === 'channels' ? (
        <div className="space-y-3">
          {connections.map((connection) => {
            const meta = CHANNEL_META[connection.channel] || {};
            const Icon = meta.icon || Share2;
            const isTikTok = connection.channel === 'TIKTOK_MESSAGING';
            return (
              <div key={connection.channel} className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${meta.color || 'bg-neutral-100 text-neutral-500'}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-[#141210]">{meta.label || connection.channel}</p>
                    <p className="text-[11px] text-neutral-400">
                      {connection.lastWebhookAt ? `Dernier webhook : ${new Date(connection.lastWebhookAt).toLocaleString('fr-FR')}` : 'Aucun webhook reçu'}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${STATUS_STYLE[isTikTok ? 'DISABLED' : connection.status] || STATUS_STYLE.DISCONNECTED}`}>
                    {isTikTok ? 'Non disponible' : STATUS_LABEL[connection.status] || connection.status}
                  </span>
                </div>

                {connection.lastErrorMessage && (
                  <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700">
                    {connection.lastErrorMessage}
                  </p>
                )}

                {!isTikTok && canManageChannels && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {connection.status === 'CONNECTED' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleTest(connection.channel)}
                          disabled={busyChannel === connection.channel}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-xs font-bold text-neutral-700 disabled:opacity-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Tester
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDisconnect(connection.connectionId, connection.channel)}
                          disabled={busyChannel === connection.channel}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-red-200 px-3 text-xs font-bold text-red-600 disabled:opacity-50"
                        >
                          <Unlink className="h-3.5 w-3.5" /> Déconnecter
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenChannel(openChannel === connection.channel ? '' : connection.channel)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#141210] px-3 text-xs font-black text-white"
                      >
                        <Link2 className="h-3.5 w-3.5" /> Connecter
                      </button>
                    )}
                  </div>
                )}

                {!isTikTok && !canManageChannels && (
                  <p className="mt-2 text-[11px] font-semibold text-neutral-400">
                    Seul le fondateur peut configurer les identifiants de ce canal.
                  </p>
                )}

                {isTikTok && (
                  <p className="mt-2 text-[11px] font-semibold text-neutral-400">
                    Aucun fournisseur TikTok Messaging n’est configuré. Le trafic TikTok passe par WhatsApp (voir la fiche produit).
                  </p>
                )}

                {openChannel === connection.channel && (
                  <ConnectForm
                    channel={connection.channel}
                    submitting={busyChannel === connection.channel}
                    onSubmit={(credentials) => handleConnect(connection.channel, credentials)}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : activeTab === 'interactions' ? (
        <div className="space-y-2">
          {interactions.length === 0 && (
            <p className="rounded-2xl border border-dashed border-neutral-200 bg-white p-6 text-center text-sm text-neutral-400">
              Aucune conversation pour le moment.
            </p>
          )}
          {interactions.map((interaction) => {
            const meta = CHANNEL_META[interaction.channel] || {};
            const Icon = meta.icon || Share2;
            return (
              <div key={interaction._id} className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-white p-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${meta.color || 'bg-neutral-100 text-neutral-500'}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#141210]">
                    {interaction.productId?.title || 'Produit non résolu'} {interaction.socialCode ? `· ${interaction.socialCode}` : ''}
                  </p>
                  <p className="truncate text-[11px] text-neutral-400">
                    {interaction.intent} · {interaction.externalUserId} · {new Date(interaction.createdAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                {interaction.responseStatus === 'SENT' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-neutral-300" />
                )}
              </div>
            );
          })}
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Clics sociaux', value: analytics.clicks },
            { label: 'Conversations', value: analytics.conversations },
            { label: 'Commandes attribuées', value: analytics.orders },
            { label: 'Taux de conversion', value: `${analytics.conversionRate}%` }
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-neutral-100 bg-white p-4">
              <p className="text-2xl font-black text-[#141210]">{stat.value}</p>
              <p className="mt-0.5 text-[11px] font-bold text-neutral-400">{stat.label}</p>
            </div>
          ))}
          <div className="col-span-2 rounded-2xl border border-neutral-100 bg-white p-4">
            <p className="mb-3 flex items-center gap-2 text-xs font-black text-neutral-600">
              <Activity className="h-3.5 w-3.5" /> Commandes par canal
            </p>
            {analytics.ordersByChannel?.length ? (
              <div className="space-y-2">
                {analytics.ordersByChannel.map((row) => (
                  <div key={row.channel} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-600">{row.channel}</span>
                    <span className="font-black text-[#141210]">
                      {row.orders} cmd · {Number(row.revenue || 0).toLocaleString('fr-FR')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400">Aucune donnée pour le moment.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
