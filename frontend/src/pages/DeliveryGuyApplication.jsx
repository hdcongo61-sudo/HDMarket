import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Bike,
  Camera,
  CheckCircle2,
  Clock3,
  FileBadge,
  Loader2,
  ShieldCheck,
  ShoppingBasket,
  UserRound
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import { useAppSettings } from '../context/AppSettingsContext';

const initialForm = {
  fullName: '',
  phone: '',
  phoneRegisteredInOwnName: false,
  identityType: 'national_id',
  identityNumber: '',
  vehicleType: 'motorcycle',
  vehicleBrand: '',
  vehicleModel: '',
  vehicleColor: '',
  plateNumber: '',
  vehicleOwnership: 'self',
  vehicleOwnerName: '',
  vehicleOwnerPhone: '',
  vehicleUseAuthorized: false,
  driverLicenseNumber: '',
  serviceCityId: '',
  serviceCommuneId: '',
  serviceCity: '',
  serviceCommune: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
  applicantNote: '',
  buyForMeOptIn: '',
  declarationsAccepted: false
};

const fieldClass =
  'mt-1.5 min-h-12 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm font-semibold text-neutral-900 outline-none transition focus:border-[#e85d00] focus:ring-2 focus:ring-[#e85d00]/15';

const statusMeta = {
  pending: {
    icon: Clock3,
    title: 'Candidature en vérification',
    message: 'Notre équipe contrôle votre identité, votre numéro et votre véhicule.',
    tone: 'border-amber-200 bg-amber-50 text-amber-900'
  },
  approved: {
    icon: CheckCircle2,
    title: 'Candidature approuvée',
    message: 'Votre accès livreur est activé. Reconnectez-vous si le mode livreur n’apparaît pas encore.',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-900'
  },
  rejected: {
    icon: ShieldCheck,
    title: 'Candidature à corriger',
    message: 'Consultez le motif ci-dessous, puis envoyez un nouveau dossier corrigé.',
    tone: 'border-red-200 bg-red-50 text-red-900'
  }
};

function FileField({ name, label, help, value, onChange, required = true }) {
  return (
    <label className="block rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-3 transition hover:border-orange-300 hover:bg-orange-50/40">
      <span className="flex items-center gap-2 text-sm font-black text-neutral-900">
        <Camera className="h-4 w-4 text-[#e85d00]" />
        {label}
      </span>
      <span className="mt-1 block text-xs leading-5 text-neutral-500">{help}</span>
      <span className={`mt-3 flex min-h-10 items-center justify-center rounded-xl px-3 text-xs font-black ${
        value ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-neutral-700 shadow-sm'
      }`}>
        {value ? `Sélectionné : ${value.name}` : 'Prendre ou choisir une photo'}
      </span>
      <input
        className="sr-only"
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
        capture="environment"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
        required={required}
      />
    </label>
  );
}

export default function DeliveryGuyApplication() {
  const { user } = useContext(AuthContext);
  const { cities = [], communes = [] } = useAppSettings();
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState({});
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requirements, setRequirements] = useState({ driverLicenseRequired: false });

  useEffect(() => {
    const matchedCity =
      cities.find((entry) => String(entry?._id || '') === String(user?.cityId || '')) ||
      cities.find((entry) => String(entry?.name || '').toLowerCase() === String(user?.city || user?.preferredCity || '').toLowerCase()) ||
      null;
    const matchedCommune =
      communes.find((entry) => String(entry?._id || '') === String(user?.communeId || '')) ||
      communes.find((entry) => String(entry?.name || '').toLowerCase() === String(user?.commune || '').toLowerCase()) ||
      null;
    setForm((previous) => ({
      ...previous,
      fullName: previous.fullName || user?.name || '',
      phone: previous.phone || user?.phone || '',
      serviceCityId: previous.serviceCityId || matchedCity?._id || '',
      serviceCommuneId: previous.serviceCommuneId || matchedCommune?._id || '',
      serviceCity: previous.serviceCity || matchedCity?.name || user?.city || user?.preferredCity || '',
      serviceCommune: previous.serviceCommune || matchedCommune?.name || user?.commune || ''
    }));
  }, [cities, communes, user]);

  const serviceCommunes = useMemo(
    () =>
      communes.filter(
        (entry) =>
          String(entry?.cityId?._id || entry?.cityId || '') === String(form.serviceCityId || '')
      ),
    [communes, form.serviceCityId]
  );

  useEffect(() => {
    api.get('/users/delivery-guy-application')
      .then(({ data }) => {
        setApplication(data?.application || null);
        setRequirements({
          driverLicenseRequired: Boolean(data?.requirements?.driverLicenseRequired)
        });
      })
      .catch(() => setApplication(null))
      .finally(() => setLoading(false));
  }, []);

  const applicationStatus = application?.status;
  const canSubmit = !['pending', 'approved'].includes(applicationStatus);
  const separateDriverLicenseRequired =
    requirements.driverLicenseRequired && form.identityType !== 'driver_license';
  const fileDefinitions = useMemo(() => [
    ['identityFront', 'Pièce d’identité — recto', 'Photo nette, entière et lisible.'],
    ['identityBack', 'Pièce d’identité — verso', 'Aucun reflet et aucun bord coupé.'],
    ['vehiclePhoto', 'Photo du véhicule', 'Photographiez la moto ou le véhicule en entier.'],
    ['platePhoto', 'Photo de la plaque', 'La plaque doit correspondre au numéro saisi.'],
    [
      'driverLicensePhoto',
      separateDriverLicenseRequired ? 'Photo du permis de conduire' : 'Photo du permis (optionnelle)',
      'Le nom et le numéro doivent être lisibles.',
      separateDriverLicenseRequired
    ]
  ], [separateDriverLicenseRequired]);

  const setValue = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const missingFile = fileDefinitions.find(([key, , , required = true]) => required && !files[key]);
    if (missingFile) {
      setError(`Ajoutez : ${missingFile[1]}.`);
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, String(value)));
      Object.entries(files).forEach(([key, file]) => body.append(key, file));
      const { data } = await api.post('/users/delivery-guy-application', body, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setApplication(data?.application || null);
      setSuccess(data?.message || 'Candidature envoyée.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Impossible d’envoyer la candidature.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="grid min-h-[60vh] place-items-center bg-[#f7f6f3]">
        <Loader2 className="h-8 w-8 animate-spin text-[#e85d00]" />
      </main>
    );
  }

  const meta = statusMeta[applicationStatus];
  const StatusIcon = meta?.icon;

  return (
    <main className="min-h-screen bg-[#f7f6f3] pb-24 text-neutral-950">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <section className="overflow-hidden rounded-3xl bg-neutral-950 p-5 text-white shadow-sm sm:p-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">
            <Bike className="h-4 w-4 text-orange-400" />
            HDMarket Delivery
          </span>
          <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">Devenir livreur</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-300">
            Envoyez un dossier vérifiable. Les informations doivent appartenir à la même personne pour protéger les clients et vos paiements.
          </p>
          <div className="mt-5 grid gap-2 text-xs font-bold text-neutral-200 sm:grid-cols-3">
            <span className="rounded-xl bg-white/5 px-3 py-2">1. Identité vérifiée</span>
            <span className="rounded-xl bg-white/5 px-3 py-2">2. Véhicule contrôlé</span>
            <span className="rounded-xl bg-white/5 px-3 py-2">3. Validation HDMarket</span>
          </div>
        </section>

        {meta ? (
          <section className={`mt-4 rounded-2xl border p-4 ${meta.tone}`}>
            <div className="flex gap-3">
              <StatusIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h2 className="font-black">{meta.title}</h2>
                <p className="mt-1 text-sm">{meta.message}</p>
                {application.reviewNote ? (
                  <p className="mt-2 rounded-xl bg-white/60 px-3 py-2 text-sm font-bold">
                    Motif : {application.reviewNote}
                  </p>
                ) : null}
                {applicationStatus === 'approved' ? (
                  <Link to="/delivery/dashboard" className="mt-3 inline-flex rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white">
                    Ouvrir l’espace livreur
                  </Link>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {success ? <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{success}</p> : null}
        {error ? <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p> : null}

        {canSubmit ? (
          <form onSubmit={submit} className="mt-5 space-y-4" lang="fr" spellCheck="true">
            <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <UserRound className="h-5 w-5 text-[#e85d00]" />
                <div>
                  <h2 className="font-black">Identité et numéro</h2>
                  <p className="text-xs text-neutral-500">Toutes les informations doivent être au nom du candidat.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-neutral-600">
                  Nom complet
                  <input className={fieldClass} value={form.fullName} onChange={(e) => setValue('fullName', e.target.value)} required />
                </label>
                <label className="text-xs font-bold text-neutral-600">
                  Numéro Mobile Money
                  <input className={fieldClass} type="tel" inputMode="tel" value={form.phone} onChange={(e) => setValue('phone', e.target.value)} required />
                </label>
                <label className="text-xs font-bold text-neutral-600">
                  Type de pièce
                  <select className={fieldClass} value={form.identityType} onChange={(e) => setValue('identityType', e.target.value)}>
                    <option value="national_id">Carte nationale d’identité</option>
                    <option value="passport">Passeport</option>
                    <option value="driver_license">Permis de conduire</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-neutral-600">
                  Numéro de la pièce
                  <input className={fieldClass} value={form.identityNumber} onChange={(e) => setValue('identityNumber', e.target.value)} required />
                </label>
              </div>
              <label className="mt-4 flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-950">
                <input className="mt-1 h-4 w-4 accent-[#e85d00]" type="checkbox" checked={form.phoneRegisteredInOwnName} onChange={(e) => setValue('phoneRegisteredInOwnName', e.target.checked)} required />
                Je confirme que ce numéro et le compte Mobile Money associé sont enregistrés à mon propre nom.
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {fileDefinitions.slice(0, 2).map(([key, label, help]) => (
                  <FileField key={key} name={key} label={label} help={help} value={files[key]} onChange={(file) => setFiles((previous) => ({ ...previous, [key]: file }))} />
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <Bike className="h-5 w-5 text-[#e85d00]" />
                <div>
                  <h2 className="font-black">Véhicule et plaque</h2>
                  <p className="text-xs text-neutral-500">Le véhicule présenté sera celui utilisé pour les courses.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-neutral-600">Type
                  <select className={fieldClass} value={form.vehicleType} onChange={(e) => setValue('vehicleType', e.target.value)}>
                    <option value="motorcycle">Moto</option><option value="bike">Vélo</option>
                    <option value="car">Voiture</option><option value="van">Fourgonnette</option><option value="other">Autre</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-neutral-600">Marque
                  <input className={fieldClass} value={form.vehicleBrand} onChange={(e) => setValue('vehicleBrand', e.target.value)} placeholder="Ex : Honda" required />
                </label>
                <label className="text-xs font-bold text-neutral-600">Modèle
                  <input className={fieldClass} value={form.vehicleModel} onChange={(e) => setValue('vehicleModel', e.target.value)} placeholder="Optionnel" />
                </label>
                <label className="text-xs font-bold text-neutral-600">Couleur
                  <input className={fieldClass} value={form.vehicleColor} onChange={(e) => setValue('vehicleColor', e.target.value)} required />
                </label>
                <label className="text-xs font-bold text-neutral-600">Numéro de plaque
                  <input className={`${fieldClass} uppercase`} value={form.plateNumber} onChange={(e) => setValue('plateNumber', e.target.value.toUpperCase())} required />
                </label>
                <label className="text-xs font-bold text-neutral-600">Ville de service
                  <select
                    className={fieldClass}
                    value={form.serviceCityId}
                    onChange={(e) => {
                      const selected = cities.find((entry) => String(entry?._id) === e.target.value);
                      setForm((previous) => ({
                        ...previous,
                        serviceCityId: e.target.value,
                        serviceCity: selected?.name || '',
                        serviceCommuneId: '',
                        serviceCommune: ''
                      }));
                    }}
                    required
                  >
                    <option value="">Choisir une ville</option>
                    {cities.map((entry) => <option key={entry._id} value={entry._id}>{entry.name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-neutral-600">Commune de service
                  <select
                    className={fieldClass}
                    value={form.serviceCommuneId}
                    onChange={(e) => {
                      const selected = serviceCommunes.find((entry) => String(entry?._id) === e.target.value);
                      setForm((previous) => ({
                        ...previous,
                        serviceCommuneId: e.target.value,
                        serviceCommune: selected?.name || ''
                      }));
                    }}
                    disabled={!form.serviceCityId || serviceCommunes.length === 0}
                    required={serviceCommunes.length > 0}
                  >
                    <option value="">Choisir une commune</option>
                    {serviceCommunes.map((entry) => <option key={entry._id} value={entry._id}>{entry.name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-neutral-600 sm:col-span-2">
                  Propriétaire du véhicule
                  <select
                    className={fieldClass}
                    value={form.vehicleOwnership}
                    onChange={(e) => setValue('vehicleOwnership', e.target.value)}
                    required
                  >
                    <option value="self">Je suis le propriétaire</option>
                    <option value="family">Véhicule d’un membre de la famille</option>
                    <option value="borrowed">Véhicule prêté</option>
                    <option value="rented">Véhicule loué</option>
                    <option value="employer">Véhicule d’un employeur</option>
                    <option value="other">Autre propriétaire</option>
                  </select>
                </label>
                {form.vehicleOwnership !== 'self' ? (
                  <>
                    <label className="text-xs font-bold text-neutral-600">
                      Nom complet du propriétaire
                      <input className={fieldClass} value={form.vehicleOwnerName} onChange={(e) => setValue('vehicleOwnerName', e.target.value)} required />
                    </label>
                    <label className="text-xs font-bold text-neutral-600">
                      Téléphone du propriétaire
                      <input className={fieldClass} type="tel" value={form.vehicleOwnerPhone} onChange={(e) => setValue('vehicleOwnerPhone', e.target.value)} required />
                    </label>
                    <label className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-950 sm:col-span-2">
                      <input
                        className="mt-1 h-4 w-4 accent-[#e85d00]"
                        type="checkbox"
                        checked={form.vehicleUseAuthorized}
                        onChange={(e) => setValue('vehicleUseAuthorized', e.target.checked)}
                        required
                      />
                      Je confirme que le propriétaire m’autorise à utiliser ce véhicule pour effectuer des livraisons HDMarket.
                    </label>
                  </>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {fileDefinitions.slice(2, 4).map(([key, label, help]) => (
                  <FileField key={key} name={key} label={label} help={help} value={files[key]} onChange={(file) => setFiles((previous) => ({ ...previous, [key]: file }))} />
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <FileBadge className="h-5 w-5 text-[#e85d00]" />
                <h2 className="font-black">Permis et sécurité</h2>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-neutral-600">
                  Numéro du permis{separateDriverLicenseRequired ? '' : ' (optionnel)'}
                  <input
                    className={fieldClass}
                    value={form.driverLicenseNumber}
                    onChange={(e) => setValue('driverLicenseNumber', e.target.value)}
                    required={separateDriverLicenseRequired}
                  />
                </label>
                <div className="sm:row-span-2">
                  {fileDefinitions.slice(4).map(([key, label, help, required]) => (
                    <FileField
                      key={key}
                      name={key}
                      label={label}
                      help={help}
                      value={files[key]}
                      required={required}
                      onChange={(file) => setFiles((previous) => ({ ...previous, [key]: file }))}
                    />
                  ))}
                </div>
                {form.identityType === 'driver_license' ? (
                  <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 sm:col-span-2">
                    Le permis choisi comme pièce d’identité sera également utilisé comme justificatif de conduite.
                  </p>
                ) : null}
                <label className="text-xs font-bold text-neutral-600">Contact d’urgence
                  <input className={fieldClass} value={form.emergencyContactName} onChange={(e) => setValue('emergencyContactName', e.target.value)} placeholder="Nom complet" required />
                </label>
                <label className="text-xs font-bold text-neutral-600">Téléphone du contact
                  <input className={fieldClass} type="tel" value={form.emergencyContactPhone} onChange={(e) => setValue('emergencyContactPhone', e.target.value)} required />
                </label>
                <label className="text-xs font-bold text-neutral-600">Lien de parenté
                  <select
                    className={fieldClass}
                    value={form.emergencyContactRelationship}
                    onChange={(e) => setValue('emergencyContactRelationship', e.target.value)}
                    required
                  >
                    <option value="">Sélectionner</option>
                    <option value="Père">Père</option>
                    <option value="Mère">Mère</option>
                    <option value="Conjoint(e)">Conjoint(e)</option>
                    <option value="Frère">Frère</option>
                    <option value="Sœur">Sœur</option>
                    <option value="Oncle">Oncle</option>
                    <option value="Tante">Tante</option>
                    <option value="Autre membre de la famille">Autre membre de la famille</option>
                    <option value="Personne de confiance">Personne de confiance</option>
                  </select>
                </label>
                <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 sm:col-span-2">
                  Si ce numéro appartient à un compte HDMarket, ce compte sera automatiquement lié comme contact d’urgence du livreur.
                </p>
                <label className="text-xs font-bold text-neutral-600 sm:col-span-2">Information complémentaire
                  <textarea className={`${fieldClass} min-h-24 py-3`} value={form.applicantNote} onChange={(e) => setValue('applicantNote', e.target.value)} placeholder="Disponibilités, zones connues, expérience…" />
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                  <ShoppingBasket className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-black">Missions « Acheter pour moi »</h2>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    Ces missions demandent d’acheter les articles du client, de vérifier leur disponibilité, d’ajouter le reçu du magasin puis de les livrer.
                  </p>
                </div>
              </div>
              <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
                <legend className="sr-only">Accepter les missions Acheter pour moi</legend>
                <label className={`cursor-pointer rounded-2xl border p-4 transition ${
                  form.buyForMeOptIn === 'true'
                    ? 'border-violet-500 bg-violet-50 text-violet-950 ring-2 ring-violet-100'
                    : 'border-neutral-200 text-neutral-700'
                }`}>
                  <span className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="buyForMeOptIn"
                      value="true"
                      checked={form.buyForMeOptIn === 'true'}
                      onChange={(event) => setValue('buyForMeOptIn', event.target.value)}
                      className="mt-1 h-4 w-4 accent-violet-600"
                      required
                    />
                    <span>
                      <span className="block text-sm font-black">Oui, j’accepte</span>
                      <span className="mt-1 block text-xs leading-5">L’onglet Achats et les demandes disponibles seront visibles.</span>
                    </span>
                  </span>
                </label>
                <label className={`cursor-pointer rounded-2xl border p-4 transition ${
                  form.buyForMeOptIn === 'false'
                    ? 'border-neutral-500 bg-neutral-50 text-neutral-950 ring-2 ring-neutral-100'
                    : 'border-neutral-200 text-neutral-700'
                }`}>
                  <span className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="buyForMeOptIn"
                      value="false"
                      checked={form.buyForMeOptIn === 'false'}
                      onChange={(event) => setValue('buyForMeOptIn', event.target.value)}
                      className="mt-1 h-4 w-4 accent-neutral-700"
                      required
                    />
                    <span>
                      <span className="block text-sm font-black">Non, livraisons seulement</span>
                      <span className="mt-1 block text-xs leading-5">Vous ne verrez aucune demande « Acheter pour moi ».</span>
                    </span>
                  </span>
                </label>
              </fieldset>
              <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                Ce choix n’empêche pas l’accès aux livraisons et aux colis ordinaires.
              </p>
            </section>

            <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm font-semibold">
              <input className="mt-1 h-4 w-4 accent-[#e85d00]" type="checkbox" checked={form.declarationsAccepted} onChange={(e) => setValue('declarationsAccepted', e.target.checked)} required />
              Je certifie que les documents sont authentiques, que le véhicule m’appartient ou que je suis autorisé à l’utiliser, et j’accepte leur vérification par HDMarket.
            </label>
            <button disabled={submitting} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#e85d00] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#ff6a00] disabled:opacity-60">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <BadgeCheck className="h-5 w-5" />}
              {submitting ? 'Envoi sécurisé…' : 'Envoyer ma candidature'}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
