import React, { useState } from 'react';
import api from '../services/api';
import { Upload, Camera, DollarSign, Tag, FileText, Package, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import categoryGroups from '../data/categories';

const operatorPhones = {
  MTN: '069822930',
  Airtel: '050237023'
};

const MAX_IMAGES = 3;

export default function ProductForm({ onCreated }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: 'used',
    operator: 'MTN'
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [imageError, setImageError] = useState('');

  const handleImageChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;
    const limitedFiles = selectedFiles.slice(0, MAX_IMAGES);
    if (selectedFiles.length > MAX_IMAGES) {
      setImageError(`Maximum ${MAX_IMAGES} photos. Seules les premières ont été conservées.`);
    } else {
      setImageError('');
    }
    setFiles(limitedFiles);
    const previews = limitedFiles.map((file) => ({
      url: URL.createObjectURL(file),
      name: file.name
    }));
    setImagePreviews(previews);
    e.target.value = '';
  };

  const removeImage = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setFiles(newFiles);
    setImagePreviews(newPreviews);
    if (newFiles.length < MAX_IMAGES) setImageError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, v));
      files.slice(0, MAX_IMAGES).forEach((f) => data.append('images', f));
      const res = await api.post('/products', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      onCreated?.(res.data);
      
      // Réinitialiser le formulaire
      setForm({ title: '', description: '', price: '', category: '', condition: 'used', operator: 'MTN' });
      setFiles([]);
      setImagePreviews([]);
      setImageError('');
      
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateCommission = () => {
    const price = parseFloat(form.price) || 0;
    return Math.round(price * 0.03);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* En-tête du formulaire */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Publier une annonce</h1>
        <p className="text-gray-500 text-sm">Remplissez les détails de votre produit pour commencer à vendre</p>
      </div>

      <form onSubmit={submit} className="space-y-6 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
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
              onChange={(e) => setForm({ ...form, title: e.target.value })}
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
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>

          {/* Catégorie et Prix en ligne */}
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
                onChange={(e) => setForm({ ...form, category: e.target.value })}
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

            {/* Prix */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <DollarSign className="w-4 h-4 text-indigo-500" />
                <span>Prix (FCFA) *</span>
              </label>
              <input
                type="number"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
                placeholder="Ex: 250000"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
                min="0"
              />
            </div>
          </div>

          {/* Condition et Opérateur */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      onChange={(e) => setForm({ ...form, condition: e.target.value })}
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
                      onChange={(e) => setForm({ ...form, condition: e.target.value })}
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

            {/* Opérateur */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Opérateur mobile</label>
              <select
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                value={form.operator}
                onChange={(e) => setForm({ ...form, operator: e.target.value })}
              >
                <option value="MTN">MTN</option>
                <option value="Airtel">Airtel</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section Images */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-2 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
            <h2 className="text-lg font-semibold text-gray-900">Photos du produit</h2>
          </div>

          {/* Upload d'images */}
          <div className="space-y-3">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <Camera className="w-4 h-4 text-blue-500" />
              <span>Photos {files.length > 0 && `(${files.length} sélectionnée${files.length > 1 ? 's' : ''})`}</span>
            </label>
            <p className="text-xs text-gray-500">Jusqu&apos;à {MAX_IMAGES} photos (PNG ou JPG, 10&nbsp;MB max chacun).</p>
            
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group">
              <Upload className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 transition-colors mb-2" />
              <span className="text-sm text-gray-500 text-center">
                <span className="text-indigo-600 font-medium">Cliquez pour uploader</span>
                <br />
                <span className="text-xs">PNG, JPG jusqu'à 10MB</span>
              </span>
              <input
                type="file"
                multiple
                onChange={handleImageChange}
                className="hidden"
                accept="image/*"
              />
            </label>
            {imageError && (
              <p className="text-xs text-red-500">{imageError}</p>
            )}

            {/* Previews des images */}
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview.url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section Paiement */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-2 h-6 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full"></div>
            <h2 className="text-lg font-semibold text-gray-900">Validation de l'annonce</h2>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-semibold text-amber-800 text-sm">Commission de publication</h3>
                <p className="text-amber-700 text-sm">
                  Pour valider votre annonce, envoyez <span className="font-bold">{calculateCommission().toLocaleString()} FCFA</span> 
                  (3% du prix) au numéro <span className="font-bold">{operatorPhones[form.operator]}</span> ({form.operator}).
                </p>
                <div className="flex items-center space-x-2 text-xs text-amber-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Votre annonce sera approuvée sous 24h après paiement</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bouton de soumission */}
        <button
          type="submit"
          disabled={loading || !form.title || !form.description || !form.price || !form.category}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2 shadow-lg"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Publication en cours...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Publier l'annonce</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
