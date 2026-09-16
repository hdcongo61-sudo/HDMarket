const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

// Use the encoded output so the editor's chosen format and quality are preserved.
export const editorOutputToFile = (output, fallbackName = 'produit') => {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(output?.imageBase64 || '');
  if (!match || !TYPES.has(match[1])) throw new Error('Impossible de lire l’image retouchée. Réessayez.');
  const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0));
  if (!bytes.length) throw new Error('L’image retouchée est vide.');
  if (bytes.length > 10 * 1024 * 1024) throw new Error('Image trop volumineuse. Réduisez ses dimensions ou choisissez WEBP.');
  const extension = match[1] === 'image/jpeg' ? 'jpg' : match[1].split('/')[1];
  const name = String(output.fullName || output.name || fallbackName).replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_ -]/gu, '').trim() || 'produit';
  return new File([bytes], `${name}-retouche.${extension}`, { type: match[1], lastModified: Date.now() });
};
