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

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#fff4e8] px-4 py-10 text-slate-950 dark:bg-neutral-950 dark:text-white">
        <div className="mx-auto max-w-md rounded-[28px] bg-white p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.8)] ring-1 ring-orange-100 dark:bg-neutral-900 dark:ring-neutral-800">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#FF6A00]">
            HDMarket
          </p>
          <h1 className="mt-2 text-xl font-black">Actualisation nécessaire</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
            Nous avons besoin de recharger cette page pour rétablir l’affichage.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6A00] px-6 text-sm font-black text-white transition hover:bg-[#f45f00]"
            >
              Actualiser
            </button>
            <a
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#fff7ef] px-6 text-sm font-black text-slate-700 ring-1 ring-orange-100 transition hover:bg-orange-50 dark:bg-neutral-950 dark:text-slate-200 dark:ring-neutral-800"
            >
              Accueil
            </a>
          </div>
        </div>
      </div>
    );
  }
}
