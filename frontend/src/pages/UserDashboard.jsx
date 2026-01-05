import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import PaymentForm from '../components/PaymentForm';
import ProductForm from '../components/ProductForm';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import { buildProductPath } from '../utils/links';

export default function UserDashboard() {
  const [items, setItems] = useState([]);
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const externalLinkProps = useDesktopExternalLink();
  const ITEMS_PER_PAGE = 6;
  const handleModalClose = () => {
    setProductModalOpen(false);
    setEditingProduct(null);
  };
  const load = async () => {
    const { data } = await api.get('/products');
    setItems(data);
    setCurrentPage(1);
  };
  useEffect(() => {
    load();
  }, []);
  const statusMessages = {
    pending: "Annonce en attente de validation après paiement.",
    approved: "Annonce validée et visible par les acheteurs.",
    rejected: "Annonce rejetée. Consultez le support pour plus de détails.",
    disabled: "Annonce désactivée. Elle n'est plus visible par les acheteurs."
  };
  const statusStyles = {
    pending: 'text-yellow-600',
    approved: 'text-green-600',
    rejected: 'text-red-600',
    disabled: 'text-gray-500'
  };

  const updateStatus = async (id, action) => {
    try {
      await api.patch(`/products/${id}/${action}`);
      load();
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  const totalPages = items.length ? Math.ceil(items.length / ITEMS_PER_PAGE) : 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return items.slice(start, start + ITEMS_PER_PAGE);
  }, [items, currentPage]);
  const currentRangeStart = items.length ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const currentRangeEnd = Math.min(items.length, currentPage * ITEMS_PER_PAGE);
  const goToPage = (page) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(nextPage);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold">Mes annonces</h2>
          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setProductModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-600 bg-indigo-600/10 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-600 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            Publier une annonce
          </button>
        </div>
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-6 sm:items-center">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-white p-0 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <p className="text-sm font-semibold text-gray-900">
                {editingProduct ? 'Modifier une annonce' : 'Publier une annonce'}
              </p>
              <button
                type="button"
                onClick={handleModalClose}
                className="text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
              >
                Fermer
              </button>
            </div>
            <div className="max-h-[85vh] overflow-y-auto px-5 py-6 sm:px-6">
              <ProductForm
                initialValues={editingProduct}
                productId={editingProduct?._id}
                onCreated={() => {
                  load();
                  handleModalClose();
                }}
                onUpdated={() => {
                  load();
                  handleModalClose();
                }}
              />
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {paginatedItems.map((p) => (
          <div key={p._id} className="border rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{p.title}</h3>
              <span className="text-xs uppercase">{p.status}</span>
            </div>
            {p.images?.length ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {p.images.map((src, idx) => (
                  <img
                    key={src || idx}
                    src={src}
                    alt={`${p.title} ${idx + 1}`}
                    className="h-24 w-24 object-cover rounded border"
                    loading="lazy"
                  />
                ))}
              </div>
            ) : (
              <div className="h-24 w-full bg-gray-100 flex items-center justify-center text-xs text-gray-500 rounded">
                Aucune image
              </div>
            )}
            <p className="text-sm text-gray-600">{Number(p.price).toLocaleString()} FCFA</p>
            <p className={`text-sm font-medium ${statusStyles[p.status] || 'text-gray-600'}`}>
              {statusMessages[p.status] || 'Statut en cours de mise à jour.'}
            </p>
      <div className="flex items-center gap-2 pt-1 text-sm">
              {p.status === 'approved' && (
                <>
                  <Link
                    to={buildProductPath(p)}
                    {...externalLinkProps}
                    className="text-indigo-600 hover:underline"
                  >
                    Voir l'annonce
                  </Link>
                  <span className="text-gray-300">|</span>
                </>
              )}
              <button
                type="button"
                className="text-indigo-600 hover:underline"
                onClick={() => {
                  setEditingProduct(p);
                  setProductModalOpen(true);
                }}
              >
                Modifier
              </button>
              <span className="text-gray-300">|</span>
              {p.status !== 'disabled' ? (
                  <button
                    onClick={() => updateStatus(p.slug || p._id, 'disable')}
                  className="text-sm text-red-600 hover:underline"
                  type="button"
                >
                  Désactiver
                </button>
              ) : (
                  <button
                    onClick={() => updateStatus(p.slug || p._id, 'enable')}
                  className="text-sm text-indigo-600 hover:underline"
                  type="button"
                >
                  Réactiver
                </button>
              )}
            </div>
            {p.status !== 'disabled' && <PaymentForm product={p} onSubmitted={load} />}
          </div>
        ))}
      </div>
      {items.length > ITEMS_PER_PAGE && (
        <div className="flex flex-col gap-3 border-t border-gray-100 px-2 pt-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Affichage {currentRangeStart}-{currentRangeEnd} sur {items.length} annonces
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-gray-300 px-3 py-1 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Précédent
            </button>
            <span className="text-sm font-medium text-gray-700">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="rounded-full border border-gray-300 px-3 py-1 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
