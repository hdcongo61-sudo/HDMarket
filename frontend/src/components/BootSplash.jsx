import React, { useEffect, useRef, useState } from 'react';

/**
 * Animated launch screen that always uses the current admin-managed brand logo.
 * When the remote logo has not loaded yet, a neutral wordmark is shown instead
 * of falling back to an obsolete bundled mark.
 */
export default function BootSplash({
  logoSrc = '',
  label = 'HDMarket',
  onDone,
  minDuration = 2400,
  waitUntil = false
}) {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const elapsed = useRef(false);
  const blocking = useRef(waitUntil);
  const completed = useRef(false);
  const resolvedLogo = normalizeLogoSource(logoSrc);

  useEffect(() => {
    blocking.current = waitUntil;
    if (elapsed.current && !blocking.current) setLeaving(true);
  }, [waitUntil]);

  useEffect(() => {
    const timer = setTimeout(() => {
      elapsed.current = true;
      if (!blocking.current) setLeaving(true);
    }, minDuration);
    return () => clearTimeout(timer);
  }, [minDuration]);

  const handleTransitionEnd = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'opacity') return;
    if (!leaving || completed.current) return;
    completed.current = true;
    setGone(true);
    onDone?.();
  };

  if (gone) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
      <div
        className={`hdsplash${leaving ? ' is-leaving' : ''}`}
        onTransitionEnd={handleTransitionEnd}
        role="status"
        aria-label={`Chargement de ${label}`}
      >
        <div className="hdsplash-glow hdsplash-glow-one" />
        <div className="hdsplash-glow hdsplash-glow-two" />

        <div className="hdsplash-brand">
          {resolvedLogo ? (
            <img className="hdsplash-logo" src={resolvedLogo} alt={label} />
          ) : (
            <span className="hdsplash-wordmark">{label}</span>
          )}
        </div>

        <div className="hdsplash-progress" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </>
  );
}

const normalizeLogoSource = (value) => {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  return String(value.secure_url || value.url || value.src || '').trim();
};

const SPLASH_CSS = `
.hdsplash{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fffaf6;font-family:system-ui,-apple-system,sans-serif;transition:opacity .42s ease,visibility .42s ease}
.hdsplash.is-leaving{opacity:0;visibility:hidden}
.hdsplash-glow{position:absolute;border-radius:999px;pointer-events:none;background:rgba(232,93,0,.1);filter:blur(1px)}
.hdsplash-glow-one{width:48vw;height:48vw;left:-15vw;top:-12vw;animation:hdsplash-float 7s ease-in-out infinite}
.hdsplash-glow-two{width:58vw;height:58vw;right:-22vw;bottom:-20vw;animation:hdsplash-float 9s ease-in-out reverse infinite}
.hdsplash-brand{position:relative;z-index:1;display:flex;min-height:150px;min-width:220px;align-items:center;justify-content:center;animation:hdsplash-enter .62s cubic-bezier(.2,.8,.25,1) both}
.hdsplash-logo{display:block;width:min(72vw,430px);max-height:42vh;object-fit:contain;filter:drop-shadow(0 16px 30px rgba(75,42,16,.12))}
.hdsplash-wordmark{font-size:clamp(2rem,8vw,4.25rem);font-weight:900;letter-spacing:-.055em;color:#e85d00}
.hdsplash-progress{position:absolute;bottom:max(8vh,48px);display:flex;gap:9px}
.hdsplash-progress span{width:8px;height:8px;border-radius:999px;background:#e85d00;animation:hdsplash-dot 1s ease-in-out infinite}
.hdsplash-progress span:nth-child(2){animation-delay:.15s}.hdsplash-progress span:nth-child(3){animation-delay:.3s}
@keyframes hdsplash-enter{from{opacity:0;transform:translateY(24px) scale(.92)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes hdsplash-dot{0%,80%,100%{opacity:.28;transform:translateY(0)}40%{opacity:1;transform:translateY(-8px)}}
@keyframes hdsplash-float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(24px) scale(1.05)}}
@media(max-width:767px){.hdsplash-logo{width:min(66vw,280px);max-height:50vh}}
@media(prefers-reduced-motion:reduce){.hdsplash *{animation:none!important}}
`;
