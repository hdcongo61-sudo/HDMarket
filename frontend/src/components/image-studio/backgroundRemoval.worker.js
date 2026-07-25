import { pipeline, RawImage } from '@huggingface/transformers';

// Apache-2.0 licensed general-purpose (not portrait-only) segmentation model —
// safe for commercial use, unlike @imgly/background-removal (AGPL) or
// briaai/RMBG-1.4 (non-commercial without a paid license). Runs entirely on
// device: first call downloads ~44MB (quantized), cached by the browser for
// every call after that, including future sessions.
const MODEL_ID = 'onnx-community/ormbg-ONNX';

let segmenterPromise = null;

const getSegmenter = (onProgress) => {
  if (!segmenterPromise) {
    segmenterPromise = pipeline('background-removal', MODEL_ID, {
      dtype: 'q8',
      progress_callback: (data) => {
        if (data?.status === 'progress' && typeof data.progress === 'number') {
          onProgress?.(Math.round(data.progress));
        }
      }
    });
  }
  return segmenterPromise;
};

self.onmessage = async (event) => {
  const { id, blob } = event.data || {};
  if (!id || !blob) return;
  try {
    const segmenter = await getSegmenter((percent) => {
      self.postMessage({ id, status: 'downloading', percent });
    });
    self.postMessage({ id, status: 'processing' });
    const image = await RawImage.fromBlob(blob);
    const output = await segmenter(image);
    const resultBlob = await output[0].toBlob();
    self.postMessage({ id, status: 'done', blob: resultBlob });
  } catch (error) {
    self.postMessage({ id, status: 'error', error: error?.message || 'Le retrait du fond a échoué.' });
  }
};
