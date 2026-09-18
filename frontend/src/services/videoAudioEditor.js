export const videoAudioMimeType = () => typeof MediaRecorder === 'undefined' ? '' :
  ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type)) || '';

// Render a new local file. The original and any resumable upload remain untouched.
export async function editVideoAudio(file, { mode, audioFile, originalVolume = 1, musicVolume = 0.5, signal, onProgress }) {
  const mimeType = videoAudioMimeType();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!mimeType || !AudioContextClass) throw new Error('Ce navigateur ne permet pas de modifier le son. Essayez Chrome ou Safari récent.');
  if (!['mute', 'replace', 'mix'].includes(mode)) throw new Error('Choisissez un mode audio.');
  if (mode !== 'mute' && !audioFile) throw new Error('Choisissez une musique ou un enregistrement.');
  const context = new AudioContextClass();
  const video = document.createElement('video');
  video.playsInline = true;
  const url = URL.createObjectURL(file);
  let stream, recorder, music, frame, timer;
  const abortError = () => new DOMException('Préparation annulée.', 'AbortError');
  const checkAbort = () => { if (signal?.aborted) throw abortError(); };
  try {
    // Resume during the user's button gesture, before asynchronous decoding.
    await context.resume();
    checkAbort();
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
    const destination = context.createMediaStreamDestination();
    const original = context.createMediaElementSource(video);
    const gain = context.createGain();
    gain.gain.value = mode === 'mix' ? Math.max(0, Math.min(1, originalVolume)) : 0;
    original.connect(gain).connect(destination);
    if (audioFile && mode !== 'mute') {
      if (audioFile.size > 20 * 1024 * 1024) throw new Error('Le fichier audio doit faire moins de 20 Mo.');
      music = context.createBufferSource();
      music.buffer = await context.decodeAudioData(await audioFile.arrayBuffer());
      music.loop = true;
      const musicGain = context.createGain();
      musicGain.gain.value = Math.max(0, Math.min(1, musicVolume));
      music.connect(musicGain).connect(destination);
    }
    checkAbort();
    drawing.drawImage(video, 0, 0, canvas.width, canvas.height);
    stream = canvas.captureStream(30);
    if (mode !== 'mute') destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 });
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
      video.play().then(() => { music?.start(); draw(); }).catch(fail);
    });
    checkAbort();
    const type = mimeType.split(';')[0];
    const result = new File(chunks, `${file.name.replace(/\.[^.]+$/, '')}-audio.${type === 'video/mp4' ? 'mp4' : 'webm'}`, { type });
    if (!result.size) throw new Error('La vidéo préparée est vide.');
    onProgress?.(100);
    return result;
  } finally {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    video.pause();
    if (recorder?.state === 'recording') recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    try { music?.stop(); } catch { /* May not have started. */ }
    await context.close();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
