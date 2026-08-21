import React, { useEffect, useState } from 'react';
import { Copy, Check, MessageCircle, Instagram, Facebook, Music2, Link2, Hash } from 'lucide-react';
import { BottomSheetModal, ModalBody, ModalHeader } from '../modals/BaseModal';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

// Spec §22/§23 — the per-product "Social Commerce card" + Share/Promote
// bottom sheet: social code, HDMarket link, and channel-specific
// copy-paste snippets (WhatsApp link, TikTok caption, Instagram message,
// Facebook post). No fake "post directly to TikTok/Instagram" buttons —
// only copy actions the provider APIs actually support in this phase.
const CopyRow = ({ icon: Icon, label, value, href, onCopy, copied }) => {
  if (!value) return null;
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-gray-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mb-2 whitespace-pre-line text-[13px] leading-snug text-gray-800">{value}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-xs font-black text-gray-800 ring-1 ring-inset ring-gray-200 active:scale-[0.98]"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copié' : 'Copier'}
        </button>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center justify-center rounded-full bg-[#141210] px-4 text-xs font-black text-white active:scale-[0.98]"
          >
            Ouvrir
          </a>
        )}
      </div>
    </div>
  );
};

export default function ShareProductModal({ productId, productTitle, onClose }) {
  const { showToast } = useToast();
  const [links, setLinks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .get(`/social-commerce/product/${productId}/share-links`, { silentGlobalError: true })
      .then(({ data }) => {
        if (!cancelled) setLinks(data?.data || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || 'Impossible de charger les liens de partage.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const copy = async (key, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      showToast('Copié !', { variant: 'success', duration: 1500 });
      setTimeout(() => setCopiedKey((current) => (current === key ? '' : current)), 1500);
    } catch {
      showToast('Impossible de copier.', { variant: 'error' });
    }
  };

  return (
    <BottomSheetModal isOpen onClose={onClose} size="md" ariaLabel="Partager le produit">
      <ModalHeader title="Partager & promouvoir" subtitle={productTitle} onClose={onClose} />
      <ModalBody>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>
        ) : links ? (
          <div className="space-y-3">
            <CopyRow
              icon={Hash}
              label="Code social"
              value={links.socialCode}
              copied={copiedKey === 'code'}
              onCopy={() => copy('code', links.socialCode)}
            />
            <CopyRow
              icon={Link2}
              label="Lien HDMarket"
              value={links.hdmarketLink}
              href={links.hdmarketLink}
              copied={copiedKey === 'link'}
              onCopy={() => copy('link', links.hdmarketLink)}
            />
            {links.whatsappLink ? (
              <CopyRow
                icon={MessageCircle}
                label="WhatsApp"
                value={links.whatsappLink}
                href={links.whatsappLink}
                copied={copiedKey === 'whatsapp'}
                onCopy={() => copy('whatsapp', links.whatsappLink)}
              />
            ) : (
              <p className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                Aucun numéro WhatsApp HDMarket configuré pour le moment — demandez à un administrateur de l’ajouter.
              </p>
            )}
            <CopyRow
              icon={Music2}
              label="Légende TikTok"
              value={links.tiktokCaption}
              copied={copiedKey === 'tiktok'}
              onCopy={() => copy('tiktok', links.tiktokCaption)}
            />
            <CopyRow
              icon={Instagram}
              label="Message Instagram"
              value={links.instagramMessage}
              copied={copiedKey === 'instagram'}
              onCopy={() => copy('instagram', links.instagramMessage)}
            />
            <CopyRow
              icon={Facebook}
              label="Publication Facebook"
              value={links.facebookPost}
              copied={copiedKey === 'facebook'}
              onCopy={() => copy('facebook', links.facebookPost)}
            />
          </div>
        ) : null}
      </ModalBody>
    </BottomSheetModal>
  );
}
