import React, { useContext, useState } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useNavigate, Navigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

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
  const [formError, setFormError] = useState('');
  const cities = ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'];
  const genderOptions = [
    { value: 'homme', label: 'Homme' },
    { value: 'femme', label: 'Femme' }
  ];

  const sendVerificationCode = async () => {
    if (!form.email.trim()) {
      setCodeError("Veuillez renseigner votre adresse email.");
      return;
    }
    setCodeSending(true);
    setCodeError('');
    setCodeMessage('');
    setFormError('');
    try {
      await api.post('/auth/register/send-code', { email: form.email });
      setCodeSent(true);
      setCodeMessage('Code envoyé par email. Vérifiez votre boîte de réception.');
    } catch (error) {
      setCodeError(error.response?.data?.message || error.message);
    } finally {
      setCodeSending(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (!form.city || !form.gender) {
      setFormError("Veuillez sélectionner votre ville et votre genre.");
      return;
    }
    if (!form.address.trim()) {
      setFormError("Veuillez renseigner votre adresse complète.");
      return;
    }
    if (!verificationCode.trim()) {
      setFormError("Veuillez saisir le code de vérification reçu par email.");
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
      setFormError(error.response?.data?.message || error.message || 'Une erreur est survenue lors de la création du compte.');
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[500px]">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-normal text-indigo-600 mb-1">HDMarket</h1>
          <p className="text-sm text-gray-500">Créez votre compte</p>
        </div>

        {/* Register Form */}
        <div className="bg-white border border-gray-200 p-6">
          <form onSubmit={submit} className="space-y-4">
            {/* Name */}
            <div>
              <input
                type="text"
                className="w-full px-3 py-2.5 border border-gray-300 focus:outline-none focus:border-indigo-600 text-sm"
                placeholder="Nom complet *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            {/* Phone */}
            <div>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="w-full px-3 py-2.5 border border-gray-300 focus:outline-none focus:border-indigo-600 text-sm"
                placeholder="Numéro de téléphone *"
                value={form.phone}
                onChange={(e) => {
                  setForm({ ...form, phone: e.target.value });
                  setCodeError('');
                }}
                required
              />
            </div>

            {/* Verification Code */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-3 py-2.5 border border-gray-300 focus:outline-none focus:border-indigo-600 text-sm"
                  placeholder="Code de vérification email *"
                  value={verificationCode}
                  onChange={(e) => {
                    setVerificationCode(e.target.value);
                    setFormError('');
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={sendVerificationCode}
                  disabled={codeSending || !form.email.trim()}
                  className="px-4 py-2.5 border border-gray-300 text-sm text-gray-700 hover:border-indigo-600 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {codeSending ? 'Envoi...' : codeSent ? 'Renvoyer' : 'Envoyer'}
                </button>
              </div>
              {codeError && <p className="text-xs text-red-600">{codeError}</p>}
              {codeMessage && <p className="text-xs text-green-600">{codeMessage}</p>}
            </div>

            {/* Address */}
            <div>
              <textarea
                className="w-full px-3 py-2.5 border border-gray-300 focus:outline-none focus:border-indigo-600 text-sm resize-none"
                rows={2}
                placeholder="Adresse complète *"
                value={form.address}
                onChange={(e) => {
                  setForm({ ...form, address: e.target.value });
                  setFormError('');
                }}
                required
              />
            </div>

            {/* Email */}
            <div>
              <input
                type="email"
                className="w-full px-3 py-2.5 border border-gray-300 focus:outline-none focus:border-indigo-600 text-sm"
                placeholder="Adresse email *"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            {/* Password */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full px-3 py-2.5 border border-gray-300 focus:outline-none focus:border-indigo-600 text-sm pr-10"
                placeholder="Mot de passe *"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Location and Gender */}
            <div className="grid grid-cols-2 gap-3">
              {/* Country (disabled) */}
              <div>
                <input
                  className="w-full px-3 py-2.5 border border-gray-300 bg-gray-100 text-gray-500 text-sm cursor-not-allowed"
                  value="République du Congo"
                  readOnly
                  disabled
                />
              </div>

              {/* City */}
              <div>
                <select
                  className="w-full px-3 py-2.5 border border-gray-300 focus:outline-none focus:border-indigo-600 text-sm bg-white"
                  value={form.city}
                  onChange={(e) => {
                    setForm({ ...form, city: e.target.value });
                    setFormError('');
                  }}
                  required
                >
                  <option value="">Ville *</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Gender */}
            <div>
              <div className="grid grid-cols-2 gap-3">
                {genderOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center justify-center px-3 py-2.5 border text-sm cursor-pointer ${
                      form.gender === option.value
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="gender"
                      value={option.value}
                      checked={form.gender === option.value}
                      onChange={(e) => {
                        setForm({ ...form, gender: e.target.value });
                        setFormError('');
                      }}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Account Type */}
            <div className="pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-600 mb-2">Type de compte</div>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex items-center justify-center px-3 py-2.5 border text-sm cursor-pointer ${
                  form.accountType === 'person'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="accountType"
                    value="person"
                    checked={form.accountType === 'person'}
                    onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                    className="sr-only"
                  />
                  Particulier
                </label>
                <label className={`flex items-center justify-center px-3 py-2.5 border text-sm cursor-pointer ${
                  form.accountType === 'shop'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="accountType"
                    value="shop"
                    checked={form.accountType === 'shop'}
                    onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                    className="sr-only"
                  />
                  Boutique
                </label>
              </div>
            </div>

            {/* Shop Notice */}
            {form.accountType === 'shop' && (
              <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 p-3">
                <p className="font-medium mb-1">Boutique sous approbation</p>
                <p>
                  Enregistrez-vous d'abord comme particulier puis{' '}
                  <Link to="/help" className="text-indigo-600 hover:text-indigo-700 underline">
                    contactez l'équipe HDMarket
                  </Link>{' '}
                  pour demander la conversion.
                </p>
              </div>
            )}

            {/* Form Error Message */}
            {formError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-3">
                {formError}
              </div>
            )}

            {/* Submit Button */}
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
              className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-3xl hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 shadow-sm"
            >
              {loading ? 'Création du compte...' : 'Créer mon compte'}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-4 pt-4 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Déjà un compte ?{' '}
              <Link to="/login" className="text-indigo-600 hover:text-indigo-700">
                Se connecter
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            En créant un compte, vous acceptez nos{' '}
            <Link to="/help" className="text-gray-600 hover:text-indigo-600">
              conditions d'utilisation
            </Link>{' '}
            et notre{' '}
            <Link to="/privacy" className="text-gray-600 hover:text-indigo-600">
              politique de confidentialité
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
