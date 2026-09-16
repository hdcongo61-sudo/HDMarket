import React, { useEffect, useRef, useState } from 'react';
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor';
import Konva from 'konva';
import { preserveEditorResolution } from './editorResolution';
import BaseModal from '../modals/BaseModal';
import { editorOutputToFile } from './editorExport';
import translations from './editorTranslationsFr';
import { removeBackgroundLocally } from './backgroundRemoval';

export default function CompleteImageStudio({ image, sourceIndex, onSave, onClose }) {
  useEffect(() => preserveEditorResolution(Konva), []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [source, setSource] = useState(image?.url);
  const [removing, setRemoving] = useState(false);
  const [progress, setProgress] = useState(null);
  const [backgroundRemoved, setBackgroundRemoved] = useState(false);
  const beforeRemoval = useRef(null);
  const imageDataRef = useRef(null);
  const removalController = useRef(null);
  const objectUrls = useRef([]);
  useEffect(() => () => {
    removalController.current?.abort();
    objectUrls.current.forEach(url => URL.revokeObjectURL(url));
  }, []);
  const removeBackground = async () => {
    if (removalController.current || savingRef.current) return;
    const controller = new AbortController();
    removalController.current = controller;
    setRemoving(true);
    setProgress(null);
    setError('');
    try {
      if (!imageDataRef.current) throw new Error('Attendez le chargement de la photo.');
      // Export current edits, rather than silently reverting to the original upload.
      const { imageData } = imageDataRef.current({ extension: 'png', quality: 1 }, 1);
      const input = editorOutputToFile(imageData, image?.name);
      const result = await removeBackgroundLocally(input, { signal: controller.signal, onProgress: setProgress });
      if (controller.signal.aborted) return;
      const previousUrl = URL.createObjectURL(input);
      const nextUrl = URL.createObjectURL(result);
      objectUrls.current.push(previousUrl, nextUrl);
      beforeRemoval.current = previousUrl;
      setSource(nextUrl);
      setBackgroundRemoved(true);
      dirty.current = true;
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message || 'Impossible de retirer le fond. Réessayez.');
    } finally {
      if (removalController.current === controller) {
        removalController.current = null;
        setRemoving(false);
      }
    }
  };
  const dirty = useRef(false);
  const savingRef = useRef(false);
  const requestClose = (_reason, hasChanges) => {
    if (savingRef.current || removalController.current) return;
    if (hasChanges || dirty.current) setConfirmClose(true);
    else onClose();
  };
  const save = async (output) => {
    if (savingRef.current || removalController.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const file = editorOutputToFile(output, image?.name);
      await onSave({
        file, sourceIndex,
        state: { editor: 'filerobot', output: { type: file.type, width: output.width, height: output.height }, aiOperations: backgroundRemoved ? ['background-remove'] : [] }
      });
      dirty.current = false;
      onClose();
    } catch (err) {
      setError(err.message || 'Impossible d’enregistrer la photo.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <BaseModal isOpen fullscreen onClose={requestClose} closeOnBackdrop={false} closeOnEsc={!saving && !removing}
      ariaLabel="Studio photo" panelClassName="!max-w-none flex h-full min-h-0 flex-col bg-white text-gray-900">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div><h2 className="text-lg font-bold">Studio photo</h2><p className="text-xs text-gray-500">Gratuit · Vos retouches restent sur cet appareil jusqu’à l’enregistrement du produit.</p></div>
        <button type="button" onClick={() => requestClose()} disabled={saving || removing} className="min-h-11 rounded-full border px-4 text-sm font-semibold disabled:opacity-50">Fermer</button>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-gray-50 px-4 py-2">
        <button type="button" onClick={removeBackground} disabled={saving || removing || backgroundRemoved}
          className="min-h-11 rounded-full bg-[#e85d00] px-4 text-sm font-bold text-white disabled:opacity-50">
          {removing ? 'Détourage en cours…' : backgroundRemoved ? 'Fond retiré' : 'Retirer le fond · Gratuit'}
        </button>
        {removing && <button type="button" onClick={() => removalController.current?.abort()} className="min-h-11 rounded-full border px-4 text-sm">Annuler le détourage</button>}
        {backgroundRemoved && !removing && <button type="button" disabled={saving} onClick={() => {
          setSource(beforeRemoval.current);
          setBackgroundRemoved(false);
          dirty.current = true;
        }} className="min-h-11 rounded-full border px-4 text-sm">Revenir avant le détourage</button>}
        <p role="status" aria-live="polite" className="text-xs text-gray-600">
          {removing ? progress === null ? 'Analyse sur cet appareil…' : `Téléchargement du modèle : ${progress} %`
            : backgroundRemoved ? 'Fond transparent. Enregistrez en PNG ou WebP pour le conserver.'
              : 'Traitement sur votre appareil. Le premier usage télécharge le modèle ; cela peut prendre quelques minutes.'}
        </p>
      </div>
      {error && <p role="alert" className="shrink-0 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {saving && <p role="status" className="shrink-0 bg-orange-50 px-4 py-2 text-sm">Enregistrement de la photo…</p>}
      {confirmClose && <div role="alert" className="flex shrink-0 flex-wrap items-center gap-3 bg-amber-50 px-4 py-3 text-sm">
        <span>Quitter sans appliquer les retouches ?</span>
        <button type="button" onClick={() => setConfirmClose(false)} className="min-h-11 rounded-full border px-4">Continuer</button>
        <button type="button" onClick={onClose} className="min-h-11 rounded-full bg-gray-900 px-4 text-white">Abandonner</button>
      </div>}
      <div className={`min-h-0 flex-1 ${removing ? 'pointer-events-none opacity-60' : ''}`} inert={removing ? '' : undefined} style={{ isolation: 'isolate' }}>
        <FilerobotImageEditor key={source} source={source} getCurrentImgDataFnRef={imageDataRef} onSave={save} onClose={requestClose}
          onModify={() => { dirty.current = true; }} useBackendTranslations={false} translations={translations}
          defaultSavedImageName={(image?.name || 'produit').replace(/\.[^.]+$/, '')}
          observePluginContainerSize
          defaultSavedImageType={backgroundRemoved ? 'png' : 'webp'} defaultSavedImageQuality={1} savingPixelRatio={1} previewPixelRatio={1}
          tabsIds={[TABS.ADJUST, TABS.FINETUNE, TABS.FILTERS, TABS.ANNOTATE, TABS.RESIZE, TABS.WATERMARK]}
          defaultTabId={TABS.FINETUNE} defaultToolId={TOOLS.BRIGHTNESS}
          Text={{ text: 'Votre texte', fontFamily: 'Arial', fonts: ['Arial', 'Verdana', 'Georgia'] }}
          Crop={{ presetsItems: [{ titleKey: 'square', descriptionKey: '1:1', ratio: 1 }] }}
          annotationsCommon={{ fill: '#e85d00' }} Rotate={{ angle: 90, componentType: 'buttons' }}
        />
      </div>
    </BaseModal>
  );
}
