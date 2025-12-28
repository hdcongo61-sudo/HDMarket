import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import { Shield, Store, MapPin, Loader2, User, Crown, Star } from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';

export default function VerifiedShops() {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';
  const [shops, setShops] = useState([]);
  const [pendingShops, setPendingShops] = useState([]);
  const topShops = useMemo(() => {
    if (!shops.length) return [];
    return [...shops]
      .sort((a, b) => {
        const ratingA = Number(a.ratingAverage ?? 0);
        const ratingB = Number(b.ratingAverage ?? 0);
        if (ratingB !== ratingA) return ratingB - ratingA;
        const countA = Number(a.ratingCount ?? 0);
        const countB = Number(b.ratingCount ?? 0);
        if (countB !== countA) return countB - countA;
        const productsA = Number(a.productCount ?? 0);
        const productsB = Number(b.productCount ?? 0);
        return productsB - productsA;
      })
      .slice(0, 3);
  }, [shops]);
  const [adminMeta, setAdminMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchShops = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: allShops } = await api.get('/shops');
        const publicData = Array.isArray(allShops) ? allShops : [];
        const verifiedList = publicData.filter((shop) => shop.shopVerified);
        const unverifiedList = publicData.filter((shop) => !shop.shopVerified);
        if (!active) return;
        setShops(verifiedList);
        setPendingShops(unverifiedList);

        if (isAdmin) {
          try {
            const { data: adminData } = await api.get('/admin/shops/verified');
            if (!active) return;
            const map = {};
            (adminData || []).forEach((item) => {
              map[item.id] = item;
            });
            setAdminMeta(map);
          } catch (adminError) {
            console.error('Erreur chargement meta admin:', adminError);
          }
        } else {
          setAdminMeta({});
        }
      } catch (e) {
        if (!active) return;
        setError(e.response?.data?.message || e.message || 'Impossible de charger les boutiques.');
        setShops([]);
        setPendingShops([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchShops();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const pageTitle = useMemo(
    () => (isAdmin ? 'Boutiques vérifiées (Admin)' : 'Boutiques vérifiées'),
    [isAdmin]
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-emerald-600 flex items-center gap-2">
            <Shield size={18} />
            Réseau labellisé ETS HD Tech Filial
          </p>
          <h1 className="text-3xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-sm text-gray-500">
            Découvrez les boutiques ayant été vérifiées manuellement par l&apos;équipe HDMarket.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
            {error}
          </div>
        ) : !shops.length ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-gray-600">
            Aucune boutique vérifiée pour le moment.
          </div>
        ) : (
          <>
            {topShops.length > 0 && (
              <section className="bg-white rounded-2xl border border-indigo-100 p-5 shadow-sm space-y-4">
                <div className="flex flex-col gap-1">
                  <p className="text-xs uppercase font-semibold text-indigo-500 flex items-center gap-2">
                    <Crown size={16} className="text-indigo-600" />
                    Classement hebdomadaire
                  </p>
                  <h2 className="text-2xl font-bold text-gray-900">Top boutiques vérifiées</h2>
                  <p className="text-sm text-gray-500">
                    Les boutiques qui obtiennent les meilleures notes moyennes et le plus d&apos;avis.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {topShops.map((shop, index) => (
                    <Link
                      key={`top-${shop._id}`}
                      to={`/shop/${shop._id}`}
                      className="rounded-2xl border border-indigo-50 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm hover:shadow-md transition-all space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={shop.shopLogo || '/api/placeholder/80/80'}
                            alt={shop.shopName}
                            className="w-14 h-14 rounded-2xl object-cover border border-indigo-100"
                          />
                          <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-lg">
                            #{index + 1}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate flex items-center gap-1">
                            {shop.shopName}
                            <VerifiedBadge verified showLabel={false} />
                          </p>
                          <p className="text-xs text-gray-500 truncate">{shop.shopAddress || 'Adresse non renseignée'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Star size={14} className="text-amber-500" />
                        {Number(shop.ratingAverage ?? 0).toFixed(1)}/5 · {shop.ratingCount || 0} avis
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Store size={14} className="text-indigo-500" />
                        {shop.productCount || 0} annonce{shop.productCount > 1 ? 's' : ''}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shops.map((shop) => {
              const meta = adminMeta[String(shop._id)];
              return (
                <Link
                  key={shop._id}
                  to={`/shop/${shop._id}`}
                  className="rounded-2xl border border-gray-100 bg-white p-4 hover:border-indigo-200 hover:shadow-lg transition-all space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={shop.shopLogo || '/api/placeholder/80/80'}
                      alt={shop.shopName}
                      className="w-14 h-14 rounded-2xl object-cover border border-indigo-100"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{shop.shopName}</p>
                      <VerifiedBadge verified showLabel={false} className="mt-1" />
                      <p className="text-xs text-gray-500 truncate">
                        {shop.shopAddress || 'Adresse non renseignée'}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <Store size={14} className="text-indigo-500" />
                    {shop.productCount || 0} annonce{shop.productCount > 1 ? 's' : ''}
                  </div>
                  {isAdmin && meta?.shopVerifiedBy && (
                    <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-xs text-indigo-900 space-y-1">
                      <p className="flex items-center gap-2 font-semibold">
                        <User size={14} />
                        Vérifiée par {meta.shopVerifiedBy.name}
                      </p>
                      {meta.shopVerifiedAt ? (
                        <p className="text-indigo-700">
                          Le {new Date(meta.shopVerifiedAt).toLocaleDateString('fr-FR')}
                        </p>
                      ) : null}
                      <p className="text-indigo-600">{meta.shopVerifiedBy.email}</p>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}

        {!loading && !error && pendingShops.length > 0 && (
          <section className="mt-10 space-y-4">
            <div>
              <p className="text-xs uppercase font-semibold text-amber-600 flex items-center gap-2">
                <Shield size={16} className="text-amber-500" />
                Boutiques en attente de vérification
              </p>
              <h2 className="text-2xl font-bold text-gray-900 mt-1">Soumissions récentes</h2>
              <p className="text-sm text-gray-500">
                Ces boutiques seront examinées prochainement par l’équipe HDMarket.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingShops.map((shop) => (
                <Link
                  key={`pending-${shop._id}`}
                  to={`/shop/${shop._id}`}
                  className="rounded-2xl border border-amber-100 bg-white p-4 hover:border-amber-200 hover:shadow-md transition-all space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={shop.shopLogo || '/api/placeholder/80/80'}
                      alt={shop.shopName}
                      className="w-14 h-14 rounded-2xl object-cover border border-amber-100"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{shop.shopName || shop.name}</p>
                      <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                        <MapPin size={12} />
                        {shop.shopAddress || 'Adresse en cours'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{shop.productCount || 0} annonce{shop.productCount > 1 ? 's' : ''}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700 border border-amber-100">
                      En revue
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Retourner à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
