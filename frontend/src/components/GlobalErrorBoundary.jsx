import React from 'react';

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
    return {
      hasError: true,
      errorMessage: String(error?.message || 'Une erreur inattendue est survenue.')
    };
  }

  componentDidCatch(error, errorInfo) {
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
      <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            HDMarket
          </p>
          <h1 className="mt-2 text-lg font-semibold">Une erreur est survenue</h1>
          <p className="mt-2 text-sm text-slate-600">
            L’interface a rencontré un problème. Veuillez réessayer.
          </p>
          {this.state.errorMessage ? (
            <p className="mt-2 text-xs text-slate-500 line-clamp-2">{this.state.errorMessage}</p>
          ) : null}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-900 px-6 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Réessayer
            </button>
            <a
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-200 px-6 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              Accueil
            </a>
          </div>
        </div>
      </div>
    );
  }
}

