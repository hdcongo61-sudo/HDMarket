import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CameraIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import BaseModal, { ModalBody, ModalHeader } from '../modals/BaseModal';
import api from '../../services/api';
import { formatPriceWithStoredSettings } from '../../utils/priceFormatter';
import { buildProductPath } from '../../utils/links';

/** Extracts the photo's average color locally (canvas) — nothing is uploaded. */
const extractDominantColor = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, size, size);
        const { data } = context.getImageData(0, 0, size, size);
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count += 1;
        }
        resolve({ r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) });
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible.'));
    };
    image.src = url;
  });

export default function ImageSearchModal({ open, onClose }) {
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [scanned, setScanned] = useState(0);

  useEffect(() => {
    if (!open) {
      setPreview('');
      setError('');
      setResults([]);
      setLoading(false);
    }
  }, [open]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setResults([]);
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      const color = await extractDominantColor(file);
      const { data } = await api.post('/search/by-color', { color: [color.r, color.g, color.b], limit: 12 });
      setResults(Array.isArray(data?.results) ? data.results : []);
      setScanned(Number(data?.scanned || 0));
      if (!data?.results?.length) {
        setError('Aucun produit visuellement proche trouvé. Essayez une autre photo.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Recherche par image impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal isOpen={open} onClose={onClose} size="lg" mobileSheet>
      <ModalHeader
        title="Recherche par image"
        subtitle="Photographiez un article pour trouver des produits visuellement similaires."
        onClose={onClose}
      />
      <ModalBody>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-[#e85d00] px-4 py-2.5 text-xs font-black text-white active:scale-[0.98]">
          <CameraIcon className="h-4 w-4" /> Prendre une photo
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
        </label>
        <label className="ml-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-xs font-black text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
          <CloudArrowUpIcon className="h-4 w-4" /> Choisir une image
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>

        {preview ? (
          <div className="mt-4 flex items-center gap-3">
            <img src={preview} alt="Aperçu" className="h-20 w-20 rounded-2xl object-cover ring-1 ring-neutral-200" />
            <p className="text-xs text-neutral-500">
              {loading ? 'Recherche de produits similaires…' : scanned ? `${scanned} produits comparés.` : ''}
            </p>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-5 grid grid-cols-3 gap-2" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse space-y-2">
                <div className="aspect-square rounded-xl bg-neutral-100 dark:bg-neutral-900" />
                <div className="h-3 w-4/5 rounded-full bg-neutral-100 dark:bg-neutral-900" />
              </div>
            ))}
          </div>
        ) : null}

        {error ? <p className="mt-4 text-xs font-medium text-red-600">{error}</p> : null}

        {results.length ? (
          <div className="mt-5">
            <p className="mb-2 text-xs font-black text-neutral-800 dark:text-neutral-100">
              Résultats visuels ({results.length})
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {results.map((item) => (
                <Link
                  key={item.id}
                  to={buildProductPath({ _id: item.id, slug: item.slug })}
                  onClick={onClose}
                  className="overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <div className="aspect-square overflow-hidden bg-[#f1ece4]">
                    {item.image ? (
                      <img src={item.image} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-2 min-h-[30px] text-[10.5px] font-semibold leading-[14px] text-neutral-800 dark:text-neutral-200">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[11px] font-black text-[#e85d00]">
                      {formatPriceWithStoredSettings(item.price)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </ModalBody>
    </BaseModal>
  );
}
