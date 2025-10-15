import React, { useContext, useEffect, useState } from 'react';
import AuthContext from '../context/AuthContext';
import api from '../services/api';

const initialForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: ''
};

export default function Profile() {
  const { user, updateUser } = useContext(AuthContext);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || ''
    }));
  }, [user]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password && form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    setError('');
    setFeedback('');
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone
      };
      if (form.password) payload.password = form.password;
      const { data } = await api.put('/users/profile', payload);
      updateUser(data);
      setFeedback('Profil mis à jour avec succès.');
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto p-4">
        <p className="text-sm text-gray-500">Vous devez être connecté pour accéder à votre profil.</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>
        <p className="text-sm text-gray-500">Consultez et mettez à jour vos informations personnelles.</p>
      </header>

      <section className="border rounded-lg p-4 bg-white shadow-sm">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Nom complet
              <input
                className="mt-1 border rounded p-2"
                name="name"
                value={form.name}
                onChange={onChange}
                disabled={loading}
                required
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Adresse email
              <input
                className="mt-1 border rounded p-2"
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                disabled={loading}
                required
              />
            </label>
          </div>
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Téléphone
            <input
              className="mt-1 border rounded p-2"
              name="phone"
              value={form.phone}
              onChange={onChange}
              disabled={loading}
              required
            />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Nouveau mot de passe
              <input
                className="mt-1 border rounded p-2"
                type="password"
                name="password"
                value={form.password}
                onChange={onChange}
                disabled={loading}
                placeholder="Laisser vide pour conserver"
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Confirmer le mot de passe
              <input
                className="mt-1 border rounded p-2"
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={onChange}
                disabled={loading}
                placeholder="Confirmez le mot de passe"
              />
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {feedback && <p className="text-sm text-green-600">{feedback}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Enregistrement…' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
