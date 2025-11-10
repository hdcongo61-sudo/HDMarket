import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { ClipboardList, Package, Truck, CheckCircle, MapPin, Clock, ShieldCheck } from 'lucide-react';

const STATUS_LABELS = {
  confirmed: 'Commande confirmée',
  delivering: 'En cours de livraison',
  delivered: 'Commande terminée'
};

const STATUS_STYLES = {
  confirmed: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  delivering: 'border-blue-200 bg-blue-50 text-blue-800',
  delivered: 'border-green-200 bg-green-50 text-green-800'
};

const ORDER_FLOW = [
  {
    id: 'confirmed',
    label: 'Commande confirmée',
    description: 'Un gestionnaire a validé la commande et prépare l’expédition.',
    icon: Package
  },
  {
    id: 'delivering',
    label: 'En cours de livraison',
    description: 'Le colis est pris en charge par le livreur et se dirige vers vous.',
    icon: Truck
  },
  {
    id: 'delivered',
    label: 'Commande terminée',
    description: 'La commande est livrée et archivée par nos équipes.',
    icon: CheckCircle
  }
];

const OrderProgress = ({ status }) => {
  const currentIndexRaw = ORDER_FLOW.findIndex((step) => step.id === status);
  const currentIndex = currentIndexRaw >= 0 ? currentIndexRaw : 0;

  return (
    <div className="mt-4 border border-gray-100 rounded-2xl p-3 bg-gray-50">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Suivi commande</p>
      <div className="space-y-4">
        {ORDER_FLOW.map((step, index) => {
          const Icon = step.icon;
          const reached = currentIndex >= index;
          const isCurrent = currentIndex === index;
          return (
            <div key={step.id} className="flex items-start gap-3">
              <div
                className={`mt-0.5 w-9 h-9 rounded-full border-2 flex items-center justify-center ${
                  reached ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-gray-200 text-gray-400 bg-white'
                }`}
              >
                <Icon size={16} />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${reached ? 'text-gray-900' : 'text-gray-500'}`}>
                  {step.label}
                  {isCurrent && (
                    <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      En cours
                    </span>
                  )}
                  {!isCurrent && reached && (
                    <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      Terminée
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function UserOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadOrders = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/orders');
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.response?.data?.message || "Impossible de charger vos commandes.");
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 md:px-8 py-6 space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            Mes commandes
          </h1>
          <p className="text-sm text-gray-500">
            Retrouvez ici vos commandes enregistrées par nos équipes.
          </p>
        </div>
        <Link
          to="/"
          className="text-sm text-indigo-600 hover:text-indigo-500"
        >
          Retour à l’accueil
        </Link>
      </header>

      {loading ? (
        <p className="text-sm text-gray-500">Chargement des commandes…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center text-sm text-gray-500">
          Vous n’avez pas encore de commande. Contactez un gestionnaire pour lancer votre première livraison.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const orderItems =
              order.items && order.items.length
                ? order.items
                : order.productSnapshot
                ? [{ snapshot: order.productSnapshot, quantity: 1 }]
                : [];
            return (
              <div key={order._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-500">Commande #{order._id.slice(-6)}</p>
                  <div className="text-sm text-gray-600 space-y-1 mt-1">
                    {orderItems.map((item, idx) => (
                      <div key={`${order._id}-${item.product}`} className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{item.snapshot?.title || 'Produit'}</span>
                        <span className="text-xs text-gray-500">
                          x{item.quantity} · {Number(item.snapshot?.price || 0).toLocaleString()} FCFA
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <div className="inline-flex items-center gap-1 text-gray-600">
                      <ShieldCheck size={13} className="text-indigo-500" />
                      <span>
                        Gestionnaire : {order.createdBy?.name || order.createdBy?.email || 'Admin HDMarket'}
                      </span>
                    </div>
                    <span className="hidden sm:block text-gray-300">•</span>
                    <span className="font-semibold text-gray-700">
                      Statut : {STATUS_LABELS[order.status]}
                    </span>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[order.status]}`}>
                  {order.status === 'confirmed' && <Package size={14} />}
                  {order.status === 'delivering' && <Truck size={14} />}
                  {order.status === 'delivered' && <CheckCircle size={14} />}
                  {STATUS_LABELS[order.status]}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                <div>
                  <p className="font-semibold text-gray-900">Livraison</p>
                  <p>{order.deliveryAddress}</p>
                  <p className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin size={13} />
                    {order.deliveryCity}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">Suivi</p>
                  {order.trackingNote ? (
                    <p className="text-sm">{order.trackingNote}</p>
                  ) : (
                    <p className="text-xs text-gray-500">Aucune note ajoutée pour le moment.</p>
                  )}
                </div>
              </div>

              <OrderProgress status={order.status} />

              <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  Créée le {new Date(order.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                {order.shippedAt && (
                  <div className="flex items-center gap-1">
                    <Truck size={12} />
                    Expédiée le {new Date(order.shippedAt).toLocaleDateString('fr-FR')}
                  </div>
                )}
                {order.deliveredAt && (
                  <div className="flex items-center gap-1">
                    <CheckCircle size={12} />
                    Livrée le {new Date(order.deliveredAt).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
