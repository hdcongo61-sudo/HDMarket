import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Search } from 'lucide-react';
import api from '../services/api';

const PAGE_SIZE = 12;

export default function AdminProductBoosts() {
  const [boostedProducts, setBoostedProducts] = useState([]);
  const [nonBoostedProducts, setNonBoostedProducts] = useState([]);
  const [boostedLoading, setBoostedLoading] = useState(false);
  const [nonBoostedLoading, setNonBoostedLoading] = useState(false);
  const [boostedError, setBoostedError] = useState('');
  const [nonBoostedError, setNonBoostedError] = useState('');
  const [boostedPage, setBoostedPage] = useState(1);
  const [nonBoostedPage, setNonBoostedPage] = useState(1);
  const [boostedTotalPages, setBoostedTotalPages] = useState(1);
  const [nonBoostedTotalPages, setNonBoostedTotalPages] = useState(1);
  const [savingId, setSavingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const handleSearchTermChange = (event) => {
    setSearchTerm(event.target.value);
    setBoostedPage(1);
    setNonBoostedPage(1);
  };

  const fetchProductsSection = useCallback(
    async ({
      boostedFilter,
      pageNumber,
      searchQuery,
      setItems,
      setTotalPages,
      setLoading,
      setError
    }) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/products/boosts', {
        params: {
          q: searchQuery,
          page: pageNumber,
          limit: PAGE_SIZE,
          boosted: boostedFilter
        }
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotalPages(data?.pagination?.pages || 1);
    } catch (err) {
      console.error('Boosts load error', err);
      setItems([]);
      setTotalPages(1);
      setError(
        boostedFilter
          ? 'Impossible de charger les produits boostés.'
          : 'Impossible de charger les produits à booster.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProductsSection({
      boostedFilter: true,
      pageNumber: boostedPage,
      searchQuery: searchTerm,
      setItems: setBoostedProducts,
      setTotalPages: setBoostedTotalPages,
      setLoading: setBoostedLoading,
      setError: setBoostedError
    });
  }, [searchTerm, boostedPage, fetchProductsSection]);

  useEffect(() => {
    fetchProductsSection({
      boostedFilter: false,
      pageNumber: nonBoostedPage,
      searchQuery: searchTerm,
      setItems: setNonBoostedProducts,
      setTotalPages: setNonBoostedTotalPages,
      setLoading: setNonBoostedLoading,
      setError: setNonBoostedError
    });
  }, [searchTerm, nonBoostedPage, fetchProductsSection]);

  const handleToggle = async (id) => {
    setSavingId(id);
    try {
      await api.patch(`/admin/products/${id}/boost`);
      await Promise.all([
        fetchProductsSection({
          boostedFilter: true,
          pageNumber: boostedPage,
          searchQuery: searchTerm,
          setItems: setBoostedProducts,
          setTotalPages: setBoostedTotalPages,
          setLoading: setBoostedLoading,
          setError: setBoostedError
        }),
        fetchProductsSection({
          boostedFilter: false,
          pageNumber: nonBoostedPage,
          searchQuery: searchTerm,
          setItems: setNonBoostedProducts,
          setTotalPages: setNonBoostedTotalPages,
          setLoading: setNonBoostedLoading,
          setError: setNonBoostedError
        })
      ]);
    } catch (err) {
      console.error('Toggle boost error', err);
      const message = 'Impossible de modifier le boost.';
      setBoostedError(message);
      setNonBoostedError(message);
    } finally {
      setSavingId(null);
    }
  };
  const renderPaginationButtons = (groupId, currentPage, total, onPageChange) => {
    if (total <= 1) return null;
    return Array.from({ length: total }, (_, index) => (
      <button
        key={`${groupId}-${index + 1}`}
        type="button"
        onClick={() => onPageChange(index + 1)}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
          currentPage === index + 1
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
        }`}
      >
        {index + 1}
      </button>
    ));
  };

  const renderProductCard = (product) => {
    const imageUrl =
      product.images?.[0] ||
      product.image ||
      "https://via.placeholder.com/400x400?text=HDMarket";
    const descriptionExcerpt = product.description
      ? `${product.description.slice(0, 120)}...`
      : 'Aucune description disponible.';
    const priceValue = Number(product.price);
    const priceLabel = Number.isFinite(priceValue) ? priceValue.toLocaleString('fr-FR') : '-';
    const createdDate = product.createdAt
      ? new Date(product.createdAt).toLocaleDateString('fr-FR')
      : '-';

    return (
      <article
        key={product._id}
        className="rounded-2xl border border-gray-100 bg-white/80 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/80"
      >
        <div className="mb-4 h-40 overflow-hidden rounded-2xl bg-gray-100">
          <img src={imageUrl} alt={product.title} className="h-full w-full object-cover" loading="lazy" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{product.category}</p>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{product.title}</h2>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p className="text-gray-900 dark:text-gray-100 font-bold">{priceLabel} FCFA</p>
            <span className="text-gray-500 dark:text-gray-400">{createdDate}</span>
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{descriptionExcerpt}</p>
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Boosté : {product.boosted ? 'Oui' : 'Non'}</span>
          <button
            onClick={() => handleToggle(product._id)}
            disabled={savingId === product._id}
            className="rounded-full bg-indigo-600 px-4 py-1 text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {product.boosted ? 'Retirer boost' : 'Booster'}
          </button>
        </div>
      </article>
    );
  };

  const boostedPagination = renderPaginationButtons(
    'boosted',
    boostedPage,
    boostedTotalPages,
    setBoostedPage
  );
  const nonBoostedPagination = renderPaginationButtons(
    'non-boosted',
    nonBoostedPage,
    nonBoostedTotalPages,
    setNonBoostedPage
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 py-6">
      <header className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/80 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
        <MessageSquare className="h-6 w-6 text-indigo-600" />
        <div>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Promotion</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Boosts produits</h1>
        </div>
      </header>
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/80 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-500" />
          <input
            value={searchTerm}
            onChange={handleSearchTermChange}
            placeholder="Recherche par titre ou catégorie..."
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
          />
        </div>
        <p className="text-xs text-gray-500">Affiche les produits validés avec tri par boost.</p>
      </div>
      <section className="space-y-8">
        <div className="space-y-5 rounded-2xl border border-gray-200 bg-white/80 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Boost</p>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Produits boostés</h2>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Page {boostedPage}/{boostedTotalPages}
            </span>
          </div>
          {boostedError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {boostedError}
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {boostedLoading ? (
              <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white/60 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                Chargement des produits boostés...
              </div>
            ) : boostedProducts.length ? (
              boostedProducts.map((product) => renderProductCard(product))
            ) : (
              <div className="col-span-full rounded-2xl border border-gray-100 bg-white/80 p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/80">
                Aucun produit boosté pour le moment.
              </div>
            )}
          </div>
          {boostedPagination && (
            <div className="flex flex-wrap justify-center gap-2 pt-4">
              {boostedPagination}
            </div>
          )}
        </div>

        <div className="space-y-5 rounded-2xl border border-gray-200 bg-white/80 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">À booster</p>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Produits non boostés</h2>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Page {nonBoostedPage}/{nonBoostedTotalPages}
            </span>
          </div>
          {nonBoostedError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {nonBoostedError}
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {nonBoostedLoading ? (
              <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white/60 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                Chargement des produits à booster...
              </div>
            ) : nonBoostedProducts.length ? (
              nonBoostedProducts.map((product) => renderProductCard(product))
            ) : (
              <div className="col-span-full rounded-2xl border border-gray-100 bg-white/80 p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/80">
                Aucun produit disponible pour le moment.
              </div>
            )}
          </div>
          {nonBoostedPagination && (
            <div className="flex flex-wrap justify-center gap-2 pt-4">
              {nonBoostedPagination}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
