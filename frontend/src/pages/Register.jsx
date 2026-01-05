import React, { useContext, useState } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useNavigate, Navigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, User, Mail, Lock, Phone, Store, MapPin, ShieldCheck } from 'lucide-react';

export default function Register() {
  const { user, login } = useContext(AuthContext);
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    accountType: 'person',
    address: '',
    country: 'République du Congo',
    city: '',
    gender: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [codeMessage, setCodeMessage] = useState('');
  const [codeError, setCodeError] = useState('');
  const cities = ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'];
  const genderOptions = [
    { value: 'homme', label: 'Homme' },
    { value: 'femme', label: 'Femme' }
  ];

  const sendVerificationCode = async () => {
    if (!form.phone.trim()) {
      alert("Veuillez renseigner votre numéro de téléphone.");
      return;
    }
    setCodeSending(true);
    setCodeError('');
    setCodeMessage('');
    try {
      await api.post('/auth/register/send-code', { phone: form.phone });
      setCodeSent(true);
      setCodeMessage('Code envoyé par SMS. Vérifiez votre téléphone.');
    } catch (error) {
      setCodeError(error.response?.data?.message || error.message);
    } finally {
      setCodeSending(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.city || !form.gender) {
      alert("Veuillez sélectionner votre ville et votre genre.");
      return;
    }
    if (!form.address.trim()) {
      alert("Veuillez renseigner votre adresse complète.");
      return;
    }
    if (!verificationCode.trim()) {
      alert("Veuillez saisir le code de vérification reçu par SMS.");
      return;
    }
    setLoading(true);
    try {
      const payload = new FormData();
      payload.append('name', form.name);
      payload.append('email', form.email);
      payload.append('password', form.password);
      payload.append('phone', form.phone);
      payload.append('accountType', 'person');
      payload.append('country', 'République du Congo');
      payload.append('city', form.city);
      payload.append('gender', form.gender);
      payload.append('address', form.address.trim());
      payload.append('verificationCode', verificationCode.trim());

      const { data } = await api.post('/auth/register', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      login(data);
      nav(from, { replace: true });
    } catch (error) {
      alert(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full space-y-8">
        {/* En-tête */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center shadow-lg">
              <UserPlus className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Rejoignez HDMarket</h1>
          <p className="text-gray-500">Créez votre compte et commencez à vendre dès aujourd'hui</p>
        </div>

        {/* Carte du formulaire */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <form onSubmit={submit} className="space-y-6">
            {/* Informations de base */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-2 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
                <h2 className="text-lg font-semibold text-gray-900">Informations personnelles</h2>
              </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nom */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <User className="w-4 h-4 text-indigo-500" />
                    <span>Nom complet *</span>
                  </label>
                  <div className="relative">
                    <input
                      className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
                      placeholder="Votre nom complet"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                {/* Téléphone */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <Phone className="w-4 h-4 text-indigo-500" />
                    <span>Téléphone *</span>
                  </label>
                  <div className="relative">
                    <input
                      className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
                      placeholder="Votre numéro"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      required
                    />
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                    <span>Code de vérification SMS *</span>
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <input
                        className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
                        placeholder="Code reçu par SMS"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        required
                      />
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                    <button
                      type="button"
                      onClick={sendVerificationCode}
                      disabled={codeSending || !form.phone.trim()}
                      className="px-4 py-3 rounded-xl border border-indigo-200 text-indigo-600 font-semibold hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {codeSending ? 'Envoi...' : codeSent ? 'Renvoyer le code' : 'Envoyer le code'}
                    </button>
                  </div>
                  {codeError && <p className="text-sm text-red-600">{codeError}</p>}
                  {codeMessage && <p className="text-sm text-emerald-600">{codeMessage}</p>}
                </div>

                {/* Adresse personnelle */}
                <div className="space-y-2 md:col-span-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <MapPin className="w-4 h-4 text-indigo-500" />
                    <span>Adresse complète *</span>
                  </label>
                  <div className="relative">
                    <textarea
                      className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
                      rows={2}
                      placeholder="Quartier, rue, numéro de parcelle..."
                      name="address"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      required
                    />
                    <MapPin className="absolute left-4 top-4 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <Mail className="w-4 h-4 text-indigo-500" />
                  <span>Adresse email *</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
                    placeholder="votre@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

              {/* Mot de passe */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <Lock className="w-4 h-4 text-indigo-500" />
                  <span>Mot de passe *</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full px-4 py-3 pl-11 pr-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
                    placeholder="Votre mot de passe"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <label className="flex items-center space-x-2 text-sm text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={() => setShowPassword(!showPassword)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span>Afficher le mot de passe</span>
                </label>
              </div>
            </div>

            {/* Localisation et genre */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pays (fixe) */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <MapPin className="w-4 h-4 text-indigo-500" />
                    <span>Pays *</span>
                  </label>
                  <div className="relative">
                    <input
                      className="w-full px-4 py-3 pl-11 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
                      value="République du Congo"
                      readOnly
                      disabled
                    />
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                {/* Ville */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <MapPin className="w-4 h-4 text-indigo-500" />
                    <span>Ville *</span>
                  </label>
                  <div className="relative">
                    <select
                      className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      required
                    >
                      <option value="">Choisissez votre ville</option>
                      {cities.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Genre */}
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-500" />
                  Genre *
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {genderOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-colors cursor-pointer ${
                        form.gender === option.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={option.value}
                        checked={form.gender === option.value}
                        onChange={(e) => setForm({ ...form, gender: e.target.value })}
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Type de compte */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-2 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
                <h2 className="text-lg font-semibold text-gray-900">Type de compte</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className={`relative cursor-pointer rounded-2xl border-2 p-4 transition-all ${
                  form.accountType === 'person' 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="accountType"
                    value="person"
                    checked={form.accountType === 'person'}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        accountType: e.target.value
                      }))
                    }
                    className="sr-only"
                  />
                  <div className="flex items-center space-x-3">
                    <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-all ${
                      form.accountType === 'person' 
                        ? 'border-indigo-500 bg-indigo-500' 
                        : 'border-gray-300'
                    }`}>
                      {form.accountType === 'person' && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <User className="w-4 h-4 text-gray-600" />
                        <span className="font-semibold text-gray-900">Particulier</span>
                      </div>
                      <p className="text-sm text-gray-500">Vendez vos produits occasionnels</p>
                    </div>
                  </div>
                </label>

                <label className={`relative cursor-pointer rounded-2xl border-2 p-4 transition-all ${
                  form.accountType === 'shop' 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="accountType"
                    value="shop"
                    checked={form.accountType === 'shop'}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        accountType: e.target.value
                      }))
                    }
                    className="sr-only"
                  />
                  <div className="flex items-center space-x-3">
                    <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-all ${
                      form.accountType === 'shop' 
                        ? 'border-indigo-500 bg-indigo-500' 
                        : 'border-gray-300'
                    }`}>
                      {form.accountType === 'shop' && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Store className="w-4 h-4 text-gray-600" />
                        <span className="font-semibold text-gray-900">Boutique</span>
                      </div>
                      <p className="text-sm text-gray-500">Votre entreprise professionnelle</p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {form.accountType === 'shop' && (
              <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold text-amber-900">Boutique sous approbation</p>
                <p>
                  Seuls les administrateurs peuvent activer un compte boutique pour un utilisateur.
                  Enregistrez-vous d'abord comme particulier puis{' '}
                  <Link to="/help" className="font-semibold text-amber-900 underline">
                    contactez l'équipe HDMarket
                  </Link>{' '}
                  pour demander la conversion.
                </p>
                <p className="text-xs text-amber-800">
                  Votre compte restera un profil personnel tant que la conversion n'est pas validée.
                </p>
              </div>
            )}

            {/* Bouton d'inscription */}
            <button
              type="submit"
              disabled={
                loading ||
                !form.name ||
                !form.email ||
                !form.password ||
                !form.phone ||
                !form.address ||
                !form.city ||
                !form.gender ||
                !verificationCode
              }
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2 shadow-lg"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Création du compte...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Créer mon compte</span>
                </>
              )}
            </button>
          </form>

          {/* Lien vers connexion */}
          <div className="text-center mt-6 pt-6 border-t border-gray-100">
            <p className="text-gray-600">
              Déjà un compte ?{' '}
              <Link 
                to="/login" 
                className="text-indigo-600 hover:text-indigo-500 font-semibold transition-colors"
              >
                Se connecter
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-1">
          <p className="text-xs text-gray-500">
            En créant un compte, vous acceptez nos{' '}
            <Link to="/help" className="text-indigo-600 hover:text-indigo-500">
              conditions d'utilisation et service client
            </Link>{' '}
            ainsi que notre{' '}
            <Link to="/privacy" className="text-indigo-600 hover:text-indigo-500">
              politique de confidentialité
            </Link>
          </p>
          <p className="text-[11px] text-gray-400">ETS HD Tech Filial</p>
        </div>
      </div>
    </div>
  );
}
