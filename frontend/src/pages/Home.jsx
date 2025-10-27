import React, { useEffect, useMemo, useState } from "react";
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
