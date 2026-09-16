import React from 'react';
import BaseModal from '../modals/BaseModal';

export default class StudioErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <BaseModal isOpen onClose={this.props.onClose} ariaLabel="Studio indisponible">
      <div className="space-y-4 p-6">
        <p role="alert">Le studio n’a pas pu se charger. Votre formulaire et vos photos sont conservés. Fermez puis réessayez.</p>
        <button type="button" onClick={this.props.onClose} className="min-h-11 rounded-full bg-gray-900 px-5 text-white">Fermer</button>
      </div>
    </BaseModal>;
  }
}
