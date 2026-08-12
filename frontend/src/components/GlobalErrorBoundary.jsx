import React from 'react';

const isIgnoredUiError = (error) =>
  /history\.replaceState\(\).*more than 100 times/i.test(String(error?.message || ''));

export default class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      requestId: ''
    };
  }

  static getDerivedStateFromError(error) {
    if (isIgnoredUiError(error)) {
      return null;
    }
    return {
      hasError: true,
      errorMessage: String(error?.message || 'Une erreur inattendue est survenue.')
    };
  }

  componentDidCatch(error, errorInfo) {
    if (isIgnoredUiError(error)) {
      return;
    }
    const payload = {
      message: String(error?.message || 'UNKNOWN_UI_ERROR'),
      stack: String(error?.stack || ''),
      componentStack: String(errorInfo?.componentStack || '')
    };
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('hdmarket:ui-error', {
          detail: payload
        })
      );
    }
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[GlobalErrorBoundary]', payload);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '', requestId: '' });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleHome = () => {
    if (typeof window === 'undefined') return;
    window.history.replaceState({}, '', '/');
    this.setState({ hasError: false, errorMessage: '', requestId: '' }, () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fff4e8] via-white to-amber-50 px-4 py-10 text-slate-950 dark:from-neutral-950 dark:via-neutral-950 dark:to-amber-950/20 dark:text-white">
        <div className="mx-auto max-w-md rounded-3xl bg-white/95 p-6 shadow-xl shadow-orange-950/10 ring-1 ring-gray-200 dark:bg-neutral-900/95 dark:ring-neutral-800">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#e85d00]">
            HDMarket
          </p>
          <div className="mt-3 text-4xl" aria-hidden="true">{offline ? '🛶' : '🛠️'}</div>
          <h1 className="mt-2 text-xl font-black">
            {offline ? 'Cette page attend le réseau' : 'Actualisation nécessaire'}
          </h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
            {offline
              ? 'Les pages déjà visitées restent disponibles. Revenez à l’accueil pour continuer avec le contenu enregistré.'
              : 'Nous avons besoin de recharger cette page pour rétablir l’affichage.'}
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={this.handleHome}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#e85d00] px-6 text-sm font-black text-white transition hover:bg-[#f45f00]"
            >
              Accueil
            </button>
            {!offline && (
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-gray-50 px-6 text-sm font-black text-slate-700 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:bg-neutral-950 dark:text-slate-200 dark:ring-neutral-800"
              >
                Actualiser
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
