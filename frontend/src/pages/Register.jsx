import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useNavigate, Navigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { useAppSettings } from '../context/AppSettingsContext';
import AuthTrustPanel from '../components/auth/AuthTrustPanel';
import AuthSuccessCard from '../components/auth/AuthSuccessCard';

const SLOW_NETWORK_MS = 8000;

const mapRegisterErrorMessage = (error, isFrench = true) => {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.code || error?.response?.data?.code || '').toUpperCase();
  const rawMessage = String(error?.response?.data?.message || error?.message || '').toLowerCase();

  if (code.includes('TIMEDOUT') || rawMessage.includes('timeout')) {
    return isFrench ? 'Connexion lente. Veuillez réessayer.' : 'Network is slow. Please retry.';
  }
  if (status === 409 || rawMessage.includes('already') || rawMessage.includes('déjà')) {
    return isFrench
      ? 'Un compte existe déjà avec cet email ou ce téléphone.'
      : 'An account already exists with this email or phone.';
  }
  if (status >= 500) {
    return isFrench
      ? 'Service temporairement indisponible. Veuillez réessayer.'
      : 'Service temporarily unavailable. Please retry.';
  }
  return isFrench
    ? 'Impossible de créer le compte pour le moment. Veuillez réessayer.'
    : 'Unable to create account right now. Please retry.';
};

const getPasswordChecks = (password = '') => {
  const value = String(password || '');
  return {
    minLength: value.length >= 8,
    hasUppercase: /[A-Z]/.test(value),
    hasNumber: /\d/.test(value),
    hasSymbol: /[^A-Za-z0-9]/.test(value)
  };
};

const strengthLabelOf = (score) => {
  if (score <= 1) return { label: 'Faible', color: 'bg-red-500' };
  if (score === 2) return { label: 'Moyen', color: 'bg-amber-500' };
  if (score === 3) return { label: 'Bon', color: 'bg-blue-500' };
  return { label: 'Fort', color: 'bg-emerald-500' };
};

export default function Register() {
  const { user, login } = useContext(AuthContext);
  const { cities, communes, language } = useAppSettings();
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const isFrench = String(language || 'fr')
    .toLowerCase()
    .startsWith('fr');

  const copy = {
    appBadge: 'HDMarket',
    title: isFrench ? 'Créer votre compte' : 'Create your account',
    subtitle: isFrench
      ? 'Inscrivez-vous pour acheter, vendre et suivre vos commandes facilement.'
      : 'Join HDMarket to buy, sell and manage your orders easily.',
    step1: isFrench ? 'Étape 1 : Profil' : 'Step 1: Profile',
    step2: isFrench ? 'Étape 2 : Sécurité' : 'Step 2: Security',
    fullName: isFrench ? 'Nom complet' : 'Full name',
    fullNamePlaceholder: isFrench ? 'Votre nom complet' : 'Your full name',
    email: 'Email',
    emailPlaceholder: isFrench ? 'nom@email.com' : 'name@email.com',
    phone: isFrench ? 'Téléphone' : 'Phone',
    phonePlaceholder: isFrench ? '060000000' : '060000000',
    verificationTitle: isFrench ? 'Code de vérification email (optionnel)' : 'Email verification code (optional)',
    verificationPlaceholder: isFrench ? 'Entrez le code' : 'Enter code',
    sendCode: isFrench ? 'Envoyer' : 'Send',
    sendingCode: isFrench ? 'Envoi...' : 'Sending...',
    resendCode: isFrench ? 'Renvoyer' : 'Resend',
    codeSentMessage: isFrench
      ? 'Code envoyé par email. Vérifiez votre boîte de réception.'
      : 'Code sent by email. Check your inbox.',
    continueStep2: isFrench ? "Continuer vers l'étape 2" : 'Continue to Step 2',
    password: isFrench ? 'Mot de passe' : 'Password',
    passwordPlaceholder: isFrench ? 'Mot de passe' : 'Password',
    confirmPassword: isFrench ? 'Confirmer le mot de passe' : 'Confirm password',
    confirmPasswordPlaceholder: isFrench ? 'Confirmer le mot de passe' : 'Confirm password',
    passwordStrength: isFrench ? 'Force du mot de passe' : 'Password strength',
    ruleLength: isFrench ? 'Au moins 8 caractères' : 'At least 8 characters',
    ruleUpper: isFrench ? 'Une lettre majuscule' : 'Uppercase letter',
    ruleNumber: isFrench ? 'Un chiffre' : 'Number',
    ruleSymbol: isFrench ? 'Un symbole (optionnel)' : 'Symbol (optional)',
    address: isFrench ? 'Adresse complète' : 'Full address',
    addressPlaceholder: isFrench ? 'Adresse complète' : 'Full address',
    city: isFrench ? 'Ville' : 'City',
    chooseCity: isFrench ? 'Choisir la ville' : 'Choose city',
    commune: isFrench ? 'Commune' : 'Commune',
    chooseCommune: isFrench ? 'Choisir la commune' : 'Choose commune',
    chooseCityFirst: isFrench ? "Choisir la ville d'abord" : 'Choose city first',
    gender: isFrench ? 'Genre' : 'Gender',
    male: isFrench ? 'Homme' : 'Male',
    female: isFrench ? 'Femme' : 'Female',
    termsLead: isFrench ? "J'accepte les" : 'I agree to the',
    terms: isFrench ? 'Conditions' : 'Terms',
    privacy: isFrench ? 'Politique de confidentialité' : 'Privacy Policy',
    back: isFrench ? 'Retour' : 'Back',
    createAccount: isFrench ? 'Créer le compte' : 'Create account',
    creatingAccount: isFrench ? 'Création...' : 'Creating...',
    slowNetwork: isFrench ? 'Réseau lent, veuillez réessayer.' : 'Network is slow, please retry.',
    haveAccount: isFrench ? 'Vous avez déjà un compte ?' : 'Already have an account?',
    signIn: isFrench ? 'Se connecter' : 'Sign in',
    nextStepError: isFrench
      ? 'Renseignez nom, email et téléphone pour continuer.'
      : 'Enter name, email and phone to continue.',
    emailRequired: isFrench ? 'Veuillez renseigner votre adresse email.' : 'Please enter your email address.',
    cityGenderRequired: isFrench
      ? 'Veuillez sélectionner votre ville et votre genre.'
      : 'Please select your city and gender.',
    communeRequired: isFrench ? 'Veuillez sélectionner votre commune.' : 'Please select your commune.',
    addressRequired: isFrench ? 'Veuillez renseigner votre adresse complète.' : 'Please enter your full address.',
    passwordsMismatch: isFrench ? 'Les mots de passe ne correspondent pas.' : 'Passwords do not match.',
    passwordRulesError: isFrench
      ? 'Le mot de passe ne respecte pas les règles minimales.'
      : 'Password does not meet minimum requirements.',
    termsRequired: isFrench
      ? 'Vous devez accepter les Conditions et la Politique de confidentialité.'
      : 'You must accept the Terms and Privacy Policy.',
    successTitle: isFrench ? 'Compte créé avec succès' : 'Account created successfully',
    successDescription: isFrench
      ? 'Votre compte est prêt. Commençons.'
      : "Your account is ready. Let's get started.",
    successStatus: isFrench ? 'Préparation de votre espace...' : 'Preparing your workspace...',
    goDashboard: isFrench ? 'Aller au tableau de bord' : 'Go to Dashboard',
    completeProfile: isFrench ? 'Compléter mon profil' : 'Complete Profile'
  };

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    accountType: 'person',
    address: '',
    country: 'République du Congo',
    city: '',
    commune: '',
    gender: ''
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slowNetwork, setSlowNetwork] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [codeMessage, setCodeMessage] = useState('');
  const [codeError, setCodeError] = useState('');
  const [formError, setFormError] = useState('');
  const [successPayload, setSuccessPayload] = useState(null);
  const [finalizing, setFinalizing] = useState(false);

  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const slowNetworkTimerRef = useRef(null);
  const successRedirectTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
      if (successRedirectTimerRef.current) clearTimeout(successRedirectTimerRef.current);
    };
  }, []);

  const cityRecords = useMemo(
    () =>
      Array.isArray(cities) && cities.length
        ? cities.filter((item) => item?.name)
        : [
            { _id: 'fallback-bzv', name: 'Brazzaville' },
            { _id: 'fallback-pn', name: 'Pointe-Noire' },
            { _id: 'fallback-ou', name: 'Ouesso' },
            { _id: 'fallback-oy', name: 'Oyo' }
          ],
    [cities]
  );

  const cityOptions = cityRecords.map((item) => item.name);
  const selectedCityRecord = cityRecords.find((item) => item.name === form.city) || null;
  const availableCommunes = useMemo(() => {
    if (!selectedCityRecord?._id || !Array.isArray(communes)) return [];
    return communes.filter((item) => {
      const itemCityId = item?.cityId?._id || item?.cityId;
      return String(itemCityId || '') === String(selectedCityRecord._id);
    });
  }, [communes, selectedCityRecord?._id]);

  const passwordChecks = useMemo(() => getPasswordChecks(form.password), [form.password]);
  const passwordScore = [
    passwordChecks.minLength,
    passwordChecks.hasUppercase,
    passwordChecks.hasNumber,
    passwordChecks.hasSymbol
  ].filter(Boolean).length;
  const passwordStrength = strengthLabelOf(passwordScore);
  const passwordStrengthLabel = {
    Faible: isFrench ? 'Faible' : 'Weak',
    Moyen: isFrench ? 'Moyen' : 'Medium',
    Bon: isFrench ? 'Bon' : 'Good',
    Fort: isFrench ? 'Fort' : 'Strong'
  }[passwordStrength.label] || passwordStrength.label;

  const canGoToStep2 = Boolean(form.name.trim() && form.email.trim() && form.phone.trim());
  const canSubmit = Boolean(
    form.name.trim() &&
      form.email.trim() &&
      form.phone.trim() &&
      form.password &&
      form.confirmPassword &&
      form.password === form.confirmPassword &&
      passwordChecks.minLength &&
      passwordChecks.hasUppercase &&
      passwordChecks.hasNumber &&
      form.address.trim() &&
      form.city &&
      form.gender &&
      acceptedTerms &&
      !loading
  );

  const completeRegistration = async (target = from) => {
    if (!successPayload || finalizing) return;
    setFinalizing(true);
    try {
      await login(successPayload);
      nav(target, { replace: true });
    } finally {
      setFinalizing(false);
    }
  };

  useEffect(() => {
    if (!successPayload) return;
    successRedirectTimerRef.current = setTimeout(() => {
      completeRegistration(from);
    }, 1800);
    return () => {
      if (successRedirectTimerRef.current) clearTimeout(successRedirectTimerRef.current);
    };
  }, [successPayload]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendVerificationCode = async () => {
    if (!form.email.trim()) {
      setCodeError(copy.emailRequired);
      return;
    }
    setCodeSending(true);
    setCodeError('');
    setCodeMessage('');
    setFormError('');
    try {
      await api.post('/auth/register/send-code', { email: form.email });
      setCodeSent(true);
      setCodeMessage(copy.codeSentMessage);
    } catch (requestError) {
      setCodeError(mapRegisterErrorMessage(requestError, isFrench));
    } finally {
      setCodeSending(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (loading || successPayload) return;
    setFormError('');

    if (!form.city || !form.gender) {
      setFormError(copy.cityGenderRequired);
      return;
    }
    if (availableCommunes.length > 0 && !form.commune) {
      setFormError(copy.communeRequired);
      return;
    }
    if (!form.address.trim()) {
      setFormError(copy.addressRequired);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setFormError(copy.passwordsMismatch);
      return;
    }
    if (!passwordChecks.minLength || !passwordChecks.hasUppercase || !passwordChecks.hasNumber) {
      setFormError(copy.passwordRulesError);
      return;
    }
    if (!acceptedTerms) {
      setFormError(copy.termsRequired);
      return;
    }

    setLoading(true);
    setSlowNetwork(false);
    if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
    slowNetworkTimerRef.current = setTimeout(() => setSlowNetwork(true), SLOW_NETWORK_MS);

    try {
      const payload = new FormData();
      payload.append('name', form.name);
      payload.append('email', form.email);
      payload.append('password', form.password);
      payload.append('phone', form.phone);
      payload.append('accountType', form.accountType || 'person');
      payload.append('country', form.country || 'République du Congo');
      payload.append('city', form.city);
      payload.append('commune', form.commune || '');
      payload.append('gender', form.gender);
      payload.append('address', form.address.trim());
      payload.append('verificationCode', (verificationCode && verificationCode.trim()) || '');

      const { data } = await api.post('/auth/register', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccessPayload(data || null);
    } catch (requestError) {
      setFormError(mapRegisterErrorMessage(requestError, isFrench));
    } finally {
      if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
      setLoading(false);
    }
  };

  if (user && !successPayload && !finalizing) {
    return <Navigate to={from} replace />;
  }

  return (
    <main className="glass-page-shell min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] lg:gap-6">
          <section className="glass-card rounded-3xl p-5 shadow-sm sm:p-7">
            {!successPayload ? (
              <>
                <header className="mb-6">
                  <p className="inline-flex items-center gap-2 rounded-full soft-card soft-card-blue px-3 py-1 text-xs font-semibold text-blue-900 dark:text-blue-100">
                    <ShieldCheck size={14} />
                    {copy.appBadge}
                  </p>
                  <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                    {copy.title}
                  </h1>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {copy.subtitle}
                  </p>
                </header>

                <div className="mb-5 grid grid-cols-2 gap-2">
                  <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${step === 1 ? 'soft-card soft-card-purple text-purple-900 dark:text-purple-100' : 'glass-card text-slate-500 dark:text-slate-300'}`}>
                    {copy.step1}
                  </div>
                  <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${step === 2 ? 'soft-card soft-card-purple text-purple-900 dark:text-purple-100' : 'glass-card text-slate-500 dark:text-slate-300'}`}>
                    {copy.step2}
                  </div>
                </div>

                <form onSubmit={submit} className="space-y-4">
                  {step === 1 ? (
                    <>
                      <div className="space-y-1.5">
                        <label htmlFor="register-name" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {copy.fullName}
                        </label>
                        <input
                          id="register-name"
                          ref={nameRef}
                          type="text"
                          autoComplete="name"
                          className="ui-input min-h-[48px] rounded-xl px-3 text-sm"
                          placeholder={copy.fullNamePlaceholder}
                          value={form.name}
                          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              emailRef.current?.focus();
                            }
                          }}
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="register-email" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {copy.email}
                        </label>
                        <input
                          id="register-email"
                          ref={emailRef}
                          type="email"
                          autoComplete="email"
                          className="ui-input min-h-[48px] rounded-xl px-3 text-sm"
                          placeholder={copy.emailPlaceholder}
                          value={form.email}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, email: e.target.value }));
                            setCodeError('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              phoneRef.current?.focus();
                            }
                          }}
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="register-phone" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {copy.phone}
                        </label>
                        <input
                          id="register-phone"
                          ref={phoneRef}
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          className="ui-input min-h-[48px] rounded-xl px-3 text-sm"
                          placeholder={copy.phonePlaceholder}
                          value={form.phone}
                          onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (canGoToStep2) setStep(2);
                            }
                          }}
                          required
                        />
                      </div>

                      <div className="rounded-2xl glass-card p-3">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-100">
                          {copy.verificationTitle}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            autoComplete="one-time-code"
                            className="ui-input min-h-[48px] flex-1 rounded-xl px-3 text-sm"
                            placeholder={copy.verificationPlaceholder}
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={sendVerificationCode}
                            disabled={codeSending || !form.email.trim()}
                            className="glass-card min-h-[48px] rounded-xl px-3 text-xs font-semibold text-slate-700 disabled:opacity-60 dark:text-slate-100"
                          >
                            {codeSending ? copy.sendingCode : codeSent ? copy.resendCode : copy.sendCode}
                          </button>
                        </div>
                        {codeError ? <p className="mt-2 text-xs text-red-600 dark:text-red-100">{codeError}</p> : null}
                        {codeMessage ? <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-100">{codeMessage}</p> : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!canGoToStep2) {
                            setFormError(copy.nextStepError);
                            return;
                          }
                            setFormError('');
                          setStep(2);
                          setTimeout(() => passwordRef.current?.focus(), 80);
                        }}
                        className="soft-card soft-card-purple inline-flex min-h-[48px] w-full items-center justify-center rounded-xl px-4 text-sm font-semibold text-purple-900 dark:text-purple-100"
                      >
                        {copy.continueStep2}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-1">
                          <label htmlFor="register-password" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {copy.password}
                          </label>
                          <div className="relative">
                            <input
                              id="register-password"
                              ref={passwordRef}
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              className="ui-input min-h-[48px] w-full rounded-xl px-3 pr-12 text-sm"
                              placeholder={copy.passwordPlaceholder}
                              value={form.password}
                              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((prev) => !prev)}
                              className="absolute right-1.5 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg glass-card text-slate-600 dark:text-slate-200"
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5 sm:col-span-1">
                          <label htmlFor="register-confirm-password" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {copy.confirmPassword}
                          </label>
                          <div className="relative">
                            <input
                              id="register-confirm-password"
                              ref={confirmRef}
                              type={showConfirmPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              className="ui-input min-h-[48px] w-full rounded-xl px-3 pr-12 text-sm"
                              placeholder={copy.confirmPasswordPlaceholder}
                              value={form.confirmPassword}
                              onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword((prev) => !prev)}
                              className="absolute right-1.5 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg glass-card text-slate-600 dark:text-slate-200"
                            >
                              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <section className="glass-card rounded-2xl p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-100">
                            {copy.passwordStrength}
                          </p>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">
                            {passwordStrengthLabel}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/55 dark:bg-slate-800">
                          <div
                            className={`h-full ${passwordStrength.color} transition-all`}
                            style={{ width: `${Math.max(8, (passwordScore / 4) * 100)}%` }}
                          />
                        </div>
                        <ul className="mt-3 space-y-1 text-xs">
                          <li className={passwordChecks.minLength ? 'text-emerald-700 dark:text-emerald-100' : 'text-slate-600 dark:text-slate-300'}>
                            • {copy.ruleLength}
                          </li>
                          <li className={passwordChecks.hasUppercase ? 'text-emerald-700 dark:text-emerald-100' : 'text-slate-600 dark:text-slate-300'}>
                            • {copy.ruleUpper}
                          </li>
                          <li className={passwordChecks.hasNumber ? 'text-emerald-700 dark:text-emerald-100' : 'text-slate-600 dark:text-slate-300'}>
                            • {copy.ruleNumber}
                          </li>
                          <li className={passwordChecks.hasSymbol ? 'text-emerald-700 dark:text-emerald-100' : 'text-slate-500 dark:text-slate-300'}>
                            • {copy.ruleSymbol}
                          </li>
                        </ul>
                      </section>

                      <div className="space-y-1.5">
                        <label htmlFor="register-address" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {copy.address}
                        </label>
                        <textarea
                          id="register-address"
                          rows={2}
                          className="ui-input min-h-[74px] w-full rounded-xl px-3 py-2.5 text-sm"
                          placeholder={copy.addressPlaceholder}
                          value={form.address}
                          onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label htmlFor="register-city" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {copy.city}
                          </label>
                          <select
                            id="register-city"
                            className="ui-input min-h-[48px] w-full rounded-xl px-3 text-sm"
                            value={form.city}
                            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value, commune: '' }))}
                            required
                          >
                            <option value="">{copy.chooseCity}</option>
                            {cityOptions.map((city) => (
                              <option key={city} value={city}>
                                {city}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="register-commune" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {copy.commune}
                          </label>
                          <select
                            id="register-commune"
                            className="ui-input min-h-[48px] w-full rounded-xl px-3 text-sm"
                            value={form.commune}
                            onChange={(e) => setForm((prev) => ({ ...prev, commune: e.target.value }))}
                            required={availableCommunes.length > 0}
                            disabled={!form.city || availableCommunes.length === 0}
                          >
                            <option value="">
                              {form.city ? copy.chooseCommune : copy.chooseCityFirst}
                            </option>
                            {availableCommunes.map((commune) => (
                              <option key={commune._id} value={commune.name}>
                                {commune.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{copy.gender}</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'homme', label: copy.male },
                            { value: 'femme', label: copy.female }
                          ].map((option) => (
                            <label
                              key={option.value}
                              className={`min-h-[48px] rounded-xl px-3 py-3 text-center text-sm font-semibold transition ${
                                form.gender === option.value
                                  ? 'soft-card soft-card-purple text-purple-900 dark:text-purple-100'
                                  : 'glass-card text-slate-700 dark:text-slate-100'
                              }`}
                            >
                              <input
                                type="radio"
                                name="gender"
                                value={option.value}
                                checked={form.gender === option.value}
                                onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
                                className="sr-only"
                              />
                              {option.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <label className="flex items-start gap-2 rounded-xl glass-card px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={(e) => setAcceptedTerms(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300"
                        />
                        <span>
                          {copy.termsLead}{' '}
                          <Link to="/help" className="font-semibold hover:underline">
                            {copy.terms}
                          </Link>{' '}
                          {isFrench ? 'et' : 'and'}{' '}
                          <Link to="/help" className="font-semibold hover:underline">
                            {copy.privacy}
                          </Link>
                          .
                        </span>
                      </label>

                      {formError ? (
                        <div className="soft-card soft-card-red rounded-2xl px-3 py-2.5 text-sm text-red-700 dark:text-red-100">
                          {formError}
                        </div>
                      ) : null}

                      {slowNetwork && loading ? (
                        <p className="text-xs text-amber-700 dark:text-amber-200">
                          {copy.slowNetwork}
                        </p>
                      ) : null}

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="glass-card min-h-[48px] rounded-xl px-4 text-sm font-semibold text-slate-700 dark:text-slate-100"
                        >
                          {copy.back}
                        </button>
                        <button
                          type="submit"
                          disabled={!canSubmit}
                          className="soft-card soft-card-purple inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-purple-900 disabled:opacity-60 dark:text-purple-100"
                        >
                          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                          {loading ? copy.creatingAccount : copy.createAccount}
                        </button>
                      </div>
                    </>
                  )}
                </form>

                <footer className="mt-6 border-t border-white/35 pt-4 text-sm text-slate-600 dark:text-slate-300">
                  <p>
                    {copy.haveAccount}{' '}
                    <Link to="/login" className="font-semibold text-slate-800 hover:underline dark:text-white">
                      {copy.signIn}
                    </Link>
                  </p>
                </footer>
              </>
            ) : (
              <AuthSuccessCard
                variant="register"
                loading={loading || finalizing}
                title={copy.successTitle}
                description={copy.successDescription}
                statusText={copy.successStatus}
                actions={[
                  {
                    key: 'go-dashboard',
                    label: copy.goDashboard,
                    primary: true,
                    disabled: finalizing,
                    onClick: () => completeRegistration(from)
                  },
                  {
                    key: 'complete-profile',
                    label: copy.completeProfile,
                    primary: false,
                    disabled: finalizing,
                    onClick: () => completeRegistration('/profile')
                  }
                ]}
              />
            )}

            {!successPayload ? <AuthTrustPanel compact /> : null}
          </section>

          <AuthTrustPanel />
        </div>
      </div>
    </main>
  );
}
