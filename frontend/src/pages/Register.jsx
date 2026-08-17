import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useNavigate, Navigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle, ChevronDown, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAppSettings } from '../context/AppSettingsContext';
import { useToast } from '../context/ToastContext';
import AuthSuccessCard from '../components/auth/AuthSuccessCard';
import CommerceAuthPanel from '../components/auth/CommerceAuthPanel';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';
import AppleAuthButton from '../components/auth/AppleAuthButton';
import { signInWithApple, signInWithGoogle } from '../services/providerAuth';
import { resolveAuthProviderAvailability } from '../utils/authProviderAvailability';
import { storage } from '../utils/storage';
import { REFERRAL_CODE_STORAGE_KEY } from './ReferralLanding';
import { useCountry } from '../context/CountryContext';

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

// The User model stores a single `name` field; provider (Google/Apple)
// profiles only give a full name, so split it best-effort into first/last
// for the two-field form.
const splitName = (fullName = '') => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
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
  const { showToast } = useToast();
  const { cities, communes, language, runtime } = useAppSettings();
  const { country: selectedCountry } = useCountry();
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
    firstName: isFrench ? 'Prénom' : 'First name',
    firstNamePlaceholder: isFrench ? 'Votre prénom' : 'Your first name',
    lastName: isFrench ? 'Nom' : 'Last name',
    lastNamePlaceholder: isFrench ? 'Votre nom' : 'Your last name',
    country: isFrench ? 'Pays' : 'Country',
    phone: isFrench ? 'Téléphone' : 'Phone',
    phonePlaceholder: isFrench ? '060000000' : '060000000',
    verificationTitle: isFrench ? 'Vérification du téléphone' : 'Phone verification',
    verificationPlaceholder: isFrench ? 'Entrez le code reçu par SMS' : 'Enter the code you received by SMS',
    sendCode: isFrench ? 'Recevoir OTP' : 'Receive OTP',
    sendingCode: isFrench ? 'Envoi...' : 'Sending...',
    resendCode: isFrench ? 'Renvoyer' : 'Resend',
    verifyCode: isFrench ? 'Vérifier OTP' : 'Verify OTP',
    verifyingCode: isFrench ? 'Vérification...' : 'Verifying...',
    codeSentMessage: isFrench
      ? 'Code envoyé par SMS. Vérifiez vos messages.'
      : 'Code sent by SMS. Check your messages.',
    phoneVerifiedMessage: isFrench ? 'Numéro de téléphone vérifié.' : 'Phone number verified.',
    phoneNotVerifiedError: isFrench
      ? 'Veuillez vérifier votre numéro de téléphone avant de continuer.'
      : 'Please verify your phone number before continuing.',
    continueStep2: isFrench ? 'Continuer' : 'Continue',
    password: isFrench ? 'Mot de passe' : 'Password',
    passwordPlaceholder: isFrench ? 'Mot de passe' : 'Password',
    confirmPassword: isFrench ? 'Confirmer le mot de passe' : 'Confirm password',
    confirmPasswordPlaceholder: isFrench ? 'Confirmer le mot de passe' : 'Confirm password',
    passwordStrength: isFrench ? 'Force du mot de passe' : 'Password strength',
    ruleLength: isFrench ? 'Au moins 8 caractères' : 'At least 8 characters',
    ruleUpper: isFrench ? 'Une lettre majuscule' : 'Uppercase letter',
    ruleNumber: isFrench ? 'Un chiffre' : 'Number',
    ruleSymbol: isFrench ? 'Un symbole (optionnel)' : 'Symbol (optional)',
    address: isFrench ? 'Adresse de livraison' : 'Delivery address',
    addressPlaceholder: isFrench ? 'Quartier, avenue, repère proche…' : 'Neighbourhood, street, nearby landmark…',
    city: isFrench ? 'Ville' : 'City',
    chooseCity: isFrench ? 'Choisir la ville' : 'Choose city',
    commune: isFrench ? 'Commune' : 'Commune',
    chooseCommune: isFrench ? 'Choisir la commune' : 'Choose commune',
    chooseCityFirst: isFrench ? "Choisir la ville d'abord" : 'Choose city first',
    gender: isFrench ? 'Genre' : 'Gender',
    male: isFrench ? 'Homme' : 'Male',
    female: isFrench ? 'Femme' : 'Female',
    termsLead: isFrench ? "J'accepte les" : 'I agree to the',
    terms: isFrench ? "conditions d'utilisation" : 'terms of use',
    privacy: isFrench ? 'Politique de confidentialité' : 'Privacy Policy',
    back: isFrench ? 'Retour' : 'Back',
    createAccount: isFrench ? 'Créer mon compte' : 'Create my account',
    creatingAccount: isFrench ? 'Création...' : 'Creating...',
    slowNetwork: isFrench ? 'Création du compte en cours, merci de patienter.' : 'Account creation in progress, please wait.',
    haveAccount: isFrench ? 'Vous avez déjà un compte ?' : 'Already have an account?',
    signIn: isFrench ? 'Se connecter' : 'Sign in',
    google: 'Google',
    apple: 'Apple',
    divider: isFrench ? 'ou' : 'or',
    googleConnected: isFrench ? 'Compte Google vérifié' : 'Google account verified',
    appleConnected: isFrench ? 'Compte Apple vérifié' : 'Apple account verified',
    nextStepError: isFrench
      ? 'Renseignez votre prénom, nom et téléphone vérifié pour continuer.'
      : 'Enter your first name, last name and a verified phone to continue.',
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
    welcomeToast: isFrench
      ? '🎉 Bienvenue sur HDMarket ! Votre compte a été créé avec succès.'
      : '🎉 Welcome to HDMarket! Your account has been created successfully.',
    goDashboard: isFrench ? 'Aller au tableau de bord' : 'Go to Dashboard',
    completeProfile: isFrench ? 'Compléter mon profil' : 'Complete Profile'
  };

  const [step, setStep] = useState(1);
  const initialProviderName = splitName(initialProviderAuth?.profile?.name);
  const [form, setForm] = useState({
    firstName: initialProviderName.firstName,
    lastName: initialProviderName.lastName,
    email: initialProviderAuth?.profile?.email || '',
    password: '',
    confirmPassword: '',
    phone: '',
    accountType: 'person',
    address: '',
    country: selectedCountry?.name || 'République du Congo',
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
  const [resendIn, setResendIn] = useState(0);
  const [codeSending, setCodeSending] = useState(false);
  const [codeVerifying, setCodeVerifying] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [codeMessage, setCodeMessage] = useState('');
  const [codeError, setCodeError] = useState('');
  const [formError, setFormError] = useState('');
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    if (!selectedCountry?.name) return;
    setForm((previous) => ({ ...previous, country: selectedCountry.name, city: '', commune: '' }));
    setPhoneVerified(false);
    setCodeSent(false);
    setVerificationCode('');
  }, [selectedCountry?.id, selectedCountry?._id, selectedCountry?.name]);

  useEffect(() => {
    storage.get(REFERRAL_CODE_STORAGE_KEY).then((value) => {
      if (value) setReferralCode(String(value));
    });
  }, []);
  const [successPayload, setSuccessPayload] = useState(null);
  const [finalizing, setFinalizing] = useState(false);

  const nameRef = useRef(null);
  const lastNameRef = useRef(null);
  const phoneRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const slowNetworkTimerRef = useRef(null);
  const successRedirectTimerRef = useRef(null);
  const otpRefs = useRef([]);
  const lastOtpAttemptRef = useRef('');

  useEffect(() => {
    return () => {
      if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
      if (successRedirectTimerRef.current) clearTimeout(successRedirectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

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
  const selectedCommuneRecord =
    availableCommunes.find((item) => item?.name === form.commune) || null;
  const selectedCityId = /^[a-f\d]{24}$/i.test(String(selectedCityRecord?._id || ''))
    ? selectedCityRecord._id
    : '';
  const selectedCommuneId = /^[a-f\d]{24}$/i.test(String(selectedCommuneRecord?._id || ''))
    ? selectedCommuneRecord._id
    : '';

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

  // Provider (Google/Apple) sign-up already proves identity via the OAuth
  // token, so phone OTP is only mandatory on the password path.
  const canGoToStep2 = Boolean(
    form.firstName.trim() && form.lastName.trim() && form.phone.trim() && (providerAuth || phoneVerified)
  );
  const canSubmit = Boolean(
    form.firstName.trim() &&
      form.lastName.trim() &&
      form.phone.trim() &&
      (providerAuth || phoneVerified) &&
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

  const sendPhoneOtp = async () => {
    if (!authAvailability.email.registration) return;
    if (!form.phone.trim()) return;
    setCodeSending(true);
    setCodeError('');
    setCodeMessage('');
    setFormError('');
    try {
      // silentGlobalError: this step already shows its own inline message
      // below — without it, a backend failure also raises the raw internal
      // error text as a global toast (e.g. leaking unconfigured env names).
      await api.post('/auth/register/phone/send-code', { phone: form.phone, countryId: selectedCountry?.id || selectedCountry?._id }, { silentGlobalError: true });
      setCodeSent(true);
      setVerificationCode('');
      setResendIn(30);
      lastOtpAttemptRef.current = '';
      setPhoneVerified(false);
      setCodeMessage(copy.codeSentMessage);
    } catch (requestError) {
      setCodeError(mapRegisterErrorMessage(requestError, isFrench));
    } finally {
      setCodeSending(false);
    }
  };

  const verifyPhoneOtp = async () => {
    if (verificationCode.length !== 6 || codeVerifying || phoneVerified) return;
    if (lastOtpAttemptRef.current === verificationCode) return;
    lastOtpAttemptRef.current = verificationCode;
    setCodeVerifying(true);
    setCodeError('');
    setCodeMessage('');
    try {
      await api.post(
        '/auth/register/phone/verify-code',
        { phone: form.phone, verificationCode, countryId: selectedCountry?.id || selectedCountry?._id },
        { silentGlobalError: true }
      );
      setPhoneVerified(true);
      setCodeMessage(copy.phoneVerifiedMessage);
    } catch (requestError) {
      setPhoneVerified(false);
      lastOtpAttemptRef.current = '';
      setCodeError(mapRegisterErrorMessage(requestError, isFrench));
    } finally {
      setCodeVerifying(false);
    }
  };

  useEffect(() => {
    if (!codeSent || phoneVerified || verificationCode.length !== 6) return;
    verifyPhoneOtp();
  }, [codeSent, phoneVerified, verificationCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateOtpDigit = (index, value) => {
    const digit = String(value || '').replace(/\D/g, '').slice(-1);
    const digits = verificationCode.padEnd(6, ' ').slice(0, 6).split('');
    digits[index] = digit || ' ';
    const nextCode = digits.join('').replace(/\s/g, '').slice(0, 6);
    setVerificationCode(nextCode);
    setCodeError('');
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key !== 'Backspace') return;
    const digit = verificationCode[index] || '';
    if (!digit && index > 0) {
      event.preventDefault();
      const next = verificationCode.split('');
      next[index - 1] = '';
      setVerificationCode(next.join('').slice(0, 6));
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    setVerificationCode(pasted);
    otpRefs.current[Math.min(5, pasted.length - 1)]?.focus();
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
      const { firstName, lastName } = splitName(data.profile?.name);
      setForm((previous) => ({
        ...previous,
        firstName: firstName || previous.firstName,
        lastName: lastName || previous.lastName,
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
      const { firstName, lastName } = splitName(profile.name);
      setForm((previous) => ({
        ...previous,
        firstName: firstName || previous.firstName,
        lastName: lastName || previous.lastName,
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

    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();

    try {
      if (providerAuth) {
        const { data } = await api.post(`/auth/provider/${providerAuth.provider}/register`, {
          idToken: providerAuth.idToken,
          name: fullName,
          phone: form.phone,
          city: form.city,
          commune: form.commune || '',
          cityId: selectedCityId,
          communeId: selectedCommuneId,
          gender: form.gender,
          address: form.address.trim(),
          acceptedLegalTerms: true,
          legalVersion: '2026-07-18',
          referralCode,
          countryId: selectedCountry?.id || selectedCountry?._id
        });
        setSuccessPayload(data || null);
        showToast(copy.welcomeToast, { variant: 'success' });
        if (referralCode) storage.remove(REFERRAL_CODE_STORAGE_KEY);
        return;
      }

      if (!phoneVerified) {
        setFormError(copy.phoneNotVerifiedError);
        return;
      }

      const payload = new FormData();
      payload.append('name', fullName);
      payload.append('password', form.password);
      payload.append('phone', form.phone);
      payload.append('accountType', form.accountType || 'person');
      payload.append('country', form.country || 'République du Congo');
      payload.append('countryId', selectedCountry?.id || selectedCountry?._id || '');
      payload.append('city', form.city);
      payload.append('commune', form.commune || '');
      payload.append('cityId', selectedCityId);
      payload.append('communeId', selectedCommuneId);
      payload.append('gender', form.gender);
      payload.append('address', form.address.trim());
      payload.append('acceptedLegalTerms', 'true');
      payload.append('legalVersion', '2026-07-18');
      if (referralCode) payload.append('referralCode', referralCode);

      const { data } = await api.post('/auth/register', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccessPayload(data || null);
      showToast(copy.welcomeToast, { variant: 'success' });
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

  const fieldClass = '!h-14 !min-h-14 !rounded-[14px] !border-0 !bg-white !px-4 !py-0 !text-base !font-medium !text-[#141210] !shadow-[inset_0_0_0_1px_#e7dfd5] outline-none placeholder:!text-[#a8a29e] focus:!bg-white focus:!shadow-[inset_0_0_0_2px_#e85d00] dark:!bg-neutral-900 dark:!text-white dark:!shadow-[inset_0_0_0_1px_#262626] dark:focus:!bg-neutral-900';
  const labelClass = 'text-[13px] font-semibold text-[#57534e] dark:text-neutral-400';
  const goToStep2 = () => {
    if (!canGoToStep2) {
      setFormError(copy.nextStepError);
      return;
    }
    setFormError('');
    setStep(2);
    setTimeout(() => {
      if (providerAuth) document.getElementById('register-city')?.focus();
      else passwordRef.current?.focus();
    }, 80);
  };

  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#141210] dark:bg-neutral-950 dark:text-white lg:px-8 lg:py-6">
      <div className="mx-auto grid min-h-[100dvh] w-full max-w-[1120px] overflow-hidden bg-[#f6f3ee] lg:min-h-[700px] lg:grid-cols-2 lg:rounded-[22px] lg:ring-1 lg:ring-[#e7dfd5] dark:bg-neutral-950 dark:ring-neutral-800">
        <section className="hd-auth-form flex min-h-[100dvh] min-w-0 flex-col lg:min-h-[700px] lg:max-h-[calc(100dvh-3rem)]">
          {!successPayload ? (
            <>
              <header className="flex items-center gap-3 px-6 pt-[22px] lg:px-12 lg:pt-8">
                <button
                  type="button"
                  onClick={() => {
                    setFormError('');
                    if (step === 2) setStep(1);
                    else nav('/login');
                  }}
                  className="flex h-11 w-7 shrink-0 items-center justify-center text-[#57534e] transition hover:text-[#e85d00] dark:text-neutral-300"
                  aria-label={copy.back}
                >
                  <ArrowLeft size={22} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold text-[#78716c] dark:text-neutral-400">
                    {step === 1
                      ? (isFrench ? 'Étape 1 sur 2 · Profil' : 'Step 1 of 2 · Profile')
                      : (isFrench ? 'Étape 2 sur 2 · Sécurité et livraison' : 'Step 2 of 2 · Security and delivery')}
                  </p>
                  <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-[#e7dfd5] dark:bg-neutral-800">
                    <div className="h-full rounded-full bg-[#e85d00] transition-all" style={{ width: step === 1 ? '50%' : '100%' }} />
                  </div>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-6 lg:px-12">
                <div className="mx-auto max-w-[430px]">
                  <h1 className="text-[26px] font-black tracking-[-0.03em] text-[#141210] dark:text-white">
                    {step === 1
                      ? (isFrench ? 'Qui êtes-vous ?' : 'Who are you?')
                      : (isFrench ? 'Sécurité et livraison' : 'Security and delivery')}
                  </h1>
                  <p className="mt-1.5 text-[14.5px] font-medium leading-[1.55] text-[#78716c] dark:text-neutral-400">
                    {step === 1
                      ? (isFrench ? 'Nous vérifions votre numéro pour sécuriser vos commandes.' : 'We verify your number to protect your orders.')
                      : (isFrench ? 'Protégez votre compte et indiquez où livrer vos commandes.' : 'Protect your account and tell us where to deliver your orders.')}
                  </p>

                  {step === 1 && !providerAuth && hasProviderRegistration ? (
                    <div className="mt-5">
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {authAvailability.google.registration ? <GoogleAuthButton label={copy.google} loading={providerLoading === 'google'} disabled={loading || Boolean(providerLoading)} onClick={handleGoogleSignIn} /> : null}
                        {authAvailability.apple.registration ? <AppleAuthButton label={copy.apple} loading={providerLoading === 'apple'} disabled={loading || Boolean(providerLoading)} onClick={handleAppleSignIn} /> : null}
                      </div>
                      {authAvailability.email.registration ? (
                        <div className="my-4 flex items-center gap-3 text-[13px] font-medium text-[#a8a29e]">
                          <span className="h-px flex-1 bg-[#e7dfd5]" />{copy.divider}<span className="h-px flex-1 bg-[#e7dfd5]" />
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {providerAuth && step === 1 ? (
                    <div className="mt-5 flex items-center gap-3 rounded-[14px] bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-400/20">
                      <CheckCircle size={18} />
                      <span className="min-w-0 truncate">{providerAuth.provider === 'apple' ? copy.appleConnected : copy.googleConnected} · {form.email}</span>
                    </div>
                  ) : null}

                  {providerAuth || authAvailability.email.registration ? (
                    <form id="register-form" onSubmit={submit} className="mt-[22px] space-y-3.5">
                      {step === 1 ? (
                        <>
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-[7px]">
                              <label htmlFor="register-first-name" className={labelClass}>{copy.firstName}</label>
                              <input id="register-first-name" ref={nameRef} type="text" autoComplete="given-name" className={fieldClass} placeholder={copy.firstNamePlaceholder} value={form.firstName} onChange={(event) => setForm((previous) => ({ ...previous, firstName: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); lastNameRef.current?.focus(); } }} required />
                            </div>
                            <div className="space-y-[7px]">
                              <label htmlFor="register-last-name" className={labelClass}>{copy.lastName}</label>
                              <input id="register-last-name" ref={lastNameRef} type="text" autoComplete="family-name" className={fieldClass} placeholder={copy.lastNamePlaceholder} value={form.lastName} onChange={(event) => setForm((previous) => ({ ...previous, lastName: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); phoneRef.current?.focus(); } }} required />
                            </div>
                          </div>

                          <div className="space-y-[7px]">
                            <label htmlFor="register-phone" className={labelClass}>{copy.phone}</label>
                            <div className="flex h-14 items-center rounded-[14px] bg-white px-4 shadow-[inset_0_0_0_1px_#e7dfd5] focus-within:shadow-[inset_0_0_0_2px_#e85d00] dark:bg-neutral-900 dark:shadow-[inset_0_0_0_1px_#262626]">
                              <span className="mr-2.5 flex shrink-0 items-center gap-1.5 whitespace-nowrap border-r border-[#ece5db] pr-2.5 text-[14px] font-semibold text-[#57534e] dark:border-neutral-700 dark:text-neutral-300">{selectedCountry?.flagEmoji || '🇨🇬'} {selectedCountry?.phoneCode || '+242'}</span>
                              <input id="register-phone" ref={phoneRef} type="tel" inputMode="tel" autoComplete="tel" className="hd-auth-autofill !h-full !min-h-0 flex-1 !rounded-none !border-0 !bg-transparent !p-0 !text-base !font-medium !shadow-none outline-none placeholder:!text-[#a8a29e] focus:!bg-transparent focus:!shadow-none dark:!bg-transparent dark:!text-white" placeholder="06 00 00 000" value={form.phone} onChange={(event) => { setForm((previous) => ({ ...previous, phone: event.target.value })); setPhoneVerified(false); setCodeSent(false); setVerificationCode(''); setCodeError(''); setCodeMessage(''); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (canGoToStep2) goToStep2(); else if (!codeSent) sendPhoneOtp(); } }} required />
                            </div>
                          </div>

                          {!providerAuth ? (
                            <section className="rounded-2xl bg-white p-3.5 ring-1 ring-inset ring-[#e7dfd5] dark:bg-neutral-900 dark:ring-neutral-800">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-bold text-[#141210] dark:text-white">Code SMS</p>
                                {codeSent && !phoneVerified ? (
                                  <button type="button" onClick={sendPhoneOtp} disabled={codeSending || resendIn > 0} className="min-h-11 text-right text-[12.5px] font-semibold text-[#a8a29e] transition enabled:text-[#b3480a] enabled:hover:text-[#e85d00] disabled:cursor-not-allowed">
                                    {codeSending ? copy.sendingCode : resendIn > 0 ? `${copy.resendCode} dans ${resendIn} s` : copy.resendCode}
                                  </button>
                                ) : null}
                              </div>
                              {!codeSent ? (
                                <button type="button" onClick={sendPhoneOtp} disabled={codeSending || !form.phone.trim()} className="mt-2.5 flex min-h-[50px] w-full items-center justify-center rounded-[14px] bg-[#faf7f2] text-sm font-bold text-[#b3480a] ring-1 ring-inset ring-[#ece5db] transition hover:text-[#e85d00] disabled:cursor-not-allowed disabled:opacity-55 dark:bg-neutral-800 dark:ring-neutral-700">
                                  {codeSending ? <><Loader2 size={16} className="mr-2 animate-spin" />{copy.sendingCode}</> : copy.sendCode}
                                </button>
                              ) : (
                                <div className="mt-2.5 grid grid-cols-6 gap-2" onPaste={handleOtpPaste}>
                                  {Array.from({ length: 6 }, (_, index) => (
                                    <input key={index} ref={(node) => { otpRefs.current[index] = node; }} type="text" inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} aria-label={`${isFrench ? 'Chiffre' : 'Digit'} ${index + 1}`} maxLength={1} value={verificationCode[index] || ''} onChange={(event) => updateOtpDigit(index, event.target.value)} onKeyDown={(event) => handleOtpKeyDown(index, event)} disabled={phoneVerified || codeVerifying} className="!h-[52px] !min-h-[52px] !w-full !rounded-xl !border-0 !bg-[#faf7f2] !p-0 !text-center !text-xl !font-extrabold !text-[#141210] !shadow-[inset_0_0_0_1px_#ece5db] outline-none focus:!shadow-[inset_0_0_0_2px_#e85d00] disabled:opacity-70 dark:!bg-neutral-800 dark:!text-white dark:!shadow-[inset_0_0_0_1px_#404040]" />
                                  ))}
                                </div>
                              )}
                              {codeVerifying ? <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-medium text-[#78716c]"><Loader2 size={14} className="animate-spin" />{copy.verifyingCode}</p> : null}
                              {phoneVerified ? <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#15803d]"><CheckCircle size={14} />{isFrench ? 'Numéro vérifié' : 'Number verified'}</p> : null}
                              {codeError ? <p className="mt-2.5 text-[12.5px] font-medium text-[#b91c1c]">{codeError}</p> : null}
                              {codeMessage && !phoneVerified ? <p className="mt-2.5 text-[12.5px] font-medium text-[#78716c]">{codeMessage}</p> : null}
                            </section>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {!providerAuth ? (
                            <>
                              <div className="space-y-[7px]">
                                <label htmlFor="register-password" className={labelClass}>{copy.password}</label>
                                <div className="relative">
                                  <input id="register-password" ref={passwordRef} type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={`${fieldClass} !pr-12`} placeholder={copy.passwordPlaceholder} value={form.password} onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))} required />
                                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center text-[#78716c] transition hover:text-[#141210]" aria-label={showPassword ? 'Masquer' : 'Afficher'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                </div>
                                <div className="flex items-center gap-2 pt-0.5">
                                  {[1, 2, 3, 4].map((segment) => <span key={segment} className={`h-[3px] flex-1 rounded-full ${passwordScore >= segment ? 'bg-[#e85d00]' : 'bg-[#e7dfd5] dark:bg-neutral-800'}`} />)}
                                  <span className="text-[12.5px] font-bold text-[#57534e] dark:text-neutral-300">{passwordStrengthLabel}</span>
                                </div>
                                <p className="text-[12.5px] font-medium text-[#78716c] dark:text-neutral-400">8 caractères, une majuscule, un chiffre. <span className="text-[#a8a29e]">Ajoutez un symbole pour « Fort ».</span></p>
                              </div>
                              <div className="space-y-[7px]">
                                <label htmlFor="register-confirm-password" className={labelClass}>{isFrench ? 'Confirmer' : 'Confirm'}</label>
                                <div className="relative">
                                  <input id="register-confirm-password" ref={confirmRef} type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" className={`${fieldClass} !pr-12`} placeholder={copy.confirmPasswordPlaceholder} value={form.confirmPassword} onChange={(event) => setForm((previous) => ({ ...previous, confirmPassword: event.target.value }))} required />
                                  <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center text-[#78716c] transition hover:text-[#141210]" aria-label={showConfirmPassword ? 'Masquer' : 'Afficher'}>{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                </div>
                              </div>
                            </>
                          ) : null}

                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-[7px]">
                              <label htmlFor="register-city" className={labelClass}>{copy.city}</label>
                              <div className="relative">
                                <select id="register-city" className={`${fieldClass} !appearance-none !pr-9`} value={form.city} onChange={(event) => setForm((previous) => ({ ...previous, city: event.target.value, commune: '' }))} required><option value="">{copy.chooseCity}</option>{cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}</select>
                                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#78716c]" />
                              </div>
                            </div>
                            <div className="space-y-[7px]">
                              <label htmlFor="register-commune" className={labelClass}>{copy.commune}</label>
                              <div className="relative">
                                <select id="register-commune" className={`${fieldClass} !appearance-none !pr-9 disabled:!text-[#a8a29e]`} value={form.commune} onChange={(event) => setForm((previous) => ({ ...previous, commune: event.target.value }))} required={availableCommunes.length > 0} disabled={!form.city || availableCommunes.length === 0}><option value="">{form.city ? copy.chooseCommune : copy.chooseCityFirst}</option>{availableCommunes.map((commune) => <option key={commune._id} value={commune.name}>{commune.name}</option>)}</select>
                                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#78716c]" />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-[7px]">
                            <label htmlFor="register-address" className={labelClass}>{copy.address}</label>
                            <textarea id="register-address" rows={2} className={`${fieldClass} !h-auto !min-h-[76px] !py-3`} placeholder={copy.addressPlaceholder} value={form.address} onChange={(event) => setForm((previous) => ({ ...previous, address: event.target.value }))} required />
                          </div>

                          <div className="space-y-[7px]">
                            <p className={labelClass}>{copy.gender}</p>
                            <div className="grid grid-cols-2 gap-2.5">
                              {[{ value: 'homme', label: copy.male }, { value: 'femme', label: copy.female }].map((option) => (
                                <label key={option.value} className={`flex min-h-[50px] cursor-pointer items-center justify-center rounded-[14px] text-sm font-semibold transition ${form.gender === option.value ? 'bg-[#e85d00] text-white' : 'bg-white text-[#57534e] ring-1 ring-inset ring-[#e7dfd5] dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-800'}`}><input type="radio" name="gender" value={option.value} checked={form.gender === option.value} onChange={(event) => setForm((previous) => ({ ...previous, gender: event.target.value }))} className="sr-only" />{option.label}</label>
                              ))}
                            </div>
                          </div>

                          {referralCode ? <p className="rounded-[14px] bg-white px-3.5 py-2.5 text-[12.5px] font-medium text-[#78716c] ring-1 ring-[#e7dfd5] dark:bg-neutral-900 dark:ring-neutral-800">Code de parrainage appliqué : <span className="font-bold text-[#141210] dark:text-white">{referralCode}</span></p> : null}

                          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] font-medium leading-[1.5] text-[#57534e] dark:text-neutral-300">
                            <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="peer sr-only" />
                            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-transparent ring-1 ring-inset ring-[#d8d0c4] transition peer-checked:bg-[#e85d00] peer-checked:text-white peer-checked:ring-[#e85d00] dark:bg-neutral-900 dark:ring-neutral-700"><Check size={14} strokeWidth={3} /></span>
                            <span>{copy.termsLead}{' '}<Link to="/conditions-utilisation" target="_blank" className="font-bold text-[#141210] underline dark:text-white">{copy.terms}</Link>{' '}{isFrench ? 'et la' : 'and the'}{' '}<Link to="/confidentialite" target="_blank" className="font-bold text-[#141210] underline dark:text-white">{copy.privacy}</Link>.</span>
                          </label>
                        </>
                      )}

                      {formError ? <div className="rounded-[14px] bg-[#fef2f2] px-4 py-3 text-sm font-semibold text-[#b91c1c] ring-1 ring-[#fecaca] dark:bg-red-500/10 dark:text-red-100 dark:ring-red-400/20">{formError}</div> : null}
                      {slowNetwork && loading ? <p className="text-[12.5px] font-medium text-amber-700 dark:text-amber-200">{copy.slowNetwork}</p> : null}
                    </form>
                  ) : hasRegistration ? (
                    <div role="status" className="mt-5 rounded-[14px] bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 ring-1 ring-blue-200">{isFrench ? 'Choisissez Google ou Apple pour créer votre compte.' : 'Choose Google or Apple to create your account.'}</div>
                  ) : (
                    <div role="status" className="mt-5 rounded-[14px] bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">{isFrench ? 'La création de compte est temporairement désactivée.' : 'Account creation is temporarily disabled.'}</div>
                  )}
                </div>
              </div>

              {(providerAuth || authAvailability.email.registration) ? (
                <footer className="sticky bottom-0 bg-[#f6f3ee] px-6 pb-6 pt-4 dark:bg-neutral-950 lg:px-12">
                  <div className="mx-auto max-w-[430px]">
                    {step === 1 ? (
                      <button type="button" onClick={goToStep2} disabled={!canGoToStep2} className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#e85d00] px-5 text-[17px] font-extrabold text-white transition hover:bg-[#f45f00] disabled:cursor-not-allowed disabled:opacity-55">{copy.continueStep2}</button>
                    ) : (
                      <button type="submit" form="register-form" disabled={!canSubmit} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#e85d00] px-5 text-[17px] font-extrabold text-white transition hover:bg-[#f45f00] disabled:cursor-not-allowed disabled:opacity-55">{loading ? <Loader2 size={18} className="animate-spin" /> : null}{loading ? copy.creatingAccount : copy.createAccount}</button>
                    )}
                    <p className="mt-3 text-center text-[13px] font-medium text-[#78716c]">{copy.haveAccount}{' '}<Link to="/login" className="font-bold text-[#b3480a] hover:text-[#e85d00]">{copy.signIn}</Link></p>
                  </div>
                </footer>
              ) : null}
            </>
          ) : (
            <div className="flex min-h-[100dvh] items-center justify-center p-6 lg:min-h-[700px]">
              <AuthSuccessCard variant="register" loading={loading || finalizing} title={copy.successTitle} description={copy.successDescription} statusText={copy.successStatus} actions={[{ key: 'go-dashboard', label: copy.goDashboard, primary: true, disabled: finalizing, onClick: () => completeRegistration(from) }, { key: 'complete-profile', label: copy.completeProfile, primary: false, disabled: finalizing, onClick: () => completeRegistration('/profile') }]} />
            </div>
          )}
        </section>
        <CommerceAuthPanel mode="register" />
      </div>
    </div>
  );
}
