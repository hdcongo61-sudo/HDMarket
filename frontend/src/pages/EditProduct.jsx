import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Edit, Tag, FileText, Package, DollarSign, Save, Image, AlertCircle } from 'lucide-react';
import categoryGroups, { getCategoryMeta } from '../data/categories';

export default function EditProduct() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    discount: 0,
    condition: 'used',
    images: []
  });
  const [error, setError] = useState('');

  const priceDisplay = useMemo(() => {
    if (!product) return { current: '', before: '' };
    const current = Number(product.price).toLocaleString();
    const before = product.priceBeforeDiscount
      ? Number(product.priceBeforeDiscount).toLocaleString()
      : product.discount > 0
      ? Number((product.price / (1 - product.discount / 100)).toFixed(0)).toLocaleString()
      : '';
    return { current, before };
  }, [product]);

  useEffect(() => {
    let active = true;
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/products/${slug}`);
        if (!active) return;
        const ownerId = data.user?._id || data.user;
        if (user?.role !== 'admin' && ownerId && String(ownerId) !== user?.id) {
          setError("Vous n'êtes pas autorisé à modifier cette annonce.");
          return;
        }
        setProduct(data);
        const categoryMeta = getCategoryMeta(data.category);
        setForm({
          title: data.title || '',
          description: data.description || '',
          category: categoryMeta?.value || data.category || '',
          discount: data.discount ?? 0,
          condition: data.condition || 'used',
          images: data.images || []
        });
        setError('');
      } catch (e) {
        if (!active) return;
        const message =
          e.response?.status === 403
            ? "Accès refusé. Cette annonce ne vous appartient pas."
            : e.response?.status === 404
            ? 'Annonce introuvable.'
            : e.response?.data?.message || e.message || 'Erreur lors du chargement.';
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchProduct();
    return () => {
      active = false;
    };
  }, [id]);

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        discount: form.discount,
        condition: form.condition
      };
      await api.put(`/products/${slug}`, payload);
      showToast('Annonce mise à jour avec succès !', { variant: 'success' });
      navigate('/my');
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Erreur lors de la mise à jour.';
      showToast(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Edit className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-500">Chargement de l'annonce…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Erreur</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Retour</span>
          </button>
        </div>

        {/* En-tête du formulaire */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Edit className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Modifier l'annonce</h1>
          <p className="text-gray-500">Mettez à jour les informations de votre produit</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {/* Section Informations de base */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-2 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-gray-900">Informations du produit</h2>
            </div>

            {/* Titre */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <FileText className="w-4 h-4 text-indigo-500" />
                <span>Titre de l'annonce *</span>
              </label>
              <input
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
                placeholder="Ex: iPhone 13 Pro Max 256GB - État neuf"
                value={form.title}
                onChange={(e) => onChange('title', e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <FileText className="w-4 h-4 text-indigo-500" />
                <span>Description détaillée *</span>
              </label>
              <textarea
                rows={4}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400 resize-none"
                placeholder="Décrivez votre produit en détail : caractéristiques, état, accessoires inclus..."
                value={form.description}
                onChange={(e) => onChange('description', e.target.value)}
                required
              />
            </div>

            {/* Catégorie et Condition */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Catégorie */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <Tag className="w-4 h-4 text-indigo-500" />
                  <span>Catégorie *</span>
                </label>
                <select
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  value={form.category}
                  onChange={(e) => onChange('category', e.target.value)}
                  required
                >
                  <option value="">Sélectionnez une catégorie</option>
                  {categoryGroups.map((group, index) => (
                    <optgroup key={index} label={group.label}>
                      {group.options.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Condition */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">État du produit</label>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <div className="relative">
                      <input
                        type="radio"
                        name="condition"
                        value="new"
                        checked={form.condition === 'new'}
                        onChange={(e) => onChange('condition', e.target.value)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-all ${
                        form.condition === 'new' 
                          ? 'border-indigo-500 bg-indigo-500' 
                          : 'border-gray-300'
                      }`}>
                        {form.condition === 'new' && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-700">Neuf</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <div className="relative">
                      <input
                        type="radio"
                        name="condition"
                        value="used"
                        checked={form.condition === 'used'}
                        onChange={(e) => onChange('condition', e.target.value)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-all ${
                        form.condition === 'used' 
                          ? 'border-indigo-500 bg-indigo-500' 
                          : 'border-gray-300'
                      }`}>
                        {form.condition === 'used' && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-700">Occasion</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section Prix et Remise */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-2 h-6 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-gray-900">Prix et Promotion</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Prix Actuel */}
              <div className="rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-medium text-indigo-900">Prix actuel</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-indigo-600">{priceDisplay.current} FCFA</p>
                    {priceDisplay.before && (
                      <p className="text-sm text-gray-500 line-through">{priceDisplay.before} FCFA</p>
                    )}
                  </div>
                  <p className="text-xs text-indigo-700">
                    Le prix de vente ne peut pas être modifié après création
                  </p>
                </div>
              </div>

              {/* Remise */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <Tag className="w-4 h-4 text-green-500" />
                  <span>Remise promotionnelle (%)</span>
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  min="0"
                  max="99"
                  step="1"
                  value={form.discount}
                  onChange={(e) => onChange('discount', Number(e.target.value))}
                />
                <p className="text-xs text-gray-500">
                  Appliquez une remise pour mettre en avant votre annonce
                </p>
                {form.discount > 0 && (
                  <div className="text-xs text-green-600 font-medium">
                    Nouveau prix: {Math.round(product.price * (1 - form.discount / 100)).toLocaleString()} FCFA
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section Images */}
          {form.images?.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-2 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
                <h2 className="text-lg font-semibold text-gray-900">Images du produit</h2>
              </div>

              <div className="space-y-3">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <Image className="w-4 h-4 text-blue-500" />
                  <span>Images actuelles ({form.images.length})</span>
                </label>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {form.images.map((src, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={src}
                        alt={`${form.title} ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-gray-200"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                        <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          Vue {index + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  Les images ne peuvent pas être modifiées après création
                </p>
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => navigate('/my')}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Enregistrer les modifications</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
