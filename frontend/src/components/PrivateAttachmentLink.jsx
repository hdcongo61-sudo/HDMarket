import React, { useState } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export default function PrivateAttachmentLink({ kind = 'disputes', file, children, className }) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const download = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/private-attachments/${kind}/${encodeURIComponent(file.filename)}`, {
        responseType: 'blob', skipCache: true
      });
      // Download rather than rendering untrusted documents in our origin.
      const url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = file.originalName || file.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      showToast('Impossible de télécharger cette pièce jointe. Vérifiez votre connexion et vos accès.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };
  return <button type="button" className={className} disabled={loading} onClick={download} aria-busy={loading}>
    {loading ? 'Téléchargement…' : children}
  </button>;
}
