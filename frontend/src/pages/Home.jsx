import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import ProductCard from "../components/ProductCard";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Search } from "lucide-react";

/**
 * 🎨 Page d'accueil moderne et responsive pour HDMarket
 * - Mobile-first
 * - Contient bannière, carrousel et liste produits filtrable
 */
export default function Home() {
  // === États principaux ===
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("new");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [highlights, setHighlights] = useState({
    favorites: [],
    topRated: [],
    topDeals: [],
    topDiscounts: []
  });
  const [highlightLoading, setHighlightLoading] = useState(false);

  // === Récupération dynamique ===
  const params = useMemo(() => {
    const p = { page, limit: 12, sort };
    if (q) p.q = q;
    if (category) p.category = category;
    return p;
  }, [q, category, page, sort]);

  // === Chargement produits ===
  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/products/public", { params });
      const fetchedItems = Array.isArray(data) ? data : data.items || [];
      const pages = Array.isArray(data) ? 1 : data.pagination?.pages || 1;
      setItems(fetchedItems);
      setTotalPages(pages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, sort]);

  useEffect(() => {
    const loadHighlights = async () => {
      setHighlightLoading(true);
      try {
        const { data } = await api.get("/products/public/highlights");
        setHighlights({
          favorites: Array.isArray(data?.favorites) ? data.favorites : [],
          topRated: Array.isArray(data?.topRated) ? data.topRated : [],
          topDeals: Array.isArray(data?.topDeals) ? data.topDeals : [],
          topDiscounts: Array.isArray(data?.topDiscounts) ? data.topDiscounts : []
        });
      } catch (e) {
        console.error(e);
      } finally {
        setHighlightLoading(false);
      }
    };

    loadHighlights();
  }, []);

  // === Fonction recherche ===
  const onSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 space-y-10">
      {/* 💡 HERO SECTION */}
      <section className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white rounded-3xl p-6 md:p-10 shadow-lg overflow-hidden">
        <div className="max-w-2xl z-10 relative">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-3">
            Bienvenue sur <span className="text-yellow-300">HDMarket</span>
          </h1>
          <p className="text-sm md:text-lg mb-5 opacity-90">
            Découvrez les meilleures offres de produits et publiez vos articles
            facilement. Une marketplace moderne et rapide.
          </p>
          <a
            href="/my"
            className="inline-block bg-yellow-400 text-black font-semibold px-4 py-2 rounded-lg hover:bg-yellow-300 transition"
          >
            Publier un produit
          </a>
        </div>

        {/* Décor d’arrière-plan */}
        <div className="absolute inset-0 bg-[url('/hero-pattern.svg')] opacity-10"></div>
      </section>

      {/* 🏆 TOP PRODUITS */}
      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-800">Top du moment</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Top favoris</h3>
                <p className="text-xs text-gray-500">Les annonces les plus enregistrées</p>
              </div>
              <Link
                to="/top-favorites"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Voir tout
              </Link>
            </div>
            {highlightLoading ? (
              <ul className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 rounded bg-gray-100 animate-pulse" />
                      <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : highlights.favorites.length ? (
              <ul className="space-y-3">
                {highlights.favorites.slice(0, 4).map((product, index) => (
                  <li key={product._id}>
                    <Link
                      to={`/product/${product._id}`}
                      className="flex items-center gap-3 rounded-2xl border border-transparent p-2 transition hover:border-indigo-100 hover:bg-indigo-50/60"
                    >
                      <span className="text-sm font-semibold text-indigo-600 w-6 text-center">
                        #{index + 1}
                      </span>
                      <img
                        src={
                          product.images?.[0] ||
                          product.image ||
                          "https://via.placeholder.com/60"
                        }
                        alt={product.title}
                        className="h-12 w-12 rounded-2xl object-cover"
                        loading="lazy"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{product.title}</p>
                        <p className="text-xs text-gray-500">
                          {Number(product.price || 0).toLocaleString()} FCFA
                        </p>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <p className="font-semibold text-indigo-600">
                          {product.favoritesCount || 0} fav
                        </p>
                        <p>Note {Number(product.ratingAverage || 0).toFixed(1)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">
                Pas encore de favoris, soyez le premier à enregistrer une annonce !
              </p>
            )}
          </div>
          <div className="rounded-3xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Top notés</h3>
                <p className="text-xs text-gray-500">Les mieux évalués par la communauté</p>
              </div>
              <Link
                to="/top-ranking"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Voir tout
              </Link>
            </div>
            {highlightLoading ? (
              <ul className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 rounded bg-gray-100 animate-pulse" />
                      <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : highlights.topRated.length ? (
              <ul className="space-y-3">
                {highlights.topRated.slice(0, 4).map((product, index) => (
                  <li key={product._id}>
                    <Link
                      to={`/product/${product._id}`}
                      className="flex items-center gap-3 rounded-2xl border border-transparent p-2 transition hover:border-indigo-100 hover:bg-indigo-50/60"
                    >
                      <span className="text-sm font-semibold text-amber-600 w-6 text-center">
                        #{index + 1}
                      </span>
                      <img
                        src={
                          product.images?.[0] ||
                          product.image ||
                          "https://via.placeholder.com/60"
                        }
                        alt={product.title}
                        className="h-12 w-12 rounded-2xl object-cover"
                        loading="lazy"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{product.title}</p>
                        <p className="text-xs text-gray-500">
                          {Number(product.price || 0).toLocaleString()} FCFA
                        </p>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <p className="font-semibold text-amber-600">
                          {Number(product.ratingAverage || 0).toFixed(1)} ★
                        </p>
                        <p>{product.ratingCount || 0} avis</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">
                Les premières évaluations apparaîtront ici très bientôt.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 🔥 TOP DEALS */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Bonnes affaires</h2>
          {!highlightLoading && highlights.topDeals.length ? (
            <Link
              to="/top-deals"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Voir tout
            </Link>
          ) : null}
        </div>
        {highlightLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />
                <div className="mt-3 space-y-2">
                  <div className="h-3 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : highlights.topDeals.length ? (
          <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            spaceBetween={16}
            slidesPerView={1}
            navigation
            pagination={{ clickable: true }}
            autoplay={{ delay: 4000, disableOnInteraction: false }}
            breakpoints={{
              640: { slidesPerView: 2 },
              1024: { slidesPerView: 4 }
            }}
          >
            {highlights.topDeals.slice(0, 12).map((product) => (
              <SwiperSlide key={`deal-${product._id}`}>
                <ProductCard p={product} />
              </SwiperSlide>
            ))}
          </Swiper>
        ) : (
          <p className="text-sm text-gray-500">
            Les prochaines bonnes affaires apparaîtront ici dès qu&apos;elles seront disponibles.
          </p>
        )}
      </section>

      {/* 💸 PROMOTIONS */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Promotions</h2>
          {!highlightLoading && highlights.topDiscounts.length ? (
            <Link
              to="/top-discounts"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Voir tout
            </Link>
          ) : null}
        </div>
        {highlightLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />
                <div className="mt-3 space-y-2">
                  <div className="h-3 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : highlights.topDiscounts.length ? (
          <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            spaceBetween={16}
            slidesPerView={1}
            navigation
            pagination={{ clickable: true }}
            autoplay={{ delay: 4500, disableOnInteraction: false }}
            breakpoints={{
              640: { slidesPerView: 2 },
              1024: { slidesPerView: 4 }
            }}
          >
            {highlights.topDiscounts.slice(0, 12).map((product) => (
              <SwiperSlide key={`discount-${product._id}`}>
                <ProductCard p={product} />
              </SwiperSlide>
            ))}
          </Swiper>
        ) : (
          <p className="text-sm text-gray-500">
            Aucune promotion active pour le moment. Repassez bientôt pour dénicher de bonnes affaires.
          </p>
        )}
      </section>

      {/* 🧭 TRI RAPIDE */}
      <div className="flex justify-between items-center flex-wrap gap-2 text-sm">
        <span className="font-medium">Trier par :</span>
        <select
          className="border rounded p-2 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="new">Nouveautés</option>
          <option value="price_asc">Prix croissant</option>
          <option value="price_desc">Prix décroissant</option>
          <option value="discount">Promotions</option>
        </select>
      </div>

      {/* 🆕 CARROUSEL DES NOUVEAUTÉS */}
      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-800">
          Nouveautés cette semaine
        </h2>
        <Swiper
          modules={[Navigation, Pagination, Autoplay]}
          spaceBetween={16}
          slidesPerView={1}
          navigation
          pagination={{ clickable: true }}
          autoplay={{ delay: 3500, disableOnInteraction: false }}
          breakpoints={{
            640: { slidesPerView: 2 },
            1024: { slidesPerView: 4 },
          }}
        >
          {items.slice(0, 8).map((p) => (
            <SwiperSlide key={p._id}>
              <ProductCard p={p} />
            </SwiperSlide>
          ))}
        </Swiper>
      </section>

      {/* 🛍️ LISTE DES PRODUITS */}
      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-800">
          Tous les produits
        </h2>

        {loading ? (
          // Skeleton loader moderne
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-gray-100 h-48 rounded-xl"
              ></div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((p) => (
              <ProductCard key={p._id} p={p} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 mt-10">
            Aucun produit trouvé.
          </p>
        )}
      </section>

      {/* 📄 PAGINATION */}
      <div className="flex justify-center items-center gap-3 pt-6">
        <button
          className="px-4 py-2 bg-gray-200 rounded-full disabled:opacity-50 hover:bg-gray-300 transition"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          ◀ Précédent
        </button>
        <span className="text-sm font-medium">
          Page {page} / {totalPages}
        </span>
        <button
          className="px-4 py-2 bg-gray-200 rounded-full disabled:opacity-50 hover:bg-gray-300 transition"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          Suivant ▶
        </button>
      </div>
    </div>
  );
}
