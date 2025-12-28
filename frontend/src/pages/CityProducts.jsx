import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import ProductCard from '../components/ProductCard';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';

const cityOptions = ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'];

export default function CityProducts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cityHighlights, setCityHighlights] = useState({});
  const cacheRef = useRef(new Map());
  const externalLinkProps = useDesktopExternalLink();
  const [selectedCity, setSelectedCity] = useState(() => {
    const initial = searchParams.get('city');
    return cityOptions.includes(initial) ? initial : cityOptions[0];
  });

  useEffect(() => {
    const controller = new AbortController();
    const loadHighlights = async () => {
      try {
        const { data } = await api.get('/products/public/highlights', {
          params: { limit: 12 },
          signal: controller.signal
        });
        if (data?.cityHighlights && typeof data.cityHighlights === 'object') {
          setCityHighlights(data.cityHighlights);
        }
      } catch (e) {
        // ignore highlight fetch errors
      }
    };
    loadHighlights();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedCity) return;

    const cached = cacheRef.current.get(selectedCity);
    if (cached) {
      setItems(cached.items);
      setError(cached.error || '');
      setLoading(false);
      if (cached.nextRetry && Date.now() < cached.nextRetry) {
        return;
      }
    }

    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/products/public', {
          params: { city: selectedCity },
          signal: controller.signal
        });
        const list = Array.isArray(data) ? data : data?.items || [];
        if (list.length) {
          setItems(list);
          cacheRef.current.set(selectedCity, {
            items: list,
            error: '',
            nextRetry: 0
          });
        } else if (cityHighlights[selectedCity]) {
          const fallback = cityHighlights[selectedCity];
          setItems(fallback);
          cacheRef.current.set(selectedCity, {
            items: fallback,
            error: '',
            nextRetry: 0
          });
        } else {
          setItems([]);
          cacheRef.current.set(selectedCity, {
            items: [],
            error: '',
            nextRetry: 0
          });
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        const message = e.response?.data?.message || e.message || 'Impossible de charger les produits.';
        setError(message);
        const fallbackItems =
          cacheRef.current.get(selectedCity)?.items || cityHighlights[selectedCity] || [];
        if (fallbackItems.length) {
          setItems(fallbackItems);
        }
        cacheRef.current.set(selectedCity, {
          items: fallbackItems,
          error: message,
          nextRetry: Date.now() + 60 * 1000
        });
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [selectedCity, cityHighlights]);

  useEffect(() => {
    if (!items.length && cityHighlights[selectedCity]?.length) {
      const fallback = cityHighlights[selectedCity];
      setItems(fallback);
      cacheRef.current.set(selectedCity, {
        items: fallback,
        error: '',
        nextRetry: 0
      });
    }
  }, [cityHighlights, selectedCity, items.length]);

  useEffect(() => {
    if (selectedCity) {
      setSearchParams({ city: selectedCity });
    }
  }, [selectedCity, setSearchParams]);

  const title = useMemo(() => {
    if (!selectedCity) return 'Produits par ville';
    return `Produits disponibles à ${selectedCity}`;
  }, [selectedCity]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500">
              Consultez les annonces publiées depuis nos principales villes de la République du Congo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="city-select" className="text-sm text-gray-600">
              Choisir une ville
            </label>
            <select
              id="city-select"
              value={selectedCity}
              onChange={(event) => setSelectedCity(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 h-48 rounded-xl bg-gray-100 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 rounded bg-gray-100 animate-pulse" />
                  <div className="h-4 w-2/3 rounded bg-gray-100 animate-pulse" />
                  <div className="h-4 w-1/3 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((product) => (
              <ProductCard key={product._id} p={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Aucune annonce disponible pour cette ville pour le moment.
          </div>
        )}

        <section className="rounded-xl border border-indigo-100 bg-white px-4 py-4 text-sm text-indigo-700 sm:px-6 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="font-semibold text-indigo-800">
              Besoin d&apos;accéder aux annonces d&apos;une catégorie spécifique&nbsp;?
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                to="/products"
                {...externalLinkProps}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                Parcourir tous les produits
              </Link>
              <Link
                to="/#categories"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-gray-50"
              >
                Voir les catégories
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
