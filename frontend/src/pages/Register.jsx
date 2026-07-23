import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useNavigate, Navigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAppSettings } from '../context/AppSettingsContext';
import AuthSuccessCard from '../components/auth/AuthSuccessCard';
import useAppBrandLogo from '../hooks/useAppBrandLogo';
import CommerceAuthPanel from '../components/auth/CommerceAuthPanel';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';
import AppleAuthButton from '../components/auth/AppleAuthButton';
import { signInWithApple, signInWithGoogle } from '../services/providerAuth';
import { resolveAuthProviderAvailability } from '../utils/authProviderAvailability';
import { storage } from '../utils/storage';
import { REFERRAL_CODE_STORAGE_KEY } from './ReferralLanding';

const SLOW_NETWORK_MS = 8000;

const mapRegisterErrorMessage = (error, isFrench = true) => {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.code || error?.response?.data?.code || '').toUpperCase();
  const rawMessage = String(error?.response?.data?.message || error?.message || '').toLowerCase();

  if (code.includes('TIMEDOUT') || rawMessage.includes('timeout')) {
    return isFrench ? 'La demande prend plus de temps que prévu. Réessayez dans un instant.' : 'The request is taking longer than expected. Please try again shortly.';
  }
  if (status === 409 || rawMessage.includes('already') || rawMessage.includes('déjà')) {
    return isFrench
      ? 'Un compte existe déjà avec cet email ou ce téléphone.'
      : 'An account already exists with this email or phone.';
  }
  if (status === 403 && code === 'AUTH_PROVIDER_DISABLED' && error?.response?.data?.message) {
    return error.response.data.message;
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
  const { cities, communes, language, runtime } = useAppSettings();
  const { isMobile, logoSrc } = useAppBrandLogo();
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const initialProviderAuth = location.state?.providerAuth || null;
  const isFrench = String(language || 'fr')
    .toLowerCase()
    .startsWith('fr');
  const authAvailability = useMemo(() => resolveAuthProviderAvailability(runtime), [runtime]);
  const hasProviderRegistration = authAvailability.google.registration || authAvailability.apple.registration;
  const hasRegistration = authAvailability.email.registration || hasProviderRegistration;

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
    slowNetwork: isFrench ? 'Création du compte en cours, merci de patienter.' : 'Account creation in progress, please wait.',
    haveAccount: isFrench ? 'Vous avez déjà un compte ?' : 'Already have an account?',
    signIn: isFrench ? 'Se connecter' : 'Sign in',
    google: isFrench ? 'Continuer avec Google' : 'Continue with Google',
    apple: isFrench ? 'Continuer avec Apple' : 'Continue with Apple',
    divider: isFrench ? 'ou avec vos informations' : 'or with your details',
    googleConnected: isFrench ? 'Compte Google vérifié' : 'Google account verified',
    appleConnected: isFrench ? 'Compte Apple vérifié' : 'Apple account verified',
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
    name: initialProviderAuth?.profile?.name || '',
    email: initialProviderAuth?.profile?.email || '',
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
  const [providerLoading, setProviderLoading] = useState('');
  const [providerAuth, setProviderAuth] = useState(initialProviderAuth);
  const [slowNetwork, setSlowNetwork] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [codeMessage, setCodeMessage] = useState('');
  const [codeError, setCodeError] = useState('');
  const [formError, setFormError] = useState('');
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    storage.get(REFERRAL_CODE_STORAGE_KEY).then((value) => {
      if (value) setReferralCode(String(value));
    });
  }, []);
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

  useEffect(() => {
    if (providerAuth && !authAvailability[providerAuth.provider]?.registration) {
      setProviderAuth(null);
      setFormError(isFrench ? 'Cette méthode de création de compte est désactivée.' : 'This account creation method is disabled.');
    }
  }, [authAvailability, isFrench, providerAuth]);

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
      (providerAuth ||
        (form.password &&
          form.confirmPassword &&
          form.password === form.confirmPassword &&
          passwordChecks.minLength &&
          passwordChecks.hasUppercase &&
          passwordChecks.hasNumber)) &&
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
    if (!authAvailability.email.registration) return;
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

  const handleGoogleSignIn = async () => {
    if (!authAvailability.google.registration || loading || providerLoading) return;
    setFormError('');
    setProviderLoading('google');
    try {
      const idToken = await signInWithGoogle();
      const { data } = await api.post('/auth/provider/google/registration-profile', { idToken });
      const nextProviderAuth = { provider: 'google', idToken, profile: data.profile };
      setProviderAuth(nextProviderAuth);
      setForm((previous) => ({
        ...previous,
        name: data.profile?.name || previous.name,
        email: data.profile?.email || previous.email,
        password: '',
        confirmPassword: ''
      }));
      setVerificationCode('');
      setCodeError('');
      setCodeMessage('');
    } catch (requestError) {
      if (requestError?.code === 'auth/popup-closed-by-user') return;
      setFormError(
        isFrench
          ? 'La connexion avec Google a échoué. Veuillez réessayer.'
          : 'Google sign-in failed. Please try again.'
      );
    } finally {
      setProviderLoading('');
    }
  };

  const handleAppleSignIn = async () => {
    if (!authAvailability.apple.registration || loading || providerLoading) return;
    setFormError('');
    setProviderLoading('apple');
    try {
      const appleCredential = await signInWithApple();
      const { data } = await api.post('/auth/provider/apple/registration-profile', { idToken: appleCredential.idToken });
      const profile = {
        ...data.profile,
        name: appleCredential.profile?.name || data.profile?.name || '',
        email: appleCredential.profile?.email || data.profile?.email || ''
      };
      setProviderAuth({ provider: 'apple', idToken: appleCredential.idToken, profile });
      setForm((previous) => ({
        ...previous,
        name: profile.name || previous.name,
        email: profile.email || previous.email,
        password: '',
        confirmPassword: ''
      }));
      setVerificationCode('');
      setCodeError('');
      setCodeMessage('');
    } catch (requestError) {
      if (requestError?.code === 'auth/popup-closed-by-user') return;
      setFormError(
        isFrench
          ? 'La connexion avec Apple a échoué. Veuillez réessayer.'
          : 'Apple sign-in failed. Please try again.'
      );
    } finally {
      setProviderLoading('');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (loading || successPayload || (!providerAuth && !authAvailability.email.registration)) return;
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
    if (!providerAuth && form.password !== form.confirmPassword) {
      setFormError(copy.passwordsMismatch);
      return;
    }
    if (!providerAuth && (!passwordChecks.minLength || !passwordChecks.hasUppercase || !passwordChecks.hasNumber)) {
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
      if (providerAuth) {
        const { data } = await api.post(`/auth/provider/${providerAuth.provider}/register`, {
          idToken: providerAuth.idToken,
          name: form.name,
          phone: form.phone,
          city: form.city,
          commune: form.commune || '',
          gender: form.gender,
          address: form.address.trim(),
          acceptedLegalTerms: true,
          legalVersion: '2026-07-18',
          referralCode
        });
        setSuccessPayload(data || null);
        if (referralCode) storage.remove(REFERRAL_CODE_STORAGE_KEY);
        return;
      }

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
      payload.append('acceptedLegalTerms', 'true');
      payload.append('legalVersion', '2026-07-18');
      if (referralCode) payload.append('referralCode', referralCode);

      const { data } = await api.post('/auth/register', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccessPayload(data || null);
      if (referralCode) storage.remove(REFERRAL_CODE_STORAGE_KEY);
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
    <main className="min-h-screen overflow-hidden bg-neutral-100 px-4 py-4 text-gray-900 dark:bg-neutral-950 dark:text-white sm:px-6 lg:px-8">
      <div className="relative mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col justify-center gap-4">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <Link to="/" className="inline-flex items-center gap-2 rounded-2xl pr-2 text-sm font-black text-gray-900 dark:text-white">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-neutral-900">
              <img src={logoSrc} alt={copy.appBadge} className="h-7 w-7 object-contain" />
            </span>
            {copy.appBadge}
          </Link>
          <Link
            to="/login"
            className="rounded bg-orange-50 px-3 py-2 text-[11px] font-bold text-[#e85d00] transition hover:bg-orange-100 dark:bg-orange-400/10 dark:text-orange-100"
          >
            {copy.signIn}
          </Link>
        </nav>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] lg:items-stretch">
          <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-7">
            {!successPayload ? (
              <>
                <header className="relative mb-6">
                  <div className="mb-4 flex justify-center lg:justify-start">
                    <div className="inline-flex flex-col items-center lg:items-start">
                      <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-[#e85d00] dark:bg-white">
                        <img
                          src={logoSrc}
                          alt={copy.appBadge}
                          className={`${isMobile ? 'h-12 w-12' : 'h-14 w-14'} object-contain`}
                        />
                      </div>
                    </div>
                  </div>
                  <h1 className="mt-4 text-2xl font-black tracking-normal text-gray-900 dark:text-white sm:text-3xl">
                    {copy.title}
                  </h1>
                  <p className="mt-2 text-sm font-medium leading-6 text-gray-600 dark:text-slate-300">
                    {copy.subtitle}
                  </p>
                </header>

                {providerAuth ? (
                  <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm dark:bg-neutral-900">
                      {providerAuth.provider === 'apple' ? 'A' : 'G'}
                    </span>
                    <span className="min-w-0">
                      <span className="block">
                        {providerAuth.provider === 'apple' ? copy.appleConnected : copy.googleConnected}
                      </span>
                      <span className="block truncate text-xs font-medium opacity-80">{form.email}</span>
                    </span>
                  </div>
                ) : (
                  <>
                    {hasProviderRegistration ? <div className="grid gap-2 sm:grid-cols-2">
                      {authAvailability.google.registration ? <GoogleAuthButton
                        label={copy.google}
                        loading={providerLoading === 'google'}
                        disabled={loading || Boolean(providerLoading)}
                        onClick={handleGoogleSignIn}
                      /> : null}
                      {authAvailability.apple.registration ? <AppleAuthButton
                        label={copy.apple}
                        loading={providerLoading === 'apple'}
                        disabled={loading || Boolean(providerLoading)}
                        onClick={handleAppleSignIn}
                      /> : null}
                    </div> : null}
                    {hasProviderRegistration && authAvailability.email.registration ? <div className="my-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <span className="h-px flex-1 bg-gray-200 dark:bg-neutral-800" />
                      {copy.divider}
                      <span className="h-px flex-1 bg-gray-200 dark:bg-neutral-800" />
                    </div> : null}
                  </>
                )}

                {providerAuth || authAvailability.email.registration ? <>
                <div className="mb-5 grid grid-cols-2 gap-2">
                  <div className={`rounded px-3 py-2 text-xs font-black ${step === 1 ? 'bg-[#e85d00] text-white' : 'bg-gray-100 text-gray-500 dark:bg-neutral-900 dark:text-slate-300'}`}>
                    {copy.step1}
                  </div>
                  <div className={`rounded px-3 py-2 text-xs font-black ${step === 2 ? 'bg-[#e85d00] text-white' : 'bg-gray-100 text-gray-500 dark:bg-neutral-900 dark:text-slate-300'}`}>
                    {copy.step2}
                  </div>
                </div>

                <form onSubmit={submit} className="space-y-4">
                  {step === 1 ? (
                    <>
                      <div className="space-y-1.5">
                        <label htmlFor="register-name" className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                          {copy.fullName}
                        </label>
                        <input
                          id="register-name"
                          ref={nameRef}
                          type="text"
                          autoComplete="name"
                          className="ui-input min-h-[48px] rounded px-3 text-sm"
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
                        <label htmlFor="register-email" className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                          {copy.email}
                        </label>
                        <input
                          id="register-email"
                          ref={emailRef}
                          type="email"
                          autoComplete="email"
                          className="ui-input min-h-[48px] rounded px-3 text-sm"
                          placeholder={copy.emailPlaceholder}
                          value={form.email}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, email: e.target.value }));
                            setCodeError('');
                          }}
                          readOnly={Boolean(providerAuth)}
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
                        <label htmlFor="register-phone" className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                          {copy.phone}
                        </label>
                        <input
                          id="register-phone"
                          ref={phoneRef}
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          className="ui-input min-h-[48px] rounded px-3 text-sm"
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

                      {!providerAuth ? (
                      <div className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
                        <p className="text-xs font-black text-slate-700 dark:text-slate-100">
                          {copy.verificationTitle}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            autoComplete="one-time-code"
                            className="ui-input min-h-[48px] flex-1 rounded px-3 text-sm"
                            placeholder={copy.verificationPlaceholder}
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={sendVerificationCode}
                            disabled={codeSending || !form.email.trim()}
                            className="min-h-[48px] rounded border border-gray-200 bg-white px-3 text-xs font-black text-[#e85d00] transition hover:bg-gray-50 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-orange-100"
                          >
                            {codeSending ? copy.sendingCode : codeSent ? copy.resendCode : copy.sendCode}
                          </button>
                        </div>
                        {codeError ? <p className="mt-2 text-xs text-red-600 dark:text-red-100">{codeError}</p> : null}
                        {codeMessage ? <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-100">{codeMessage}</p> : null}
                      </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => {
                          if (!canGoToStep2) {
                            setFormError(copy.nextStepError);
                            return;
                          }
                          setFormError('');
                          setStep(2);
                          setTimeout(() => {
                            if (providerAuth) document.getElementById('register-address')?.focus();
                            else passwordRef.current?.focus();
                          }, 80);
                        }}
                        className="inline-flex min-h-[48px] w-full items-center justify-center rounded bg-[#e85d00] px-4 text-sm font-black text-white transition hover:bg-[#e85f00]"
                      >
                        {copy.continueStep2}
                      </button>
                    </>
                  ) : (
                    <>
                      {!providerAuth ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-1">
                          <label htmlFor="register-password" className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                            {copy.password}
                          </label>
                          <div className="relative">
                            <input
                              id="register-password"
                              ref={passwordRef}
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              className="ui-input min-h-[48px] w-full rounded px-3 pr-12 text-sm"
                              placeholder={copy.passwordPlaceholder}
                              value={form.password}
                              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((prev) => !prev)}
                              className="absolute right-1.5 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded bg-gray-100 text-gray-500 transition hover:bg-gray-200 dark:bg-neutral-800 dark:text-slate-200"
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5 sm:col-span-1">
                          <label htmlFor="register-confirm-password" className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                            {copy.confirmPassword}
                          </label>
                          <div className="relative">
                            <input
                              id="register-confirm-password"
                              ref={confirmRef}
                              type={showConfirmPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              className="ui-input min-h-[48px] w-full rounded px-3 pr-12 text-sm"
                              placeholder={copy.confirmPasswordPlaceholder}
                              value={form.confirmPassword}
                              onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword((prev) => !prev)}
                              className="absolute right-1.5 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded bg-gray-100 text-gray-500 transition hover:bg-gray-200 dark:bg-neutral-800 dark:text-slate-200"
                            >
                              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      </div>
                      ) : null}

                      {!providerAuth ? (
                      <section className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-100">
                            {copy.passwordStrength}
                          </p>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">
                            {passwordStrengthLabel}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-neutral-800">
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
                      ) : null}

                      <div className="space-y-1.5">
                        <label htmlFor="register-address" className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                          {copy.address}
                        </label>
                        <textarea
                          id="register-address"
                          rows={2}
                          className="ui-input min-h-[74px] w-full rounded px-3 py-2.5 text-sm"
                          placeholder={copy.addressPlaceholder}
                          value={form.address}
                          onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label htmlFor="register-city" className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                            {copy.city}
                          </label>
                          <select
                            id="register-city"
                            className="ui-input min-h-[48px] w-full rounded px-3 text-sm"
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
                          <label htmlFor="register-commune" className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                            {copy.commune}
                          </label>
                          <select
                            id="register-commune"
                            className="ui-input min-h-[48px] w-full rounded px-3 text-sm"
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
                        <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">{copy.gender}</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'homme', label: copy.male },
                            { value: 'femme', label: copy.female }
                          ].map((option) => (
                            <label
                              key={option.value}
                              className={`min-h-[48px] rounded px-3 py-3 text-center text-sm font-semibold transition ${
                                form.gender === option.value
                                  ? 'bg-[#e85d00] text-white'
                                  : 'bg-gray-100 text-gray-700 dark:bg-neutral-900 dark:text-slate-100'
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

                      <label className="flex items-start gap-2 rounded border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs text-gray-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={(e) => setAcceptedTerms(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#e85d00]"
                        />
                        <span>
                          {copy.termsLead}{' '}
                          <Link to="/conditions-utilisation" target="_blank" className="font-semibold hover:underline">
                            {copy.terms}
                          </Link>{' '}
                          {isFrench ? 'et' : 'and'}{' '}
                          <Link to="/confidentialite" target="_blank" className="font-semibold hover:underline">
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
                          className="min-h-[48px] rounded border border-gray-200 bg-gray-50 px-4 text-sm font-black text-gray-800 transition hover:bg-gray-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-slate-100"
                        >
                          {copy.back}
                        </button>
                        <button
                          type="submit"
                          disabled={!canSubmit}
                          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded bg-[#e85d00] px-4 text-sm font-black text-white transition hover:bg-[#e85f00] disabled:opacity-60"
                        >
                          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                          {loading ? copy.creatingAccount : copy.createAccount}
                        </button>
                      </div>
                    </>
                  )}
                </form>
                </> : hasRegistration ? (
                  <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-100">
                    {isFrench ? 'Choisissez Google ou Apple ci-dessus pour créer votre compte.' : 'Choose Google or Apple above to create your account.'}
                  </div>
                ) : (
                  <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
                    {isFrench ? 'La création de compte est temporairement désactivée.' : 'Account creation is temporarily disabled.'}
                  </div>
                )}

                <footer className="mt-6 border-t border-gray-100 pt-4 text-sm text-gray-600 dark:border-neutral-800 dark:text-slate-300">
                  <p>
                    {copy.haveAccount}{' '}
                    <Link to="/login" className="font-black text-[#e85d00] hover:underline dark:text-orange-100">
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

          </section>

          <CommerceAuthPanel mode="register" logoSrc={logoSrc} />
        </div>
      </div>
    </main>
  );
}
