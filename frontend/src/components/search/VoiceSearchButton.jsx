import React, { useRef, useState } from 'react';
import { MicrophoneIcon } from '@heroicons/react/24/outline';

const isSupported = () =>
  typeof window !== 'undefined' &&
  Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

/**
 * Taobao-style voice search button. Uses the browser's built-in speech engine
 * (fr-FR) — zero network cost. Renders nothing when unsupported.
 */
export default function VoiceSearchButton({ onResult, className = '', label = 'Recherche vocale' }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const supported = isSupported();

  const stop = () => {
    setListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
  };

  const start = () => {
    if (listening) {
      stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      const text = String(transcript || '').trim();
      if (text) onResult(text);
      stop();
    };
    recognition.onerror = () => stop();
    recognition.onend = () => stop();
    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      stop();
    }
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={start}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${
        listening
          ? 'animate-pulse bg-red-50 text-red-600'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950'
      } ${className}`}
    >
      <MicrophoneIcon className="h-4 w-4" />
    </button>
  );
}
