import { test, expect } from '@playwright/test';

test('renders mute, replacement and mixed audio into playable individual files', async ({ page }) => {
  await page.route('**/audio-editor-test', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Audio test</body></html>' }));
  await page.goto('/audio-editor-test');
  const result = await page.evaluate(async () => {
    const { editVideoAudio } = await import('/src/services/videoAudioEditor.js');
    const canvas = document.createElement('canvas');
    canvas.width = 160; canvas.height = 120;
    const drawing = canvas.getContext('2d');
    drawing.fillStyle = 'red'; drawing.fillRect(0, 0, 160, 120);
    const context = new AudioContext();
    await context.resume();
    const destination = context.createMediaStreamDestination();
    const tone = context.createOscillator();
    tone.frequency.value = 440;
    tone.connect(destination); tone.start();
    const stream = canvas.captureStream(30);
    destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
    const recorder = new MediaRecorder(stream, { mimeType: 'video/mp4' });
    const chunks = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    await new Promise(resolve => {
      recorder.onstop = resolve; recorder.start();
      const draw = setInterval(() => drawing.fillRect(0, 0, 160, 120), 33);
      setTimeout(() => { clearInterval(draw); recorder.stop(); }, 1200);
    });
    tone.stop(); stream.getTracks().forEach(track => track.stop()); await context.close();
    const file = new File(chunks, 'original.mp4', { type: 'video/mp4' });
    // A short WAV tone also verifies that shorter replacement tracks loop.
    const samples = 8000, wav = new ArrayBuffer(44 + samples * 2), view = new DataView(wav);
    const text = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    text(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.sin(i / 16000 * Math.PI * 2 * 880) * 8000, true);
    const audioFile = new File([wav], 'music.wav', { type: 'audio/wav' });
    const results = [];
    for (const mode of ['mute', 'replace', 'mix']) {
      const output = await editVideoAudio(file, { mode, audioFile, originalVolume: 0.25, musicVolume: 0.5 });
      const video = document.createElement('video');
      video.muted = true;
      const url = URL.createObjectURL(output); video.src = url;
      await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = reject; });
      await video.play();
      const capture = video.captureStream();
      let originalTone = 0, addedTone = 0;
      if (mode !== 'mute') {
        const decoder = new AudioContext();
        const decoded = await decoder.decodeAudioData(await output.arrayBuffer());
        const data = decoded.getChannelData(0);
        const amplitude = frequency => {
          let sine = 0, cosine = 0;
          const start = Math.floor(decoded.sampleRate * 0.2), count = Math.floor(decoded.sampleRate * 0.2);
          for (let i = start; i < start + count; i++) {
            const angle = i / decoded.sampleRate * Math.PI * 2 * frequency;
            sine += data[i] * Math.sin(angle); cosine += data[i] * Math.cos(angle);
          }
          return Math.hypot(sine, cosine) * 2 / count;
        };
        originalTone = amplitude(440); addedTone = amplitude(880);
        await decoder.close();
      }
      results.push({ mode, size: output.size, width: video.videoWidth, audioTracks: capture.getAudioTracks().length, originalTone, addedTone });
      video.pause(); capture.getTracks().forEach(track => track.stop()); URL.revokeObjectURL(url);
    }
    const controller = new AbortController(); controller.abort();
    let cancelled = false;
    try { await editVideoAudio(file, { mode: 'mute', signal: controller.signal }); } catch (error) { cancelled = error.name === 'AbortError'; }
    return { results, cancelled };
  });
  expect(result.cancelled).toBe(true);
  for (const item of result.results) {
    expect(item.size).toBeGreaterThan(100);
    expect(item.width).toBe(160);
    expect(item.audioTracks).toBe(item.mode === 'mute' ? 0 : 1);
    if (item.mode !== 'mute') expect(item.addedTone).toBeGreaterThan(0.05);
    if (item.mode === 'replace') expect(item.originalTone).toBeLessThan(0.02);
    if (item.mode === 'mix') expect(item.originalTone).toBeGreaterThan(0.1);
  }
});
