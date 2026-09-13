import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowDownTrayIcon, ShareIcon } from '@heroicons/react/24/outline';
import BaseModal, { ModalBody, ModalHeader } from './modals/BaseModal';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { buildProductShareUrl } from '../utils/links';
import { PLACEHOLDER_IMAGE } from '../utils/placeholderImage';

const POSTER_W = 1080;
const POSTER_H = 1350;

const wrapTitle = (context, text, maxWidth, maxLines) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  return lines;
};

/**
 * Taobao-style share poster: product photo + price + QR deep link on a
 * branded card, generated client-side for WhatsApp forwarding.
 */
export default function ShareProductPosterModal({ open, onClose, product }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    setDrawing(true);
    let cancelled = false;

    const draw = async () => {
      const canvas = canvasRef.current;
      if (!canvas || !product) return;
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, POSTER_W, POSTER_H);

      // Background
      const gradient = context.createLinearGradient(0, 0, 0, POSTER_H);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.72, '#ffffff');
      gradient.addColorStop(1, '#fff3e9');
      context.fillStyle = gradient;
      context.fillRect(0, 0, POSTER_W, POSTER_H);

      const imageUrl = String(product.images?.[0] || product.image || '');
      const primary = imageUrl || PLACEHOLDER_IMAGE;
      const image = new Image();
      image.crossOrigin = 'anonymous';
      const drawImage = () => {
        // Cover-crop into the top square.
        const size = POSTER_W;
        const ratio = Math.max(size / image.width, size / image.height);
        const w = image.width * ratio;
        const h = image.height * ratio;
        context.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
      };
      const loadImage = () =>
        new Promise((resolve) => {
          image.onload = () => {
            drawImage();
            resolve();
          };
          image.onerror = () => resolve();
          image.src = primary;
        });
      await loadImage();

      // Info panel
      const panelY = POSTER_W + 16;
      context.fillStyle = '#231f1b';
      context.font = 'bold 54px system-ui, -apple-system, sans-serif';
      const lines = wrapTitle(context, product.title, POSTER_W - 80, 3);
      lines.forEach((line, index) => {
        context.fillText(line, 40, panelY + 60 + index * 66);
      });

      context.fillStyle = '#e85d00';
      context.font = 'black 72px system-ui, -apple-system, sans-serif';
      const priceText = formatPriceWithStoredSettings(product.price || 0);
      context.fillText(priceText, 40, panelY + 170 + (lines.length - 1) * 66);

      // Brand + QR
      context.fillStyle = '#8a8378';
      context.font = 'bold 30px system-ui, -apple-system, sans-serif';
      context.fillText('HDMarket', 40, POSTER_H - 50);
      context.font = '500 24px system-ui, -apple-system, sans-serif';
      context.fillText('Scannez pour voir le produit', 40, POSTER_H - 14);

      try {
        const qrUrl = await QRCode.toDataURL(buildProductShareUrl(product), {
          width: 220,
          margin: 1,
          color: { dark: '#231f1b', light: '#ffffff' }
        });
        const qrImage = new Image();
        await new Promise((resolve) => {
          qrImage.onload = resolve;
          qrImage.onerror = resolve;
          qrImage.src = qrUrl;
        });
        if (qrImage.width) {
          context.fillStyle = '#ffffff';
          context.fillRect(POSTER_W - 260 - 24, POSTER_H - 250 - 24, 268, 268);
          context.drawImage(qrImage, POSTER_W - 260 - 16, POSTER_H - 250 - 16, 252, 252);
        }
      } catch {
        /* QR optional */
      }

      if (!cancelled) {
        setReady(true);
        setDrawing(false);
      }
    };

    draw().catch(() => {
      if (!cancelled) setDrawing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, product]);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `hdmarket-${String(product?.slug || 'produit').slice(0, 60)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [product?.slug]);

  const share = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || typeof navigator === 'undefined' || typeof navigator.share !== 'function') return;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const file = new File([blob], `hdmarket-${String(product?.slug || 'produit').slice(0, 60)}.png`, {
      type: 'image/png'
    });
    try {
      await navigator.share({
        title: product?.title || 'Produit HDMarket',
        text: `${product?.title || 'Produit HDMarket'} — ${formatPriceWithStoredSettings(product?.price || 0)}`,
        files: [file]
      });
    } catch {
      /* cancelled */
    }
  }, [product?.title, product?.price, product?.slug]);

  return (
    <BaseModal isOpen={open} onClose={onClose} size="sm" mobileSheet ariaLabel="Affiche à partager">
      <ModalHeader title="Affiche à partager" subtitle="Une image prête pour WhatsApp." onClose={onClose} />
      <ModalBody className="pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
          {drawing && !ready ? (
            <div className="aspect-[4/5] w-full animate-pulse bg-neutral-100" />
          ) : null}
          <canvas
            ref={canvasRef}
            width={POSTER_W}
            height={POSTER_H}
            className="aspect-[4/5] w-full"
            style={{ display: ready ? 'block' : 'none' }}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={share}
            disabled={!ready}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-black text-white disabled:opacity-50"
          >
            <ShareIcon className="h-4 w-4" /> Partager
          </button>
          <button
            type="button"
            onClick={download}
            disabled={!ready}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4" /> Télécharger
          </button>
        </div>
      </ModalBody>
    </BaseModal>
  );
}
