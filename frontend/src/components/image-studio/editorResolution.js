// Filerobot renders its image node at preview dimensions. Its save routine
// caches that node before scaling it back up, so the cache must retain the
// source pixels; increasing the final canvas size alone cannot restore detail.
export function sourceCacheRatio(node, requestedRatio = 1) {
  const image = node.image();
  const width = image?.naturalWidth || image?.width;
  const height = image?.naturalHeight || image?.height;
  return Math.max(requestedRatio || 1, width / node.width() || 1, height / node.height() || 1);
}

export function preserveEditorResolution(Konva) {
  const original = Konva.Image.prototype.cache;
  function cache(config = {}) {
    if (this.id() === 'FIE_original-image') {
      return original.call(this, { ...config, pixelRatio: sourceCacheRatio(this, config.pixelRatio) });
    }
    return original.call(this, config);
  }
  Konva.Image.prototype.cache = cache;
  return () => {
    if (Konva.Image.prototype.cache === cache) Konva.Image.prototype.cache = original;
  };
}
