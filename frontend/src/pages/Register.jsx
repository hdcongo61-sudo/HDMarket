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
    // Verification code optional when email is not configured or in production
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
      payload.append('verificationCode', (verificationCode && verificationCode.trim()) || '');

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
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-[#F2F2F7] dark:bg-black">
      <div className="w-full max-w-[500px]">
        <div className="text-center mb-10">
          <h1 className="text-[28px] font-semibold tracking-tight text-black dark:text-white mb-2">HDMarket</h1>
          <p className="text-[15px] text-[#8E8E93]">Créez votre compte</p>
        </div>

        <div className="apple-card p-6">
          <form onSubmit={submit} className="space-y-4">
            {/* Name */}
            <div>
              <input
                type="text"
                className="apple-input w-full"
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
                className="apple-input w-full"
                placeholder="060000000"
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
                  className="apple-input flex-1"
                  placeholder="Code de vérification email (optionnel)"
                  value={verificationCode}
                  onChange={(e) => {
                    setVerificationCode(e.target.value);
                    setFormError('');
                  }}
                />
                <button
                  type="button"
                  onClick={sendVerificationCode}
                  disabled={codeSending || !form.email.trim()}
                  className="px-4 py-2.5 rounded-full font-medium text-[15px] border border-[#C7C7CC] text-[#007AFF] hover:bg-[rgba(0,122,255,0.08)] tap-feedback whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="apple-input w-full"
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
                className="apple-input w-full pr-12"
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
                  className="apple-input w-full bg-[rgba(120,120,128,0.08)] text-[#8E8E93] cursor-not-allowed"
                  value="République du Congo"
                  readOnly
                  disabled
                />
              </div>

              {/* City */}
              <div>
                <select
                  className="apple-input w-full bg-white dark:bg-[#1C1C1E]"
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
                !form.gender
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
