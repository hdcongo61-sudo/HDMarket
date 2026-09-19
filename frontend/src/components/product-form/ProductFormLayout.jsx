import React from 'react';
import { ArrowLeftIcon, ArrowRightIcon, CameraIcon, CheckIcon, CheckCircleIcon, EyeIcon, PaperAirplaneIcon, PencilSquareIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { formatPriceWithStoredSettings } from '../../utils/priceFormatter';
import './product-form.css';

export const PRODUCT_FORM_STEPS = [
  { title: 'Le produit', short: 'Produit', description: 'Un titre précis, un prix clair et les détails qui comptent.' },
  { title: 'Photos & médias', short: 'Photos', description: 'Montrez votre produit sous son meilleur angle.' },
  { title: 'Options de vente', short: 'Vente', description: 'Adaptez votre offre aux besoins de vos acheteurs.' },
  { title: 'Dernier regard', short: 'Vérification', description: 'Vérifiez votre annonce et les frais avant de confirmer.' }
];

export function ProductFormNavigation({ activeStep, onStep, isEditing, hideHeader, disabled }) {
  return <header className="pf-header">
    {!hideHeader && <div className="pf-heading">
      <div><p className="pf-eyebrow">ESPACE VENDEUR</p><h1>{isEditing ? 'Donnez une nouvelle vie à votre annonce.' : 'Votre prochain client commence ici.'}</h1>
        <p>Présentez votre produit. Nous vous guidons pour la suite.</p></div>
      <span className="pf-heading-icon"><PencilSquareIcon /></span>
    </div>}
    <nav aria-label="Étapes de l’annonce" className="pf-steps">
      {PRODUCT_FORM_STEPS.map((step, index) => <button key={step.short} type="button" disabled={disabled}
        aria-current={activeStep === index ? 'step' : undefined} onClick={() => onStep(index)}
        className={`no-ui-btn pf-step ${activeStep === index ? 'is-active' : ''}`}>
        <span className="pf-step-number">{String(index + 1).padStart(2, '0')}</span>
        <span>{step.short}</span>
      </button>)}
    </nav>
  </header>;
}

export function ProductFormSummary({ form, image, photoCount, requiredFields, fee, isEditing, onStep }) {
  const checklist = [
    { label: 'Titre du produit', done: requiredFields.title, step: 0 },
    { label: 'Description', done: requiredFields.description, step: 0 },
    { label: 'Catégorie', done: requiredFields.category, step: 0 },
    { label: 'Prix de vente', done: requiredFields.price, step: 0 },
    { label: 'Photos', done: photoCount > 0, step: 1, recommended: true }
  ];
  return <aside className="pf-sidebar" aria-label="Résumé de l’annonce">
    <div className="pf-summary-card">
      <p className="pf-eyebrow"><EyeIcon /> VOTRE ANNONCE PREND FORME</p>
      <div className="pf-cover">
        {image ? <img src={image} alt="Photo principale de votre annonce" /> : <div><CameraIcon /><span>Votre produit, en image</span><button type="button" onClick={() => onStep(1)}>Ajouter des photos <ArrowRightIcon /></button></div>}
        {photoCount > 0 && <span className="pf-photo-count">{photoCount} photo{photoCount > 1 ? 's' : ''}</span>}
      </div>
      <div className="pf-preview-copy">
        <span className="pf-condition">{form.condition === 'new' ? 'Neuf' : 'Occasion'}</span>
        <h3>{form.title || 'Le titre de votre produit'}</h3>
        <p className="pf-preview-price">{Number(form.price) > 0 ? formatPriceWithStoredSettings(Number(form.price) * (1 - Number(form.discount || 0) / 100)) : 'Votre prix de vente'}</p>
      </div>
      <div className="pf-checklist"><h3>Les essentiels</h3>
        {checklist.map(item => <button type="button" key={item.label} onClick={() => onStep(item.step)}>
          <span className={`pf-check ${item.done ? 'is-done' : ''}`}>{item.done && <CheckIcon />}</span>
          <span>{item.label}</span>{item.recommended && <small>Conseillé</small>}
        </button>)}
      </div>
      <div className="pf-fee"><span>{isEditing ? 'Frais supplémentaires estimés' : 'Frais de publication estimés'}</span><strong>{formatPriceWithStoredSettings(fee)}</strong></div>
    </div>
    <p className="pf-sidebar-note"><ShieldCheckIcon />Vous pourrez tout vérifier avant de confirmer.</p>
  </aside>;
}

export function ProductFormActions({ activeStep, onStep, onContinue, loading, processing, isEditing, submitLabel, onCancel }) {
  const last = activeStep === PRODUCT_FORM_STEPS.length - 1;
  return <footer className="pf-actions">
    <div className="pf-action-status"><CheckCircleIcon /><span>{last ? 'Une dernière vérification' : `Étape ${activeStep + 1} sur ${PRODUCT_FORM_STEPS.length}`}</span></div>
    <div className="pf-action-buttons">
      {activeStep > 0 ? <button type="button" className="no-ui-btn pf-secondary" disabled={loading || processing} onClick={() => onStep(activeStep - 1)}><ArrowLeftIcon /> Retour</button>
        : onCancel && <button type="button" className="no-ui-btn pf-secondary" disabled={loading || processing} onClick={onCancel}>Fermer</button>}
      {last ? <button key="publish" type="submit" disabled={loading || processing} className="no-ui-btn pf-primary">
        {loading ? <span className="pf-spinner" /> : <PaperAirplaneIcon />}
        {loading ? (isEditing ? 'Enregistrement…' : 'Publication…') : processing ? 'Préparation des médias…' : submitLabel || (isEditing ? 'Enregistrer les modifications' : 'Publier mon annonce')}
      </button> : <button key="continue" type="button" disabled={loading || processing} onClick={onContinue} className="no-ui-btn pf-primary">{processing ? 'Préparation des médias…' : 'Continuer'}<ArrowRightIcon /></button>}
    </div>
  </footer>;
}
