export const videoAudioMimeType = () => typeof MediaRecorder === 'undefined' ? '' :
  ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type)) || '';

// Render a new local file. The original and any resumable upload remain untouched.
export async function muteVideo(file, { signal, onProgress } = {}) {
  const abortError = () => new DOMException('Préparation annulée.', 'AbortError');
  const checkAbort = () => { if (signal?.aborted) throw abortError(); };
  checkAbort();
  const mimeType = videoAudioMimeType();
  if (!mimeType) throw new Error('Ce navigateur ne permet pas de couper le son. Essayez Chrome ou Safari récent.');
  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  const url = URL.createObjectURL(file);
  let stream, recorder, frame, timer;
  try {
    await new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); video.onloadeddata = null; video.onerror = null; };
      const abort = () => { cleanup(); reject(abortError()); };
      video.onloadeddata = () => { cleanup(); resolve(); };
      video.onerror = () => { cleanup(); reject(new Error('Cette vidéo est illisible.')); };
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => { cleanup(); reject(new Error('La vidéo ne peut pas être chargée.')); }, 20000);
      video.src = url;
      video.load();
    });
    checkAbort();
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('Durée vidéo indisponible.');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale / 2) * 2);
    canvas.height = Math.max(2, Math.round(video.videoHeight * scale / 2) * 2);
    const drawing = canvas.getContext('2d');
    if (!drawing || !canvas.captureStream) throw new Error('La modification vidéo est indisponible sur ce navigateur.');
    checkAbort();
    drawing.drawImage(video, 0, 0, canvas.width, canvas.height);
    stream = canvas.captureStream(30);
    // Capture only the canvas video track: the output contains no audio.
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
    const chunks = [];
    await new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); video.onended = null; video.onerror = null; };
      const fail = error => { cleanup(); reject(error); };
      const abort = () => fail(abortError());
      signal?.addEventListener('abort', abort, { once: true });
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => fail(new Error('La préparation audio a échoué.'));
      recorder.onstop = () => { cleanup(); resolve(); };
      video.onerror = () => fail(new Error('Lecture vidéo interrompue.'));
      video.onended = () => { if (recorder.state !== 'inactive') recorder.stop(); };
      timer = setTimeout(() => fail(new Error('Préparation interrompue. Gardez cet onglet visible et réessayez.')), (video.duration + 30) * 1000);
      const draw = () => {
        drawing.drawImage(video, 0, 0, canvas.width, canvas.height);
        onProgress?.(Math.min(99, Math.round(video.currentTime / video.duration * 100)));
        frame = requestAnimationFrame(draw);
      };
      recorder.start(250);
      video.play().then(() => { if (!signal?.aborted) draw(); }).catch(fail);
    });
    checkAbort();
    const type = mimeType.split(';')[0];
    const result = new File(chunks, `${file.name.replace(/\.[^.]+$/, '')}-sans-son.${type === 'video/mp4' ? 'mp4' : 'webm'}`, { type });
    if (!result.size) throw new Error('La vidéo préparée est vide.');
    onProgress?.(100);
    return result;
  } finally {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    video.pause();
    if (recorder?.state === 'recording') recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
