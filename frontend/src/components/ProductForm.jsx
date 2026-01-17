import React, { useContext, useEffect, useState } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { Upload, Camera, DollarSign, Tag, FileText, Package, Send, AlertCircle, CheckCircle2, Video, Trash2 } from 'lucide-react';
import categoryGroups from '../data/categories';

const operatorPhones = {
  MTN: '069822930',
  Airtel: '050237023'
};

const MAX_IMAGES = 3;
const MAX_VIDEO_SIZE_MB = 20;
const MAX_PDF_SIZE_MB = 10;
const DeleteIcon = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="currentColor"
      d="M9 3h6l1 2h5v2H3V5h5l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM6 7h12l-1 14H7L6 7z"
    />
  </svg>
);

export default function ProductForm(props) {
  const { onCreated, onUpdated, initialValues, productId, submitLabel } = props;
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: 'used',
    operator: 'MTN',
    discount: ''
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [removedImages, setRemovedImages] = useState([]);
  const [imageError, setImageError] = useState('');
  const { user } = useContext(AuthContext);
  const canUploadVideo = Boolean(user?.shopVerified && user?.accountType === 'shop');
  const canUploadPdf = user?.accountType === 'shop';
  const [videoFile, setVideoFile] = useState(null);
  const [videoError, setVideoError] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfError, setPdfError] = useState('');
  const [existingPdf, setExistingPdf] = useState(null);
  const [removePdf, setRemovePdf] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  const handleImageChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;
    const maxSelectable = Math.max(0, MAX_IMAGES - existingImages.length);
    if (maxSelectable === 0) {
      setImageError(`Maximum ${MAX_IMAGES} photos au total. Supprimez une image pour en ajouter.`);
      e.target.value = '';
      return;
    }
    const limitedFiles = selectedFiles.slice(0, maxSelectable);
    if (selectedFiles.length > maxSelectable) {
      setImageError(`Maximum ${MAX_IMAGES} photos au total. Seules les premières ont été conservées.`);
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

  const removeExistingImage = (index) => {
    const target = existingImages[index];
    if (!target) return;
    setExistingImages(existingImages.filter((_, i) => i !== index));
    setRemovedImages((prev) => [...prev, target]);
    if (existingImages.length - 1 + files.length < MAX_IMAGES) setImageError('');
  };

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setVideoError('Le fichier doit être une vidéo (MP4, MOV, ...).');
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      setVideoError(`La vidéo doit faire moins de ${MAX_VIDEO_SIZE_MB} Mo.`);
      return;
    }
    setVideoError('');
    setVideoFile(file);
    e.target.value = '';
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoError('');
  };

  const handlePdfChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setPdfError('Le fichier doit être un PDF.');
      return;
    }
    if (file.size > MAX_PDF_SIZE_MB * 1024 * 1024) {
      setPdfError(`Le PDF doit faire moins de ${MAX_PDF_SIZE_MB} Mo.`);
      return;
    }
    setPdfError('');
    setPdfFile(file);
    setRemovePdf(false);
    e.target.value = '';
  };

  const removePdfFile = () => {
    setPdfFile(null);
    setPdfError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (videoFile) {
      setIsUploadingVideo(true);
      setUploadProgress(0);
    }
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'discount' && (v === '' || v === null || v === undefined)) return;
        data.append(k, v);
      });
      files.slice(0, MAX_IMAGES).forEach((f) => data.append('images', f));
      removedImages.forEach((image) => data.append('removeImages', image));
      if (videoFile) {
        data.append('video', videoFile);
      }
      if (pdfFile) {
        data.append('pdf', pdfFile);
      }
      if (removePdf) {
        data.append('removePdf', 'true');
      }
      const url = `/products${productId ? `/${productId}` : ''}`;
      const method = productId ? 'put' : 'post';
      const res = await api[method](url, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (event.total) {
            const percentCompleted = Math.round((event.loaded * 100) / event.total);
            setUploadProgress(percentCompleted);
          }
        }
      });
      if (productId) {
        onUpdated?.(res.data);
      } else {
        onCreated?.(res.data);
      }
      
      // Réinitialiser le formulaire
      setForm({
        title: '',
        description: '',
        price: '',
        category: '',
        condition: 'used',
        operator: 'MTN',
        discount: ''
      });
      setFiles([]);
      setImagePreviews([]);
      setExistingImages([]);
      setRemovedImages([]);
      setImageError('');
      setVideoFile(null);
      setVideoError('');
      setPdfFile(null);
      setPdfError('');
      setExistingPdf(null);
      setRemovePdf(false);
      
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
      setIsUploadingVideo(false);
      setUploadProgress(0);
    }
  };

  const calculateCommission = () => {
    const price = parseFloat(form.price) || 0;
    return Math.round(price * 0.03);
  };

  useEffect(() => {
    if (!initialValues) {
      setExistingImages([]);
      setExistingPdf(null);
      setRemovePdf(false);
      setRemovedImages([]);
      return;
    }
    setForm({
      title: initialValues.title || '',
      description: initialValues.description || '',
      price: initialValues.price || '',
      category: initialValues.category || '',
      condition: initialValues.condition || 'new',
      operator: initialValues.operator || 'MTN',
      discount:
        typeof initialValues.discount === 'number' || typeof initialValues.discount === 'string'
          ? initialValues.discount
          : ''
    });
    setExistingImages(Array.isArray(initialValues.images) ? initialValues.images : []);
    setExistingPdf(initialValues.pdf || null);
    setRemovePdf(false);
    setRemovedImages([]);
  }, [initialValues]);

  const isEditing = Boolean(productId);
  const headerTitle = isEditing ? 'Modifier une annonce' : 'Publier une annonce';
  const headerSubtitle = isEditing
    ? 'Mettez à jour les informations de votre produit'
    : 'Remplissez les détails de votre produit pour commencer à vendre';
  const buttonLabel =
    submitLabel || (isEditing ? 'Mettre à jour l’annonce' : 'Publier l’annonce');
  const priceGridClass = isEditing ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2';

  return (
    <div className="max-w-2xl mx-auto">
      {/* En-tête du formulaire */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{headerTitle}</h1>
        <p className="text-gray-500 text-sm">{headerSubtitle}</p>
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
          <div className={`grid ${priceGridClass} gap-4`}>
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

            {isEditing && (
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <Tag className="w-4 h-4 text-amber-500" />
                  <span>Remise (%)</span>
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all placeholder-gray-400"
                  placeholder="Ex: 5"
                  value={form.discount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setForm((prev) => ({ ...prev, discount: '' }));
                      return;
                    }
                    const numeric = Math.max(0, Math.min(99, Number(value)));
                    setForm((prev) => ({ ...prev, discount: numeric }));
                  }}
                  min="0"
                  max="99"
                />
                <p className="text-[11px] text-gray-500">
                  Laissez vide pour aucune remise. Le pourcentage maximum est de 99%.
                </p>
              </div>
            )}
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
              <span>
                Photos{' '}
                {(existingImages.length + files.length) > 0 &&
                  `(${existingImages.length + files.length})`}
              </span>
            </label>
            <p className="text-xs text-gray-500">Jusqu&apos;à {MAX_IMAGES} photos (PNG ou JPG, 10&nbsp;MB max chacun).</p>

            {existingImages.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Images actuelles</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {existingImages.map((src, index) => (
                    <div key={`${src}-${index}`} className="relative group">
                      <img
                        src={src}
                        alt={`Image existante ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(index)}
                        className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
                        aria-label="Supprimer l'image"
                      >
                        <DeleteIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
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
                      className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
                      aria-label="Supprimer l'image"
                    >
                      <DeleteIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {canUploadVideo ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-2 h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-gray-900">Vidéo de présentation</h2>
            </div>
            <p className="text-sm text-gray-500">
              Ajoutez une courte vidéo (MP4, MOV, WEBM) pour montrer le produit. Taille maximale {MAX_VIDEO_SIZE_MB} Mo.
            </p>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group">
              <Video className="w-8 h-8 text-gray-400 group-hover:text-emerald-500 transition-colors mb-2" />
              <span className="text-sm text-gray-500 text-center">Cliquez pour uploader votre vidéo</span>
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                className="hidden"
              />
            </label>
            {videoFile && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 bg-white">
                <span className="text-sm text-gray-700 truncate">{videoFile.name}</span>
                <button
                  type="button"
                  onClick={removeVideo}
                  className="text-xs font-semibold text-red-600 hover:text-red-500"
                >
                  Supprimer
                </button>
              </div>
            )}
            {videoError && <p className="text-xs text-red-500">{videoError}</p>}
            {isUploadingVideo && (
              <div className="mt-2 w-full rounded-full bg-gray-100 h-2 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 space-y-1">
            <p className="font-semibold text-gray-700">Vidéo réservée aux boutiques certifiées</p>
            <p>
              Contactez un administrateur via{' '}
              <a href="/help" className="font-semibold text-indigo-600 hover:underline">
                le centre d’aide
              </a>{' '}
              pour valider votre boutique.
            </p>
          </div>
        )}

        {canUploadPdf && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-2 h-6 bg-gradient-to-b from-slate-500 to-gray-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-gray-900">Fiche produit (PDF)</h2>
            </div>
            <p className="text-sm text-gray-500">
              Ajoutez un document PDF pour détailler votre produit. Taille maximale {MAX_PDF_SIZE_MB} Mo.
            </p>
            {existingPdf && !pdfFile && !removePdf && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                <div>
                  <span className="font-medium">PDF actuel :</span>{' '}
                  <a
                    href={existingPdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    Ouvrir
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => setRemovePdf(true)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                  aria-label="Supprimer le PDF"
                  title="Supprimer le PDF"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
            {removePdf && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <span>Le PDF sera supprimé lors de l’enregistrement.</span>
                <button
                  type="button"
                  onClick={() => setRemovePdf(false)}
                  className="text-xs font-semibold text-red-600 hover:text-red-500"
                >
                  Annuler
                </button>
              </div>
            )}
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group">
              <FileText className="w-8 h-8 text-gray-400 group-hover:text-slate-600 transition-colors mb-2" />
              <span className="text-sm text-gray-500 text-center">Cliquez pour uploader un PDF</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={handlePdfChange}
                className="hidden"
              />
            </label>
            {pdfFile && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 bg-white">
                <span className="text-sm text-gray-700 truncate">{pdfFile.name}</span>
                <button
                  type="button"
                  onClick={removePdfFile}
                  className="text-xs font-semibold text-red-600 hover:text-red-500"
                >
                  Supprimer
                </button>
              </div>
            )}
            {pdfError && <p className="text-xs text-red-500">{pdfError}</p>}
          </div>
        )}

        {!isEditing && (
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
        )}

        {/* Bouton de soumission */}
        <button
          type="submit"
          disabled={loading || !form.title || !form.description || !form.price || !form.category}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2 shadow-lg"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>{isEditing ? 'Mise à jour en cours...' : 'Publication en cours...'}</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>{buttonLabel}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
